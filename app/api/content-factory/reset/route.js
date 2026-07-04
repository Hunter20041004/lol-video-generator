import { NextResponse } from 'next/server';

const {
  listPatchItems,
  resetPatchItemForRepublish,
  resetPatchItemsForRepublish,
  summarizePatchItems,
} = require('../../../../utils/contentFactory/store');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const itemId = String(body.itemId || '').trim();
    const itemIds = Array.isArray(body.itemIds)
      ? body.itemIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    const projectId = String(body.projectId || '').trim();
    const patchVersion = String(body.patchVersion || '').trim();
    const category = String(body.category || '').trim();
    const reason = String(body.reason || 'manual_republish_reset').trim();

    let result;
    if (itemId) {
      const item = resetPatchItemForRepublish(itemId, { reason });
      if (!item) {
        return NextResponse.json({ success: false, error: `找不到內容：${itemId}` }, { status: 404 });
      }
      result = { updated: 1, items: [item] };
    } else if (itemIds.length > 0) {
      result = resetPatchItemsForRepublish({ ids: itemIds, projectId, category }, { reason });
    } else if (patchVersion) {
      result = resetPatchItemsForRepublish({ projectId, patchVersion, category }, { reason });
    } else {
      return NextResponse.json({ success: false, error: '請提供 itemId、itemIds 或 patchVersion。' }, { status: 400 });
    }

    const allItems = listPatchItems({ projectId });
    return NextResponse.json({
      success: true,
      updated: result.updated,
      items: result.items,
      stats: summarizePatchItems(allItems),
      remaining: allItems.filter((item) => ['READY', 'FAILED'].includes(item.status)).length,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
