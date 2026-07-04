import { NextResponse } from 'next/server';
const { scanEsportsCandidates } = require('../../../../utils/esports/candidateScanner');
const { readCandidateSnapshot } = require('../../../../utils/esports/candidateStore');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await scanEsportsCandidates(body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Esports candidate scan failed.',
    }, { status: error.message?.includes('useSample') ? 400 : 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get('scanId') || '';
    const snapshot = readCandidateSnapshot(scanId);
    return NextResponse.json({ success: true, ...snapshot });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Esports candidate scan not found.',
    }, { status: /not found|expired/i.test(error.message || '') ? 404 : 500 });
  }
}
