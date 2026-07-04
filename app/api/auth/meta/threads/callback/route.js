import { NextResponse } from "next/server";
const {
  normalizeLocale,
  exchangeThreadsCode,
  getThreadsProfile,
  assertExpectedThreadsUsername,
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
  const locale = normalizeLocale((searchParams.get("state") || "threads:zh").split(":").pop());

  if (error) {
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:40px;background:#07111f;color:#ff6b6b">
        <h2>Meta Threads OAuth Error</h2><pre>${esc(error)}</pre></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
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

    return new NextResponse(
      `<html><body style="font-family:monospace;padding:40px;background:#07111f;color:#c89b3c">
        <h2>Threads ${suffix} Connected</h2>
        <p>Saved to <code>.env.local</code>.</p>
        <p>Connected: <strong>${esc(profile.username || profile.id)}</strong></p>
        <p style="color:#7ec8e3">Restart Next.js after connecting both locales so runtime env picks up the tokens.</p>
        <a href="/" style="color:#c89b3c">Back to Studio</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:40px;background:#07111f;color:#ff6b6b">
        <h2>Threads Token Exchange Failed</h2><pre>${esc(err.message)}</pre></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 500 }
    );
  }
}
