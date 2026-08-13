import { NextResponse } from 'next/server';
const { runPlayerRadarFromSnapshot } = require('../../../../utils/esports/playerRadarRunner');
const { formatEsportsApiError } = require('../../../../utils/esports/apiErrors');

function statusForPlayerRadarError(error) {
  const message = error.message || '';
  if (/not found|scan/i.test(message)) return 404;
  if (/^Player Radar\b/i.test(message)) return 400;
  if (/^Post Match Read\b|official champion art unavailable|official map unavailable|verified 12-second licensed music segment/i.test(message)) return 400;
  if (/needs|invalid|required|unsupported|contains|malformed|must match|unique|finite/i.test(message)) return 400;
  return 500;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runPlayerRadarFromSnapshot(body);
    return NextResponse.json(result);
  } catch (error) {
    const payload = formatEsportsApiError(error, {
      fallbackMessage: '賽後判讀產生失敗。',
      status: statusForPlayerRadarError(error),
    });
    return NextResponse.json(payload, { status: payload.status });
  }
}
