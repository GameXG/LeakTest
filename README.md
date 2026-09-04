# LeakTest

LeakTest is a greenfield environment leak detection website focused on cross-checking network identity, browser signals, and runtime consistency.

Primary detection areas:

- Multi-source IP detection
- Multi-source DNS leak detection
- Multi-source WebRTC leak detection
- Timezone consistency detection
- Device environment authenticity scoring
- User-Agent authenticity scoring

Project documents:

- [Product requirements](./docs/PRD.md)
- [Technical design](./docs/TECHNICAL_DESIGN.md)

Current implementation status:

- Phase 1 monorepo scaffold is in place
- `apps/api` provides session creation, fingerprint collection, HTTP observation ingest, DNS observation ingest, finalization, and report retrieval
- `apps/api` also exposes public local-MVP probe endpoints for multi-source HTTP echo collection and DNS probe hits
- `apps/web` provides the home page, run flow, and report page
- Multi-source HTTP observation is now wired end to end and feeds the reporting baseline when available
- A third-party IP source based on Cloudflare Trace is now included in the run flow
- Browser-side AI reachability probes for major AI services are now included in the run flow and report
- DNS now has a local simulated probe pipeline plus a future-facing `/api/ingest/dns/authoritative` contract for real resolver-side ingest

Current DNS boundary:

- Local development does not perform true authoritative DNS resolver inference yet
- Browser-triggered DNS probe hits and client-reported probe outcomes are stored and labeled as simulated operational evidence
- True resolver-side DNS evidence is only produced when an external authoritative DNS service posts into `/api/ingest/dns/authoritative`

Local development:

1. Install dependencies with `npm install`
2. Start the API with `npm run dev:api`
3. Start the web app with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 npm run dev:web`
4. Open `http://localhost:3000`

Verification commands:

- `npm run typecheck:api`
- `npm run build:api`
- `npm run typecheck:web`
- `npm run build:web`

Recommended build order:

1. Session lifecycle, browser collector, and basic report page
2. Multi-region HTTP echo nodes and IP consistency scoring
3. Authoritative DNS observation pipeline
4. WebRTC ICE candidate collection and scoring
5. Device and User-Agent authenticity engine
6. Production hardening, analytics, and public API
