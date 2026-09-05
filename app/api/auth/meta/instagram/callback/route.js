import { NextResponse } from "next/server";
const {
  normalizeLocale,
  exchangeInstagramCode,
  getInstagramProfile,
  assertExpectedInstagramUsername,
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
    callback = validateMetaCallbackRequest(request.url, "instagram");
  } catch {
    return html(renderMetaAuthPage({ platform: "instagram", status: "invalid-state" }), 400);
  }
  const { code, providerError: error } = callback;
  const locale = normalizeLocale(callback.locale);

  if (error) {
    return html(renderMetaAuthPage({ platform: "instagram", status: "provider-error" }), 400);
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    const tokenResult = await exchangeInstagramCode(code);
    const accessToken = tokenResult.accessToken;
    const profile = await getInstagramProfile(accessToken);
    assertExpectedInstagramUsername(locale, profile.username);
    const suffix = locale.toUpperCase();

    const userId = profile.id || tokenResult.userId;
    persistEnv({
      [`INSTAGRAM_${suffix}_USER_ID`]: userId,
      [`INSTAGRAM_${suffix}_ACCESS_TOKEN`]: accessToken,
    });
    process.env[`INSTAGRAM_${suffix}_USER_ID`] = userId;
    process.env[`INSTAGRAM_${suffix}_ACCESS_TOKEN`] = accessToken;

    return html(renderMetaAuthPage({ platform: "instagram", status: "success", account: profile.username || userId }));
  } catch (err) {
    return html(renderMetaAuthPage({ platform: "instagram", status: "connection-error" }), 500);
  }
}
