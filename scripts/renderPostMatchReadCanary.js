#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { runPlayerRadarFromSnapshot } = require("../utils/esports/playerRadarRunner");
const { renderVideosFromRequest } = require("../utils/render/renderService");
const { selectAndStageLicensedMusic } = require("../utils/render/licensedMusicLibrary");

const SCAN_ID = "scan-2026-08-12-b509a93dc3";
const SERIES_ID = "LCK CL 2026 Rounds 3-4::2026-08-12::HANJIN BRION Challengers::Hanwha Life Esports Challengers";

function buildCanaryOptions(args = []) {
  const unsafe = args.some((arg) => /publish|queue|production/i.test(String(arg)));
  if (unsafe) throw new Error("Post Match Read is a preview-only canary; publishing and production arguments are forbidden.");
  if (args.length > 0) throw new Error(`Unsupported preview-only canary argument: ${args[0]}`);
  return {
    scanId: SCAN_ID,
    seriesId: SERIES_ID,
    matchupPlayerName: "Jackal (Lee Su-min)",
    mvpPlayerName: "Pyeonsik",
    mode: "preview",
    languages: ["zh"],
  };
}

function getPrimaryRepoRoot() {
  const commonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
  return path.dirname(commonDir);
}

function readFrozenCandidateSnapshot(scanId, { primaryRepoRoot = getPrimaryRepoRoot() } = {}) {
  const storePath = path.join(primaryRepoRoot, ".data", "esports-candidate-scans.json");
  const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
  const snapshot = (store.scans || []).find((entry) => entry.scanId === scanId);
  if (!snapshot) throw new Error(`Candidate scan not found: ${scanId}`);
  return snapshot;
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
  getPrimaryRepoRoot,
  readFrozenCandidateSnapshot,
  runCanary,
};
