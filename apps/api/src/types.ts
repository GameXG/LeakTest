export type SessionStatus =
  | "created"
  | "collecting"
  | "awaiting_finalize"
  | "processing"
  | "completed"
  | "failed"
  | "expired";

export interface DetectorConfig {
  echoNodes: Array<{
    vantage: string;
    url: string;
    region: string;
  }>;
  externalIpSources: Array<{
    id: string;
    provider: string;
    label: string;
    url: string;
    parser: "cloudflare_trace";
  }>;
  stunServers: Array<{
    id: string;
    urls: string[];
    region: string;
  }>;
  dnsTargets: Array<{
    id: string;
    host: string;
    purpose: "base" | "uncached" | "dualstack" | "low_ttl";
      probeUrl?: string;
      mode?: "simulated_http_probe" | "authoritative_ready";
    }>;
  aiTargets: Array<{
    id: string;
    provider: string;
    label: string;
    probeUrl: string;
  }>;
}

export interface SessionRecord {
  id: string;
  clientToken: string;
  createdAt: string;
  expiresAt: string;
  status: SessionStatus;
  detectorConfig: DetectorConfig;
}

export interface FingerprintSnapshot {
  sessionId: string;
  ua?: string;
  uaCh?: {
    mobile?: boolean;
    platform?: string;
    brands?: Array<{ brand: string; version: string }>;
  };
  timezone?: string;
  utcOffsetMinutes?: number;
  language?: string;
  languages?: string[];
  acceptLanguage?: string;
  screen?: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    pixelRatio: number;
  };
  deviceSignals?: {
    platform?: string;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    maxTouchPoints?: number;
  };
  collectedAt: string;
}

export interface IpRegionSignal {
  countryCode: string;
  countryName: string;
  inferredTimezone: string;
  primaryLocale: string;
  source: "http_observation_inferred" | "deterministic_placeholder";
  inferenceMethod: "stable_ip_hash" | "session_hash";
  baselineIp?: string;
  observedHttpCount: number;
}

export interface HttpObservation {
  sessionId: string;
  source: "echo_endpoint" | "client_report";
  vantage: string;
  region?: string;
  provider?: string;
  label?: string;
  parser?: "cloudflare_trace";
  url?: string;
  observedIp?: string;
  observedIpFamily?: "ipv4" | "ipv6" | "unknown";
  statusCode?: number;
  rttMs?: number;
  userAgent?: string;
  acceptLanguage?: string;
  requestHost?: string;
  error?: string;
  observedAt: string;
}

export interface AiObservation {
  sessionId: string;
  source: "client_probe";
  targetId: string;
  provider: string;
  label: string;
  probeUrl: string;
  status: "reachable" | "blocked" | "timeout" | "error";
  latencyMs?: number;
  error?: string;
  observedAt: string;
}

export interface DnsObservation {
  sessionId: string;
  source: "probe_endpoint_hit" | "client_report" | "authoritative_ingest";
  simulated: boolean;
  targetId: string;
  targetHost?: string;
  purpose?: "base" | "uncached" | "dualstack" | "low_ttl";
  probeId?: string;
  resolverIp?: string;
  resolverAsn?: number;
  resolverCountry?: string;
  queryType?: string;
  status: "hit" | "success" | "error" | "timeout" | "observed";
  latencyMs?: number;
  error?: string;
  requestHost?: string;
  requesterIp?: string;
  observedAt: string;
}

export interface WebrtcObservation {
  sessionId: string;
  source: "client_probe";
  candidateType: "host" | "srflx" | "relay" | "prflx" | "unknown";
  address?: string;
  addressFamily?: "ipv4" | "ipv6" | "unknown";
  protocol?: string;
  port?: number;
  relatedAddress?: string;
  relatedPort?: number;
  foundation?: string;
  rawCandidate?: string;
  observedAt: string;
}

export interface Finding {
  code: string;
  severity: "info" | "low" | "medium" | "high";
  scoreDelta: number;
  title: string;
  titleKey?: string;
  description: string;
  descriptionKey?: string;
  translationParams?: Record<string, string | number>;
  evidence: Record<string, unknown>;
}

export interface ModuleStatus {
  module: string;
  moduleKey?: string;
  status: "ok" | "warning" | "critical" | "info";
  scoreDelta: number;
  summary: string;
  summaryKey?: string;
  summaryParams?: Record<string, string | number>;
}

export interface SessionReport {
  sessionId: string;
  summary: {
    totalScore: number;
    riskLevel: "consistent" | "mildly_suspicious" | "suspicious" | "high_risk";
    createdAt: string;
    headline: string;
    headlineKey?: string;
    headlineParams?: Record<string, string | number>;
  };
  moduleStatuses: ModuleStatus[];
  findings: Finding[];
  evidence: {
    ipRegionSignal: IpRegionSignal;
    fingerprint?: FingerprintSnapshot;
    httpObservations: HttpObservation[];
    dnsObservations: DnsObservation[];
    aiObservations: AiObservation[];
    webrtcObservations: WebrtcObservation[];
    dnsCapability: {
      mode: "simulated_http_probe" | "authoritative";
      summary: string;
      summaryKey?: string;
    };
  };
}
