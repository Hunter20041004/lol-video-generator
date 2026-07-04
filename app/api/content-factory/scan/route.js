import { NextResponse } from 'next/server';
const { scrapePatchData } = require('../../../../src/parsers/PatchDataParser');
const {
  buildPatchItemsFromScanResult,
  listContentProjects,
  listPatchItems,
  upsertPatchItems,
  summarizePatchItems,
} = require('../../../../utils/contentFactory/store');
const { getContentProject } = require('../../../../utils/contentFactory/projects');

export async function POST(request) {
  try {
    const body = await request?.json?.().catch(() => ({})) || {};
    const project = getContentProject(body.projectId || 'lol');
    if (project.id !== 'lol') {
      return NextResponse.json({
        success: false,
        error: '這個專案的掃描器尚未接上。下一階段會支援手動貼上通用遊戲公告。',
        projects: listContentProjects(),
        selectedProjectId: project.id,
      }, { status: 501 });
    }

    const scanResult = await scrapePatchData();
    const patchItems = buildPatchItemsFromScanResult(scanResult, { projectId: project.id });
    const { inserted, updated } = upsertPatchItems(patchItems);
    const projectItems = listPatchItems({ projectId: project.id });
    const scannedPatchVersion = patchItems.find((item) => item.patchVersion)?.patchVersion || 'latest';
    const scannedItems = patchItems.length > 0
      ? listPatchItems({ projectId: project.id, patchVersion: scannedPatchVersion })
      : [];

    return NextResponse.json({
      success: true,
      project,
      projects: listContentProjects(),
      selectedProjectId: project.id,
      inserted,
      updated,
      stats: summarizePatchItems(projectItems),
      scanStats: summarizePatchItems(scannedItems),
      scannedPatchVersion,
      items: scannedItems,
      list: scanResult.list || [],
      itemChanges: scanResult.itemChanges || [],
      runeChanges: scanResult.runeChanges || [],
      systemChanges: scanResult.systemChanges || [],
      patchUrl: scanResult.patchUrl || '',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return POST({ json: async () => ({ projectId: 'lol' }) });
}
