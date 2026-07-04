import { NextResponse } from "next/server";
const {
  buildInsightsReport,
  summarizeTrackedInsights,
  syncPublishedInsights,
} = require("../../../utils/publishing/insights");

export async function GET() {
  return NextResponse.json({
    success: true,
    summary: summarizeTrackedInsights(),
    report: buildInsightsReport(),
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await syncPublishedInsights({
      platform: body.platform || "",
      locale: body.locale || "",
      force: Boolean(body.force),
      limit: body.limit,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
