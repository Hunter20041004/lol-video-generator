# Publishing Setup

Hextech Video Studio now creates one publishing task per platform and per language:

- `zh` video -> `ZH_ACCOUNT_SET`
- `en` video -> `EN_ACCOUNT_SET`

The safe default is queue/package generation. Actual API publishing only happens when credentials are configured and the UI/API asks for `action: "publish"`.

## Environment Variables

Use `.env.local` for local credentials. Do not commit it.

### Shared Public Media URL

Instagram, Threads video posts, and TikTok URL-pull publishing need a public HTTPS URL for the rendered MP4.

```bash
PUBLIC_MEDIA_BASE_URL=https://your-public-domain.example
```

Without this, those platforms will be queued as `NEEDS_PUBLIC_URL` and the system will still create caption packages.

## YouTube Shorts

You can use the existing Google OAuth flow:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Then connect each account:

- Chinese channel: `http://localhost:3000/api/auth/google?locale=zh`
- English channel: `http://localhost:3000/api/auth/google?locale=en`

The callback writes:

```bash
YOUTUBE_ZH_REFRESH_TOKEN=
YOUTUBE_EN_REFRESH_TOKEN=
```

Optional:

```bash
YOUTUBE_ZH_PRIVACY_STATUS=private
YOUTUBE_EN_PRIVACY_STATUS=private
```

Keep `private` while testing.

## Instagram Reels

Requires an Instagram Professional account connected to Meta developer permissions.

For Instagram Login, use the Instagram App ID/Secret from the Instagram use case API setup. If these are not set, the app falls back to `META_APP_ID` / `META_APP_SECRET`, but Meta may reject that with `Invalid platform app`.

```bash
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
```

```bash
INSTAGRAM_ZH_USER_ID=
INSTAGRAM_ZH_ACCESS_TOKEN=
INSTAGRAM_EN_USER_ID=
INSTAGRAM_EN_ACCESS_TOKEN=
```

Also requires `PUBLIC_MEDIA_BASE_URL`.

## Threads

```bash
THREADS_ZH_USER_ID=
THREADS_ZH_ACCESS_TOKEN=
THREADS_EN_USER_ID=
THREADS_EN_ACCESS_TOKEN=
```

Also requires `PUBLIC_MEDIA_BASE_URL` for video posts.

For text-only fallback:

```bash
THREADS_ALLOW_TEXT_ONLY=true
```

## TikTok / Douyin

This adapter targets TikTok Content Posting API. Direct Post usually requires app review.

```bash
TIKTOK_ZH_ACCESS_TOKEN=
TIKTOK_EN_ACCESS_TOKEN=
TIKTOK_PRIVACY_LEVEL=SELF_ONLY
```

Also requires `PUBLIC_MEDIA_BASE_URL`.

China Douyin is a separate open platform and needs a separate adapter once your Douyin developer app is approved.

## Queue CLI

```bash
npm run publish:queue
npm run publish:run
npm run publish:run -- --platform youtube --locale zh
```

## Instagram + Threads Performance Tracking

Reconnect both Instagram and Threads account sets after adding this feature so the
tokens include the Insights permissions:

- Instagram: `instagram_business_manage_insights`
- Threads: `threads_manage_insights`

Manual sync:

```bash
npm run insights:sync
npm run insights:sync -- --platform threads --locale zh --force
```

Standalone scheduler:

```bash
npm run insights:scheduler -- --now
```

The existing `npm run publish:scheduler` also runs due Insights syncs. Performance
snapshots are stored on each published task in `.data/publish-queue.json`.

Generated caption/manifest packages are saved under:

```bash
public/publish-packages/
```
