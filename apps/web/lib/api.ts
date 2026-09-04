const DEFAULT_API_BASE = "http://localhost:4000";

function trimSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getApiBaseUrl(): string {
  const envValue = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!envValue) {
    return DEFAULT_API_BASE;
  }
  return trimSlash(envValue);
}

export type CreateSessionResponse = {
  sessionId: string;
  clientToken: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  detectorConfig?: {
    echoNodes?: Array<{ vantage: string; url: string; region: string }>;
    externalIpSources?: Array<{
      id: string;
      provider: string;
      label: string;
      url: string;
      parser: "cloudflare_trace";
    }>;
    stunServers?: Array<{ id: string; urls: string[]; region: string }>;
    dnsTargets?: Array<{
      id: string;
      host: string;
      purpose: "base" | "uncached" | "dualstack" | "low_ttl";
      probeUrl?: string;
      mode?: "simulated_http_probe" | "authoritative_ready";
    }>;
    aiTargets?: Array<{
      id: string;
      provider: string;
      label: string;
      probeUrl: string;
    }>;
  };
};

export type HttpObservation = {
  vantage: string;
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
};

export type DnsObservation = {
  targetId: string;
  targetHost?: string;
  purpose?: "base" | "uncached" | "dualstack" | "low_ttl";
  probeId?: string;
  status?: "success" | "error" | "timeout" | "observed" | "hit";
  latencyMs?: number;
  error?: string;
  simulated?: boolean;
  source?: "client_report" | "authoritative_ingest";
  observedAt?: string;
};

export type AiObservation = {
  targetId: string;
  provider: string;
  label: string;
  probeUrl: string;
  status: "reachable" | "blocked" | "timeout" | "error";
  latencyMs?: number;
  error?: string;
  observedAt?: string;
};

export type WebrtcObservation = {
  candidateType: "host" | "srflx" | "relay" | "prflx" | "unknown";
  address?: string;
  addressFamily?: "ipv4" | "ipv6" | "unknown";
  protocol?: string;
  port?: number;
  relatedAddress?: string;
  relatedPort?: number;
  foundation?: string;
  rawCandidate?: string;
  observedAt?: string;
};

export type FingerprintPayload = {
  sessionId: string;
  token: string;
  ua: string;
  uaCh: {
    mobile?: boolean;
    platform?: string;
    brands?: Array<{ brand: string; version: string }>;
  };
  timezone: string;
  utcOffsetMinutes: number;
  language: string;
  languages: string[];
  acceptLanguage: string;
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    pixelRatio: number;
  };
  deviceSignals: {
    platform: string;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    maxTouchPoints?: number;
  };
};

export type ReportResponse = {
  sessionId: string;
  summary: {
    totalScore: number;
    riskLevel: string;
    createdAt: string;
    headline: string;
    headlineKey?: string;
    headlineParams?: Record<string, string | number>;
  };
  moduleStatuses: Array<{
    module: string;
    moduleKey?: string;
    status: string;
    scoreDelta: number;
    summary: string;
    summaryKey?: string;
    summaryParams?: Record<string, string | number>;
  }>;
  findings: Array<{
    code: string;
    title: string;
    titleKey?: string;
    severity: string;
    description: string;
    descriptionKey?: string;
    translationParams?: Record<string, string | number>;
    scoreDelta: number;
    evidence: Record<string, unknown>;
  }>;
  evidence: Record<string, unknown> & {
    aiObservations?: AiObservation[];
    webrtcObservations?: WebrtcObservation[];
    dnsCapability?: {
      mode?: string;
      summary?: string;
      summaryKey?: string;
    };
  };
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }
  return (await response.json()) as T;
}

export async function createSession(signal?: AbortSignal): Promise<CreateSessionResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal
  });
  return parseResponse<CreateSessionResponse>(response);
}

export async function collectFingerprint(
  payload: FingerprintPayload,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/collect/fingerprint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal
  });
  await parseResponse<unknown>(response);
}

export async function collectHttp(
  sessionId: string,
  token: string,
  observations: HttpObservation[],
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/collect/http`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, token, observations }),
    signal
  });
  await parseResponse<unknown>(response);
}

export async function collectDns(
  sessionId: string,
  token: string,
  observations: DnsObservation[],
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/collect/dns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, token, observations }),
    signal
  });
  await parseResponse<unknown>(response);
}

export async function collectAi(
  sessionId: string,
  token: string,
  observations: AiObservation[],
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/collect/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, token, observations }),
    signal
  });
  await parseResponse<unknown>(response);
}

export async function collectWebrtc(
  sessionId: string,
  token: string,
  observations: WebrtcObservation[],
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/collect/webrtc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, token, observations }),
    signal
  });
  await parseResponse<unknown>(response);
}

export async function finalizeSession(
  sessionId: string,
  token: string,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/session/${sessionId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    signal
  });
  await parseResponse<unknown>(response);
}

export async function getReport(sessionId: string, signal?: AbortSignal): Promise<ReportResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/report/${sessionId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal,
    cache: "no-store"
  });
  return parseResponse<ReportResponse>(response);
}
