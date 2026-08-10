import { NextResponse } from 'next/server';
const { runPlayerRadarFromSnapshot } = require('../../../../utils/esports/playerRadarRunner');
const { formatEsportsApiError } = require('../../../../utils/esports/apiErrors');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runPlayerRadarFromSnapshot(body);
    return NextResponse.json(result);
  } catch (error) {
    const payload = formatEsportsApiError(error, {
      fallbackMessage: '選手雷達產生失敗。',
      status: /not found|scan/i.test(error.message || '') ? 404 : undefined,
    });
    return NextResponse.json(payload, { status: payload.status });
  }
}
