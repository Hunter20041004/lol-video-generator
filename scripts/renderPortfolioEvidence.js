const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createPortfolioRenderProps } = require("../utils/portfolioDemo");

const ROOT = path.resolve(__dirname, "..");

function writePortfolioProps(propsPath) {
  fs.writeFileSync(propsPath, JSON.stringify(createPortfolioRenderProps()), "utf8");
}

function buildPortfolioRenderArgs(propsPath) {
  return [
    "render",
    "src/index.jsx",
    "MetaTierRankingVideo",
    "public/demo/meta-tier-ranking.mp4",
    "--muted",
    "--frames=0-179",
    "--pixel-format=yuv420p",
    `--props=${propsPath}`,
  ];
}

function resolveRemotionBinary() {
  const executable = process.platform === "win32" ? "remotion.cmd" : "remotion";
  return path.join(ROOT, "node_modules", ".bin", executable);
}

function renderPortfolioEvidence() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hvs-portfolio-render-"));
  const propsPath = path.join(tempDir, "props.json");

  try {
    writePortfolioProps(propsPath);
    execFileSync(resolveRemotionBinary(), buildPortfolioRenderArgs(propsPath), { cwd: ROOT, stdio: "inherit" });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  renderPortfolioEvidence();
}

module.exports = { buildPortfolioRenderArgs, renderPortfolioEvidence, resolveRemotionBinary, writePortfolioProps };
