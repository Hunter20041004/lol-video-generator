import { NextResponse } from 'next/server';
const { scrapePatchData } = require('../../../src/parsers/PatchDataParser');

export async function GET() {
  try {
    const result = await scrapePatchData();
    if (Array.isArray(result)) {
      return NextResponse.json({ success: true, list: result, itemChanges: [], runeChanges: [], systemChanges: [] });
    }
    return NextResponse.json({
      success: true,
      list: result.list || [],
      itemChanges: result.itemChanges || [],
      runeChanges: result.runeChanges || [],
      systemChanges: result.systemChanges || [],
      patchUrl: result.patchUrl || '',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
