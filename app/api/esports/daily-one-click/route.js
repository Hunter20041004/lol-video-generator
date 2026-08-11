import { NextResponse } from 'next/server';
const { handleDailyOneClickApiRequest } = require('../../../../utils/esports/apiHandlers');
const { formatEsportsApiError } = require('../../../../utils/esports/apiErrors');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await handleDailyOneClickApiRequest(body);
    return NextResponse.json(result);
  } catch (error) {
    const payload = formatEsportsApiError(error, {
      fallbackMessage: '每日一鍵產片並發布失敗。',
    });
    return NextResponse.json(payload, { status: payload.status });
  }
}
