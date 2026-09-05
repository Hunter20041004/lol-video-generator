import { NextResponse } from "next/server";
const {
  normalizeLocale,
  exchangeThreadsCode,
  getThreadsProfile,
  assertExpectedThreadsUsername,
  persistEnv,
} = require("../../../../../../utils/publishing/metaAuth");
const { validateMetaCallbackRequest } = require("../../../../../../utils/publishing/metaOAuthFlow");

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
  let callback;
  try {
    callback = validateMetaCallbackRequest(request.url, "threads");
  } catch {
    return NextResponse.json({ error: "Invalid or expired OAuth state." }, { status: 400 });
  }
  const { code, providerError: error } = callback;
  const locale = normalizeLocale(callback.locale);

  if (error) {
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:40px;background:#07111f;color:#ff6b6b">
        <h2>Threads authorization was not completed.</h2><p>Please restart the connection from Studio.</p></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 400 }
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
        <h2>Threads connection failed.</h2><p>Please restart the connection from Studio.</p></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 500 }
    );
  }
}
