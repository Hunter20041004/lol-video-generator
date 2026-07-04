const { getThreadsConfig, getPublicVideoUrl, normalizeLocale } = require("../accounts");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithNetworkRetry(url, options) {
  const attempts = Number(process.env.META_FETCH_RETRY_ATTEMPTS || 3);
  const delayMs = Number(process.env.META_FETCH_RETRY_DELAY_MS || 500);
  let lastError = null;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(delayMs * attempt);
    }
  }
  throw lastError;
}

async function postForm(url, params) {
  const response = await fetchWithNetworkRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || `Threads API failed (${response.status})`);
  }
  return json;
}

async function getJson(url) {
  const response = await fetchWithNetworkRetry(url);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || `Threads API failed (${response.status})`);
  }
  return json;
}

async function waitForContainer(containerId, accessToken) {
  const maxAttempts = Number(process.env.THREADS_CONTAINER_MAX_ATTEMPTS || 120);
  const pollMs = Number(process.env.THREADS_CONTAINER_POLL_MS || 5000);
  let lastStatus = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await getJson(
      `https://graph.threads.net/v1.0/${containerId}?fields=status,error_message&access_token=${encodeURIComponent(accessToken)}`
    );
    lastStatus = status;
    if (status.status === "FINISHED") return status;
    if (status.status === "ERROR") {
      throw new Error(status.error_message || "Threads media container failed.");
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(
    `Threads media container ${containerId} was not ready after ${maxAttempts * pollMs}ms`
    + `${lastStatus ? `; last status: ${JSON.stringify(lastStatus)}` : ""}.`
  );
}

async function publish(task) {
  const locale = normalizeLocale(task.locale);
  const config = getThreadsConfig(locale);
  if (!config.userId || !config.accessToken) {
    return {
      status: "NEEDS_AUTH",
      needsAuth: true,
      message: "Missing THREADS_USER_ID / THREADS_ACCESS_TOKEN for this locale.",
    };
  }

  const publicVideoUrl = task.publicVideoUrl || getPublicVideoUrl(task.videoUrl);
  const text = task.copy?.caption || task.copy?.description || task.copy?.title || "";

  if (!publicVideoUrl && !config.allowTextOnly) {
    return {
      status: "NEEDS_PUBLIC_URL",
      message: "Threads video publishing needs PUBLIC_MEDIA_BASE_URL, or set THREADS_ALLOW_TEXT_ONLY=true for text-only posts.",
    };
  }

  const createPayload = publicVideoUrl
    ? {
        media_type: "VIDEO",
        video_url: publicVideoUrl,
        text,
        access_token: config.accessToken,
      }
    : {
        media_type: "TEXT",
        text,
        access_token: config.accessToken,
      };

  const base = "https://graph.threads.net/v1.0/me";
  const container = await postForm(`${base}/threads`, createPayload);
  if (publicVideoUrl) {
    await waitForContainer(container.id, config.accessToken);
  }
  const published = await postForm(`${base}/threads_publish`, {
    creation_id: container.id,
    access_token: config.accessToken,
  });

  return {
    status: "PUBLISHED",
    platform: "threads",
    postId: published.id,
    url: published.permalink || "",
  };
}

module.exports = {
  publish,
};
