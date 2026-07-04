import { NextResponse } from 'next/server';
const { renderVideosFromRequest } = require('../../../utils/render/renderService');

export async function POST(request) {
  try {
    const requestData = await request.json();
    const renderResult = await renderVideosFromRequest(requestData);
    return NextResponse.json(renderResult);
  } catch (error) {
    console.error('Render API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
