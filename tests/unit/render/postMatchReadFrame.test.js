const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

let framePromise;
function loadFrame() {
  return framePromise ||= (async () => {
    const filename = path.resolve(__dirname, "../../../src/templates/player-radar/PostMatchReadFrame.jsx");
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
    component._compile(code, filename);
    return component.exports.PostMatchReadFrame;
  })();
}

test("frame preserves the selected team-final game label", async () => {
  const Frame = await loadFrame();
  const html = renderToStaticMarkup(React.createElement(Frame, {
    model: { gameFlow: { gameNumber: 2 } }, sceneTag: "MAP_CONVERSION",
  }));
  assert.match(html, /GAME 2 · TEAM FINAL/);
});

test("series frame reports actual games instead of an inferred best-of", async () => {
  const Frame = await loadFrame();
  for (const gameCount of [5, 3, 4, 2, 1]) {
    const html = renderToStaticMarkup(React.createElement(Frame, {
      model: { seriesContext: { league: "LCK", gameCount, teamA: "T1", teamB: "HLE", score: "2-3" } },
      sceneTag: "FINAL_READ",
    }));
    assert.ok(html.includes(`LCK · 共 ${gameCount} 局`));
    assert.doesNotMatch(html, /BO[135]/);
    assert.ok(html.includes("T1 2-3 HLE"));
  }
});

test("series frame omits unknown or invalid counts without fabricating a format", async () => {
  const Frame = await loadFrame();
  for (const gameCount of [undefined, null, 0, -1, 2.5, NaN, Infinity, "5"]) {
    const html = renderToStaticMarkup(React.createElement(Frame, {
      model: { branding: { publicTitle: "賽後判讀" }, seriesContext: { league: "LCP", gameCount } },
      sceneTag: "RESULT_HOOK",
    }));
    assert.ok(html.includes("賽後判讀"));
    assert.ok(html.includes("LCP"));
    assert.doesNotMatch(html, /共|BO[135]|undefined|NaN|Infinity/);
  }
});

test("English frame does not repeat POST MATCH READ in both header lines", async () => {
  const Frame = await loadFrame();
  const html = renderToStaticMarkup(React.createElement(Frame, {
    model: { locale: "en", branding: { publicTitle: "POST MATCH READ" }, seriesContext: {} },
    sceneTag: "RESULT_HOOK",
  }));

  assert.equal((html.match(/POST MATCH READ/g) || []).length, 1);
  assert.match(html, /MATCH ANALYSIS/);
});

test("frame uses the LoL broadcast visual world instead of the darkroom proof style", async () => {
  const Frame = await loadFrame();
  const html = renderToStaticMarkup(React.createElement(Frame, {
    model: {
      branding: { publicTitle: "賽後判讀" },
      seriesContext: { league: "LCK", teamA: "T1", teamB: "HLE", score: "2-3" },
    },
    sceneTag: "RESULT_HOOK",
  }));

  assert.match(html, /data-visual-world="lol-broadcast"/);
  assert.match(html, /#07141C/i);
  assert.match(html, /#C89B3C/i);
  assert.match(html, /#0AC8B9/i);
  assert.match(html, /aria-label="故事進度 1\/6"/);
  assert.doesNotMatch(html, /#E94B35|film-grain|proof-mark/i);
});

test("frame keeps a dense verified series telemetry rail visible across scenes", async () => {
  const Frame = await loadFrame();
  const html = renderToStaticMarkup(React.createElement(Frame, {
    model: {
      branding: { publicTitle: "賽後判讀" },
      seriesContext: {
        league: "LCK",
        season: "2026",
        matchDate: "2026-09-26",
        gameCount: 5,
        teamA: "T1",
        teamB: "HLE",
        score: "2-3",
      },
      matchup: { primaryEvidence: { metric: "GPM", delta: 72 } },
      gameFlow: { gameNumber: 2, towerScore: "8–4", goldDelta: 8917 },
      proof: { player: { name: "Ruler", rawStats: { csm: 9.88 } } },
    },
    sceneTag: "MAP_CONVERSION",
  }));

  assert.match(html, /data-series-telemetry="visible"/);
  assert.match(html, /LCK/);
  assert.match(html, /2026-09-26/);
  assert.match(html, /5 GAMES/);
  assert.match(html, /data-story-rail="6-scenes"/);
  assert.match(html, /04\s*\/\s*06/);
  assert.match(html, /data-evidence-ticker="persistent"/);
  assert.match(html, /\+72/);
  assert.match(html, /8–4/);
  assert.match(html, /\+8,917/);
  assert.match(html, /9\.88/);
});
