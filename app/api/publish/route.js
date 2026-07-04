import { NextResponse } from 'next/server';
const { createPublishJobs } = require('../../../utils/publishing');
const { listTasks } = require('../../../utils/publishing/queueStore');
const { ensurePublicMediaBaseUrl } = require('../../../utils/publishing/tunnel');
const { validatePublishRequest } = require('../../../utils/apiGuards');

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    success: true,
    jobs: listTasks({
      status: searchParams.get('status') || '',
      platform: searchParams.get('platform') || '',
      locale: searchParams.get('locale') || '',
    }),
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const policy = validatePublishRequest(body);
    const action = body.action || 'queue';
    const platforms = policy.platforms;
    const sampleVideoUrl = Array.isArray(body.videos) && body.videos.length > 0
      ? body.videos.find((video) => video?.videoUrl)?.videoUrl
      : body.videoUrl;
    const publicMedia = await ensurePublicMediaBaseUrl({
      action,
      platforms,
      sampleVideoUrl,
    });
    const result = await createPublishJobs({
      videoUrl: body.videoUrl,
      videos: body.videos,
      analysis: body.analysis || {},
      socialCopy: body.socialCopy,
      locale: body.locale || 'zh',
      platform: body.platform || 'instagram',
      platforms,
      action,
      scheduledAt: body.scheduledAt,
    });
    result.publicMedia = publicMedia;

    return NextResponse.json(result);
  } catch (err) {
    console.error('Publish API Error:', err);
    const isAuthError = err.message?.includes('authenticated') || err.code === 401;
    return NextResponse.json(
      { success: false, error: err.message, needsAuth: isAuthError },
      { status: err.statusCode || (isAuthError ? 401 : 500) }
    );
  }
}
