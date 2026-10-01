const { createMatchStoryService } = require("../../../../utils/esports/matchStoryService");
const { createMatchStoryPost } = require("../../../../utils/esports/matchStoryApi");

export const runtime = "nodejs";
export const POST = createMatchStoryPost(createMatchStoryService());
