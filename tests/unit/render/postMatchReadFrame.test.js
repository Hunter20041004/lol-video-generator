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

test("frame preserves the selected game flow label", async () => {
  const Frame = await loadFrame();
  const html = renderToStaticMarkup(React.createElement(Frame, {
    model: { gameFlow: { gameNumber: 2 } }, sceneTag: "GAME_FLOW",
  }));
  assert.match(html, /遊戲過程 · GAME 2/);
});

test("series frame reports actual games instead of an inferred best-of", async () => {
  const Frame = await loadFrame();
  for (const gameCount of [5, 3, 4, 2, 1]) {
    const html = renderToStaticMarkup(React.createElement(Frame, {
      model: { seriesContext: { league: "LCK", gameCount, teamA: "T1", teamB: "HLE", score: "2-3" } },
      sceneTag: "FINAL_READ",
    }));
    assert.ok(html.includes(`賽後判讀 · LCK · 共 ${gameCount} 局`));
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
    assert.ok(html.includes("賽後判讀 · LCP"));
    assert.doesNotMatch(html, /共|BO[135]|undefined|NaN|Infinity/);
  }
});
