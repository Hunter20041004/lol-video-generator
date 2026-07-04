import { NextResponse } from "next/server";
const { buildThreadsAuthUrl, getThreadsAppConfig, normalizeLocale } = require("../../../../../utils/publishing/metaAuth");

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locale = normalizeLocale(searchParams.get("locale") || "zh");
  const { appId, appSecret } = getThreadsAppConfig();

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "THREADS_APP_ID/THREADS_APP_SECRET or META_APP_ID/META_APP_SECRET must be set in .env.local" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(buildThreadsAuthUrl(locale));
}
