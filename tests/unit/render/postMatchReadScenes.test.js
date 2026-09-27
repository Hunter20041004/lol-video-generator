const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

let scenesPromise;
function loadScenes() {
  return scenesPromise ||= (async () => {
    const filename = path.resolve(__dirname, "../../../src/templates/player-radar/PostMatchReadScenes.jsx");
    const swc = require("next/dist/build/swc");
    await swc.loadBindings();
    const { code } = await swc.transform(fs.readFileSync(filename, "utf8"), {
      filename,
      jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "classic" } } },
      module: { type: "commonjs" },
    });
    const component = new Module(filename, module);
    component.filename = filename;
    component.paths = module.paths;
    const nativeRequire = component.require.bind(component);
    component.require = (request) => request === "remotion"
      ? {
          AbsoluteFill: ({ children, ...props }) => React.createElement("div", props, children),
          Img: (props) => React.createElement("img", props),
        }
      : nativeRequire(request);
    component._compile(code, filename);
    return component.exports;
  })();
}

const crest = (name) => ({ publicPath: `/team-crests/${name}.png`, labelMode: "embedded" });

test("result scene renders a LoL broadcast scoreboard with one winner treatment", async () => {
  const { MatchupBroadcastScene } = await loadScenes();
  const html = renderToStaticMarkup(React.createElement(MatchupBroadcastScene, {
    localFrame: 24,
    reducedMotion: false,
    phase: "result",
    model: {
      seriesContext: { teamA: "T1", teamB: "HLE" },
      resultHook: { scoreParts: { left: "2", separator: "–", right: "3" }, resultClaim: "HLE 拿下系列賽。" },
      hook: { metric: "GPM", leftRaw: 388, rightRaw: 460, displayValue: "388 vs 460" },
      finalRead: { winnerTeam: { name: "HLE" } },
      assets: { teams: { teamA: { ...crest("t1"), labelMode: "separate" }, teamB: crest("hle") }, matchup: {} },
    },
  }));

  assert.match(html, /data-broadcast-component="scoreboard"/);
  assert.match(html, /data-winner="HLE"/);
  assert.match(html, /T1/);
  assert.match(html, /HLE/);
  assert.match(html, />2</);
  assert.match(html, />3</);
  assert.match(html, /SERIES RESULT/);
  assert.match(html, /data-result-signal="verified"/);
  assert.match(html, /388 vs 460/);
  assert.match(html, /GPM/);
  assert.equal((html.match(/>T1</g) || []).length, 2);
  assert.doesNotMatch(html, /proof-mark|grayscale\(/i);
});

test("matchup scene renders a role-aware champion duel with a dense verified comparison", async () => {
  const { MatchupBroadcastScene } = await loadScenes();
  const html = renderToStaticMarkup(React.createElement(MatchupBroadcastScene, {
    localFrame: 32,
    reducedMotion: false,
    phase: "matchup",
    model: {
      matchup: {
        role: "MID",
        edgePlayer: { name: "Zeka" },
        opponentPlayer: { name: "Faker" },
        primaryEvidence: { metric: "KDA", delta: 3.54, winnerValue: 7.4, loserValue: 3.86 },
        scopeClaim: "五路之中，中路差距最大。",
        claim: "中路差距成為系列賽支點。",
      },
      resultHook: {},
      assets: {
        matchup: {
          edge: { championName: "Ryze", squareSrc: "/champions/ryze.png" },
          opponent: { championName: "Orianna", squareSrc: "/champions/orianna.png" },
        },
        teams: {},
      },
    },
  }));

  assert.match(html, /data-broadcast-component="matchup"/);
  assert.match(html, /data-role="MID"/);
  assert.match(html, /Ryze/);
  assert.match(html, /Orianna/);
  assert.match(html, /data-primary-metric="KDA"/);
  assert.match(html, /data-duel-comparison="visible"/);
  assert.match(html, /7\.4/);
  assert.match(html, /3\.86/);
  assert.match(html, /五路之中，中路差距最大/);
  assert.equal((html.match(/data-primary-metric=/g) || []).length, 1);
  assert.doesNotMatch(html, /grayscale\(/i);
});

test("matchup scene keeps verified player identity when champion art is unavailable", async () => {
  const { MatchupBroadcastScene } = await loadScenes();
  const html = renderToStaticMarkup(React.createElement(MatchupBroadcastScene, {
    localFrame: 32,
    reducedMotion: false,
    phase: "matchup",
    model: {
      matchup: {
        role: "TOP",
        edgePlayer: { name: "Zeus" },
        opponentPlayer: { name: "Kiin" },
        primaryEvidence: { metric: "GPM", delta: 42 },
        claim: "上路建立資源差。",
      },
      resultHook: {},
      assets: { matchup: {}, teams: {} },
    },
  }));

  assert.equal((html.match(/data-fallback="identity"/g) || []).length, 2);
  assert.match(html, /Zeus/);
  assert.match(html, /Kiin/);
  assert.doesNotMatch(html, /undefined|<img/i);
});

test("early control maps only verified objective totals onto the Rift board", async () => {
  const { EarlyControlScene } = await loadScenes();
  const html = renderToStaticMarkup(React.createElement(EarlyControlScene, {
    localFrame: 36,
    reducedMotion: false,
    model: {
      locale: "en",
      assets: { mapSrc: "/maps/summoners-rift.png" },
      gameFlow: {
        earlyResourceTeam: "HLE",
        earlyResources: { voidGrubs: 3, riftHeralds: 1, displayValue: "3＋1" },
        teamFinals: [
          { team: "GEN", voidGrubs: 0, riftHeralds: 0, barons: 1, towers: 8 },
          { team: "HLE", voidGrubs: 3, riftHeralds: 1, barons: 0, towers: 4 },
        ],
      },
    },
  }));

  assert.match(html, /data-broadcast-component="rift-objectives"/);
  assert.match(html, /summoners-rift\.png/);
  assert.match(html, /VOID GRUBS/);
  assert.match(html, /RIFT HERALD/);
  assert.match(html, /TEAM FINAL/);
  assert.match(html, /data-team-objective-matrix="visible"/);
  assert.match(html, /GEN/);
  assert.match(html, /BARON/);
  assert.match(html, /HLE/);
  assert.doesNotMatch(html, /EARLY CONTROL/);
  assert.doesNotMatch(html, /timestamp|event path|route claim/i);
});

test("map conversion shows towers, gold, and barons together as a tactical dashboard", async () => {
  const { MapConversionScene } = await loadScenes();
  const model = {
    locale: "en",
    assets: { mapSrc: "/maps/summoners-rift.png" },
    gameFlow: {
      finalMapTeam: "HLE",
      towerScore: "6–2",
      goldDelta: 7157,
      conversion: { barons: 2, towers: 6, displayValue: "2 → 6" },
      conclusion: "The lead became map control.",
    },
  };
  const renderAt = (localFrame) => renderToStaticMarkup(React.createElement(MapConversionScene, { model, localFrame, reducedMotion: false }));
  const towers = renderAt(90);
  const gold = renderAt(150);

  assert.match(towers, /data-conversion-dashboard="visible"/);
  assert.match(towers, /6–2/);
  assert.match(towers, /\+7,157/);
  assert.match(towers, /2 → 6/);
  assert.match(towers, /BARONS/);
  assert.match(gold, /\+7,157/);
  assert.match(gold, /6–2/);
  assert.doesNotMatch(gold, /MAP CONVERSION/);
});

test("player proof renders a verified broadcast card with a persistent stat matrix", async () => {
  const { PlayerProofScene } = await loadScenes();
  const html = renderToStaticMarkup(React.createElement(PlayerProofScene, {
    localFrame: 80,
    reducedMotion: false,
    model: {
      locale: "zh",
      seriesContext: { teamA: "GEN", teamB: "HLE" },
      proof: {
        label: "數據 MVP 候選",
        player: { name: "Ruler", team: "GEN", role: "BOT", rawStats: { csm: 10.22 } },
        secondaryEvidence: [
          { metric: "KDA", displayValue: "7.4" },
          { metric: "KP%", displayValue: "71%" },
        ],
        claim: "穩定輸出把優勢變成勝勢。",
      },
      assets: {
        teams: { teamA: crest("gen"), teamB: crest("hle") },
        proof: {
          playerPortrait: { publicPath: "/players/ruler.webp" },
          champions: [{ championName: "Caitlyn", src: "/champions/caitlyn.png" }],
        },
      },
    },
  }));

  assert.match(html, /data-broadcast-component="player-card"/);
  assert.match(html, /data-player-team="GEN"/);
  assert.match(html, /data-portrait-stage="compact"/);
  assert.match(html, /data-portrait-stage="compact"[^>]*height:720px/);
  assert.match(html, /ruler\.webp/);
  assert.match(html, /gen\.png/);
  assert.match(html, /Ruler/);
  assert.match(html, /BOT/);
  assert.match(html, /數據 MVP 候選/);
  assert.match(html, /data-primary-metric="CS \/ MIN"/);
  assert.match(html, /data-player-stat-matrix="visible"/);
  assert.equal((html.match(/data-secondary-evidence=/g) || []).length, 2);
  assert.match(html, /7\.4/);
  assert.match(html, /71%/);
  assert.doesNotMatch(html, /grayscale\(/i);
});

test("final read keeps the full evidence stack visible during the victory lockup", async () => {
  const { FinalReadScene } = await loadScenes();
  const model = {
    resultHook: { scoreParts: { left: "2", separator: "–", right: "3" } },
    finalRead: {
      winnerTeam: { name: "HLE" },
      conclusionParts: { lead: "把前期資源", emphasis: "換成真正勝勢。" },
      recapReferences: [{ displayValue: "+42", label: "MID GPM" }, { displayValue: "7.4", label: "KDA" }],
    },
    assets: { finalRead: { winnerCrest: crest("hle") } },
  };
  const reading = renderToStaticMarkup(React.createElement(FinalReadScene, { model, localFrame: 30, reducedMotion: false }));
  const hold = renderToStaticMarkup(React.createElement(FinalReadScene, { model, localFrame: 100, reducedMotion: false }));

  assert.match(reading, /data-broadcast-component="victory-lockup"/);
  assert.match(reading, /data-recap-evidence="visible"/);
  assert.match(reading, /\+42/);
  assert.match(hold, /data-reading-hold="true"/);
  assert.match(hold, /HLE/);
  assert.match(hold, /2–3/);
  assert.match(hold, /換成真正勝勢/);
  assert.match(hold, /data-final-evidence-stack="visible"/);
  assert.match(hold, /\+42/);
  assert.match(hold, /7\.4/);
  assert.doesNotMatch(hold, /THE FINAL READ/);
  assert.doesNotMatch(hold, /proof-mark|grayscale\(/i);
});
