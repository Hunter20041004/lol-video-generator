const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_URL = pathToFileURL(path.resolve(__dirname, '../../../app/components/studio/studioModel.js')).href;

test('esports preview is publishable only when every rendered video passed validation', async () => {
  const { normalizeEsportsPreview, canPublishPreview } = await import(MODULE_URL);
  const good = normalizeEsportsPreview({
    videos: [{ locale: 'zh', videoUrl: '/renders/a.mp4' }],
    validationReports: [{ passed: true }],
    payloads: [{ locale: 'zh', dataType: 'PLAYER_RADAR' }],
  });
  const bad = normalizeEsportsPreview({
    videos: [{ locale: 'zh', videoUrl: '/renders/a.mp4' }],
    validationReports: [{ passed: false, reasons: ['duration'] }],
    payloads: [{ locale: 'zh', dataType: 'PLAYER_RADAR' }],
  });

  assert.equal(canPublishPreview(good), true);
  assert.equal(canPublishPreview(bad), false);
  assert.deepEqual(bad.validationFailures, ['duration']);
});

test('partial publish retry includes only failed platform jobs', async () => {
  const { failedPublishJobs } = await import(MODULE_URL);

  assert.deepEqual(
    failedPublishJobs({
      jobs: [
        { id: 'ig', platform: 'instagram', status: 'PUBLISHED' },
        { id: 'threads', platform: 'threads', status: 'FAILED' },
        { id: 'scheduled', platform: 'instagram', status: 'QUEUED' },
      ],
    }),
    [{ id: 'threads', platform: 'threads', status: 'FAILED' }]
  );
});

test('unpublished preview has no failed platform jobs', async () => {
  const { failedPublishJobs } = await import(MODULE_URL);

  assert.deepEqual(failedPublishJobs(null), []);
});

test('Leaguepedia cooldown errors preserve the retry time', async () => {
  const { humanizeWorkflowError } = await import(MODULE_URL);
  const message = humanizeWorkflowError({
    error: 'Leaguepedia rate limit reached.',
    retryAt: '2026-08-15T20:30:00.000Z',
  });

  assert.match(message, /Leaguepedia/);
  assert.match(message, /2026/);
});

test('publishing auth errors explain which connection must be restored', async () => {
  const { humanizeWorkflowError } = await import(MODULE_URL);

  assert.equal(
    humanizeWorkflowError({ error: 'Instagram is not authenticated.', needsAuth: true, platform: 'instagram' }),
    'Instagram 連線已失效，請到進階工具重新連接後再試。'
  );
});

test('version preview keeps the exact rendered artifact for confirmation', async () => {
  const { normalizeVersionPreview, canPublishPreview } = await import(MODULE_URL);
  const preview = normalizeVersionPreview({
    item: { id: 'patch-26.16', title: '版本 26.16' },
    render: { videos: [{ locale: 'zh', videoUrl: '/renders/patch-26.16.mp4' }] },
  });

  assert.equal(preview.kind, 'version');
  assert.equal(preview.item.id, 'patch-26.16');
  assert.deepEqual(preview.videos, [{ locale: 'zh', videoUrl: '/renders/patch-26.16.mp4' }]);
  assert.equal(canPublishPreview(preview), true);
});

test('Meta candidates with hard blocks or missing ranking entries cannot render', async () => {
  const { isRenderableMetaCandidate } = await import(MODULE_URL);

  assert.equal(isRenderableMetaCandidate({ candidateId: 'blocked', hardBlock: { blocked: true } }), false);
  assert.equal(isRenderableMetaCandidate({ candidateId: 'empty-tier', kind: 'META_TIER_RANKING', entries: [] }), false);
  assert.equal(isRenderableMetaCandidate({ candidateId: 'valid-tier', kind: 'META_TIER_RANKING', entries: [{ champion: 'Ahri' }] }), true);
});
