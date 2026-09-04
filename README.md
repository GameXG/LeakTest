# LeakTest

LeakTest is a browser-native environment leak detection website. The browser performs the observations directly against third-party sources and renders the result locally.

Primary detection areas:

- Multi-source IP and exit identity
- DNS path and leak signals
- WebRTC and UDP exposure
- AI service reachability
- Timezone, language, device, and User-Agent consistency
- Official service status

Project documents:

- [Product requirements](./docs/PRD.md)
- [Technical design](./docs/TECHNICAL_DESIGN.md)

Architecture boundary:

- `apps/web` is the local Next.js frontend.
- `cfworker` is the deployable Cloudflare Workers mirror.
- There is no general-purpose first-party API, session store, or report API in the current product.
- The `/status` page reads CORS-enabled official sources from the user's browser. Apple is handled by the fixed read-only `/apple-status` adapter because Apple's official status data endpoint does not grant browser CORS; the adapter accepts no upstream URL or user data.
- The Worker serves the application but does not proxy or aggregate third-party diagnostic requests.

Local development:

1. Install dependencies with `npm install`
2. Start the web app with `npm run dev:web`
3. Open `http://localhost:3000`

Verification commands:

- `npm run typecheck:web`
- `npm run build:web`
- `npm run typecheck` from `apps/web`
- `npm run typecheck` from `cfworker`

Deployment:

- Deploy from `cfworker` with `npm run deploy`.
- The Cloudflare build and deployment do not require a separate API process.
