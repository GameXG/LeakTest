import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { buildDetectorConfig, SESSION_TTL_MS } from "./detector-config.js";
import { runPhase1Scoring } from "./phase1-scoring.js";
import { store } from "./store.js";
import type {
  AiObservation,
  DnsObservation,
  FingerprintSnapshot,
  HttpObservation,
  SessionRecord,
  WebrtcObservation,
} from "./types.js";

interface CreateSessionReply {
  sessionId: string;
  clientToken: string;
  status: SessionRecord["status"];
  createdAt: string;
  expiresAt: string;
  detectorConfig: ReturnType<typeof buildDetectorConfig>;
}

interface CollectFingerprintBody {
  sessionId?: string;
  token?: string;
  ua?: string;
  uaCh?: FingerprintSnapshot["uaCh"];
  timezone?: string;
  utcOffsetMinutes?: number;
  language?: string;
  languages?: string[];
  acceptLanguage?: string;
  screen?: FingerprintSnapshot["screen"];
  deviceSignals?: FingerprintSnapshot["deviceSignals"];
}

interface CollectHttpBody {
  sessionId?: string;
  token?: string;
  observations?: HttpObservationInput[];
}

interface HttpObservationInput {
  vantage?: string;
  region?: string;
  url?: string;
  observedIp?: string;
  observedIpFamily?: "ipv4" | "ipv6" | "unknown";
  statusCode?: number;
  rttMs?: number;
  userAgent?: string;
  acceptLanguage?: string;
  requestHost?: string;
  error?: string;
  observedAt?: string;
}

interface CollectDnsBody {
  sessionId?: string;
  token?: string;
  observations?: DnsObservationInput[];
}

interface CollectAiBody {
  sessionId?: string;
  token?: string;
  observations?: AiObservationInput[];
}

interface CollectWebrtcBody {
  sessionId?: string;
  token?: string;
  observations?: WebrtcObservationInput[];
}

interface DnsObservationInput {
  targetId?: string;
  targetHost?: string;
  purpose?: "base" | "uncached" | "dualstack" | "low_ttl";
  probeId?: string;
  status?: "success" | "error" | "timeout" | "observed" | "hit";
  latencyMs?: number;
  error?: string;
  resolverIp?: string;
  resolverAsn?: number;
  resolverCountry?: string;
  queryType?: string;
  simulated?: boolean;
  source?: DnsObservation["source"];
  observedAt?: string;
}

interface AiObservationInput {
  targetId?: string;
  provider?: string;
  label?: string;
  probeUrl?: string;
  status?: AiObservation["status"];
  latencyMs?: number;
  error?: string;
  observedAt?: string;
}

interface WebrtcObservationInput {
  candidateType?: WebrtcObservation["candidateType"];
  address?: string;
  addressFamily?: WebrtcObservation["addressFamily"];
  protocol?: string;
  port?: number;
  relatedAddress?: string;
  relatedPort?: number;
  foundation?: string;
  rawCandidate?: string;
  observedAt?: string;
}

const ECHO_VANTAGE_REGIONS: Record<string, string> = {
  "ap-sg": "apac",
  "eu-fr": "europe",
  "us-va": "north_america",
};

const CLOUDFLARE_TRACE_URL =
  process.env.CLOUDFLARE_TRACE_URL ?? "https://cloudflare.com/cdn-cgi/trace";

const buildClientToken = (): string => randomBytes(24).toString("base64url");

const readForwardedHeader = (
  value: string | string[] | undefined,
): string | undefined => {
  if (!value) {
    return undefined;
  }
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) {
    return undefined;
  }
  return first.split(",")[0]?.trim();
};

const getPublicBaseUrl = (request: {
  headers: Record<string, unknown>;
}): string => {
  const forwardedProto = readForwardedHeader(
    request.headers["x-forwarded-proto"] as string | string[] | undefined,
  );
  const forwardedHost = readForwardedHeader(
    request.headers["x-forwarded-host"] as string | string[] | undefined,
  );
  const hostHeader = readForwardedHeader(
    request.headers.host as string | string[] | undefined,
  );

  const protocol = forwardedProto ?? "http";
  const host = forwardedHost ?? hostHeader ?? "localhost:4000";
  return `${protocol}://${host}`;
};

