# Technical Design

## 1. System Overview

LeakTest consists of a browser client, a primary web application, an aggregation API, and supporting observation services.

```text
Browser Client
  -> Web App
  -> Detection API
  -> Rule Engine
  -> Report Generator

Detection API
  -> Multi-region HTTP Echo Nodes
  -> Authoritative DNS Servers
  -> STUN/TURN Nodes
  -> GeoIP and ASN Intelligence
  -> PostgreSQL
  -> Redis
```

## 2. Proposed Stack

- Frontend: Next.js with TypeScript
- Backend API: Fastify with TypeScript
- Database: PostgreSQL
- Cache and queue: Redis and BullMQ
- DNS authority: CoreDNS or PowerDNS
- STUN or TURN: coturn
- Telemetry: OpenTelemetry and Sentry

This split keeps the core product in one TypeScript codebase while allowing DNS and STUN to remain specialized infrastructure.

## 3. Logical Components

### 3.1 Web Application

Responsibilities:

- Render homepage, run page, and report page
- Create sessions
- Execute browser-side collectors
- Submit collection data to the API

### 3.2 Detection API

Responsibilities:

- Issue signed session tokens
- Accept collector payloads
- Enrich IP and resolver observations with geo and ASN data
- Execute rule engine
- Persist findings and reports

### 3.3 HTTP Echo Nodes

Responsibilities:

- Return the client IP seen at each region
- Attach server timestamp and region identifier
- Avoid caching and include strict CORS policy for the first-party origin

### 3.4 Authoritative DNS Service

Responsibilities:

- Serve unique session subdomains
- Log resolver IP, query type, ECS, and timestamps
- Push normalized query events to the API or queue

### 3.5 STUN Nodes

Responsibilities:

- Provide regional STUN endpoints for ICE candidate discovery
- Remain stateless where possible

## 4. Session Lifecycle

### 4.1 Flow

1. Client requests `POST /api/session`
2. API creates a session and returns `sessionId`, `clientToken`, and detector config
3. Client runs collectors in parallel where safe
4. Client posts results incrementally
5. Client calls `POST /api/session/:id/finalize`
6. API aggregates observations, runs rules, stores findings, and generates a report
7. Client navigates to the report page

### 4.2 Session States

- `created`
- `collecting`
- `awaiting_finalize`
- `processing`
- `completed`
- `expired`
- `failed`

## 5. Detector Design

### 5.1 IP Detection

Client behavior:

- Call at least three echo nodes from separate regions
- Measure elapsed time from the browser side
- Submit each node response independently to reduce blast radius from partial failures

Echo node response shape:

```json
{
  "vantage": "us-east",
  "observedIp": "203.0.113.10",
  "ipFamily": "ipv4",
  "serverTime": "2026-04-11T10:00:00Z"
}
```

Derived fields:

- ASN
- organization
- country, region, city
- is_datacenter
- proxy intelligence labels if configured later

Primary findings:

- Different public IPs across vantage points
- Exit IPv4 looks proxied while IPv6 exposes a different network
- Exit path appears inconsistent with declared locale

### 5.2 DNS Leak Detection

Design note: browsers cannot directly reveal system DNS settings. DNS leak detection is inferred through authoritative DNS observation.

Flow:

1. API creates unique hostnames for a session
2. Browser requests assets or fetch targets on those hostnames
3. Recursive resolvers contact the authoritative DNS service
4. DNS query events are linked back to the session

Recommended hostname sets:

- base lookup set
- uncached random subdomain set
- dual-stack set
- low TTL set

Captured fields:

- fqdn
- resolver_ip
- resolver_asn
- resolver_country
- query_type
- ecs_prefix
- first_seen_at

Primary findings:

- Resolver belongs to the user's local ISP while HTTP exit belongs to a proxy ASN
- Resolver geography diverges sharply from HTTP exit geography
- Multiple unrelated resolvers appear in a short session without clear explanation

### 5.3 WebRTC Leak Detection

Client behavior:

- Create `RTCPeerConnection`
- Configure multiple STUN servers
- Collect ICE candidates for a bounded time window
- Parse and normalize candidate details in the browser before upload

Captured fields:

- candidate_type
- address
- port
- transport
- related_address
- protocol
- raw_candidate

