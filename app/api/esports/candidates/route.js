import { NextResponse } from 'next/server';
const { scanEsportsCandidates } = require('../../../../utils/esports/candidateScanner');
const { readCandidateSnapshot } = require('../../../../utils/esports/candidateStore');
const { formatEsportsApiError } = require('../../../../utils/esports/apiErrors');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await scanEsportsCandidates(body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const payload = formatEsportsApiError(error, {
      fallbackMessage: '候選賽事掃描失敗。',
      status: error.message?.includes('useSample') ? 400 : undefined,
    });
    return NextResponse.json(payload, { status: payload.status });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get('scanId') || '';
    const snapshot = readCandidateSnapshot(scanId);
    return NextResponse.json({ success: true, ...snapshot });
  } catch (error) {
    const payload = formatEsportsApiError(error, {
      fallbackMessage: '找不到這次候選掃描。',
      status: /not found|expired/i.test(error.message || '') ? 404 : undefined,
    });
    return NextResponse.json(payload, { status: payload.status });
  }
}
