const { test, expect } = require('@playwright/test');
const { researchPackage } = require('../fixtures/match-story/research');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { once } = require('node:events');

test('a lost save response can recover the latest draft explicitly without retrying a write', async ({ page }) => {
  const research = researchPackage();
  let reads = 0, saves = 0;
  let draft = { id: 'synthetic-recovery', identity: research.identity, research, revision: 1, status: 'draft', confirmedRevision: null, selectedCandidateId: 'candidate-1', segments: [{ narration: '原稿', factIds: ['fact-1'] }] };
  await page.route('**/api/esports/candidates', route => route.fulfill({ json: { success: true, scanId: research.identity.scanId, candidates: [{ ...research.identity, canPreview: true }] } }));
  await page.route('**/api/esports/story', async route => {
    const body = route.request().postDataJSON();
    if (body.action === 'revise') {
      saves++;
      draft = { ...draft, ...body.patch, revision: 2 };
      return route.abort('failed');
    }
    if (body.action === 'read') { reads++; expect(body.expectedRevision).toBeUndefined(); }
    return route.fulfill({ json: { success: true, draft } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '尋找區間賽事' }).click();
  await page.getByLabel('匯入研究資料').setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(research)) });
  await page.getByLabel('第 1 段旁白').fill('已保存但回應中斷');
  await page.getByRole('button', { name: '保存稿件' }).click();
  await expect(page.getByTestId('match-story-panel')).toContainText('連線中斷');
  await page.getByLabel('第 1 段旁白').fill('本頁尚未保存');
  await page.getByText('讀回已保存草稿', { exact: true }).click();
  await expect(page.getByTestId('match-story-panel')).toContainText('會取代本頁未保存的編輯');
  await page.getByRole('button', { name: '讀回最新版本', exact: true }).click();
  await expect(page.getByLabel('第 1 段旁白')).toHaveValue('已保存但回應中斷');
  await expect(page.getByTestId('match-story-panel')).toContainText('第 2 版 · 草稿未確認');
  expect(reads).toBe(1);
  expect(saves).toBe(1);
});

test('editor imports research and saves then confirms a version without publishing', async ({ page }) => {
  const research = researchPackage();
  const identity = research.identity;
  let draft, confirmations = 0, publications = 0;
  await page.route('**/api/publish', route => { publications++; return route.fulfill({ json: { success: true } }); });
  await page.route('**/api/esports/candidates', route => route.fulfill({ json: { success: true, scanId: identity.scanId,
    candidates: [{ ...identity, canPreview: true, status: 'completed' }] } }));
  await page.route('**/api/esports/story', route => {
    const body = route.request().postDataJSON();
    if (body.action === 'import') draft = { id: 'synthetic-draft', identity, research, revision: 1, status: 'draft', confirmedRevision: null, selectedCandidateId: null, segments: [], rights: [] };
    if (body.action === 'revise') draft = { ...draft, ...body.patch, revision: draft.revision + 1, status: 'draft', confirmedRevision: null };
    if (body.action === 'confirm') { confirmations++; draft = { ...draft, status: 'confirmed', confirmedRevision: draft.revision }; }
    return route.fulfill({ json: { success: true, draft } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '尋找區間賽事' }).click();
  await page.getByLabel('匯入研究資料').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(research)) });
  await page.getByRole('button', { name: '選用：合成交戰' }).click();
  await page.getByRole('button', { name: '新增段落' }).click();
  await page.getByLabel('第 1 段旁白').fill('依報導，合成隊伍贏下河道交戰。');
  await page.getByLabel('第 1 段證據：合成隊伍贏下河道交戰。').check();
  await expect(page.getByRole('button', { name: '確認這版稿件' })).toBeDisabled();
  await page.getByRole('button', { name: '保存稿件' }).click();
  await page.getByRole('button', { name: '確認這版稿件' }).click();
  await expect(page.getByTestId('match-story-panel')).toContainText('第 2 版已確認，待製作預覽');
  expect(confirmations).toBe(1);
  expect(publications).toBe(0);
  await page.getByLabel('第 1 段旁白').fill('再次改稿');
  await expect(page.getByTestId('match-story-panel')).toContainText('有未保存修改');
  await expect(page.getByRole('button', { name: '確認這版稿件' })).toBeDisabled();
});

test('changing the match removes the previous draft and its confirmation', async ({ page }) => {
  const research = researchPackage();
  const candidate = { ...research.identity, canPreview: true };
  await page.route('**/api/esports/candidates', route => route.fulfill({ json: { success: true, scanId: research.identity.scanId, candidates: [candidate, { ...candidate, seriesId: 'second-series', teamA: 'Another Synthetic Team' }] } }));
  await page.route('**/api/esports/story', route => route.fulfill({ json: { success: true, draft: { identity: research.identity, research, id: 'synthetic', revision: 2, confirmedRevision: 2, status: 'confirmed', selectedCandidateId: 'candidate-1', segments: [{ narration: '舊場稿件', factIds: ['fact-1'] }] } } }));
  await page.goto('/');
  await page.getByRole('button', { name: '尋找區間賽事' }).click();
  await page.getByLabel('匯入研究資料').setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(research)) });
  await expect(page.getByTestId('match-story-panel')).toContainText('第 2 版已確認');
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: /Another Synthetic Team/ }).click();
  await expect(page.getByTestId('match-story-panel')).toContainText('尚未匯入研究資料');
  await expect(page.getByLabel('第 1 段旁白')).toHaveCount(0);
  await expect(page.getByTestId('match-story-panel')).not.toContainText('已確認');
});

