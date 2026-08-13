#!/usr/bin/env node
const path = require("node:path");
const { runPlayerRadarFromSnapshot } = require("../utils/esports/playerRadarRunner");
const { renderVideosFromRequest } = require("../utils/render/renderService");
const { selectAndStageLicensedMusic } = require("../utils/render/licensedMusicLibrary");
const genHleSnapshot = require("../tests/fixtures/esports/genHlePostMatchReadCanary");

const SCAN_ID = "canary-gen-hle-2026";
const SERIES_ID = "LCK-2026-GEN-HLE-2-0";

function buildCanaryOptions(args = []) {
  const unsafe = args.some((arg) => /publish|queue|production/i.test(String(arg)));
  if (unsafe) throw new Error("Post Match Read is a preview-only canary; publishing and production arguments are forbidden.");
  if (args.length > 0) throw new Error(`Unsupported preview-only canary argument: ${args[0]}`);
  return {
    scanId: SCAN_ID,
    seriesId: SERIES_ID,
    matchupPlayerName: "Chovy",
    mvpPlayerName: "Ruler",
    mode: "preview",
    languages: ["zh"],
  };
}

function readFrozenCandidateSnapshot(scanId) {
  if (scanId !== SCAN_ID) throw new Error(`Frozen canary scan not found: ${scanId}`);
  return genHleSnapshot;
}

async function runCanary(options = buildCanaryOptions(), deps = {}) {
  let selectedTrack = null;
  const renderVideos = deps.renderVideosFromRequest || ((request) => renderVideosFromRequest(request, {
    selectLicensedMusicImpl: (selectionOptions) => {
      selectedTrack = selectAndStageLicensedMusic({ ...selectionOptions, random: () => 0 });
      return selectedTrack;
    },
  }));
  const result = await (deps.runPlayerRadarFromSnapshot || runPlayerRadarFromSnapshot)(options, {
    readCandidateSnapshot: deps.readCandidateSnapshot || ((scanId) => readFrozenCandidateSnapshot(scanId)),
    renderVideosFromRequest: renderVideos,
  });
  const video = result.videos[0];
  const videoPath = path.join(process.cwd(), "public", String(video.videoUrl || "").replace(/^\/+/, ""));
  const summary = {
    videoPath,
    mediaReport: result.validationReports[0],
    selectedTrack: selectedTrack ? { trackId: selectedTrack.trackId, audioPlan: selectedTrack.audioPlan } : null,
    publish: { jobs: result.publish?.jobs || [] },
  };
  return summary;
}

async function main() {
  const summary = await runCanary(buildCanaryOptions(process.argv.slice(2)));
  console.log(`Canary video: ${summary.videoPath}`);
  console.log(`Selected track: ${summary.selectedTrack?.trackId || "none"}`);
  console.log(`Publish jobs: ${summary.publish.jobs.length}`);
  console.log(JSON.stringify(summary));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildCanaryOptions,
  readFrozenCandidateSnapshot,
  runCanary,
};
