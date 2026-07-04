import { NextResponse } from 'next/server';
const { fetchMetaImpact } = require('../../../utils/metaImpactProvider');

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await fetchMetaImpact(body?.target || body || {}, {
      locale: body?.locale || body?.outputLanguage || 'zh',
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ [MetaImpact] fetch failed:', error);
    return NextResponse.json(
      { success: false, reason: 'META_IMPACT_ERROR', error: error.message || String(error) },
      { status: 200 },
    );
  }
}
