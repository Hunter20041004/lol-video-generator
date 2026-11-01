const http = require("node:http");
const { writeCandidateSnapshot } = require("../../../utils/esports/candidateStore");
const { createMatchStoryService } = require("../../../utils/esports/matchStoryService");
const { createMatchStoryPost } = require("../../../utils/esports/matchStoryApi");

const storyService = createMatchStoryService();
const post = createMatchStoryPost(storyService);
const previewRoot = process.env.STORY_TEST_RENDER_ROOT;
const previewPost = previewRoot ? require('../../../utils/esports/matchStoryPreviewApi').createMatchStoryPreviewPost(
  require('../../../utils/esports/matchStoryPreview').createMatchStoryPreview({
    storyService,
    assetResolver: (identity, options) => require('../../../utils/render/matchStoryAssets').prepareMatchStoryMaterials(identity, {...options, rootDir: previewRoot}),
    renderer: packet => require('../../../utils/render/matchStoryRenderer').renderMatchStoryPreview(packet, {rootDir: previewRoot}),
  })
) : null;
const server = http.createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const request = new Request(`http://127.0.0.1:${server.address().port}${incoming.url}`, {
      method: incoming.method, headers: incoming.headers, body: Buffer.concat(chunks),
    });
    const response = await (incoming.url === '/api/esports/story/preview' && previewPost ? previewPost : post)(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(await response.text());
  } catch {
    outgoing.writeHead(500);
    outgoing.end("fixture failure");
  }
});
process.once("message", (snapshot) => {
  writeCandidateSnapshot(snapshot);
  server.listen(0, "127.0.0.1", () => process.send({ port: server.address().port }));
});
process.on("disconnect", () => server.close());
