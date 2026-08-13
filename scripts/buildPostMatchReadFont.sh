#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="$(mktemp -d)"
SOURCE_URL="https://raw.githubusercontent.com/google/fonts/73fc2ff52147e34a74804b500cf89ca219eac55d/ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf"
LICENSE_URL="https://raw.githubusercontent.com/google/fonts/73fc2ff52147e34a74804b500cf89ca219eac55d/ofl/notoseriftc/OFL.txt"
SOURCE_SHA="0077e18f57c6908f4a000969880940bdb0dad057c0e8d98b49dc364c3d1b09c6"
OUTPUT_SHA="22cfa6a3c60cb2b314d451958213a0a65ce9f0af4d4aa3c28796937be725c830"
BUILD_EPOCH="1786646238"

cleanup() {
  rm -rf -- "${BUILD_DIR}"
}
trap cleanup EXIT

python3 -m venv "${BUILD_DIR}/venv"
"${BUILD_DIR}/venv/bin/python" -m pip install --quiet 'fonttools[woff]==4.63.0' 'brotli==1.2.0'
curl -fsSL "${SOURCE_URL}" -o "${BUILD_DIR}/source.ttf"
curl -fsSL "${LICENSE_URL}" -o "${BUILD_DIR}/OFL.txt"

printf '%s  %s\n' "${SOURCE_SHA}" "${BUILD_DIR}/source.ttf" | shasum -a 256 -c -
SOURCE_DATE_EPOCH="${BUILD_EPOCH}" "${BUILD_DIR}/venv/bin/fonttools" varLib.instancer "${BUILD_DIR}/source.ttf" wght=700 --output="${BUILD_DIR}/static.ttf"
"${BUILD_DIR}/venv/bin/pyftsubset" "${BUILD_DIR}/static.ttf" \
  --text-file="${PROJECT_DIR}/config/post-match-read-font-glyphs.txt" \
  --output-file="${BUILD_DIR}/NotoSerifTC-PostMatchRead-700.woff2" \
  --flavor=woff2 --layout-features='*' --glyph-names --symbol-cmap \
  --legacy-cmap --notdef-glyph --notdef-outline --recommended-glyphs \
  --name-IDs='*' --name-legacy --name-languages='*'

ACTUAL_OUTPUT_SHA="$(shasum -a 256 "${BUILD_DIR}/NotoSerifTC-PostMatchRead-700.woff2" | cut -d ' ' -f 1)"
printf 'Post Match Read font output SHA-256: %s\n' "${ACTUAL_OUTPUT_SHA}"
printf '%s  %s\n' "${OUTPUT_SHA}" "${BUILD_DIR}/NotoSerifTC-PostMatchRead-700.woff2" | shasum -a 256 -c -
mkdir -p "${PROJECT_DIR}/public/fonts"
cp "${BUILD_DIR}/NotoSerifTC-PostMatchRead-700.woff2" "${PROJECT_DIR}/public/fonts/NotoSerifTC-PostMatchRead-700.woff2"
cp "${BUILD_DIR}/OFL.txt" "${PROJECT_DIR}/public/fonts/OFL-NotoSerifTC.txt"
