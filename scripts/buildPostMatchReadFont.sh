#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="$(mktemp -d)"
SOURCE_REVISION="73fc2ff52147e34a74804b500cf89ca219eac55d"
BUILD_EPOCH="1786646238"
NOTO_URL="https://raw.githubusercontent.com/google/fonts/${SOURCE_REVISION}/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf"
NOTO_SHA="864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f"
BARLOW_800_URL="https://raw.githubusercontent.com/google/fonts/${SOURCE_REVISION}/ofl/barlowcondensed/BarlowCondensed-ExtraBold.ttf"
BARLOW_800_SHA="724c9c25952d5f4a2d87185d9767aa006144c5f0d944dc05bf7d5d603551c260"
BARLOW_900_URL="https://raw.githubusercontent.com/google/fonts/${SOURCE_REVISION}/ofl/barlowcondensed/BarlowCondensed-Black.ttf"
BARLOW_900_SHA="e74b750df582c608f35db467b711b2b60d2217618e85e60b72b42dfd00446cab"
NOTO_LICENSE_URL="https://raw.githubusercontent.com/google/fonts/${SOURCE_REVISION}/ofl/notosanstc/OFL.txt"
BARLOW_LICENSE_URL="https://raw.githubusercontent.com/google/fonts/${SOURCE_REVISION}/ofl/barlowcondensed/OFL.txt"

cleanup() {
  rm -rf -- "${BUILD_DIR}"
}
trap cleanup EXIT

python3 -m venv "${BUILD_DIR}/venv"
"${BUILD_DIR}/venv/bin/python" -m pip install --quiet 'fonttools[woff]==4.63.0' 'brotli==1.2.0'
curl -fsSL "${NOTO_URL}" -o "${BUILD_DIR}/noto-variable.ttf"
curl -fsSL "${BARLOW_800_URL}" -o "${BUILD_DIR}/barlow-800.ttf"
curl -fsSL "${BARLOW_900_URL}" -o "${BUILD_DIR}/barlow-900.ttf"
curl -fsSL "${NOTO_LICENSE_URL}" -o "${BUILD_DIR}/OFL-NotoSansTC.txt"
curl -fsSL "${BARLOW_LICENSE_URL}" -o "${BUILD_DIR}/OFL-BarlowCondensed.txt"

printf '%s  %s\n' "${NOTO_SHA}" "${BUILD_DIR}/noto-variable.ttf" | shasum -a 256 -c -
printf '%s  %s\n' "${BARLOW_800_SHA}" "${BUILD_DIR}/barlow-800.ttf" | shasum -a 256 -c -
printf '%s  %s\n' "${BARLOW_900_SHA}" "${BUILD_DIR}/barlow-900.ttf" | shasum -a 256 -c -

export SOURCE_DATE_EPOCH="${BUILD_EPOCH}"
"${BUILD_DIR}/venv/bin/fonttools" varLib.instancer "${BUILD_DIR}/noto-variable.ttf" wght=700 --output="${BUILD_DIR}/noto-700.ttf"
"${BUILD_DIR}/venv/bin/fonttools" varLib.instancer "${BUILD_DIR}/noto-variable.ttf" wght=900 --output="${BUILD_DIR}/noto-900.ttf"

subset_font() {
  local source_file="$1"
  local output_name="$2"
  "${BUILD_DIR}/venv/bin/pyftsubset" "${source_file}" \
    --text-file="${PROJECT_DIR}/config/post-match-read-font-glyphs.txt" \
    --output-file="${BUILD_DIR}/${output_name}" \
    --flavor=woff2 --layout-features='*' --glyph-names --symbol-cmap \
    --legacy-cmap --notdef-glyph --notdef-outline --recommended-glyphs \
    --name-IDs='*' --name-legacy --name-languages='*'
}

subset_font "${BUILD_DIR}/barlow-800.ttf" "BarlowCondensed-PostMatchRead-800.woff2"
subset_font "${BUILD_DIR}/barlow-900.ttf" "BarlowCondensed-PostMatchRead-900.woff2"
subset_font "${BUILD_DIR}/noto-700.ttf" "NotoSansTC-PostMatchRead-700.woff2"
subset_font "${BUILD_DIR}/noto-900.ttf" "NotoSansTC-PostMatchRead-900.woff2"

mkdir -p "${PROJECT_DIR}/public/fonts"
cp "${BUILD_DIR}"/*-PostMatchRead-*.woff2 "${PROJECT_DIR}/public/fonts/"
cp "${BUILD_DIR}/OFL-NotoSansTC.txt" "${PROJECT_DIR}/public/fonts/OFL-NotoSansTC.txt"
cp "${BUILD_DIR}/OFL-BarlowCondensed.txt" "${PROJECT_DIR}/public/fonts/OFL-BarlowCondensed.txt"

node - "${PROJECT_DIR}" "${SOURCE_REVISION}" <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const projectDir = process.argv[2];
const sourceRevision = process.argv[3];
const names = [
  "BarlowCondensed-PostMatchRead-800.woff2",
  "BarlowCondensed-PostMatchRead-900.woff2",
  "NotoSansTC-PostMatchRead-700.woff2",
  "NotoSansTC-PostMatchRead-900.woff2",
];
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const files = Object.fromEntries(names.map((name) => [
  name,
  sha256(path.join(projectDir, "public", "fonts", name)),
]));
const manifest = { sourceRevision, files };
fs.writeFileSync(
  path.join(projectDir, "config", "post-match-read-font-hashes.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
NODE

shasum -a 256 "${PROJECT_DIR}"/public/fonts/*-PostMatchRead-*.woff2 "${PROJECT_DIR}/config/post-match-read-font-hashes.json"
