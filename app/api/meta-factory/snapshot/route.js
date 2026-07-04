import { NextResponse } from 'next/server';
const { handleMetaSnapshotRequest } = require('../../../../utils/metaFactory/apiHandlers');

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = handleMetaSnapshotRequest(searchParams.get('snapshotId') || '');
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.message.includes('not found') ? 404 : 500 });
  }
}
