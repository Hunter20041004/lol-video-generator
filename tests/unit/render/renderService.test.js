const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const { renderVideosFromRequest } = require(path.join(ROOT, "utils/render/renderService"));
const {
  RENDER_ASSET_FALLBACK_PUBLIC_PATH,
  localizeRemoteImageAssets,
} = require(path.join(ROOT, "utils/render/remoteAssetCache"));

async function withTempProject(fn) {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-render-service-"));
  fs.mkdirSync(path.join(dir, "public", "renders"), { recursive: true });
  process.chdir(dir);
  try {
    await fn(dir);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("renderVideosFromRequest renders bilingual payloads without HTTP self-fetch", async () => {
  await withTempProject(async (dir) => {
    const commands = [];
    const result = await renderVideosFromRequest({
      dataType: "SYSTEM_UPDATE",
      targetName: "Teleport",
      renderLanguages: ["zh", "en"],
      localizedPayloads: {
        zh: {
          dataType: "SYSTEM_UPDATE",
          targetType: "SYSTEM",
          targetName: "Teleport",
          headline: "Teleport adjust",
          changeDesc: "Cooldown adjusted.",
          storyboard: [{ text: "Teleport timing changed", tag: "HOOK" }],
        },
        en: {
          dataType: "SYSTEM_UPDATE",
          targetType: "SYSTEM",
          targetName: "Teleport",
          headline: "Teleport adjust",
          changeDesc: "Cooldown adjusted.",
          storyboard: [{ text: "Teleport timing changed", tag: "HOOK" }],
        },
      },
    }, {
      timestamp: 12345,
      sharedBgmFile: "audio/bgm1.mp3",
      execRenderImpl: async (executable, args, options) => {
        commands.push({ executable, args, options });
        return null;
      },
    });

    assert.equal(result.success, true);
    assert.deepEqual(result.videos.map((video) => video.videoUrl), [
      "/renders/render_12345_zh.mp4",
      "/renders/render_12345_en.mp4",
    ]);
    assert.equal(commands.length, 2);
    assert.equal(commands[0].executable, "npx");
    assert.ok(commands[0].args.includes("LeaguePatchVideo"));
    assert.ok(commands[0].args.includes("--timeout=120000"));
    assert.ok(commands[0].args.includes("--video-bitrate=8M"));
    assert.equal(commands[0].options.shell, false);
    assert.equal(fs.readdirSync(path.join(dir, "public", "renders")).filter((file) => file.startsWith("props_")).length, 0);
  });
});

test("renderVideosFromRequest ignores injected composition ids and launches without a shell", async () => {
  await withTempProject(async () => {
    const calls = [];

    await renderVideosFromRequest({
      dataType: "SYSTEM_UPDATE",
      compositionId: "LeaguePatchVideo; touch /tmp/pwned",
      targetName: "Teleport",
      headline: "Teleport adjust",
      changeDesc: "Cooldown adjusted.",
      storyboard: [{ text: "Teleport timing changed", tag: "HOOK" }],
    }, {
      timestamp: 12346,
      execRenderImpl: async (executable, args, options) => {
        calls.push({ executable, args, options });
        return null;
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].executable, "npx");
    assert.ok(calls[0].args.includes("LeaguePatchVideo"));
    assert.equal(calls[0].args.join(" ").includes("touch /tmp/pwned"), false);
    assert.equal(calls[0].options.shell, false);
  });
});

test("renderVideosFromRequest routes esports daily payloads to dedicated compositions", async () => {
  await withTempProject(async () => {
    const commands = [];
    const result = await renderVideosFromRequest({
      dataType: "ESPORTS_MATCH_RECAP",
      locale: "en",
      title: "T1 vs GEN Match Recap",
      match: { league: "LCK", teams: ["T1", "GEN"], score: "2-0" },
      recapPoints: [
        { id: "series-result", summary: "T1 won 2-0" },
        { id: "team-damage-gap", summary: "T1 led team damage" },
        { id: "team-gold-gap", summary: "T1 led gold" },
      ],
      storyboard: [{ text: "T1 vs GEN\nwhy it mattered", tag: "HOOK" }],
    }, {
      timestamp: 777,
      execRenderImpl: async (executable, args, options) => {
        commands.push({ executable, args, options });
        return null;
      },
    });

    assert.equal(result.success, true);
    assert.equal(commands.length, 1);
    assert.ok(commands[0].args.includes("EsportsMatchRecapVideo"));
  });
});

test("localizeRemoteImageAssets caches remote render images before Remotion runs", async () => {
  await withTempProject(async (dir) => {
    const fetched = [];
    const fakeFetch = async (url) => {
      fetched.push(url);
      return {
        ok: true,
        arrayBuffer: async () => Buffer.from(`image:${url}`),
      };
    };

    const result = await localizeRemoteImageAssets({
      dataType: "PATCH",
      championName: "Lee Sin",
      splashUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/LeeSin_0.jpg",
      skillIcons: {
        BASE: "https://ddragon.leagueoflegends.com/cdn/16.12.1/img/item/1037.png",
        Q: "https://ddragon.leagueoflegends.com/cdn/16.12.1/img/spell/LeeSinQOne.png",
      },
      storyboard: [
        {
          tag: "SKILL_SHOWCASE",
          iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.12.1/img/spell/LeeSinQOne.png",
        },
      ],
    }, {
      cwd: dir,
      fetchImpl: fakeFetch,
    });

    assert.match(result.splashUrl, /^\/render-assets\/[a-f0-9]{24}\.jpg$/);
    assert.match(result.heroIconUrl, /^\/render-assets\/[a-f0-9]{24}\.png$/);
    assert.match(result.skillIcons.BASE, /^\/render-assets\/[a-f0-9]{24}\.png$/);
    assert.equal(result.storyboard[0].iconUrl, result.skillIcons.Q);
    assert.equal(new Set(fetched).size, 4);

    const cachedFiles = fs.readdirSync(path.join(dir, "public", "render-assets"));
    assert.ok(cachedFiles.includes("missing-image.svg"));
    assert.ok(cachedFiles.some((file) => file.endsWith(".jpg")));
    assert.ok(cachedFiles.filter((file) => file.endsWith(".png")).length >= 3);
  });
});

test("localizeRemoteImageAssets replaces failed remote images with local fallback", async () => {
  await withTempProject(async (dir) => {
    const result = await localizeRemoteImageAssets({
      dataType: "PATCH",
      championName: "Lee Sin",
      splashUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/LeeSin_0.jpg",
    }, {
      cwd: dir,
      fetchImpl: async () => ({ ok: false, status: 503, arrayBuffer: async () => Buffer.from("") }),
    });

    assert.equal(result.splashUrl, RENDER_ASSET_FALLBACK_PUBLIC_PATH);
    assert.equal(result.heroIconUrl, RENDER_ASSET_FALLBACK_PUBLIC_PATH);
    assert.ok(fs.existsSync(path.join(dir, "public", "render-assets", "missing-image.svg")));
  });
});

test("localizeRemoteImageAssets adds champion assets for meta offmeta videos", async () => {
  await withTempProject(async (dir) => {
    const fetched = [];
    const result = await localizeRemoteImageAssets({
      dataType: "META_OFFMETA_PICK",
      champion: "Fizz",
      role: "Mid",
    }, {
      cwd: dir,
      fetchImpl: async (url) => {
        fetched.push(url);
        return {
          ok: true,
          arrayBuffer: async () => Buffer.from(`image:${url}`),
        };
      },
    });

    assert.match(result.heroIconUrl, /^\/render-assets\/[a-f0-9]{24}\.png$/);
    assert.match(result.splashUrl, /^\/render-assets\/[a-f0-9]{24}\.jpg$/);
    assert.equal(fetched.some((url) => url.includes("/img/champion/Fizz.png")), true);
    assert.equal(fetched.some((url) => url.includes("/champion/splash/Fizz_0.jpg")), true);
  });
});

test("prepareProps localizes meta offmeta champion names across visible zh text", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.endsWith("/api/versions.json")) {
      return { ok: true, json: async () => ["16.12.1"] };
    }
    if (url.includes("/data/en_US/champion.json")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            Fizz: { id: "Fizz", name: "Fizz", image: { full: "Fizz.png" } },
          },
        }),
      };
    }
    if (url.includes("/data/zh_TW/champion.json")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            Fizz: { id: "Fizz", name: "飛斯", image: { full: "Fizz.png" } },
          },
        }),
      };
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  try {
    const props = await require(path.join(ROOT, "utils/render/renderService")).prepareProps({
      dataType: "META_OFFMETA_PICK",
      locale: "zh",
      champion: "Fizz",
      role: "Mid",
      title: "Fizz 中路：這套出裝能不能抄？",
      recommendedStoryAngle: "Fizz 中路看的是出裝路線，不是中路位置本身。",
      playerTakeaways: [{ label: "先釐清", body: "這不是 Fizz 中路位置黑科技，而是非主流出裝題材。" }],
      storyboard: [{ tag: "HOOK", text: "Fizz 中路\n出裝路線檢查" }],
    }, "audio/bgm1.mp3");

    assert.equal(props.localizedChampionName, "飛斯");
    assert.match(props.title, /飛斯 中路/);
    assert.equal(props.title.includes("Fizz"), false);
    assert.match(props.recommendedStoryAngle, /飛斯 中路/);
    assert.equal(props.storyboard[0].text.includes("Fizz"), false);
    assert.match(props.playerTakeaways[0].body, /飛斯 中路/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("prepareProps localizes meta offmeta core item and rune names across visible zh text", async () => {
  const originalFetch = global.fetch;
  delete require.cache[require.resolve(path.join(ROOT, "utils/riotLocalization"))];
  delete require.cache[require.resolve(path.join(ROOT, "utils/render/renderService"))];
  global.fetch = async (url) => {
    if (url.endsWith("/api/versions.json")) {
      return { ok: true, json: async () => ["16.12.1"] };
    }
    if (url.includes("/data/en_US/champion.json")) {
      return { ok: true, json: async () => ({ data: { Fizz: { id: "Fizz", name: "Fizz", image: { full: "Fizz.png" } } } }) };
    }
    if (url.includes("/data/zh_TW/champion.json")) {
      return { ok: true, json: async () => ({ data: { Fizz: { id: "Fizz", name: "飛斯", image: { full: "Fizz.png" } } } }) };
    }
    if (url.includes("/data/en_US/item.json")) {
      return { ok: true, json: async () => ({ data: { 3869: { name: "Bloodsong" } } }) };
    }
    if (url.includes("/data/zh_TW/item.json")) {
      return { ok: true, json: async () => ({ data: { 3869: { name: "血鳴" } } }) };
    }
    if (url.includes("/data/en_US/runesReforged.json")) {
      return { ok: true, json: async () => ([{ id: 8000, name: "Precision", slots: [{ runes: [{ id: 8214, name: "Summon Aery", icon: "perk-images/Styles/Sorcery/SummonAery/SummonAery.png" }] }] }]) };
    }
    if (url.includes("/data/zh_TW/runesReforged.json")) {
      return { ok: true, json: async () => ([{ id: 8000, name: "精準", slots: [{ runes: [{ id: 8214, name: "召喚艾莉", icon: "perk-images/Styles/Sorcery/SummonAery/SummonAery.png" }] }] }]) };
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  try {
    const props = await require(path.join(ROOT, "utils/render/renderService")).prepareProps({
      dataType: "META_OFFMETA_PICK",
      locale: "zh",
      champion: "Fizz",
      role: "Mid",
      title: "Fizz 中路：Bloodsong / Summon Aery 黑科技能不能打？",
      recommendedStoryAngle: "這集看 Fizz 中路的 Bloodsong 搭配 Summon Aery。",
      coreItems: [{ name: "Bloodsong", sampleSize: 4200 }],
      coreRunes: [{ name: "Summon Aery", sampleSize: 6800 }],
      playerTakeaways: [{ label: "打法節奏", body: "Fizz 用 Bloodsong 搭配 Summon Aery 改變節奏。" }],
      storyboard: [{ tag: "CORE_TECH", text: "Fizz 中路\nBloodsong + Summon Aery" }],
    }, "audio/bgm1.mp3");

    assert.equal(props.coreItems[0].name, "血鳴");
    assert.match(props.coreItems[0].iconUrl, /\/img\/item\/3869\.png$/);
    assert.equal(props.coreRunes[0].name, "召喚艾莉");
    assert.match(props.coreRunes[0].iconUrl, /SummonAery\.png$/);
    assert.match(props.title, /血鳴 \/ 召喚艾莉/);
    assert.equal(props.title.includes("Bloodsong"), false);
    assert.match(props.recommendedStoryAngle, /血鳴 搭配 召喚艾莉/);
    assert.match(props.storyboard[0].text, /血鳴 \+ 召喚艾莉/);
    assert.match(props.playerTakeaways[0].body, /血鳴 搭配 召喚艾莉/);
  } finally {
    global.fetch = originalFetch;
    delete require.cache[require.resolve(path.join(ROOT, "utils/riotLocalization"))];
    delete require.cache[require.resolve(path.join(ROOT, "utils/render/renderService"))];
  }
});

test("prepareProps localizes meta offmeta visible context labels for zh videos", async () => {
  const originalFetch = global.fetch;
  delete require.cache[require.resolve(path.join(ROOT, "utils/riotLocalization"))];
  delete require.cache[require.resolve(path.join(ROOT, "utils/render/renderService"))];
  global.fetch = async (url) => {
    if (url.endsWith("/api/versions.json")) {
      return { ok: true, json: async () => ["16.12.1"] };
    }
    if (url.includes("/data/en_US/champion.json")) {
      return { ok: true, json: async () => ({ data: { Fizz: { id: "Fizz", name: "Fizz", image: { full: "Fizz.png" } } } }) };
    }
    if (url.includes("/data/zh_TW/champion.json")) {
      return { ok: true, json: async () => ({ data: { Fizz: { id: "Fizz", name: "飛斯", image: { full: "Fizz.png" } } } }) };
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  try {
    const props = await require(path.join(ROOT, "utils/render/renderService")).prepareProps({
      dataType: "META_OFFMETA_PICK",
      locale: "zh",
      champion: "Fizz",
      role: "Mid",
      title: "Fizz Mid：KR Emerald+ Off-role tech",
      topicFrame: "Off-role tech",
      offmetaTypeLabel: "Off-role tech",
      versionOverview: {
        patch: "16.12",
        region: "KR",
        rankPreset: "Emerald+",
        role: "Mid",
        techType: "Off-role tech",
      },
      recommendedStoryAngle: "Fizz Mid 只看 KR Emerald+ 的 Off-role tech。",
      playerTakeaways: [{ label: "打法節奏", body: "KR Emerald+ 的 Fizz Mid 可以先一般對局測。" }],
      storyboard: [{ tag: "VERSION_OVERVIEW", text: "16.12 KR\nEmerald+ Mid\nOff-role tech" }],
    }, "audio/bgm1.mp3");

    assert.deepEqual(props.versionOverview, {
      patch: "16.12",
      region: "韓服",
      rankPreset: "翡翠以上",
      role: "中路",
      techType: "位置黑科技",
    });
    assert.equal(props.topicFrame, "位置黑科技");
    assert.equal(props.offmetaTypeLabel, "位置黑科技");

    const visible = JSON.stringify({
      title: props.title,
      recommendedStoryAngle: props.recommendedStoryAngle,
      playerTakeaways: props.playerTakeaways,
      storyboard: props.storyboard,
      versionOverview: props.versionOverview,
      topicFrame: props.topicFrame,
      offmetaTypeLabel: props.offmetaTypeLabel,
    });
    assert.match(visible, /飛斯/);
    assert.match(visible, /韓服/);
    assert.match(visible, /翡翠以上/);
    assert.match(visible, /中路/);
    assert.equal(visible.includes("Fizz"), false);
    assert.equal(visible.includes("KR"), false);
    assert.equal(visible.includes("Emerald+"), false);
    assert.equal(visible.includes("Mid"), false);
    assert.equal(visible.includes("Off-role"), false);
  } finally {
    global.fetch = originalFetch;
    delete require.cache[require.resolve(path.join(ROOT, "utils/riotLocalization"))];
    delete require.cache[require.resolve(path.join(ROOT, "utils/render/renderService"))];
  }
});

test("prepareProps localizes tier ranking entry champion names and icon URLs", async () => {
  const originalFetch = global.fetch;
  delete require.cache[require.resolve(path.join(ROOT, "utils/riotLocalization"))];
  delete require.cache[require.resolve(path.join(ROOT, "utils/render/renderService"))];
  global.fetch = async (url) => {
    if (url.endsWith("/api/versions.json")) {
      return { ok: true, json: async () => ["16.12.1"] };
    }
    if (url.includes("/data/en_US/champion.json")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            Ahri: { id: "Ahri", name: "Ahri", image: { full: "Ahri.png" } },
            Orianna: { id: "Orianna", name: "Orianna", image: { full: "Orianna.png" } },
          },
        }),
      };
    }
    if (url.includes("/data/zh_TW/champion.json")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            Ahri: { id: "Ahri", name: "阿璃", image: { full: "Ahri.png" } },
            Orianna: { id: "Orianna", name: "奧莉安娜", image: { full: "Orianna.png" } },
          },
        }),
      };
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  try {
    const props = await require(path.join(ROOT, "utils/render/renderService")).prepareProps({
      dataType: "META_TIER_RANKING",
      locale: "zh",
      role: "Mid",
      title: "中路 梯度榜前 2",
      entries: [
        { rank: 1, champion: "Ahri", role: "Mid", tierScore: 92, statLine: "勝率 52.1% · 登場率 13.2% · 樣本 183,420" },
        { rank: 2, champion: "Orianna", role: "Mid", tierScore: 88, statLine: "勝率 51.7% · 登場率 9.8% · 樣本 120,311" },
      ],
      storyboard: [{ tag: "HOOK", text: "中路 版本答案\n先看這幾隻" }],
    }, "audio/bgm2.mp3");

    assert.equal(props.entries[0].localizedChampionName, "阿璃");
    assert.equal(props.entries[1].localizedChampionName, "奧莉安娜");
    assert.match(props.entries[0].heroIconUrl, /\/img\/champion\/Ahri\.png$/);
    assert.match(props.entries[1].heroIconUrl, /\/img\/champion\/Orianna\.png$/);
  } finally {
    global.fetch = originalFetch;
    delete require.cache[require.resolve(path.join(ROOT, "utils/riotLocalization"))];
    delete require.cache[require.resolve(path.join(ROOT, "utils/render/renderService"))];
  }
});
