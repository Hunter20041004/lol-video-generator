function usableVideos(value) {
  return (Array.isArray(value) ? value : []).filter((video) => video?.videoUrl);
}

export function normalizeEsportsPreview(payload = {}) {
  const videos = usableVideos(payload.videos);
  const validationReports = Array.isArray(payload.validationReports) ? payload.validationReports : [];
  const validationFailures = validationReports.flatMap((report) => (
    report?.passed === true ? [] : Array.isArray(report?.reasons) ? report.reasons : ["媒體驗證未通過"]
  ));

  return {
    kind: "esports",
    videos,
    payloads: Array.isArray(payload.payloads) ? payload.payloads : [],
    validationReports,
    validationFailures,
  };
}

export function normalizeVersionPreview(payload = {}) {
  return {
    kind: "version",
    item: payload.item || null,
    videos: usableVideos(payload.render?.videos || payload.item?.renderResult?.videos),
  };
}

export function canPublishPreview(preview) {
  if (!preview || preview.videos.length === 0) return false;
  if (preview.kind === "esports") {
    return preview.validationReports.length === preview.videos.length
      && preview.validationReports.every((report) => report?.passed === true);
  }
  return true;
}

export function failedPublishJobs(payload = {}) {
  return (Array.isArray(payload.jobs) ? payload.jobs : [])
    .filter((job) => !["PUBLISHED", "QUEUED"].includes(job?.status));
}

export function humanizeWorkflowError(payload = {}) {
  const message = String(payload?.error || payload?.message || "操作失敗，請稍後重試。");
  if (payload?.needsAuth || /not authenticated|authentication|unauthorized/i.test(message)) {
    const platform = String(payload?.platform || (/threads/i.test(message) ? "Threads" : "Instagram"));
    const label = platform.toLowerCase() === "threads" ? "Threads" : "Instagram";
    return `${label} 連線已失效，請到進階工具重新連接後再試。`;
  }
  if (/leaguepedia|rate limit/i.test(message) && payload?.retryAt) {
    return `Leaguepedia 暫時限制請求，可於 ${new Date(payload.retryAt).toLocaleString("zh-TW")} 後重試。`;
  }
  return message;
}
