import { NextResponse } from 'next/server';
const {
  listContentProjects,
  listPatchItems,
  reconcilePublishedItemsFromQueue,
  summarizePatchItems,
  updatePatchItem,
} = require('../../../../utils/contentFactory/store');
const { hydratePatchItemPostLinks } = require('../../../../utils/publishing/postLinks');
const { readQueue } = require('../../../../utils/publishing/queueStore');
const { mergePatchItemInsightsFromQueue } = require('../../../../utils/publishing/insights');

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || '';
    const patchVersion = searchParams.get('patchVersion') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';
    reconcilePublishedItemsFromQueue();
    const rawItems = listPatchItems({ projectId, patchVersion, category, status });
    const hydrationResults = await Promise.all(rawItems.map((item) => hydratePatchItemPostLinks(item)));
    const queueById = new Map(readQueue().map((task) => [task.id, task]));
    const items = hydrationResults.map((entry) => mergePatchItemInsightsFromQueue(entry.item, queueById));

    for (const entry of hydrationResults) {
      if (!entry.changed) continue;
      updatePatchItem(entry.item.id, {
        status: entry.item.status,
        error: entry.item.error,
        publishResult: entry.item.publishResult,
      });
    }

    return NextResponse.json({
      success: true,
      projects: listContentProjects(),
      selectedProjectId: projectId || '',
      stats: summarizePatchItems(items),
      items,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
