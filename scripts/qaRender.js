#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ENTRY = path.join(ROOT, "src/index.jsx");
const OUT_DIR = path.join("/tmp", "hextech-render-qa");

const COMPOSITIONS = [
  "LeaguePatchVideo",
  "PlayerRadarVideo",
  "ItemUpdateVideo",
  "RuneUpdateVideo",
  "EsportsHeadToHeadRadarVideo",
  "EsportsMatchRecapVideo",
];

const run = (cmd, args) => {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
};

const assertFileLooksReal = (file) => {
  const stat = fs.statSync(file);
  if (stat.size < 25_000) {
    throw new Error(`Still render looks too small: ${file} (${stat.size} bytes)`);
  }
};

fs.mkdirSync(OUT_DIR, { recursive: true });

try {
  const compositions = run("npx", ["remotion", "compositions", ENTRY]);
  for (const id of COMPOSITIONS) {
    if (!compositions.includes(id)) {
      throw new Error(`Missing Remotion composition: ${id}`);
    }
  }

  for (const id of COMPOSITIONS) {
    const out = path.join(OUT_DIR, `${id}.png`);
    run("npx", ["remotion", "still", ENTRY, id, out, "--frame=45", "--timeout=90000"]);
    assertFileLooksReal(out);
    console.log(`✅ ${id} still OK -> ${out}`);
  }

  console.log(`\n✅ Render QA completed. Output: ${OUT_DIR}`);
} catch (error) {
  console.error(`\n❌ Render QA failed: ${error.message}`);
  process.exit(1);
}