Primary findings:

- WebRTC exposes a public IP different from the HTTP exit IP
- IPv6 leaks through WebRTC while HTTP traffic appears proxied over IPv4
- Too many interface candidates suggest virtualized or patched environments

### 5.4 Timezone Consistency

Collected signals:

- browser timezone via `Intl.DateTimeFormat`
- UTC offset
- local wall clock
- `navigator.language`
- `navigator.languages`
- request `Accept-Language`

Primary findings:

- Browser timezone differs from IP-inferred timezone
- Offset does not match the named IANA timezone
- Locale and timezone both diverge from exit geography

### 5.5 Device Environment Authenticity

Collected signals:

- `navigator.platform`
- `navigator.hardwareConcurrency`
- `navigator.deviceMemory`
- `maxTouchPoints`
- display metrics
- WebGL vendor and renderer
- media capability signals
- basic automation indicators

Primary findings:

- Claimed mobile device without touch profile
- macOS or iOS claims paired with incompatible GPU or browser behavior
- Highly templated or impossible hardware combinations

### 5.6 User-Agent Authenticity

Compared signals:

- HTTP User-Agent header
- UA-CH
- runtime capability matrix
- inferred browser engine behavior

Primary findings:

- User-Agent and UA-CH disagreement
- Claimed Safari with Chromium-only runtime features
- Claimed modern Chrome missing expected APIs

## 6. Rule Engine

The rule engine should be data-driven. Each rule evaluates normalized observations and returns findings with a score delta and evidence payload.

Suggested rule structure:

```json
{
  "code": "WEBRTC_PUBLIC_IP_MISMATCH",
  "severity": "high",
  "scoreDelta": 35,
  "title": "WebRTC public IP differs from HTTP exit IP"
}
```

Recommended categories:

- IP consistency
- DNS leak
- WebRTC leak
- timezone mismatch
- device authenticity
- user-agent authenticity

Example rules:

- HTTP exit IP and WebRTC public IP differ: `+35`
- DNS resolver maps to local ISP while exit IP maps to proxy ASN: `+30`
- Browser timezone and IP geography differ materially: `+10`
- User-Agent and UA-CH disagree on platform or brand: `+25`
- Claimed mobile environment has no touch capability and desktop display metrics: `+20`

Risk mapping:

- `0-19`: consistent
- `20-49`: mildly suspicious
- `50-79`: suspicious
- `80-100`: high risk

## 7. Data Model

### 7.1 session

```sql
create table session (
  id uuid primary key,
  status text not null,
  client_token_hash text not null,
  consent_version text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finalized_at timestamptz
);
```

### 7.2 http_observation

```sql
create table http_observation (
  id uuid primary key,
  session_id uuid not null references session(id),
  vantage text not null,
  observed_ip inet not null,
  ip_family text not null,
  asn integer,
  organization text,
  country text,
  region text,
  city text,
  is_datacenter boolean,
  headers_json jsonb,
  rtt_ms integer,
  created_at timestamptz not null default now()
);
```

### 7.3 dns_observation

```sql
create table dns_observation (
  id uuid primary key,
  session_id uuid not null references session(id),
  fqdn text not null,
  resolver_ip inet not null,
  resolver_asn integer,
  resolver_organization text,
  resolver_country text,
  ecs_prefix text,
  query_type text not null,
  queried_at timestamptz not null
);
```

### 7.4 webrtc_candidate

```sql
create table webrtc_candidate (
  id uuid primary key,
  session_id uuid not null references session(id),
  candidate_type text not null,
  address text not null,
  port integer,
  transport text,
  related_address text,
  protocol text,
  raw_candidate text,
  created_at timestamptz not null default now()
);
```

### 7.5 fingerprint_snapshot

```sql
create table fingerprint_snapshot (
  id uuid primary key,
  session_id uuid not null references session(id),
  ua text,
  ua_ch_json jsonb,
  platform text,
  languages_json jsonb,
  timezone text,
  utc_offset_minutes integer,
  screen_json jsonb,
  webgl_json jsonb,
  device_signals_json jsonb,
  created_at timestamptz not null default now()
);
```

### 7.6 finding

