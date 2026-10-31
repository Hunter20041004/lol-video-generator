const { createMatchStoryPreview } = require("../../../../../utils/esports/matchStoryPreview");
const { createMatchStoryPreviewPost } = require("../../../../../utils/esports/matchStoryPreviewApi");
const { renderMatchStoryPreview } = require("../../../../../utils/render/renderService");

export const runtime = "nodejs";
export const POST = createMatchStoryPreviewPost(createMatchStoryPreview({ renderer: renderMatchStoryPreview }));
