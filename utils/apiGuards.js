const { assertSupportedDataType } = require("./pipelineRegistry");
const {
  assertPlayerRadarEvidence,
  hasPlayerRadarPayload,
  isPlayerRadarPayload,
} = require("./esports/playerRadarEvidence");
const {
  DEFAULT_PLATFORMS,
  assertSupportedPlatform,
} = require("./publishing");

function badRequest(error) {
  error.statusCode = 400;
  return error;
}

function validateAnalyzeRequest(body = {}) {
  try {
    const dataType = assertSupportedDataType(body.dataType || "PATCH");
    if (dataType === "PLAYER_RADAR") {
      throw new Error("PLAYER_RADAR must use /api/esports/player-radar because the generic /api/analyze path does not run the required evidence gates.");
    }
    return {
      dataType,
    };
  } catch (error) {
    throw badRequest(error);
  }
}

function requestedPlatforms(body = {}) {
  if (Array.isArray(body.platforms) && body.platforms.length > 0) {
    return body.platforms;
  }
  if (body.platform === "all") return DEFAULT_PLATFORMS;
  return [body.platform || "instagram"];
}

function validatePublishRequest(body = {}) {
  try {
    const analysis = body.analysis && typeof body.analysis === "object" ? body.analysis : body;
    const inferredType = body.analysis?.dataType
      || body.dataType
      || (hasPlayerRadarPayload(analysis) ? "PLAYER_RADAR" : "PATCH");
    const dataType = assertSupportedDataType(inferredType);
    if (dataType === "PLAYER_RADAR") {
      assertPlayerRadarEvidence(isPlayerRadarPayload(analysis) || hasPlayerRadarPayload(analysis)
        ? analysis
        : { ...analysis, dataType });
    }
    const platforms = requestedPlatforms(body).map(assertSupportedPlatform);
    return {
      dataType,
      platforms,
    };
  } catch (error) {
    throw badRequest(error);
  }
}

module.exports = {
  validateAnalyzeRequest,
  validatePublishRequest,
};
