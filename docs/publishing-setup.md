# Publishing Setup

Hextech Video Studio now creates one publishing task per platform and per language:

- `zh` video -> `ZH_ACCOUNT_SET`
- `en` video -> `EN_ACCOUNT_SET`

The safe default is queue/package generation. Actual API publishing only happens when credentials are configured and the UI/API asks for `action: "publish"`.

## Environment Variables

Use `.env.local` for local credentials. Do not commit it.

### Shared Public Media URL

Instagram and Threads video posts need a public HTTPS URL for the rendered MP4.

```bash
PUBLIC_MEDIA_BASE_URL=https://your-public-domain.example
```

Without this, those platforms will be queued as `NEEDS_PUBLIC_URL` and the system will still create caption packages.

### Meta OAuth

Set the shared Meta app credentials and the base URL used for OAuth callbacks:

```bash
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_BASE_URL=http://localhost:3000
```

Platform-specific app credentials can override the shared Meta credentials when
Instagram and Threads use separate Meta app configurations:

INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
THREADS_APP_ID=
THREADS_APP_SECRET=
```

## Instagram Reels

Requires an Instagram Professional account connected to Meta developer permissions.

```bash
INSTAGRAM_ZH_USER_ID=
INSTAGRAM_ZH_ACCESS_TOKEN=
INSTAGRAM_EN_USER_ID=
INSTAGRAM_EN_ACCESS_TOKEN=
```

Also requires `PUBLIC_MEDIA_BASE_URL`.

Connect each account through the OAuth routes:

- Chinese account: `http://localhost:3000/api/auth/meta/instagram?locale=zh`
- English account: `http://localhost:3000/api/auth/meta/instagram?locale=en`

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

Connect each account through the OAuth routes:

- Chinese account: `http://localhost:3000/api/auth/meta/threads?locale=zh`
- English account: `http://localhost:3000/api/auth/meta/threads?locale=en`

## Queue CLI

```bash
npm run publish:queue
npm run publish:run
npm run publish:run -- --platform instagram --locale zh
npm run publish:run -- --platform threads --locale en
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
