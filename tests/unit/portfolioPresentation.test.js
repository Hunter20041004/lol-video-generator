const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { build } = require("esbuild");
const { parse } = require("yaml");

const ROOT = path.resolve(__dirname, "../..");
const REQUIRED_CI_COMMANDS = [
  "npm ci",
  "npm run tdd:doctor",
  "npm run test:coverage",
  "npx next build",
  "npm audit --audit-level=high",
];

function hasEnabledLiveContracts(value) {
  if (Array.isArray(value)) return value.some(hasEnabledLiveContracts);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => (
    (key === "RUN_EXTERNAL_CONTRACTS" && String(child) === "1") ||
    hasEnabledLiveContracts(child)
  ));
}

function assertCiWorkflow(workflow) {
  let document;
  assert.doesNotThrow(() => {
    document = parse(workflow);
  }, "workflow must be valid YAML");

  assert.deepEqual(document.permissions, { contents: "read" }, "workflow must use only contents: read");
  assert.equal(typeof document.concurrency?.group, "string", "workflow must define a concurrency group");
  assert.notEqual(document.concurrency.group.trim(), "", "workflow must define a nonempty concurrency group");
  assert.equal(document.concurrency["cancel-in-progress"], true, "workflow must set cancel-in-progress: true");

  assert.deepEqual(Object.keys(document.jobs || {}), ["verify"], "workflow must contain exactly the verify job");
  const verify = document.jobs?.verify;
  assert.equal(verify?.permissions, undefined, "verify permissions must inherit repository least privilege");
  assert.equal(verify?.["runs-on"], "ubuntu-latest", "verify must run on ubuntu-latest");
  assert.equal(verify?.["timeout-minutes"], 25, "verify must use a 25-minute timeout");
  const steps = Array.isArray(verify?.steps) ? verify.steps : [];
  const setupNode = steps.find((step) => String(step?.uses || "").startsWith("actions/setup-node@"));
  assert.equal(String(setupNode?.with?.["node-version"]), "22", "verify must use Node 22");
  assert.deepEqual(
    steps.filter((step) => typeof step?.run === "string").map((step) => step.run),
    REQUIRED_CI_COMMANDS,
    "workflow must use the exact CI parity commands",
  );

  assert.equal(hasEnabledLiveContracts(document), false, "workflow must not enable live external contracts");
  assert.doesNotMatch(workflow, /\bsecrets\s*(?:\.|\[)/i, "workflow must not contain secret references");
  assert.doesNotMatch(
    workflow,
    /portfolio:render|\bremotion\b|\brender\b|\.mp4\b/i,
    "workflow must not contain render or MP4 instructions",
  );
}

function runLolalyticsContract(runExternalContracts) {
  const detailHtml = `
    <img src="/item64/3100.webp" alt="Lich Bane" />
    <strong>52.1</strong><span>1,200</span>
    <img src="/runes/8112.webp" alt="Electrocute" />
    <strong>53.2</strong><span>900</span>
  `;
  const script = `
    const { after } = require("node:test");
    let fetchCalls = 0;
    global.fetch = async (url) => {
      fetchCalls += 1;
      return {
        ok: true,
        text: async () => String(url).includes("/tierlist/")
          ? "LoLalytics tier"
          : ${JSON.stringify(detailHtml)},
      };
    };
    after(() => console.log("FETCH_CALLS=" + fetchCalls));
    require(${JSON.stringify(path.join(ROOT, "tests/contract/metaFactory/lolalyticsContract.test.js"))});
  `;
  const env = { ...process.env };
  if (runExternalContracts === undefined) delete env.RUN_EXTERNAL_CONTRACTS;
  else env.RUN_EXTERNAL_CONTRACTS = runExternalContracts;

  return execFileSync(process.execPath, ["-e", script], {
    cwd: ROOT,
    encoding: "utf8",
    env,
  });
}

test("LoLalytics contracts make zero fetch calls when live contracts are disabled", () => {
  const output = runLolalyticsContract(undefined);

  assert.match(output, /FETCH_CALLS=0/);
});

test("LoLalytics contracts use the stubbed boundary when live contracts are enabled", () => {
  const output = runLolalyticsContract("1");

  assert.match(output, /FETCH_CALLS=2/);
});

test("CI uses least privilege and non-live local parity", () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, ".github/workflows/ci.yml"),
    "utf8",
  );

  assert.doesNotThrow(() => assertCiWorkflow(workflow));
});

test("CI contract rejects malformed workflow YAML", () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, ".github/workflows/ci.yml"),
    "utf8",
  );

  assert.throws(
    () => assertCiWorkflow(`${workflow}\ninvalid: [\n`),
    /valid YAML/,
  );
});

