import { NextResponse } from 'next/server';
const { handleSingleSeriesApiRequest } = require('../../../../utils/esports/apiHandlers');
const { formatEsportsApiError } = require('../../../../utils/esports/apiErrors');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await handleSingleSeriesApiRequest(body);
    return NextResponse.json(result);
  } catch (error) {
    const payload = formatEsportsApiError(error, {
      fallbackMessage: '單一系列賽測試失敗。',
    });
    return NextResponse.json(payload, { status: payload.status });
  }
}
