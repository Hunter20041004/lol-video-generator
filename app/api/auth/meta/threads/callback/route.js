import { NextResponse } from "next/server";
const {
  normalizeLocale,
  exchangeThreadsCode,
  getThreadsProfile,
  assertExpectedThreadsUsername,
  persistEnv,
} = require("../../../../../../utils/publishing/metaAuth");
const { validateMetaCallbackRequest } = require("../../../../../../utils/publishing/metaOAuthFlow");
const { renderMetaAuthPage } = require("../../../../../../utils/publishing/metaAuthPage");

const html = (body, status = 200) => new NextResponse(body, {
  status,
  headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
});

export async function GET(request) {
  let callback;
  try {
    callback = validateMetaCallbackRequest(request.url, "threads");
  } catch {
    return html(renderMetaAuthPage({ platform: "threads", status: "invalid-state" }), 400);
  }
  const { code, providerError: error } = callback;
  const locale = normalizeLocale(callback.locale);

  if (error) {
    return html(renderMetaAuthPage({ platform: "threads", status: "provider-error" }), 400);
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    const accessToken = await exchangeThreadsCode(code);
    const profile = await getThreadsProfile(accessToken);
    assertExpectedThreadsUsername(locale, profile.username);
    const suffix = locale.toUpperCase();

    persistEnv({
      [`THREADS_${suffix}_USER_ID`]: profile.id,
      [`THREADS_${suffix}_ACCESS_TOKEN`]: accessToken,
    });
    process.env[`THREADS_${suffix}_USER_ID`] = profile.id;
    process.env[`THREADS_${suffix}_ACCESS_TOKEN`] = accessToken;

    return html(renderMetaAuthPage({ platform: "threads", status: "success", account: profile.username || profile.id }));
  } catch (err) {
    return html(renderMetaAuthPage({ platform: "threads", status: "connection-error" }), 500);
  }
}
