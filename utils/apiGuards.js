const { assertSupportedDataType } = require("./pipelineRegistry");
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
    return {
      dataType: assertSupportedDataType(body.dataType || "PATCH"),
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
    const dataType = assertSupportedDataType(body.analysis?.dataType || body.dataType || "PATCH");
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