const createSession = (publicBaseUrl: string): SessionRecord => {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const clientToken = buildClientToken();

  return {
    id,
    clientToken,
    createdAt,
    expiresAt,
    status: "created",
    detectorConfig: buildDetectorConfig(id, clientToken, publicBaseUrl),
  };
};

const asFingerprintSnapshot = (
  body: CollectFingerprintBody,
  sessionId: string,
  acceptLanguageHeader: string | undefined,
): FingerprintSnapshot => ({
  sessionId,
  ua: body.ua,
  uaCh: body.uaCh,
  timezone: body.timezone,
  utcOffsetMinutes:
    typeof body.utcOffsetMinutes === "number"
      ? body.utcOffsetMinutes
      : undefined,
  language: body.language,
  languages: Array.isArray(body.languages)
    ? body.languages.filter((item) => typeof item === "string")
    : undefined,
  acceptLanguage: acceptLanguageHeader ?? body.acceptLanguage,
  screen: body.screen,
  deviceSignals: body.deviceSignals,
  collectedAt: new Date().toISOString(),
});

const setCorsHeaders = (
  origin: string | undefined,
  reply: FastifyReply,
): void => {
  reply.header("Access-Control-Allow-Origin", origin ?? "*");
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  reply.header(
    "Access-Control-Allow-Headers",
    "Content-Type,X-DNS-Ingest-Token",
  );
  reply.header("Vary", "Origin");
};

const isAuthorized = (
  session: SessionRecord,
  token: string | undefined,
): boolean => token === session.clientToken;

const isExpired = (session: SessionRecord): boolean =>
  new Date(session.expiresAt).getTime() < Date.now();

const ensureSessionIsActive = (
  session: SessionRecord,
  reply: FastifyReply,
): boolean => {
  if (!isExpired(session)) {
    return true;
  }
  session.status = "expired";
  store.setSession(session);
  reply.code(410).send({
    error: "session_expired",
    message: "Session has expired.",
  });
  return false;
};

const parseObservedIpFamily = (
  input: string | undefined,
): HttpObservation["observedIpFamily"] => {
  if (!input) {
    return "unknown";
  }
  const version = isIP(input);
  if (version === 4) {
    return "ipv4";
  }
  if (version === 6) {
    return "ipv6";
  }
  return "unknown";
};

const buildEchoObservation = (
  sessionId: string,
  vantage: string,
  region: string,
  request: {
    ip: string;
    url: string;
    headers: Record<string, unknown>;
  },
): HttpObservation => ({
  sessionId,
  source: "echo_endpoint",
  vantage,
  region,
  url: request.url,
  observedIp: request.ip,
  observedIpFamily: parseObservedIpFamily(request.ip),
  userAgent:
    typeof request.headers["user-agent"] === "string"
      ? request.headers["user-agent"]
      : undefined,
  acceptLanguage:
    typeof request.headers["accept-language"] === "string"
      ? request.headers["accept-language"]
      : undefined,
  requestHost:
    typeof request.headers.host === "string" ? request.headers.host : undefined,
  observedAt: new Date().toISOString(),
});

