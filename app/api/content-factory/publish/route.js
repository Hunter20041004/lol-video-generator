import { NextResponse } from 'next/server';
const {
  selectPublishCandidates,
  updatePatchItem,
  summarizePatchItems,
  listPatchItems,
} = require('../../../../utils/contentFactory/store');
const { buildLocalizedAnalysis } = require('../../../../utils/contentFactory/analysisBuilder');
const { resolveInternalOrigin } = require('../../../../utils/contentFactory/internalOrigin');
const { createPublishJobs, retryFailedPublishJobs } = require('../../../../utils/publishing');
const { ensurePublicMediaBaseUrl } = require('../../../../utils/publishing/tunnel');
const { renderVideosFromRequest } = require('../../../../utils/render/renderService');

const PUBLISHABLE_STATUSES = new Set(['READY', 'FAILED']);

function getFinalStatus(action, publishResult) {
  if (action === 'queue') return 'QUEUED';
  const statuses = Array.isArray(publishResult?.jobs) ? publishResult.jobs.map((job) => job.status) : [];
  if (statuses.length > 0 && statuses.every((status) => status === 'PUBLISHED')) return 'PUBLISHED';
  if (statuses.includes('QUEUED')) return 'QUEUED';
  return 'FAILED';
}

function canRetryExistingPublishJobs(item) {
  return Array.isArray(item?.renderResult?.videos)
    && item.renderResult.videos.length > 0
    && Array.isArray(item?.publishResult?.jobs)
    && item.publishResult.jobs.some((job) => job.status !== 'PUBLISHED');
}

function getRenderedVideos(item) {
  return Array.isArray(item?.renderResult?.videos)
    ? item.renderResult.videos.filter((video) => video?.videoUrl)
    : [];
}

function selectRequestedCandidates(body, count) {
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const patchVersion = typeof body.patchVersion === 'string' ? body.patchVersion.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const itemIds = Array.isArray(body.itemIds)
    ? body.itemIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  if (itemIds.length === 0) return selectPublishCandidates({ count, projectId, patchVersion, category });

  const itemsById = new Map(listPatchItems().map((item) => [item.id, item]));
  return itemIds
    .map((id) => itemsById.get(id))
    .filter((item) => item
      && PUBLISHABLE_STATUSES.has(item.status)
      && (!projectId || item.projectId === projectId));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const count = Math.min(5, Math.max(1, Number(body.count) || 1));
  const action = body.action === 'queue' ? 'queue' : 'publish';
  const platforms = Array.isArray(body.platforms) && body.platforms.length > 0
    ? body.platforms
    : ['instagram', 'threads'];
  const internalOrigin = resolveInternalOrigin(request.url);
  const candidates = selectRequestedCandidates(body, count);
  const results = [];

  for (const item of candidates) {
    try {
      let analysis = null;
      let renderJson = null;
      let videos = getRenderedVideos(item);

      if (canRetryExistingPublishJobs(item)) {
        updatePatchItem(item.id, { status: 'PUBLISHING', error: null });
      } else if (videos.length > 0) {
        updatePatchItem(item.id, { status: 'PUBLISHING', error: null });
        analysis = await buildLocalizedAnalysis(internalOrigin, item);
      } else {
        updatePatchItem(item.id, { status: 'RENDERING', error: null });
        analysis = await buildLocalizedAnalysis(internalOrigin, item);
        renderJson = await renderVideosFromRequest({
          ...analysis,
          renderLanguages: ['zh', 'en'],
          localizedPayloads: analysis.localizedPayloads,
        });

        videos = Array.isArray(renderJson.videos) && renderJson.videos.length > 0
          ? renderJson.videos
          : [{ locale: 'zh', label: '中文版', videoUrl: renderJson.videoUrl, fileName: renderJson.fileName }];

        updatePatchItem(item.id, {
          status: 'PUBLISHING',
          renderedAt: new Date().toISOString(),
          renderResult: { videos },
        });
      }

      const publicMedia = await ensurePublicMediaBaseUrl({
        action,
        platforms,
        sampleVideoUrl: videos[0]?.videoUrl,
        localUrl: internalOrigin,
      });

      const publishResult = canRetryExistingPublishJobs(item)
        ? await retryFailedPublishJobs({ jobs: item.publishResult.jobs })
        : await createPublishJobs({
            videos,
            analysis,
            platforms,
            action,
            scheduledAt: body.scheduledAt,
          });
      publishResult.publicMedia = publicMedia;
      const finalStatus = getFinalStatus(action, publishResult);
      const updated = updatePatchItem(item.id, {
        status: finalStatus,
        publishedAt: finalStatus === 'PUBLISHED' ? new Date().toISOString() : null,
        publishResult,
        error: finalStatus === 'FAILED' ? 'One or more platform publish jobs failed.' : null,
      });

      results.push({
        success: finalStatus !== 'FAILED',
        item: updated,
        render: renderJson || item.renderResult,
        publish: publishResult,
      });
    } catch (error) {
      const failed = updatePatchItem(item.id, {
        status: 'FAILED',
        error: error.message,
      });
      results.push({
        success: false,
        item: failed || item,
        error: error.message,
      });
    }
  }

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const allItems = listPatchItems({ projectId });
  return NextResponse.json({
    success: true,
    requested: count,
    processed: results.length,
    platforms,
    action,
    results,
    stats: summarizePatchItems(allItems),
    remaining: allItems.filter((item) => ['READY', 'FAILED'].includes(item.status)).length,
  });
}
