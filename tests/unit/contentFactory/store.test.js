const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");

function clearModules() {
  delete require.cache[path.join(ROOT, "utils/contentFactory/store.js")];
}

async function withTempProject(fn) {
  const originalCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-content-factory-"));
  process.chdir(dir);
  clearModules();
  try {
    await fn(dir);
  } finally {
    process.chdir(originalCwd);
    clearModules();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const scanResult = {
  patchUrl: "https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-10-notes/",
  list: [
    {
      dataType: "PATCH",
      championName: "Quinn",
      changes: [
        { ability: "Q", changeDesc: "Damage increased 20 -> 30" },
        { ability: "R", changeDesc: "Cooldown decreased 120 -> 100" },
      ],
    },
  ],
  runeChanges: [
    {
      targetType: "RUNE",
      targetName: "Stormsurge",
      localizedName: "風暴浪湧",
      changeType: "BUFF",
      statChanges: [{ metricName: "Move Speed", beforeValue: "40%", afterValue: "48%", trend: "BUFF" }],
    },
  ],
  itemChanges: [
    {
      targetType: "ITEM",
      targetName: "Kraken Slayer",
      localizedName: "海妖殺手",
      changeType: "NERF",
      statChanges: [{ metricName: "Damage", beforeValue: "140", afterValue: "120", trend: "NERF" }],
    },
  ],
  systemChanges: [
    {
      targetType: "SYSTEM",
      targetName: "Mid Role Quest",
      localizedName: "中路任務",
      changeType: "BUFF",
      statChanges: [{ metricName: "Bonus AD and AP", beforeValue: "6%", afterValue: "8%", trend: "BUFF" }],
      changeDesc: "Bonus AD and AP: 6% ⇒ 8%",
    },
  ],
};

test("buildPatchItemsFromScanResult creates ordered system, champion, rune, item records with stable hashes", async () => {
  await withTempProject(async () => {
    const { buildPatchItemsFromScanResult } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    const items = buildPatchItemsFromScanResult(scanResult);

    assert.equal(items.length, 4);
    assert.deepEqual(items.map((item) => item.category), ["SYSTEM", "CHAMPION", "RUNE", "ITEM"]);
    assert.equal(items[0].patchVersion, "26.10");
    assert.equal(items[0].projectId, "lol");
    assert.equal(items[0].projectName, "英雄聯盟");
    assert.equal(items[0].payload.dataType, "SYSTEM_UPDATE");
    assert.equal(items[0].payload.projectId, "lol");
    assert.match(items[0].sourceHash, /^[a-f0-9]{64}$/);
  });
});

test("content factory keeps identical scan results separate by project", async () => {
  await withTempProject(async () => {
    const {
      buildPatchItemsFromScanResult,
      listPatchItems,
      selectPublishCandidates,
      summarizePatchItems,
      upsertPatchItems,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    upsertPatchItems(buildPatchItemsFromScanResult(scanResult, { projectId: "lol" }));
    upsertPatchItems(buildPatchItemsFromScanResult(scanResult, { projectId: "generic-game" }));

    assert.equal(listPatchItems().length, 8);
    assert.equal(listPatchItems({ projectId: "lol" }).length, 4);
    assert.equal(listPatchItems({ projectId: "generic-game" }).length, 4);
    assert.equal(listPatchItems({ projectId: "unknown-project" }).length, 0);
    assert.deepEqual(
      [...new Set(selectPublishCandidates({ count: 5, projectId: "generic-game" }).map((item) => item.projectId))],
      ["generic-game"],
    );

    const summary = summarizePatchItems(listPatchItems());
    assert.equal(summary.byProject.lol, 4);
    assert.equal(summary.byProject["generic-game"], 4);
  });
});

test("upsertPatchItems preserves published records and only selects publishable未發布 items", async () => {
  await withTempProject(async () => {
    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
      updatePatchItem,
      selectPublishCandidates,
      readDatabase,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    const items = buildPatchItemsFromScanResult(scanResult);
    const first = upsertPatchItems(items, { now: "2026-05-22T01:00:00.000Z" });
    assert.equal(first.inserted, 4);
    assert.equal(first.updated, 0);

    const champion = first.database.items.find((item) => item.category === "CHAMPION");
    updatePatchItem(champion.id, { status: "PUBLISHED", publishedAt: "2026-05-22T02:00:00.000Z" });

    const second = upsertPatchItems(items, { now: "2026-05-22T03:00:00.000Z" });
    assert.equal(second.inserted, 0);
    assert.equal(second.updated, 4);
    assert.equal(readDatabase().items.find((item) => item.category === "CHAMPION").status, "PUBLISHED");

    const candidates = selectPublishCandidates({ count: 5 });
    assert.deepEqual(candidates.map((item) => item.category), ["SYSTEM", "RUNE", "ITEM"]);
  });
});

test("upsertPatchItems updates same patch category target when parser detail changes", async () => {
  await withTempProject(async () => {
    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
      listPatchItems,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    const first = {
      patchUrl: "https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-11-notes/",
      runeChanges: [
        {
          targetType: "RUNE",
          targetName: "Deathfire Touch",
          localizedName: "冥火之觸",
          changeType: "ADJUST",
          changeDesc: "Damage: Adaptive ⇒ Magic Damage",
          statChanges: [{ metricName: "Damage", beforeValue: "Adaptive", afterValue: "Magic Damage", trend: "ADJUST" }],
        },
      ],
    };
    const second = {
      patchUrl: first.patchUrl,
      runeChanges: [
        {
          ...first.runeChanges[0],
          changeDesc: "Extra Riot context.\nDamage: Adaptive ⇒ Magic Damage",
        },
      ],
    };

    const inserted = upsertPatchItems(buildPatchItemsFromScanResult(first));
    const firstId = inserted.database.items[0].id;
    const updated = upsertPatchItems(buildPatchItemsFromScanResult(second));
    const items = listPatchItems();

    assert.equal(updated.inserted, 0);
    assert.equal(updated.updated, 1);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, firstId);
    assert.match(items[0].payload.changeDesc, /Extra Riot context/);
  });
});

test("selectPublishCandidates does not republish already published records", async () => {
  await withTempProject(async () => {
    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
      updatePatchItem,
      selectPublishCandidates,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    const { database } = upsertPatchItems(buildPatchItemsFromScanResult(scanResult));
    const champion = database.items.find((item) => item.category === "CHAMPION");
    updatePatchItem(champion.id, { status: "PUBLISHED", publishedAt: "2026-05-22T04:00:00.000Z" });

    const candidates = selectPublishCandidates({ count: 1 });

    assert.equal(candidates.length, 1);
    assert.notEqual(candidates[0].id, champion.id);
    assert.equal(candidates[0].status, "READY");
  });
});

test("reconcilePublishedItemsFromQueue marks already published content as published", async () => {
  await withTempProject(async (dir) => {
    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
      reconcilePublishedItemsFromQueue,
      selectPublishCandidates,
      readDatabase,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    const { database } = upsertPatchItems(buildPatchItemsFromScanResult(scanResult));
    const champion = database.items.find((item) => item.category === "CHAMPION");
    fs.writeFileSync(path.join(dir, ".data", "publish-queue.json"), JSON.stringify({
      tasks: [
        {
          id: "pub_zh_threads_quinn",
          status: "PUBLISHED",
          platform: "threads",
          locale: "zh",
          copy: {
            title: "葵恩 26.10 改版：打野與跑線能力上修",
            caption: "葵恩 26.10 改版：打野與跑線能力上修\n\n#英雄聯盟 #Quinn",
          },
          result: { postId: "thread-1", url: "https://threads.net/@hextech/post/1" },
        },
      ],
    }, null, 2));

    const result = reconcilePublishedItemsFromQueue();

    assert.equal(result.updated, 1);
    const updatedChampion = readDatabase().items.find((item) => item.id === champion.id);
    assert.equal(updatedChampion.status, "PUBLISHED");
    assert.equal(updatedChampion.publishResult.jobs[0].id, "pub_zh_threads_quinn");
    assert.deepEqual(selectPublishCandidates({ count: 3 }).map((item) => item.category), ["SYSTEM", "RUNE", "ITEM"]);
  });
});

test("selectPublishCandidates clamps batch size to 1-5 and follows category priority", async () => {
  await withTempProject(async () => {
    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
      selectPublishCandidates,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    upsertPatchItems(buildPatchItemsFromScanResult(scanResult));

    assert.equal(selectPublishCandidates({ count: 0 }).length, 1);
    assert.equal(selectPublishCandidates({ count: 99 }).length, 4);
    assert.deepEqual(selectPublishCandidates({ count: 4 }).map((item) => item.category), ["SYSTEM", "CHAMPION", "RUNE", "ITEM"]);
  });
});

test("listPatchItems and selectPublishCandidates can scope by patch version and category", async () => {
  await withTempProject(async () => {
    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
      updatePatchItem,
      listPatchItems,
      selectPublishCandidates,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    const patch2611 = {
      ...scanResult,
      patchUrl: "https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-11-notes/",
      itemChanges: [
        {
          targetType: "ITEM",
          targetName: "Zeke's Convergence",
          localizedName: "錫柯的聚合之力",
          changeType: "ADJUST",
          statChanges: [{ metricName: "Trigger", beforeValue: "old", afterValue: "new", trend: "ADJUST" }],
        },
      ],
    };

    upsertPatchItems(buildPatchItemsFromScanResult(scanResult));
    const { database } = upsertPatchItems(buildPatchItemsFromScanResult(patch2611));
    const patch2611Champion = database.items.find((item) => item.patchVersion === "26.11" && item.category === "CHAMPION");
    updatePatchItem(patch2611Champion.id, { status: "PUBLISHED", publishedAt: "2026-05-22T05:00:00.000Z" });

    assert.deepEqual(
      [...new Set(listPatchItems({ patchVersion: "26.11" }).map((item) => item.patchVersion))],
      ["26.11"],
    );
    assert.deepEqual(
      listPatchItems({ patchVersion: "26.11", category: "ITEM" }).map((item) => item.targetName),
      ["Zeke's Convergence"],
    );
    assert.deepEqual(
      selectPublishCandidates({ count: 5, patchVersion: "26.11", category: "ITEM" }).map((item) => item.targetName),
      ["Zeke's Convergence"],
    );
    assert.equal(
      selectPublishCandidates({ count: 5, patchVersion: "26.11" }).some((item) => item.id === patch2611Champion.id),
      false,
    );
  });
});

test("listPatchItems prefers newer patch versions before old high-score records", async () => {
  await withTempProject(async () => {
    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
      listPatchItems,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    upsertPatchItems(buildPatchItemsFromScanResult({
      patchUrl: "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-10-notes",
      list: [
        {
          dataType: "PATCH",
          championName: "Old High Score",
          changes: [
            { ability: "P", changeDesc: "Changed" },
            { ability: "Q", changeDesc: "Changed" },
            { ability: "W", changeDesc: "Changed" },
            { ability: "E", changeDesc: "Changed" },
            { ability: "R", changeDesc: "Changed" },
          ],
        },
      ],
    }));
    upsertPatchItems(buildPatchItemsFromScanResult({
      patchUrl: "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-13-notes",
      list: [
        {
          dataType: "PATCH",
          championName: "Latest Lower Score",
          changes: [{ ability: "Q", changeDesc: "Changed" }],
        },
      ],
    }));

    const items = listPatchItems({ projectId: "lol" });

    assert.equal(items[0].patchVersion, "26.13");
    assert.equal(items[0].targetName, "Latest Lower Score");
    assert.equal(items[1].patchVersion, "26.10");
  });
});

test("readDatabase safely recovers from malformed local database files", async () => {
  await withTempProject(async () => {
    const { DB_PATH, readDatabase } = require(path.join(ROOT, "utils/contentFactory/store.js"));
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, "{not-json", "utf8");

    const database = readDatabase();

    assert.deepEqual(database, { version: 1, items: [] });
  });
});

test("readPublishedQueueTasks supports flat queues and safely handles missing or malformed files", async () => {
  await withTempProject(async (dir) => {
    const { readPublishedQueueTasks } = require(path.join(ROOT, "utils/contentFactory/store.js"));
    const queuePath = path.join(dir, ".data", "custom-queue.json");
    fs.mkdirSync(path.dirname(queuePath), { recursive: true });
    fs.writeFileSync(queuePath, JSON.stringify([
      { id: "published", status: "PUBLISHED" },
      { id: "failed", status: "FAILED" },
      null,
    ]));

    assert.deepEqual(readPublishedQueueTasks(queuePath).map((task) => task.id), ["published"]);

    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      fs.writeFileSync(queuePath, "{bad-json");
      assert.deepEqual(readPublishedQueueTasks(queuePath), []);
    } finally {
      console.warn = originalWarn;
    }

    fs.rmSync(queuePath);
    assert.deepEqual(readPublishedQueueTasks(queuePath), []);
  });
});