const asHttpObservation = (
  body: HttpObservationInput,
  sessionId: string,
  requestHeaders: Record<string, unknown>,
): HttpObservation => {
  const observedAt =
    typeof body.observedAt === "string" && body.observedAt.trim()
      ? body.observedAt
      : new Date().toISOString();
  const observedIp =
    typeof body.observedIp === "string" && body.observedIp.trim()
      ? body.observedIp.trim()
      : undefined;

  return {
    sessionId,
    source: "client_report",
    vantage:
      typeof body.vantage === "string" && body.vantage.trim()
        ? body.vantage.trim()
        : "unknown",
    region:
      typeof body.region === "string" && body.region.trim()
        ? body.region.trim()
        : undefined,
    url:
      typeof body.url === "string" && body.url.trim() ? body.url.trim() : undefined,
    observedIp,
    observedIpFamily:
      body.observedIpFamily ?? parseObservedIpFamily(body.observedIp),
    statusCode: typeof body.statusCode === "number" ? body.statusCode : undefined,
    rttMs: typeof body.rttMs === "number" ? body.rttMs : undefined,
    userAgent:
      typeof body.userAgent === "string" && body.userAgent.trim()
        ? body.userAgent.trim()
        : typeof requestHeaders["user-agent"] === "string"
          ? requestHeaders["user-agent"]
          : undefined,
    acceptLanguage:
      typeof body.acceptLanguage === "string" && body.acceptLanguage.trim()
        ? body.acceptLanguage.trim()
        : typeof requestHeaders["accept-language"] === "string"
          ? requestHeaders["accept-language"]
          : undefined,
    requestHost:
      typeof body.requestHost === "string" && body.requestHost.trim()
        ? body.requestHost.trim()
        : typeof requestHeaders.host === "string"
          ? requestHeaders.host
          : undefined,
    error:
      typeof body.error === "string" && body.error.trim()
        ? body.error.trim()
        : undefined,
    observedAt,
  };
};

const parseTracePayload = (payload: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const line of payload.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    result[key] = value;
  }
  return result;
};

const asDnsObservation = (
  body: DnsObservationInput,
  sessionId: string,
): DnsObservation => ({
  sessionId,
  source:
    body.source === "authoritative_ingest"
      ? "authoritative_ingest"
      : "client_report",
  simulated:
    typeof body.simulated === "boolean"
      ? body.simulated
      : body.source === "authoritative_ingest"
        ? false
        : true,
  targetId:
    typeof body.targetId === "string" && body.targetId.trim()
      ? body.targetId.trim()
      : "unknown",
  targetHost:
    typeof body.targetHost === "string" && body.targetHost.trim()
      ? body.targetHost.trim()
      : undefined,
  purpose:
    body.purpose === "base" ||
    body.purpose === "uncached" ||
    body.purpose === "dualstack" ||
    body.purpose === "low_ttl"
      ? body.purpose
      : undefined,
  probeId:
    typeof body.probeId === "string" && body.probeId.trim()
      ? body.probeId.trim()
      : undefined,
  resolverIp:
    typeof body.resolverIp === "string" && body.resolverIp.trim()
      ? body.resolverIp.trim()
      : undefined,
  resolverAsn: typeof body.resolverAsn === "number" ? body.resolverAsn : undefined,
  resolverCountry:
    typeof body.resolverCountry === "string" && body.resolverCountry.trim()
      ? body.resolverCountry.trim()
      : undefined,
  queryType:
    typeof body.queryType === "string" && body.queryType.trim()
      ? body.queryType.trim()
      : undefined,
  status:
    body.status === "hit" ||
    body.status === "success" ||
    body.status === "error" ||
    body.status === "timeout" ||
    body.status === "observed"
      ? body.status
      : "observed",
  latencyMs: typeof body.latencyMs === "number" ? body.latencyMs : undefined,
  error:
    typeof body.error === "string" && body.error.trim()
      ? body.error.trim()
      : undefined,
  observedAt:
    typeof body.observedAt === "string" && body.observedAt.trim()
      ? body.observedAt
      : new Date().toISOString(),
});

const asAiObservation = (
  body: AiObservationInput,
  sessionId: string,
): AiObservation => ({
  sessionId,
  source: "client_probe",
  targetId:
    typeof body.targetId === "string" && body.targetId.trim()
      ? body.targetId.trim()
      : "unknown",
  provider:
    typeof body.provider === "string" && body.provider.trim()
      ? body.provider.trim()
      : "unknown",
  label:
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim()
      : "Unknown",
  probeUrl:
    typeof body.probeUrl === "string" && body.probeUrl.trim()
      ? body.probeUrl.trim()
      : "",
  status:
    body.status === "reachable" ||
    body.status === "blocked" ||
    body.status === "timeout" ||
    body.status === "error"
      ? body.status
      : "error",
  latencyMs: typeof body.latencyMs === "number" ? body.latencyMs : undefined,
  error:
    typeof body.error === "string" && body.error.trim()
      ? body.error.trim()
      : undefined,
  observedAt:
    typeof body.observedAt === "string" && body.observedAt.trim()
      ? body.observedAt
      : new Date().toISOString(),
});

