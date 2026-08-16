function renderedVideos(render = {}) {
  if (Array.isArray(render.videos)) return render.videos.filter((video) => video?.videoUrl);
  if (!render.videoUrl) return [];
  return [{ locale: "zh", label: "中文版", videoUrl: render.videoUrl, fileName: render.fileName }];
}

function persistPreviewArtifact(item, render, options = {}) {
  const videos = renderedVideos(render);
  if (!item?.id || videos.length === 0) return item;
  const now = options.now || (() => new Date());
  const updatePatchItem = options.updatePatchItem || require("./store").updatePatchItem;
  return updatePatchItem(item.id, {
    renderedAt: now().toISOString(),
    renderResult: { videos },
  });
}

module.exports = {
  persistPreviewArtifact,
  renderedVideos,
};
