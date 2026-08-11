import { NextResponse } from 'next/server';
const { handleDailyApiRequest } = require('../../../../utils/esports/apiHandlers');
const { formatEsportsApiError } = require('../../../../utils/esports/apiErrors');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await handleDailyApiRequest(body);
    return NextResponse.json(result);
  } catch (error) {
    const payload = formatEsportsApiError(error, {
      fallbackMessage: '賽事影片流程失敗。',
    });
    return NextResponse.json(payload, { status: payload.status });
  }
}
