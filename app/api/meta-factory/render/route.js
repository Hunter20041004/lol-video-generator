import { NextResponse } from 'next/server';
const { handleMetaRenderRequest } = require('../../../../utils/metaFactory/apiHandlers');

function isJsonParseError(error) {
  return error instanceof SyntaxError || error?.name === 'SyntaxError';
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch (error) {
    if (isJsonParseError(error)) {
      const parseError = new Error('Malformed JSON body.');
      parseError.statusCode = 400;
      throw parseError;
    }
    throw error;
  }
}

export async function POST(request) {
  try {
    const body = await readJsonBody(request);
    const result = await handleMetaRenderRequest(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error.message || 'Meta render failed.';
    const status = error.statusCode || (message.includes('not found') || message.includes('hard-blocked') ? 400 : 500);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
