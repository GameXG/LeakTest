# LeakTest Cloudflare Worker

This directory contains a standalone Cloudflare Workers build of the current LeakTest front-end.

It is intentionally independent from the monorepo `apps/api` workspace. The user-facing pages and the route handlers required by the pages are embedded here so the site can be deployed as a single Workers application.

## Included

- Next.js 16 app-router pages
- Local route handlers used by the UI
- Cloudflare Workers deployment config via OpenNext

## Not Included

- The separate `apps/api` Fastify service
- Node-only backend runtime

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
- Current pages mainly depend on `fetch`, App Router, and route handlers, so no extra R2/KV/D1 bindings are required for the current feature set.
