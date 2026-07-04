import { NextResponse } from 'next/server';
const { handleSingleSeriesApiRequest } = require('../../../../utils/esports/apiHandlers');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await handleSingleSeriesApiRequest(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Esports single-series test failed.',
    }, { status: 500 });
  }
}
