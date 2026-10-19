# Technical Design

## 1. System Overview

LeakTest is a browser-native diagnostic application. The browser performs measurements directly against public third-party endpoints, normalizes the responses, scores the evidence, and renders the result in the page.

```text
Browser
  -> Next.js application served by Cloudflare Workers
  -> Third-party IP, GeoIP, trace, DNS-probe, STUN, AI, and status sources
  -> Browser-side normalizers and scoring
  -> Local diagnostic view
```

There is no first-party API, session service, report store, status proxy, or server-side aggregation layer in the current product.

## 2. Stack

- Frontend: Next.js with TypeScript and React
- Local development: Next.js dev server in `apps/web`
- Node.js/npm deployment: Next.js production server from `apps/web`
- Docker Compose deployment: the root `Dockerfile` runs the Node.js/npm deployment
- Production: OpenNext on Cloudflare Workers in `cfworker`
- Upstream access: browser `fetch`, image requests, and WebRTC APIs
- State: React state and browser-local history where a page needs it

The Worker is an application delivery runtime. It is not an intermediary for the diagnostic traffic. This keeps measurements tied to the user's actual browser network path and avoids turning the Worker into an API gateway or a second billing and rate-limit identity.

## 3. Logical Components

### 3.1 Browser application

Responsibilities:

- Render the diagnostic pages and status page
- Execute browser-side collectors
- Measure latency and browser-visible reachability
- Normalize third-party responses
- Calculate capped risk scores where applicable
- Show raw evidence and distinguish unavailable data from positive detections

### 3.2 Cloudflare Workers application

Responsibilities:

- Serve the compiled Next.js application
- Apply page redirects and cache headers
- Provide the production hosting surface

It does not receive collector payloads and does not make the user's third-party requests on their behalf.

### 3.3 Node.js and Docker Compose application

The root npm scripts build and start `apps/web` with the standard Next.js production server. `compose.yaml` packages that same runtime in a Node.js container and exposes port 3000. These deployment modes only serve the frontend; browser diagnostic requests still go directly to the configured third-party sources.

### 3.4 Third-party observation sources

Sources are configured in `lib/source-registry.ts` and called from browser hooks:

- IP and GeoIP providers
- Cloudflare Trace and public exit probes
- DNS leak-probe hostnames
- AI service reachability targets
- STUN servers for WebRTC candidates
- Official service status JSON endpoints

Each source is treated as optional. A failed or blocked source must not be converted into a successful observation.

## 4. Browser Request Model

### 4.1 Direct requests

The browser calls public sources directly with `credentials: "omit"` where the source is read as data. Requests use bounded timeouts and `cache: "no-store"` for live diagnostics.

The result therefore describes what the current browser can observe. It does not claim that a Cloudflare Worker or another server can reach the same source.

### 4.2 CORS boundary

Data reads require the third-party source to permit browser CORS. Opaque reachability probes may use `mode: "no-cors"`, but they cannot be treated as readable data.

The UI must keep these cases separate:

- readable response with a positive or negative observation
- HTTP error from a readable source
- timeout or network failure
- opaque reachability result
- source that is not browser-readable because of CORS policy

## 5. Diagnostic Modules

### 5.1 IP and exit identity

The browser calls multiple public IP and GeoIP sources, compares returned identities, and reports provider agreement or drift. Latency is supporting evidence only.

### 5.2 DNS path

Browsers cannot directly reveal the operating system resolver configuration. The product uses browser-triggered probe hostnames and labels this signal as simulated unless an independently deployed authoritative service provides resolver-side evidence. A missing authoritative service is a capability limitation, not a clean result.

### 5.3 WebRTC and UDP

The browser creates a bounded `RTCPeerConnection`, configures the selected STUN servers, and parses ICE candidates locally. Candidate type, address family, public addresses, and related addresses are displayed with the platform's privacy behavior preserved.

### 5.4 AI reachability

The browser probes configured AI targets using opaque fetches and image requests where appropriate. The result describes browser-visible reachability and timing; it is not an API health guarantee and does not send user credentials.

### 5.5 Environment consistency

The browser compares timezone, UTC offset, language, screen, device, WebGL, and User-Agent signals. Correlated signals must not be counted twice, and the mainland likelihood score is capped at 10:

- `0-3`: safe
- `4-7`: suspicious
- `8-10`: dangerous

## 6. Official Status Page

The `/status` page uses a browser-only hook and a pure normalizer in `lib/status-normalizer.ts`.

### 6.1 Readable sources

- Claude summary JSON
- OpenAI summary JSON
- Google incidents JSON

Each source is fetched independently with `Promise.allSettled`, so one source cannot hide another source's result.

### 6.2 Restricted sources

- OpenAI Atom/RSS feeds are not used because they are not browser-readable.
- Google products JSON is not used because it is not browser-readable. Google service rows are only considered known when `incidents.json` contains a directly matching `service_name`.
- Apple system status data is not fetched from the browser when its response is not CORS-readable. The page marks Apple as restricted and links to the official status page.

If a source does not provide enough evidence for a service, the service is shown as `未提供` or `暂时无法获取`. It must not be shown as `正常运行` merely because the request failed or because an incident list omitted that service.

### 6.3 Normalized shape

The status normalizer produces:

```ts
type OfficialVendorStatus = {
  id: string;
  label: string;
  pageUrl: string;
  apiUrl: string;
  overallLabel: string;
  overallIndicator: string;
  updatedAt?: string;
  services: Array<{
    id: string;
    label: string;
    status: string;
    statusCn: string;
    sourceName: string;
    updatedAt?: string;
  }>;
  sourceCount: number;
  error?: string;
};
```

The normalized object is held in React state only. No status response is sent back to LeakTest.

## 7. State and Privacy

- No server-created session is required for a diagnostic run.
- No collector payload is posted to a LeakTest API.
- Credentials are not included in third-party diagnostic requests.
- Browser-local history is used only for the views that explicitly need it.
- Raw third-party response data is reduced to the fields needed for the current view.
- Public upstream endpoints remain subject to their own retention, rate limits, and privacy policies.

## 8. Removed Server API

The former Fastify service and unused Next.js API routes were removed because the live product does not depend on session creation, collector ingestion, report retrieval, GeoIP proxying, IP-risk proxying, or status aggregation.

The following are intentionally not part of the deployment contract:

- `POST /api/session`
- `POST /api/collect/*`
- `POST /api/session/:id/finalize`
- `GET /api/report/:id`
- `GET /api/official-status`
- `GET /api/geoip/:ip`
- `GET /api/iprisk/:ip`
- legacy Claude session and DNS routes

If a future requirement needs durable reports, batch processing, or an external developer API, it should be designed as a separate product boundary rather than silently restoring the old collector API.

## 9. Verification

Before release:

1. Run `npm run typecheck` in `apps/web`.
2. Run `npm run typecheck` in `cfworker`.
3. Compare shared files under `app/`, `components/`, `lib/`, and `public/` with `cmp` or `diff`.
4. Open the local `/status` page and confirm direct upstream requests, partial failures, restricted sources, and refresh behavior.
5. Open `/risk` and confirm the browser diagnostic flow remains intact.
6. Build the production Worker and verify the compiled output has no `/api/official-status` route.

Static type checks and local browser checks do not prove that every user's network can reach every third-party source. Production status must continue to expose those source-level limits.

## 10. Deployment

```text
Source: cfworker/
  -> OpenNext build
  -> Cloudflare Workers deployment
  -> Browser loads application
  -> Browser calls third-party sources directly
```

Deploy from `cfworker` with `npm run deploy`. No separate API process, database, queue, or cache service is required for the current browser-native architecture.