test('untrusted source text is inert and unsafe links have no navigation entry', async ({ page }) => {
  const research = researchPackage();
  research.sources[0].title = '<img src=x onerror="window.syntheticXss=1">';
  research.sources[0].url = 'javascript:window.syntheticXss=1';
  await page.route('**/api/esports/candidates', route => route.fulfill({ json: { success: true, scanId: research.identity.scanId, candidates: [{ ...research.identity, canPreview: true }] } }));
  await page.route('**/api/esports/story', route => route.fulfill({ json: { success: true, draft: { identity: research.identity, research, id: 'synthetic', revision: 1, status: 'draft', selectedCandidateId: null, segments: [] } } }));
  await page.goto('/');
  await page.getByRole('button', { name: '尋找區間賽事' }).click();
  await page.getByLabel('匯入研究資料').setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(research)) });
  await expect(page.getByTestId('match-story-panel')).toContainText('連結不安全');
  await expect(page.getByRole('link', { name: '查看來源' })).toHaveCount(0);
  expect(await page.evaluate(() => window.syntheticXss)).toBeUndefined();
  await expect(page.getByTestId('match-story-panel').locator('img')).toHaveCount(0);
});

test('real Next route accepts the local browser origin and rejects external or forwarded origins', async ({ request }) => {
  const url = 'http://127.0.0.1:49765/api/esports/story';
  const data = { action: 'research', scanId: 'synthetic', seriesId: 'synthetic' };
  const local = await request.post(url, { headers: { origin: 'http://127.0.0.1:49765' }, data });
  expect(local.status()).toBe(503);
  expect((await local.json()).code).toBe('MATCH_STORY_SERVICE_DISABLED');
  const hostile = await request.post(url, { headers: { origin: 'https://synthetic.example', 'x-forwarded-host': 'synthetic.example', 'x-forwarded-proto': 'https' }, data });
  expect(hostile.status()).toBe(403);
});

test('mobile editors can jump directly to the script without scrolling through every source', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const research = researchPackage();
  await page.route('**/api/esports/candidates', route => route.fulfill({ json: { success: true, scanId: research.identity.scanId, candidates: [{ ...research.identity, canPreview: true }] } }));
  await page.route('**/api/esports/story', route => route.fulfill({ json: { success: true, draft: { identity: research.identity, research, id: 'synthetic', revision: 1, status: 'draft', selectedCandidateId: 'candidate-1', segments: [{ narration: '合成稿', factIds: ['fact-1'] }] } } }));
  await page.goto('/');
  await page.getByRole('button', { name: '尋找區間賽事' }).click();
  await page.getByLabel('匯入研究資料').setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(research)) });
  const jump = page.getByRole('link', { name: '編輯腳本', exact: true });
  await expect(jump).toBeVisible();
  await jump.click();
  await expect(page.getByLabel('第 1 段旁白')).toBeInViewport();
});

test('story actions use bounded motion and reduced-motion disables movement', async ({ page }) => {
  const research = researchPackage();
  await page.route('**/api/esports/candidates', route => route.fulfill({ json: { success: true, scanId: research.identity.scanId, candidates: [{ ...research.identity, canPreview: true }] } }));
  await page.route('**/api/esports/story', route => route.fulfill({ json: { success: true, draft: { identity: research.identity, research, id: 'synthetic', revision: 1, status: 'draft', selectedCandidateId: 'candidate-1', segments: [] } } }));
  await page.goto('/');
  await page.getByRole('button', { name: '尋找區間賽事' }).click();
  await page.getByLabel('匯入研究資料').setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(research)) });
  const action = page.getByRole('button', { name: '新增段落' });
  await expect(action).toBeVisible();
  expect(await action.evaluate(el => getComputedStyle(el).transitionProperty)).toBe('transform');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await action.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
});

test('a long candidate headline fits the mobile editor without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const research = researchPackage();
  research.candidates[0].headline = '第四局預示者團，Taeyoon與隊友如何改變局勢而不是一人包辦整場勝利';
  await page.route('**/api/esports/candidates', route => route.fulfill({ json: { success: true, scanId: research.identity.scanId, candidates: [{ ...research.identity, canPreview: true }] } }));
  await page.route('**/api/esports/story', route => route.fulfill({ json: { success: true, draft: { identity: research.identity, research, id: 'synthetic', revision: 1, status: 'draft', selectedCandidateId: null, segments: [] } } }));
  await page.goto('/');
  await page.getByRole('button', { name: '尋找區間賽事' }).click();
  await page.getByLabel('匯入研究資料').setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(research)) });
  await expect(page.getByRole('button', { name: `選用：${research.candidates[0].headline}` })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});