```sql
create table finding (
  id uuid primary key,
  session_id uuid not null references session(id),
  rule_code text not null,
  severity text not null,
  score_delta numeric not null,
  title text not null,
  evidence_json jsonb not null,
  created_at timestamptz not null default now()
);
```

### 7.7 report

```sql
create table report (
  id uuid primary key,
  session_id uuid not null unique references session(id),
  total_score numeric not null,
  risk_level text not null,
  summary_json jsonb not null,
  generated_at timestamptz not null default now()
);
```

## 8. API Design

### 8.1 Create Session

`POST /api/session`

Response:

```json
{
  "sessionId": "uuid",
  "clientToken": "signed-token",
  "config": {
    "echoNodes": [
      { "id": "ap-sg", "url": "https://ap.example.com/echo" },
      { "id": "eu-de", "url": "https://eu.example.com/echo" },
      { "id": "us-va", "url": "https://us.example.com/echo" }
    ],
    "stunServers": [
      "stun:stun-ap.example.com:3478",
      "stun:stun-eu.example.com:3478",
      "stun:stun-us.example.com:3478"
    ],
    "dnsTargets": [
      "a1.session.example.net",
      "b1.session.example.net"
    ]
  }
}
```

### 8.2 Collect Fingerprint

`POST /api/collect/fingerprint`

Payload:

```json
{
  "sessionId": "uuid",
  "token": "signed-token",
  "ua": "...",
  "uaCh": {},
  "timezone": "Europe/Berlin",
  "utcOffsetMinutes": -120,
  "languages": ["en-US", "en"],
  "screen": {},
  "webgl": {},
  "deviceSignals": {}
}
```

### 8.3 Collect HTTP Observation

`POST /api/collect/http`

Payload:

```json
{
  "sessionId": "uuid",
  "token": "signed-token",
  "vantage": "us-va",
  "observedIp": "203.0.113.10",
  "ipFamily": "ipv4",
  "rttMs": 183
}
```

### 8.4 Collect WebRTC Observation

`POST /api/collect/webrtc`

Payload:

```json
{
  "sessionId": "uuid",
  "token": "signed-token",
  "candidates": [
    {
      "candidateType": "srflx",
      "address": "198.51.100.10",
      "port": 50000,
      "transport": "udp",
      "relatedAddress": "10.0.0.15"
    }
  ]
}
```

### 8.5 Finalize Session

`POST /api/session/:id/finalize`

Behavior:

- verify session completeness
- ingest delayed DNS events if available
- run rule engine
- persist findings and report

### 8.6 Get Report

`GET /api/report/:id`

Response sections:

- summary
- module statuses
- findings
- evidence

## 9. Frontend Pages

### 9.1 Home

- value proposition
- what is collected
- consent acknowledgment
- start test action

### 9.2 Run Page

- progress view
- detector status list
- retry or timeout messages
- optional advanced panel for raw collector state

### 9.3 Report Page

- total score and risk level
- module cards
- evidence table
- remediation tips
- later: JSON export

## 10. Deployment Topology

Minimum recommended production footprint:

- 1 primary web and API deployment
- 3 regional HTTP echo nodes
- 2 authoritative DNS nodes
- 3 STUN nodes
- 1 PostgreSQL instance
- 1 Redis instance

Traffic notes:

- Echo endpoints should disable caching
- DNS authority should be isolated from the main app surface
- STUN should be rate-limited and monitored to prevent abuse

## 11. Security and Privacy

- Require signed session tokens on all collector endpoints
- Apply per-IP and per-session rate limits
- Set report expiration windows
- Store only necessary raw artifacts
- Separate privileged admin surfaces from public report access

## 12. Known Limits

- DNS leak conclusions are inferred from authoritative observation, not direct system inspection
- WebRTC signal quality depends on browser policy and platform
- Device and User-Agent authenticity are probabilistic, not absolute
- Corporate networks and public DNS providers can create ambiguous cases

## 13. Delivery Plan

### Stage 1

- monorepo setup
- session API
- browser collector shell
- IP and timezone detectors
- basic report page

### Stage 2

- DNS authority integration
- DNS event ingestion
- WebRTC detector
- expanded scoring rules

### Stage 3

- device authenticity engine
- User-Agent authenticity engine
- report export

### Stage 4

- observability
- abuse controls
- admin metrics
- public API and batch mode