test("CI contract rejects unsafe or non-parity workflow variants", () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, ".github/workflows/ci.yml"),
    "utf8",
  );
  const variants = [
    ["verify job permissions", workflow.replace("    runs-on: ubuntu-latest", "    permissions: write-all\n    runs-on: ubuntu-latest"), /verify permissions/],
    ["additional privileged job", `${workflow}\n  publish:\n    permissions: write-all\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo unsafe\n`, /exactly the verify job/],
    ["Ubuntu runner", workflow.replace("ubuntu-latest", "windows-latest"), /ubuntu-latest/],
    ["cancellation", workflow.replace("cancel-in-progress: true", "cancel-in-progress: false"), /cancel-in-progress/],
    ["concurrency group", workflow.replace(/group: .*\n/, 'group: ""\n'), /concurrency group/],
    ["parity order", workflow.replace("npm ci\n      - run: npm run tdd:doctor", "npm run tdd:doctor\n      - run: npm ci"), /exact CI parity commands/],
    ["unquoted live flag", `${workflow}\nenv:\n  RUN_EXTERNAL_CONTRACTS: 1\n`, /live external contracts/],
    ["quoted live flag", `${workflow}\nenv:\n  RUN_EXTERNAL_CONTRACTS: "1"\n`, /live external contracts/],
    ["dot secret", `${workflow}\nenv:\n  TOKEN: \${{ secrets.TOKEN }}\n`, /secret references/],
    ["bracket secret", `${workflow}\nenv:\n  TOKEN: \${{ secrets['TOKEN'] }}\n`, /secret references/],
    ["Remotion", `${workflow}\nrenderer: remotion\n`, /render or MP4/],
    ["render", `${workflow}\ncommand: render\n`, /render or MP4/],
    ["portfolio render", `${workflow}\ncommand: portfolio:render\n`, /render or MP4/],
    ["MP4", `${workflow}\nartifact: output.MP4\n`, /render or MP4/],
  ];

  for (const [label, variant, expected] of variants) {
    assert.throws(() => assertCiWorkflow(variant), expected, label);
  }
});

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
              React.createElement(
                "x-composition",
                { "data-id": id, "data-default-props": JSON.stringify(defaultProps) },
                React.createElement(Component, defaultProps),
              );
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
    const rendered = markup.match(new RegExp(`<x-composition data-id="${id}"[^>]*>([\\s\\S]*?)</x-composition>`));
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

test("portfolio UI candidate and Meta tier render default use the same synthetic evidence", async () => {
  const { createPortfolioDemoState } = require("../../utils/portfolioDemo");
  const { RemotionRoot } = await loadRemotionModule("src/Root.jsx");
  const candidate = createPortfolioDemoState().candidates[0];
  const markup = renderToStaticMarkup(React.createElement(RemotionRoot));
  const rendered = markup.match(/<x-composition data-id="MetaTierRankingVideo" data-default-props="([^"]+)"/);

  assert.ok(rendered, "MetaTierRankingVideo should expose its default render props");
  for (const entry of candidate.entries) {
    assert.match(rendered[1], new RegExp(`${entry.champion}.*tierScore.*${entry.tierScore}`));
  }
});

test("separate portfolio demo states have independent nested fixture data", () => {
  const { createPortfolioDemoState } = require("../../utils/portfolioDemo");
  const first = createPortfolioDemoState();
  const second = createPortfolioDemoState();

  first.candidates[0].entries[0].champion = "Mutated Pick";
  first.renderResult.videos[0].url = "/mutated.mp4";

  assert.equal(second.candidates[0].entries[0].champion, "Synthetic Pick A");
  assert.equal(second.renderResult.videos[0].url, "/demo/meta-tier-ranking.mp4");
});

test("separate portfolio render props have independent nested fixture data", () => {
  const { createPortfolioRenderProps } = require("../../utils/portfolioDemo");
  const first = createPortfolioRenderProps();
  const second = createPortfolioRenderProps();

  first.data.entries[0].champion = "Mutated Render Pick";

  assert.equal(second.data.entries[0].champion, "Synthetic Pick A");
});

test("portfolio demo state is enabled only by the exact portfolio query", () => {
  const { createPortfolioDemoStateFromSearch } = require("../../utils/portfolioDemo");

  assert.equal(typeof createPortfolioDemoStateFromSearch, "function");
  assert.equal(createPortfolioDemoStateFromSearch(""), null);
  assert.equal(createPortfolioDemoStateFromSearch("?portfolio=0"), null);
  assert.equal(createPortfolioDemoStateFromSearch("?portfolio=1").candidates[0].synthetic, true);
});

