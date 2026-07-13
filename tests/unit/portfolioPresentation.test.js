const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { build } = require("esbuild");

const ROOT = path.resolve(__dirname, "../..");

async function loadRemotionModule(entryFile) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-remotion-contract-"));
  const outfile = path.join(tempDir, "entry.cjs");
  await build({
    entryPoints: [path.join(ROOT, entryFile)],
    outfile,
    bundle: true,
    format: "cjs",
    jsx: "automatic",
    platform: "node",
    plugins: [{
      name: "render-contract-remotion",
      setup(build) {
        build.onResolve({ filter: /^remotion$/ }, () => ({ path: "remotion", namespace: "render-contract" }));
        build.onLoad({ filter: /.*/, namespace: "render-contract" }, () => ({
          loader: "js",
          resolveDir: ROOT,
          contents: `
            import React from "react";
            export const AbsoluteFill = ({ children, ...props }) => React.createElement("div", props, children);
            export const Audio = (props) => React.createElement("audio", props);
            export const Composition = ({ id, component: Component, defaultProps }) =>
              React.createElement("x-composition", { "data-id": id }, React.createElement(Component, defaultProps));
            export const Img = (props) => React.createElement("img", props);
            export const OffthreadVideo = (props) => React.createElement("video", props);
            export const Sequence = ({ children, ...props }) => React.createElement("div", props, children);
            export const interpolate = (_value, _input, output) => output[0];
            export const spring = () => 1;
            export const staticFile = (src) => "/" + src;
            export const useCurrentFrame = () => 0;
            export const useVideoConfig = () => ({ fps: 30, width: 1080, height: 1920, durationInFrames: 390 });
          `,
        }));
      },
    }],
  });

  try {
    return require(outfile);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test("public setup documents only retained social publishers", () => {
  const env = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const publishingGuide = fs.readFileSync(
    path.join(ROOT, "docs/publishing-setup.md"),
    "utf8",
  );
  for (const stale of ["YOUTUBE_", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TIKTOK_"]) {
    assert.equal(env.includes(stale), false, stale);
    assert.equal(publishingGuide.includes(stale), false, stale);
  }
  assert.equal(/YouTube API|TikTok Content Posting API/.test(readme), false);
  assert.equal(/YouTube|TikTok/.test(publishingGuide), false);
  assert.match(env, /^GEMINI_API_KEY=/m);
  assert.match(readme, /Google Generative AI/);
  assert.match(readme, /Instagram \/ Threads/);
  assert.match(readme, /Executive Summary/);
});

test("package identity and tracked media have explicit rights", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const license = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.equal(pkg.description, "Bilingual LoL data-to-video pipeline with guarded social publishing.");
  assert.equal(pkg.author, "Hunter Tseng（曾尉庭）");
  assert.deepEqual(pkg.keywords, ["remotion", "nextjs", "content-automation", "league-of-legends"]);
  assert.match(license, /ISC License/);
  assert.match(readme, /User-supplied audio/);
  for (const name of ["bgm1.mp3", "bgm2.mp3", "bgm3.mp3"]) {
    assert.equal(fs.existsSync(path.join(ROOT, "public/audio", name)), false);
  }
});

test("explicitly muted tier ranking renders no audio and preserves supplied audio", async () => {
  const { Template_MetaTierRanking } = await loadRemotionModule("src/templates/Template_MetaTierRanking.jsx");
  const mutedMarkup = renderToStaticMarkup(
    React.createElement(Template_MetaTierRanking, { data: { bgmFile: null } }),
  );
  const suppliedMarkup = renderToStaticMarkup(
    React.createElement(Template_MetaTierRanking, { data: { bgmFile: "audio/licensed-by-user.mp3" } }),
  );

  assert.equal(mutedMarkup.includes("<audio"), false);
  assert.match(suppliedMarkup, /<audio[^>]+src="\/audio\/licensed-by-user\.mp3"/);
});

test("every retained Root composition is muted when user audio is omitted", async () => {
  const { RemotionRoot } = await loadRemotionModule("src/Root.jsx");
  const markup = renderToStaticMarkup(React.createElement(RemotionRoot));
  const compositionIds = [
    "LeaguePatchVideo",
    "ItemUpdateVideo",
    "RuneUpdateVideo",
    "PlayerRadarVideo",
    "EsportsHeadToHeadRadarVideo",
    "EsportsMatchRecapVideo",
    "MetaOffmetaVideo",
    "MetaTierRankingVideo",
  ];

  for (const id of compositionIds) {
    const rendered = markup.match(new RegExp(`<x-composition data-id="${id}">([\\s\\S]*?)</x-composition>`));
    assert.ok(rendered, `${id} should render from Root defaults`);
    assert.equal(rendered[1].includes("<audio"), false, `${id} should be muted`);
  }
});

test("tracked source docs and tests do not reference deleted demo audio", () => {
  const trackedFiles = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT })
    .toString("utf8")
    .split("\0")
    .filter((file) => ["src/", "utils/", "tests/", "docs/"].some((prefix) => file.startsWith(prefix)));
  const deletedAudioReference = /audio\/bgm[123]\.mp3/;
  const offenders = trackedFiles.filter((file) => deletedAudioReference.test(
    fs.readFileSync(path.join(ROOT, file), "utf8"),
  ));

  assert.deepEqual(offenders, []);
});

test("portfolio demo state contains a candidate and a playable render result", () => {
  const { createPortfolioDemoState } = require("../../utils/portfolioDemo");
  const state = createPortfolioDemoState();
  assert.equal(state.candidates.length > 0, true);
  assert.equal(state.candidates[0].synthetic, true);
  assert.equal(state.renderResult.videos[0].url, "/demo/meta-tier-ranking.mp4");
});

test("workbench enables deterministic evidence only with portfolio query", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");
  assert.match(page, /searchParams\.get\("portfolio"\) === "1"/);
  assert.match(page, /createPortfolioDemoState/);
  assert.match(page, /Synthetic portfolio fixture/);
});
