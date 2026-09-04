# LeakTest Cloudflare Worker

This directory contains the deployable Cloudflare Workers mirror of the LeakTest frontend.

The application is browser-native: the Worker serves the Next.js application and does not expose a first-party diagnostic, report, session, GeoIP, risk, or official-status API.

## Included

- Next.js 16 app-router pages
- Browser-side diagnostic collectors
- Direct official status-source reads from the `/status` page
- Cloudflare Workers deployment config via OpenNext

## Runtime boundary

- Third-party diagnostic requests originate in the user's browser.
- The Worker does not proxy, aggregate, store, or bill those upstream requests.
- Official sources that fail browser CORS checks are displayed as restricted or unavailable.

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
