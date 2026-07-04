import { NextResponse } from 'next/server';
const { handleDailyApiRequest } = require('../../../../utils/esports/apiHandlers');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await handleDailyApiRequest(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Esports daily pipeline failed.',
    }, { status: 500 });
  }
}
