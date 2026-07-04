import { NextResponse } from "next/server";
const {
  normalizeLocale,
  exchangeInstagramCode,
  getInstagramProfile,
  assertExpectedInstagramUsername,
  persistEnv,
} = require("../../../../../../utils/publishing/metaAuth");

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const locale = normalizeLocale((searchParams.get("state") || "instagram:zh").split(":").pop());

  if (error) {
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:40px;background:#07111f;color:#ff6b6b">
        <h2>Meta Instagram OAuth Error</h2><pre>${esc(error)}</pre></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
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

    return new NextResponse(
      `<html><body style="font-family:monospace;padding:40px;background:#07111f;color:#c89b3c">
        <h2>Instagram ${suffix} Connected</h2>
        <p>Saved to <code>.env.local</code>.</p>
        <p>Connected: <strong>${esc(profile.username || userId)}</strong></p>
        <p style="color:#7ec8e3">Restart Next.js after connecting both locales so runtime env picks up the tokens.</p>
        <a href="/" style="color:#c89b3c">Back to Studio</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:40px;background:#07111f;color:#ff6b6b">
        <h2>Instagram Token Exchange Failed</h2><pre>${esc(err.message)}</pre></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 500 }
    );
  }
}