const asWebrtcObservation = (
  body: WebrtcObservationInput,
  sessionId: string,
): WebrtcObservation => ({
  sessionId,
  source: "client_probe",
  candidateType:
    body.candidateType === "host" ||
    body.candidateType === "srflx" ||
    body.candidateType === "relay" ||
    body.candidateType === "prflx"
      ? body.candidateType
      : "unknown",
  address:
    typeof body.address === "string" && body.address.trim()
      ? body.address.trim()
      : undefined,
  addressFamily:
    body.addressFamily === "ipv4" ||
    body.addressFamily === "ipv6" ||
    body.addressFamily === "unknown"
      ? body.addressFamily
      : parseObservedIpFamily(body.address),
  protocol:
    typeof body.protocol === "string" && body.protocol.trim()
      ? body.protocol.trim()
      : undefined,
  port: typeof body.port === "number" ? body.port : undefined,
  relatedAddress:
    typeof body.relatedAddress === "string" && body.relatedAddress.trim()
      ? body.relatedAddress.trim()
      : undefined,
  relatedPort: typeof body.relatedPort === "number" ? body.relatedPort : undefined,
  foundation:
    typeof body.foundation === "string" && body.foundation.trim()
      ? body.foundation.trim()
      : undefined,
  rawCandidate:
    typeof body.rawCandidate === "string" && body.rawCandidate.trim()
      ? body.rawCandidate
      : undefined,
  observedAt:
    typeof body.observedAt === "string" && body.observedAt.trim()
      ? body.observedAt
      : new Date().toISOString(),
});