test("taskMatchesPatchItem requires a matching name and patch when one is specified", async () => {
  await withTempProject(async () => {
    const { taskMatchesPatchItem } = require(path.join(ROOT, "utils/contentFactory/store.js"));
    const task = {
      copy: {
        title: "Quinn patch 26.10 breakdown",
        caption: "Quinn is faster after the update",
        tags: ["League"],
      },
      videoUrl: "/renders/quinn.mp4",
    };

    assert.equal(taskMatchesPatchItem(task, { targetName: "Smolder", patchVersion: "26.10" }), false);
    assert.equal(taskMatchesPatchItem(task, { targetName: "Quinn", patchVersion: "26.11" }), false);
    assert.equal(taskMatchesPatchItem(task, { payload: { championName: "Quinn" }, patchVersion: "latest" }), true);
    assert.equal(taskMatchesPatchItem(task, { raw: { localizedChampionName: "Quinn" } }), true);
  });
});

test("reconcilePublishedItemsFromQueue leaves already-published records unchanged", async () => {
  await withTempProject(async (dir) => {
    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
      updatePatchItem,
      reconcilePublishedItemsFromQueue,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));
    const { database } = upsertPatchItems(buildPatchItemsFromScanResult(scanResult));
    const champion = database.items.find((item) => item.category === "CHAMPION");
    updatePatchItem(champion.id, { status: "PUBLISHED" });
    fs.writeFileSync(path.join(dir, ".data", "publish-queue.json"), JSON.stringify([
      {
        id: "pub-quinn",
        status: "PUBLISHED",
        copy: { caption: "Quinn patch 26.10" },
      },
    ]));

    const result = reconcilePublishedItemsFromQueue();

    assert.equal(result.updated, 0);
    assert.deepEqual(result.items, []);
  });
});

