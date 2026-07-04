const { getInstagramConfig, getPublicVideoUrl, normalizeLocale } = require("../accounts");

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

async function graphGet(url) {
  const response = await fetchWithNetworkRetry(url);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || `Instagram API failed (${response.status})`);
  }
  return json;
}

async function graphPost(url, params) {
  const response = await fetchWithNetworkRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || `Instagram API failed (${response.status})`);
  }
  return json;
}

async function waitForContainer(containerId, accessToken) {
  const maxAttempts = Number(process.env.INSTAGRAM_CONTAINER_MAX_ATTEMPTS || 120);
  const pollMs = Number(process.env.INSTAGRAM_CONTAINER_POLL_MS || 5000);
  let lastStatus = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const url = `https://graph.instagram.com/v25.0/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`;
    const status = await graphGet(url);
    lastStatus = status;
    if (status.status_code === "FINISHED") return status;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(status.status || `Instagram container ${status.status_code}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(
    `Instagram media container ${containerId} was not ready after ${maxAttempts * pollMs}ms`
    + `${lastStatus ? `; last status: ${JSON.stringify(lastStatus)}` : ""}.`
  );
}

async function getMediaPermalink(mediaId, accessToken) {
  if (!mediaId) return "";
  try {
    const params = new URLSearchParams({
      fields: "permalink",
      access_token: accessToken,
    });
    const media = await graphGet(`https://graph.instagram.com/v25.0/${mediaId}?${params.toString()}`);
    return media.permalink || "";
  } catch (error) {
    console.warn(`[Instagram] Could not fetch permalink for ${mediaId}: ${error.message}`);
    return "";
  }
}

async function publish(task) {
  const locale = normalizeLocale(task.locale);
  const config = getInstagramConfig(locale);
  if (!config.userId || !config.accessToken) {
    return {
      status: "NEEDS_AUTH",
      needsAuth: true,
      message: "Missing INSTAGRAM_USER_ID / INSTAGRAM_ACCESS_TOKEN for this locale.",
    };
  }

  const publicVideoUrl = task.publicVideoUrl || getPublicVideoUrl(task.videoUrl);
  if (!publicVideoUrl) {
    return {
      status: "NEEDS_PUBLIC_URL",
      message: "Instagram Reels publishing needs PUBLIC_MEDIA_BASE_URL so Meta can fetch the MP4.",
    };
  }

  const caption = task.copy?.caption || task.copy?.description || task.copy?.title || "";
  const base = `https://graph.instagram.com/v25.0/${config.userId}`;
  const container = await graphPost(`${base}/media`, {
    media_type: "REELS",
    video_url: publicVideoUrl,
    caption,
    access_token: config.accessToken,
  });

  await waitForContainer(container.id, config.accessToken);

  const published = await graphPost(`${base}/media_publish`, {
    creation_id: container.id,
    access_token: config.accessToken,
  });
  const permalink = await getMediaPermalink(published.id, config.accessToken);

  return {
    status: "PUBLISHED",
    platform: "instagram",
    mediaId: published.id,
    url: permalink,
  };
}

module.exports = {
  publish,
};