test('browser editor uses a real HTTP service and real disk for import, save and confirmation', async ({ page }) => {
  const research = researchPackage();
  const identity = research.identity;
  const candidate = { ...identity, tournament: 'LCK 2026 Season', status: 'completed', canPreview: true,
    completeness: { hasTenPlayers: true, hasFiveRoleMatchups: true }, players: Array.from({ length: 10 }, () => ({})),
    roleMatchups: Array.from({ length: 5 }, () => ({ left: {}, right: {} })) };
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'lol-story-browser-'));
  const child = fork(path.resolve(__dirname, '../fixtures/match-story/httpServer.js'), [], { cwd, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  try {
    const ready = once(child, 'message');
    child.send({ scanId: identity.scanId, createdAt: new Date().toISOString(), candidates: [candidate] });
    const [message] = await ready;
    const backend = `http://127.0.0.1:${message.port}/api/esports/story`;
    await page.route('**/api/esports/candidates', route => route.fulfill({ json: { success: true, scanId: identity.scanId, candidates: [candidate] } }));
    await page.route('**/api/esports/story', async route => {
      const response = await fetch(backend, { method: 'POST', headers: { 'content-type': 'application/json' }, body: route.request().postData() });
      return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
    });
    await page.goto('/');
    await page.getByRole('button', { name: '尋找區間賽事' }).click();
    await page.getByLabel('匯入研究資料').setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(research)) });
    await page.getByRole('button', { name: '選用：合成交戰' }).click();
    await page.getByRole('button', { name: '新增段落' }).click();
    await page.getByLabel('第 1 段旁白').fill('依報導，合成隊伍贏下交戰。');
    await page.getByLabel('第 1 段證據：合成隊伍贏下河道交戰。').check();
    await page.getByRole('button', { name: '保存稿件' }).click();
    await page.getByRole('button', { name: '確認這版稿件' }).click();
    await expect(page.getByTestId('match-story-panel')).toContainText('第 2 版已確認，待製作預覽');
    const store = JSON.parse(fs.readFileSync(path.join(cwd, '.data/match-story-drafts.json'), 'utf8'));
    const versions = Object.values(store.drafts)[0];
    expect(versions).toHaveLength(2);
    expect(versions[1].confirmedRevision).toBe(2);
    expect(fs.readdirSync(path.join(cwd, '.data')).sort()).toEqual(['esports-candidate-scans.json', 'match-story-drafts.json']);
  } finally {
    if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('a malformed response gives a recoverable error instead of raw server output', async ({ page }) => {
  const research = researchPackage();
  await page.route('**/api/esports/candidates', route => route.fulfill({ json: { success: true, scanId: research.identity.scanId, candidates: [{ ...research.identity, canPreview: true }] } }));
  await page.route('**/api/esports/story', route => route.fulfill({ status: 500, body: '<html>synthetic-internal-detail</html>', contentType: 'text/html' }));
  await page.goto('/');
  await page.getByRole('button', { name: '尋找區間賽事' }).click();
  await page.getByLabel('匯入研究資料').setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(research)) });
  await expect(page.getByTestId('match-story-panel').getByRole('alert')).toContainText('伺服器回應無法讀取，請重試');
  await expect(page.getByTestId('match-story-panel')).not.toContainText('synthetic-internal-detail');
  await expect(page.getByLabel('匯入研究資料')).toBeEnabled();
});

test('a failed save keeps edits and a double click cannot submit twice', async ({ page }) => {
  const research = researchPackage();
  const identity = research.identity;
  let saves = 0;
  await page.route('**/api/esports/candidates', route => route.fulfill({ json: { success: true, scanId: identity.scanId, candidates: [{ ...identity, canPreview: true }] } }));
  await page.route('**/api/esports/story', async route => {
    const body = route.request().postDataJSON();
    if (body.action === 'revise') {
      saves++;
      await new Promise(resolve => setTimeout(resolve, 100));
      return route.fulfill({ status: 500, json: { success: false, message: '保存失敗，請重試。' } });
    }
    return route.fulfill({ json: { success: true, draft: { id: 'synthetic', identity, research, revision: 1, status: 'draft', confirmedRevision: null, selectedCandidateId: 'candidate-1', segments: [{ narration: '舊稿', factIds: ['fact-1'] }] } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '尋找區間賽事' }).click();
  await page.getByLabel('匯入研究資料').setInputFiles({ name: 'research.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(research)) });
  await page.getByLabel('第 1 段旁白').fill('未保存但不能遺失');
  await page.getByRole('button', { name: '保存稿件' }).dispatchEvent('click');
  await page.getByRole('button', { name: '保存稿件' }).dispatchEvent('click');
  await expect(page.getByTestId('match-story-panel').getByRole('alert')).toContainText('保存失敗');
  await expect(page.getByLabel('第 1 段旁白')).toHaveValue('未保存但不能遺失');
  expect(saves).toBe(1);
  await page.getByRole('button', { name: '保存稿件' }).click();
  await expect.poll(() => saves).toBe(2);
});
