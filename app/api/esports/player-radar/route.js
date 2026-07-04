import { NextResponse } from 'next/server';
const { runPlayerRadarFromSnapshot } = require('../../../../utils/esports/playerRadarRunner');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runPlayerRadarFromSnapshot(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Player radar failed.',
    }, { status: /not found|scan/i.test(error.message || '') ? 404 : 500 });
  }
}