test("resetPatchItemForRepublish clears old publish data and makes an item selectable again", async () => {
  await withTempProject(async () => {
    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
      updatePatchItem,
      resetPatchItemForRepublish,
      selectPublishCandidates,
      readDatabase,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));
    const { database } = upsertPatchItems(buildPatchItemsFromScanResult(scanResult));
    const champion = database.items.find((item) => item.category === "CHAMPION");

    updatePatchItem(champion.id, {
      status: "PUBLISHED",
      renderedAt: "2026-05-22T01:30:00.000Z",
      publishedAt: "2026-05-22T02:00:00.000Z",
      renderResult: { videos: [{ locale: "zh", videoUrl: "/renders/old.mp4" }] },
      publishResult: { jobs: [{ id: "pub-old", status: "PUBLISHED" }] },
      error: "old error",
    });

    const reset = resetPatchItemForRepublish(champion.id, {
      now: "2026-05-22T03:00:00.000Z",
      reason: "bad_video",
    });

    assert.equal(reset.status, "READY");
    assert.equal(reset.renderedAt, null);
    assert.equal(reset.publishedAt, null);
    assert.equal(reset.renderResult, null);
    assert.equal(reset.publishResult, null);
    assert.equal(reset.error, null);
    assert.equal(reset.publishResetAt, "2026-05-22T03:00:00.000Z");
    assert.equal(reset.publishResetReason, "bad_video");
    assert.equal(readDatabase().items.find((item) => item.id === champion.id).status, "READY");
    assert.equal(selectPublishCandidates({ count: 5 }).some((item) => item.id === champion.id), true);
  });
});