test("workbench enables deterministic evidence only with portfolio query", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/page.jsx"), "utf8");
  assert.match(page, /createPortfolioDemoStateFromSearch\(window\.location\.search\)/);
  assert.match(page, /Synthetic portfolio fixture/);
});

test("portfolio render command passes canonical synthetic props through the Remotion CLI", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const renderScriptPath = path.join(ROOT, "scripts/renderPortfolioEvidence.js");

  assert.equal(pkg.scripts["portfolio:render"], "node scripts/renderPortfolioEvidence.js");
  assert.equal(fs.existsSync(renderScriptPath), true);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-portfolio-render-"));
  const propsPath = path.join(tempDir, "props.json");
  try {
    const { buildPortfolioRenderArgs, resolveRemotionBinary, writePortfolioProps } = require(renderScriptPath);
    writePortfolioProps(propsPath);
    const written = JSON.parse(fs.readFileSync(propsPath, "utf8"));
    const candidate = require("../../utils/portfolioDemo").createPortfolioDemoState().candidates[0];

    assert.deepEqual(written.data.entries, candidate.entries);
    assert.equal(
      resolveRemotionBinary(),
      path.join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "remotion.cmd" : "remotion"),
    );
    assert.deepEqual(buildPortfolioRenderArgs(propsPath), [
      "render",
      "src/index.jsx",
      "MetaTierRankingVideo",
      "public/demo/meta-tier-ranking.mp4",
      "--muted",
      "--frames=0-179",
      "--pixel-format=yuv420p",
      `--props=${propsPath}`,
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  assert.equal(pkg.scripts["portfolio:capture"], "node scripts/capturePortfolioEvidence.js");
});

test("portfolio evidence has the required binary contracts", () => {
  const screenshot = fs.readFileSync(path.join(ROOT, "docs/screenshots/workbench.png"));
  const videoPath = path.join(ROOT, "public/demo/meta-tier-ranking.mp4");

  assert.deepEqual([...screenshot.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(screenshot.readUInt32BE(16), 1440);
  assert.equal(screenshot.readUInt32BE(20), 900);
  assert.equal(fs.existsSync(videoPath), true);
  assert.ok(fs.statSync(videoPath).size > 100 * 1024);
});

test("README makes committed synthetic evidence discoverable and exactly reproducible", () => {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const firstSection = readme.slice(0, readme.indexOf("## 作品集重點"));

  assert.match(firstSection, /\[觀看靜音 synthetic MP4\]\(public\/demo\/meta-tier-ranking\.mp4\)/);
  assert.match(firstSection, /\[查看工作台 PNG\]\(docs\/screenshots\/workbench\.png\)/);
  assert.match(firstSection, /`http:\/\/localhost:3000\/\?portfolio=1`/);
  assert.match(readme, /npx playwright install chromium/);
  assert.match(readme, /npm run portfolio:render/);
  assert.match(readme, /npm run dev/);
  assert.match(readme, /npm run portfolio:capture/);
  assert.match(readme, /generated synthetic evidence[^\n]+not live Riot, player, or ranked data/i);
});

test("worker executable exposes only Gemini analysis and Meta publishing status", () => {
  const worker = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");

  assert.doesNotMatch(worker, /GOOGLE_(?:CLIENT|REFRESH)|YouTube|youtubeResult/);
  assert.match(worker, /GEMINI_API_KEY/);
  assert.match(worker, /Instagram \/ Threads/);
  assert.match(worker, /result\.publish/);
});

test("package omits googleapis when no runtime module imports it", () => {
  const runtimeFiles = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT })
    .toString("utf8")
    .split("\0")
    .filter((file) => /^(?:app|src|utils|scripts)\//.test(file) || /^[^/]+\.(?:js|jsx)$/.test(file));
  const consumers = runtimeFiles.filter((file) => /(?:require\(|from |import\()["']googleapis["']/.test(
    fs.readFileSync(path.join(ROOT, file), "utf8"),
  ));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));

  assert.deepEqual(consumers, []);
  assert.equal(Object.hasOwn(pkg.dependencies, "googleapis"), false);
  assert.equal(Object.hasOwn(lock.packages[""].dependencies, "googleapis"), false);
  assert.equal(lock.packages["node_modules/googleapis"], undefined);
});

test("README limits ISC to Hunter-authored work and preserves third-party terms", () => {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  assert.match(readme, /ISC covers only software and documentation authored by Hunter Tseng（曾尉庭）/);
  assert.match(readme, /Riot trademarks and data, and all other third-party assets and materials, remain under their respective terms/);
});
