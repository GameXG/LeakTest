# LeakTest Cloudflare Worker

This directory contains the deployable Cloudflare Workers mirror of the LeakTest frontend.

The application is browser-native: the Worker serves the Next.js application and does not expose a first-party diagnostic, report, session, GeoIP, or risk API. It includes one fixed read-only `/apple-status` adapter for Apple's official status data because that upstream endpoint does not grant browser CORS.

## Included

- Next.js 16 app-router pages
- Browser-side diagnostic collectors
- Direct official status-source reads from the `/status` page, plus the fixed Apple status adapter
- Cloudflare Workers deployment config via OpenNext

## Runtime boundary

- Third-party diagnostic requests originate in the user's browser.
- The Worker does not proxy, aggregate, store, or bill diagnostic upstream requests.
- `/apple-status` can only fetch Apple's fixed official status endpoint and returns the structured payload without accepting arbitrary URLs.
- Other official sources that fail browser CORS checks are displayed as restricted or unavailable.

## Install

```bash
cd cfworker
npm install
```

## Local development

Node-based Next.js dev:

```bash
npm run dev
```

Workers runtime preview:

```bash
cp .dev.vars.example .dev.vars
npm run preview
```

## Deploy

Authenticate Wrangler first, then:

```bash
npm run deploy
```

## Notes

- The build targets Cloudflare Workers using `@opennextjs/cloudflare`.
- `nodejs_compat` is enabled in `wrangler.jsonc`.
- No extra R2/KV/D1 bindings or separate API process are required for the current feature set.