test("resetPatchItemsForRepublish resets a patch version and ignores older queue reconciliation", async () => {
  await withTempProject(async (dir) => {
    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
      updatePatchItem,
      resetPatchItemsForRepublish,
      reconcilePublishedItemsFromQueue,
      readDatabase,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));
    const { database } = upsertPatchItems(buildPatchItemsFromScanResult(scanResult));
    const champion = database.items.find((item) => item.category === "CHAMPION");
    const system = database.items.find((item) => item.category === "SYSTEM");
    updatePatchItem(champion.id, { status: "PUBLISHED", publishedAt: "2026-05-22T02:00:00.000Z" });
    updatePatchItem(system.id, { status: "PUBLISHED", publishedAt: "2026-05-22T02:00:00.000Z" });
    fs.writeFileSync(path.join(dir, ".data", "publish-queue.json"), JSON.stringify({
      tasks: [
        {
          id: "pub-old-quinn",
          status: "PUBLISHED",
          createdAt: "2026-05-22T02:30:00.000Z",
          copy: { caption: "Quinn patch 26.10" },
        },
      ],
    }, null, 2));

    const reset = resetPatchItemsForRepublish(
      { patchVersion: "26.10" },
      { now: "2026-05-22T03:00:00.000Z" },
    );
    const reconciled = reconcilePublishedItemsFromQueue({ now: "2026-05-22T04:00:00.000Z" });
    const items = readDatabase().items;

    assert.equal(reset.updated, 4);
    assert.equal(reconciled.updated, 0);
    assert.equal(items.find((item) => item.id === champion.id).status, "READY");
    assert.equal(items.find((item) => item.id === system.id).status, "READY");
  });
});

