import { NextResponse } from 'next/server';
const { handleMetaScanRequest } = require('../../../../utils/metaFactory/apiHandlers');

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
    const result = await handleMetaScanRequest(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 500 });
  }
}
