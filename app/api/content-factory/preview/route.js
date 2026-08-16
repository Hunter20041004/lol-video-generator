import { NextResponse } from 'next/server';
const { listPatchItems } = require('../../../../utils/contentFactory/store');
const { buildLocalizedAnalysis } = require('../../../../utils/contentFactory/analysisBuilder');
const { resolveInternalOrigin } = require('../../../../utils/contentFactory/internalOrigin');
const { buildSocialCopy } = require('../../../../utils/publishing/copy');
const { renderVideosFromRequest } = require('../../../../utils/render/renderService');
const { persistPreviewArtifact } = require('../../../../utils/contentFactory/previewArtifact');

const COPY_PREVIEW_PLATFORMS = ['instagram', 'threads'];

function buildCopyPreview(analysis) {
  return {
    zh: Object.fromEntries(
      COPY_PREVIEW_PLATFORMS.map((platform) => [platform, buildSocialCopy({ analysis, locale: 'zh', platform })])
    ),
    en: Object.fromEntries(
      COPY_PREVIEW_PLATFORMS.map((platform) => [platform, buildSocialCopy({ analysis, locale: 'en', platform })])
    ),
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const itemId = String(body.itemId || '').trim();
    const shouldRender = body.render === true;
    if (!itemId) {
      return NextResponse.json({ success: false, error: 'itemId is required.' }, { status: 400 });
    }

    const item = listPatchItems().find((entry) => entry.id === itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: `Content item not found: ${itemId}` }, { status: 404 });
    }

    const internalOrigin = resolveInternalOrigin(request.url);
    const analysis = await buildLocalizedAnalysis(internalOrigin, item);
    let render = null;
    let responseItem = item;

    if (shouldRender) {
      render = await renderVideosFromRequest({
        ...analysis,
        bgmMode: 'auto',
        renderLanguages: ['zh', 'en'],
        localizedPayloads: analysis.localizedPayloads,
      });
      responseItem = persistPreviewArtifact(item, render) || item;
    }

    return NextResponse.json({
      success: true,
      item: responseItem,
      analysis,
      copyPreview: buildCopyPreview(analysis),
      render,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Content preview failed.',
    }, { status: 500 });
  }
}