test("buildPatchItemsFromScanResult infers item and rune change types from trends and text", async () => {
  await withTempProject(async () => {
    const { buildPatchItemsFromScanResult } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    const items = buildPatchItemsFromScanResult({
      itemChanges: [
        {
          targetName: "Buff Sword",
          statChanges: [{ metricName: "Attack Damage", beforeValue: 10, afterValue: 15, trend: "BUFF" }],
        },
        {
          targetName: "Mixed Bow",
          statChanges: [
            { metricName: "Attack Speed", beforeValue: "30%", afterValue: "35%", trend: "BUFF" },
            { metricName: "Damage", beforeValue: 100, afterValue: 90, trend: "NERF" },
          ],
        },
        {
          targetName: "Text Nerf Blade",
          changeDesc: "Damage reduced.",
        },
        {
          targetName: "Neutral Trinket",
          changeDesc: "Rules text updated.",
        },
      ],
      runeChanges: [
        {
          targetName: "Trend Rune",
          trend: "NERF",
          statChanges: [{ metricName: "Damage", beforeValue: 4, afterValue: 3 }],
        },
      ],
    });

    const byName = new Map(items.map((item) => [item.targetName, item]));
    assert.equal(byName.get("Buff Sword").changeType, "BUFF");
    assert.equal(byName.get("Mixed Bow").changeType, "ADJUST");
    assert.equal(byName.get("Text Nerf Blade").changeType, "NERF");
    assert.equal(byName.get("Neutral Trinket").changeType, "ADJUST");
    assert.equal(byName.get("Trend Rune").changeType, "NERF");
    assert.equal(byName.get("Buff Sword").patchVersion, "latest");
  });
});

test("listPatchItems filters by category and status while summarizePatchItems reports counts", async () => {
  await withTempProject(async () => {
    const {
      buildPatchItemsFromScanResult,
      upsertPatchItems,
      updatePatchItem,
      listPatchItems,
      summarizePatchItems,
    } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    const { database } = upsertPatchItems(buildPatchItemsFromScanResult(scanResult));
    updatePatchItem(database.items.find((item) => item.category === "ITEM").id, { status: "FAILED" });

    assert.deepEqual(listPatchItems({ category: "RUNE" }).map((item) => item.category), ["RUNE"]);
    assert.deepEqual(listPatchItems({ status: "FAILED" }).map((item) => item.category), ["ITEM"]);

    const summary = summarizePatchItems(listPatchItems());
    assert.equal(summary.total, 4);
    assert.equal(summary.byCategory.SYSTEM, 1);
    assert.equal(summary.byCategory.CHAMPION, 1);
    assert.equal(summary.byCategory.RUNE, 1);
    assert.equal(summary.byCategory.ITEM, 1);
    assert.equal(summary.byStatus.FAILED, 1);
    assert.equal(summary.byStatus.READY, 3);
  });
});

test("updatePatchItem returns null for unknown records", async () => {
  await withTempProject(async () => {
    const { updatePatchItem } = require(path.join(ROOT, "utils/contentFactory/store.js"));

    assert.equal(updatePatchItem("missing-id", { status: "FAILED" }), null);
  });
});