export const buildServer = (): FastifyInstance => {
  const app = Fastify({ logger: true });

  app.addHook("onRequest", async (request, reply) => {
    setCorsHeaders(
      typeof request.headers.origin === "string"
        ? request.headers.origin
        : undefined,
      reply,
    );

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "leaktest-api",
    phase: "phase-1-plus-http-dns",
    now: new Date().toISOString(),
  }));

  app.post("/api/session", async (request, reply) => {
    const session = createSession(getPublicBaseUrl(request));
    store.setSession(session);

    const payload: CreateSessionReply = {
      sessionId: session.id,
      clientToken: session.clientToken,
      status: session.status,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      detectorConfig: session.detectorConfig,
    };
    return reply.code(201).send(payload);
  });

  app.get<{
    Params: { vantage: string };
    Querystring: { sessionId?: string; token?: string };
  }>("/api/public/echo/:vantage", async (request, reply) => {
    const vantage = request.params.vantage;
    const region = ECHO_VANTAGE_REGIONS[vantage];
    if (!region) {
      return reply.code(404).send({
        error: "unknown_vantage",
        message: "Unknown echo vantage identifier.",
      });
    }

    const sessionId = request.query.sessionId;
    const token = request.query.token;
    if (!sessionId) {
      return reply.code(400).send({
        error: "session_id_required",
        message: "Field `sessionId` query parameter is required.",
      });
    }

    const session = store.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({
        error: "session_not_found",
        message: "Session not found.",
      });
    }

    if (!isAuthorized(session, token)) {
      return reply.code(401).send({
        error: "invalid_token",
        message: "The supplied client token is invalid.",
      });
    }

    if (!ensureSessionIsActive(session, reply)) {
      return reply;
    }

    const observation = buildEchoObservation(sessionId, vantage, region, request);

    return reply.code(200).send({
      sessionId,
      observation,
    });
  });

  app.get<{
    Querystring: { sessionId?: string; token?: string };
  }>("/api/public/ip-source/cloudflare-trace", async (request, reply) => {
    const sessionId = request.query.sessionId;
    if (!sessionId) {
      return reply.code(400).send({
        error: "session_id_required",
        message: "Field `sessionId` query parameter is required.",
      });
    }

    const session = store.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({
        error: "session_not_found",
        message: "Session not found.",
      });
    }

    if (!isAuthorized(session, request.query.token)) {
      return reply.code(401).send({
        error: "invalid_token",
        message: "The supplied client token is invalid.",
      });
    }

    if (!ensureSessionIsActive(session, reply)) {
      return reply;
    }

    try {
      const upstreamResponse = await fetch(CLOUDFLARE_TRACE_URL, {
        headers: {
          "user-agent":
            typeof request.headers["user-agent"] === "string"
              ? request.headers["user-agent"]
              : "LeakTest/0.1",
          accept: "text/plain",
        },
      });

      const body = await upstreamResponse.text();
      if (!upstreamResponse.ok) {
        return reply.code(502).send({
          error: "cloudflare_trace_unavailable",
          message: "Cloudflare trace upstream returned a non-success status.",
          statusCode: upstreamResponse.status,
        });
      }

      const parsed = parseTracePayload(body);
      const observation = {
        sessionId,
        source: "client_report" as const,
        vantage: "cloudflare-trace",
        region: "external",
        provider: "cloudflare",
        label: "Cloudflare Trace",
        parser: "cloudflare_trace" as const,
        url: CLOUDFLARE_TRACE_URL,
        observedIp: parsed.ip,
        observedIpFamily: parseObservedIpFamily(parsed.ip),
        statusCode: upstreamResponse.status,
        requestHost: "cloudflare.com",
        observedAt: new Date().toISOString(),
      };

      return reply.code(200).send({
        sessionId,
        observation,
        trace: parsed,
      });
    } catch (error) {
      return reply.code(502).send({
        error: "cloudflare_trace_fetch_failed",
        message:
          error instanceof Error ? error.message : "Cloudflare trace fetch failed.",
      });
    }
  });

  app.post<{ Body: CollectFingerprintBody }>(
    "/api/collect/fingerprint",
    async (request, reply) => {
      const sessionId = request.body?.sessionId;
      if (!sessionId) {
        return reply.code(400).send({
          error: "session_id_required",
          message: "Field `sessionId` is required.",
        });
      }

      const session = store.getSession(sessionId);
      if (!session) {
        return reply.code(404).send({
          error: "session_not_found",
          message: "Session not found.",
        });
      }

      if (!isAuthorized(session, request.body?.token)) {
        return reply.code(401).send({
          error: "invalid_token",
          message: "The supplied client token is invalid.",
        });
      }

      if (!ensureSessionIsActive(session, reply)) {
        return reply;
      }

      const acceptLanguageHeader =
        typeof request.headers["accept-language"] === "string"
          ? request.headers["accept-language"]
          : undefined;

      const snapshot = asFingerprintSnapshot(
        request.body,
        sessionId,
        acceptLanguageHeader,
      );
      store.setFingerprint(snapshot);
      session.status = "collecting";
      store.setSession(session);

      return reply.code(202).send({
        sessionId,
        status: session.status,
        collectedAt: snapshot.collectedAt,
      });
    },
  );

  app.post<{ Body: CollectHttpBody }>("/api/collect/http", async (request, reply) => {
    const sessionId = request.body?.sessionId;
    if (!sessionId) {
      return reply.code(400).send({
        error: "session_id_required",
        message: "Field `sessionId` is required.",
      });
    }

    const session = store.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({
        error: "session_not_found",
        message: "Session not found.",
      });
    }

    if (!isAuthorized(session, request.body?.token)) {
      return reply.code(401).send({
        error: "invalid_token",
        message: "The supplied client token is invalid.",
      });
    }

    if (!ensureSessionIsActive(session, reply)) {
      return reply;
    }

    const observations = Array.isArray(request.body?.observations)
      ? request.body.observations
      : [];
    if (observations.length === 0) {
      return reply.code(400).send({
        error: "observations_required",
        message: "Field `observations` must be a non-empty array.",
      });
    }

    const normalized = observations.map((item) =>
      asHttpObservation(item, sessionId, request.headers),
    );
    store.addHttpObservations(normalized);

    session.status = "collecting";
    store.setSession(session);

    return reply.code(202).send({
      sessionId,
      status: session.status,
      accepted: normalized.length,
      totalHttpObservations: store.getHttpObservations(sessionId).length,
    });
  });

  app.get<{
    Params: { targetId: string };
    Querystring: { sessionId?: string; token?: string; probeId?: string };
  }>("/api/public/probe/dns/:targetId", async (request, reply) => {
    const sessionId = request.query.sessionId;
    if (!sessionId) {
      return reply.code(400).send({
        error: "session_id_required",
        message: "Field `sessionId` query parameter is required.",
      });
    }

    const session = store.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({
        error: "session_not_found",
        message: "Session not found.",
      });
    }

    if (!isAuthorized(session, request.query.token)) {
      return reply.code(401).send({
        error: "invalid_token",
        message: "The supplied client token is invalid.",
      });
    }

    if (!ensureSessionIsActive(session, reply)) {
      return reply;
    }

    const targetId = request.params.targetId;
    const configuredTarget = session.detectorConfig.dnsTargets.find(
      (target) => target.id === targetId,
    );

    store.addDnsObservation({
      sessionId,
      source: "probe_endpoint_hit",
      simulated: true,
      targetId,
      targetHost: configuredTarget?.host,
      purpose: configuredTarget?.purpose,
      probeId: request.query.probeId,
      status: "hit",
      requestHost:
        typeof request.headers.host === "string" ? request.headers.host : undefined,
      requesterIp: request.ip,
      observedAt: new Date().toISOString(),
    });

    session.status = "collecting";
    store.setSession(session);

    reply.header("Cache-Control", "no-store");
    return reply.code(204).send();
  });

  app.post<{ Body: CollectDnsBody }>("/api/collect/dns", async (request, reply) => {
    const sessionId = request.body?.sessionId;
    if (!sessionId) {
      return reply.code(400).send({
        error: "session_id_required",
        message: "Field `sessionId` is required.",
      });
    }

    const session = store.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({
        error: "session_not_found",
        message: "Session not found.",
      });
    }

    if (!isAuthorized(session, request.body?.token)) {
      return reply.code(401).send({
        error: "invalid_token",
        message: "The supplied client token is invalid.",
      });
    }

    if (!ensureSessionIsActive(session, reply)) {
      return reply;
    }

    const observations = Array.isArray(request.body?.observations)
      ? request.body.observations
      : [];
    if (observations.length === 0) {
      return reply.code(400).send({
        error: "observations_required",
        message: "Field `observations` must be a non-empty array.",
      });
    }

    const normalized = observations.map((item) => asDnsObservation(item, sessionId));
    store.addDnsObservations(normalized);

    session.status = "collecting";
    store.setSession(session);

    return reply.code(202).send({
      sessionId,
      status: session.status,
      accepted: normalized.length,
      totalDnsObservations: store.getDnsObservations(sessionId).length,
    });
  });

  app.post<{ Body: CollectAiBody }>("/api/collect/ai", async (request, reply) => {
    const sessionId = request.body?.sessionId;
    if (!sessionId) {
      return reply.code(400).send({
        error: "session_id_required",
        message: "Field `sessionId` is required.",
      });
    }

    const session = store.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({
        error: "session_not_found",
        message: "Session not found.",
      });
    }

    if (!isAuthorized(session, request.body?.token)) {
      return reply.code(401).send({
        error: "invalid_token",
        message: "The supplied client token is invalid.",
      });
    }

    if (!ensureSessionIsActive(session, reply)) {
      return reply;
    }

    const observations = Array.isArray(request.body?.observations)
      ? request.body.observations
      : [];
    if (observations.length === 0) {
      return reply.code(400).send({
        error: "observations_required",
        message: "Field `observations` must be a non-empty array.",
      });
    }

    const normalized = observations.map((item) => asAiObservation(item, sessionId));
    store.addAiObservations(normalized);

    session.status = "collecting";
    store.setSession(session);

    return reply.code(202).send({
      sessionId,
      status: session.status,
      accepted: normalized.length,
      totalAiObservations: store.getAiObservations(sessionId).length,
    });
  });

  app.post<{ Body: CollectWebrtcBody }>("/api/collect/webrtc", async (request, reply) => {
    const sessionId = request.body?.sessionId;
    if (!sessionId) {
      return reply.code(400).send({
        error: "session_id_required",
        message: "Field `sessionId` is required.",
      });
    }

    const session = store.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({
        error: "session_not_found",
        message: "Session not found.",
      });
    }

    if (!isAuthorized(session, request.body?.token)) {
      return reply.code(401).send({
        error: "invalid_token",
        message: "The supplied client token is invalid.",
      });
    }

    if (!ensureSessionIsActive(session, reply)) {
      return reply;
    }

    const observations = Array.isArray(request.body?.observations)
      ? request.body.observations
      : [];
    if (observations.length === 0) {
      return reply.code(400).send({
        error: "observations_required",
        message: "Field `observations` must be a non-empty array.",
      });
    }

    const normalized = observations.map((item) => asWebrtcObservation(item, sessionId));
    store.addWebrtcObservations(normalized);

    session.status = "collecting";
    store.setSession(session);

    return reply.code(202).send({
      sessionId,
      status: session.status,
      accepted: normalized.length,
      totalWebrtcObservations: store.getWebrtcObservations(sessionId).length,
    });
  });

  app.post<{ Body: { sessionId?: string; observations?: DnsObservationInput[] } }>(
    "/api/ingest/dns/authoritative",
    async (request, reply) => {
      const ingestToken = process.env.DNS_INGEST_TOKEN;
      const presentedIngestToken =
        typeof request.headers["x-dns-ingest-token"] === "string"
          ? request.headers["x-dns-ingest-token"]
          : undefined;
      if (ingestToken && ingestToken !== presentedIngestToken) {
        return reply.code(401).send({
          error: "invalid_ingest_token",
          message: "The supplied ingest token is invalid.",
        });
      }

      const sessionId = request.body?.sessionId;
      if (!sessionId) {
        return reply.code(400).send({
          error: "session_id_required",
          message: "Field `sessionId` is required.",
        });
      }

      const session = store.getSession(sessionId);
      if (!session) {
        return reply.code(404).send({
          error: "session_not_found",
          message: "Session not found.",
        });
      }

      const observations = Array.isArray(request.body?.observations)
        ? request.body.observations
        : [];
      if (observations.length === 0) {
        return reply.code(400).send({
          error: "observations_required",
          message: "Field `observations` must be a non-empty array.",
        });
      }

      const normalized = observations.map((item) =>
        asDnsObservation(
          {
            ...item,
            source: "authoritative_ingest",
            simulated: false,
            status: item.status ?? "observed",
          },
          sessionId,
        ),
      );
      store.addDnsObservations(normalized);

      session.status = "collecting";
      store.setSession(session);

      return reply.code(202).send({
        sessionId,
        status: session.status,
        accepted: normalized.length,
        totalDnsObservations: store.getDnsObservations(sessionId).length,
      });
    },
  );

  app.post<{ Params: { id: string }; Body: { token?: string } }>(
    "/api/session/:id/finalize",
    async (request, reply) => {
      const { id } = request.params;
      const session = store.getSession(id);
      if (!session) {
        return reply.code(404).send({
          error: "session_not_found",
          message: "Session not found.",
        });
      }

      if (!isAuthorized(session, request.body?.token)) {
        return reply.code(401).send({
          error: "invalid_token",
          message: "The supplied client token is invalid.",
        });
      }

      if (!ensureSessionIsActive(session, reply)) {
        return reply;
      }

      session.status = "processing";
      store.setSession(session);

      const fingerprint = store.getFingerprint(id);
      const httpObservations = store.getHttpObservations(id);
      const dnsObservations = store.getDnsObservations(id);
      const aiObservations = store.getAiObservations(id);
      const webrtcObservations = store.getWebrtcObservations(id);
      const report = runPhase1Scoring({
        sessionId: id,
        fingerprint,
        httpObservations,
        dnsObservations,
        aiObservations,
        webrtcObservations,
      });
      store.setReport(report);

      session.status = "completed";
      store.setSession(session);

      return reply.code(200).send({
        sessionId: id,
        status: session.status,
        report,
      });
    },
  );

  app.get<{ Params: { id: string } }>("/api/report/:id", async (request, reply) => {
    const report = store.getReport(request.params.id);
    if (!report) {
      return reply.code(404).send({
        error: "report_not_found",
        message: "Report not found. Finalize the session first.",
      });
    }
    return reply.code(200).send(report);
  });

  return app;
};
