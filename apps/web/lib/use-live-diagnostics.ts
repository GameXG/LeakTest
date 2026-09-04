"use client";

import { useEffect, useState } from "react";
import { SOURCE_REGISTRY } from "./source-registry";

export type IpCard = {
  label: string;
  ips?: Array<{ version: "IPv4" | "IPv6"; value: string }>;
  countryCode?: string;
  geo?: string;
};

export type RiskSnapshot = {
  trustScore?: number;
  trustLabel?: string;
  trustSummary?: string;
  country?: string;
  city?: string;
  ipType?: string;
  asn?: string;
  carrier?: string;
  vpn?: boolean;
  proxy?: boolean;
  tor?: boolean;
  crawler?: boolean;
  abuser?: boolean;
};

export type ServiceObservation = {
  id: string;
  label: string;
  latencyMs?: number;
  status: "normal" | "good" | "slow" | "blocked";
};

export type DnsObservation = {
  status: "safe" | "warn" | "neutral";
  statusLabel: string;
  ip?: string;
  countryCode?: string;
  isp?: string;
  location?: string;
  resolverCount?: number;
  domesticResolverCount?: number;
  globalResolverCount?: number;
};

export type WebrtcObservation = {
  status: "safe" | "warn" | "neutral";
  statusLabel: string;
  ip?: string;
  baselineIps?: string[];
  countryCode?: string;
  country?: string;
  candidates: Array<{ candidateType: string; address?: string; protocol?: string }>;
  publicCandidateCount?: number;
  ipv4Count?: number;
  ipv6Count?: number;
  stunServerCount?: number;
  relayCount?: number;
  srflxCount?: number;
  hostCount?: number;
  tcpCount?: number;
  udpCount?: number;
};

export type DeviceSnapshot = {
  timezoneLabel: string;
  languageLabel: string;
  browserLabel: string;
  cookieLabel: string;
  webglRenderer: string;
  canvasHash: string;
  webglHash: string;
  mainlandRiskScore: number;
  mainlandRiskLabel: "安全" | "可疑" | "危险";
  mainlandRiskSummary: string;
  signals: EnvironmentSignal[];
};

export type EnvironmentSignal = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "good" | "review" | "neutral";
  points: number;
};

export type StatusSnapshot = {
  overallLabel: string;
  overallIndicator: string;
  components: Array<{ name: string; status: string; statusCn: string }>;
  fetchedAt?: string;
};

export type DiagnosticsProgress = {
  label: string;
  completed: number;
  total: number;
  percent: number;
};

export type LiveDiagnosticsState = {
  loading: boolean;
  error?: string;
  progress?: DiagnosticsProgress;
  cards: {
    local?: IpCard;
    cloudflare?: IpCard;
    ai?: IpCard;
    codex?: IpCard;
  };
  risk?: RiskSnapshot;
  codexRisk?: RiskSnapshot;
  services: ServiceObservation[];
  dns?: DnsObservation;
  webrtc?: WebrtcObservation;
  device?: DeviceSnapshot;
  history: Array<{ ip: string; countryCode?: string; city?: string; time: string }>;
  status?: StatusSnapshot;
};

const HISTORY_KEY = "risk_page_history";
const HISTORY_LIMIT = 8;
const DNS_TEST_DOMAINS = SOURCE_REGISTRY.dns.leakDomains;
const REGIONAL_PORTAL_GROUPS = SOURCE_REGISTRY.environment.regionalPortals;
const WEBRTC_STUN_SERVERS = SOURCE_REGISTRY.webrtc.stunServers;
const PROGRESS_STEPS = [
  "收集出口 IP",
  "聚合多源 IP 信息",
  "探测服务可达性",
  "检测 DNS 泄露",
  "检测 WebRTC",
  "整理设备与历史"
] as const;

const initialState: LiveDiagnosticsState = {
  loading: true,
  progress: {
    label: PROGRESS_STEPS[0],
    completed: 0,
    total: PROGRESS_STEPS.length,
    percent: 0
  },
  cards: {},
  services: [],
  history: []
};

function makeProgress(step: number): DiagnosticsProgress {
  return {
    label: PROGRESS_STEPS[Math.max(0, Math.min(step - 1, PROGRESS_STEPS.length - 1))],
    completed: step,
    total: PROGRESS_STEPS.length,
    percent: Math.round((step / PROGRESS_STEPS.length) * 100)
  };
}

function parseTrace(text: string) {
  const entries = Object.fromEntries(
    text
      .trim()
      .split("\n")
      .map((line) => line.split("=")),
  );

  return {
    ip: typeof entries.ip === "string" ? entries.ip : undefined,
    countryCode: typeof entries.loc === "string" ? entries.loc.toLowerCase() : undefined
  };
}

async function fetchTrace(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch trace from ${url}`);
  }

  return parseTrace(await response.text());
}

async function fetchCnIp() {
  const sources = SOURCE_REGISTRY.ip.mainlandIpv4Pages;

  for (const source of sources) {
    try {
      const response = await fetch(source, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000)
      });
      const html = await response.text();
      const match = html.match(/(\d+\.\d+\.\d+\.\d+)/);

      if (match) {
        return match[1];
      }
    } catch {}
  }

  return undefined;
}

async function fetchPublicIpv6() {
  const sources = [
    ...SOURCE_REGISTRY.ip.publicIp.ipv6.json.map(
      (url) => async () => (await fetchJson<{ ip?: string }>(url)).ip,
    ),
    ...SOURCE_REGISTRY.ip.publicIp.ipv6.text.map(
      (url) => async () => (await fetchText(url)).trim(),
    )
  ];

  for (const source of sources) {
    try {
      const ip = await source();

      if (typeof ip === "string" && ip.includes(":")) {
        return ip;
      }
    } catch {}
  }

  return undefined;
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }

  return response.text();
}

async function fetchIpApiSource(ip: string) {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return undefined;
  }

  try {
    return await fetchJson<{
      status?: string;
      country?: string;
      countryCode?: string;
      regionName?: string;
      city?: string;
      isp?: string;
      org?: string;
      as?: string;
      mobile?: boolean;
      proxy?: boolean;
      hosting?: boolean;
      query?: string;
    }>(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city,isp,org,as,mobile,proxy,hosting,query`,
    );
  } catch {
    return undefined;
  }
}

async function fetchIpInfoSource(ip: string) {
  try {
    return await fetchJson<{
      ip?: string;
      city?: string;
      region?: string;
      country?: string;
      org?: string;
      timezone?: string;
    }>(`https://ipinfo.io/${encodeURIComponent(ip)}/json`);
  } catch {
    return undefined;
  }
}

async function fetchIpApiIsSource(ip: string) {
  try {
    return await fetchJson<{
      ip?: string;
      is_tor?: boolean;
      is_proxy?: boolean;
      is_vpn?: boolean;
      is_crawler?: boolean;
      is_abuser?: boolean;
      is_datacenter?: boolean;
      is_mobile?: boolean;
      company?: {
        name?: string;
        type?: string;
      };
      asn?: {
        asn?: number;
        org?: string;
      };
      company_name?: string;
      asn_num?: number;
      asn_org?: string;
      cc?: string;
      location?: {
        country?: string;
        state?: string;
        city?: string;
        country_code?: string;
      };
    }>(`https://api.ipapi.is?q=${encodeURIComponent(ip)}`);
  } catch {
    return undefined;
  }
}

function countryNameFromCode(countryCode?: string) {
  const normalized = countryCode?.trim().toUpperCase();

  if (!normalized || normalized.length !== 2) {
    return undefined;
  }

  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

async function fetchGeo(ip?: string) {
  if (!ip) {
    return undefined;
  }

  const [ipApi, ipInfo, ipApiIs] = await Promise.all([
    fetchIpApiSource(ip),
    fetchIpInfoSource(ip),
    fetchIpApiIsSource(ip)
  ]);

  return {
    country:
      ipApiIs?.location?.country ??
      countryNameFromCode(ipApiIs?.cc) ??
      ipApi?.country,
    region: ipApiIs?.location?.state ?? ipApi?.regionName ?? ipInfo?.region,
    city: ipApiIs?.location?.city ?? ipInfo?.city ?? ipApi?.city,
    isp:
      ipApiIs?.company?.name ??
      ipApiIs?.company_name ??
      ipApiIs?.asn?.org ??
      ipApiIs?.asn_org ??
      ipApi?.isp ??
      ipInfo?.org,
    country_code: (
      ipApiIs?.location?.country_code ??
      ipApiIs?.cc ??
      ipApi?.countryCode ??
      ipInfo?.country ??
      ""
    ).toLowerCase() || undefined
  };
}

async function fetchRisk(ip?: string) {
  if (!ip) {
    return undefined;
  }

  const [ipApi, ipInfo, ipApiIs] = await Promise.all([
    fetchIpApiSource(ip),
    fetchIpInfoSource(ip),
    fetchIpApiIsSource(ip)
  ]);

  const trust_score =
    ipApiIs?.is_tor
      ? 5
      : ipApiIs?.is_vpn
        ? 25
        : ipApiIs?.is_proxy || ipApi?.proxy
          ? 35
          : ipApiIs?.is_datacenter || ipApi?.hosting
            ? 45
            : ipApiIs?.is_abuser
              ? 30
              : 100;

  const asnFromIpApi = ipApi?.as ? Number((ipApi.as.match(/^AS(\d+)/i) ?? [])[1] ?? "") : undefined;

  return {
    trust_score,
    country:
      ipApiIs?.location?.country ??
      countryNameFromCode(ipApiIs?.cc) ??
      ipApi?.country,
    city: ipApiIs?.location?.city ?? ipInfo?.city ?? ipApi?.city,
    asn: ipApiIs?.asn?.asn ?? ipApiIs?.asn_num ?? asnFromIpApi,
    asOrganization:
      ipApiIs?.asn?.org ??
      ipApiIs?.asn_org ??
      ipApiIs?.company?.name ??
      ipApiIs?.company_name ??
      ipApi?.org ??
      ipApi?.isp ??
      ipInfo?.org,
    isResidential:
      ipApiIs?.is_datacenter === false
        ? true
        : ipApiIs?.is_datacenter === true || ipApi?.hosting
          ? false
          : undefined,
    is_vpn: ipApiIs?.is_vpn,
    is_proxy: ipApiIs?.is_proxy ?? ipApi?.proxy,
    is_tor: ipApiIs?.is_tor,
    is_crawler: ipApiIs?.is_crawler,
    is_abuser: ipApiIs?.is_abuser,
    company_type: ipApiIs?.company?.type ?? (ipApi?.hosting ? "hosting" : ipApi?.mobile ? "mobile" : undefined),
    company_name:
      ipApiIs?.company?.name ??
      ipApiIs?.company_name ??
      ipApiIs?.asn_org ??
      ipApi?.isp ??
      ipInfo?.org
  };
}

function formatGeo(
  geo?: {
    country?: string;
    region?: string;
    city?: string;
    isp?: string;
  },
  fallbackCountryCode?: string
) {
  const pieces = [geo?.country, geo?.region, geo?.city, geo?.isp].filter(Boolean);

  if (pieces.length > 0) {
    return pieces.join(" ");
  }

  if (fallbackCountryCode) {
    return fallbackCountryCode.toUpperCase();
  }

  return undefined;
}

function buildIpList(...values: Array<string | undefined>) {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))];

  return unique
    .map((value) => ({
      version: value.includes(":") ? ("IPv6" as const) : ("IPv4" as const),
      value
    }))
    .sort((left, right) => {
      if (left.version === right.version) {
        return 0;
      }

      return left.version === "IPv4" ? -1 : 1;
    });
}

function trustLabel(score?: number) {
  if (typeof score !== "number") {
    return "未知";
  }
  if (score >= 95) return "极度纯净";
  if (score >= 80) return "纯净";
  if (score >= 50) return "良好";
  if (score >= 25) return "中性";
  return "可疑";
}

function trustSummary(score?: number) {
  if (typeof score !== "number") {
    return "未取得风险评分";
  }
  if (score >= 95) return "该IP信誉极好";
  if (score >= 80) return "该 IP 信誉优异";
  if (score >= 50) return "该 IP 存在轻微风险";
  if (score >= 25) return "该 IP 存在一定风险";
  return "该 IP 风险极高";
}

function ipTypeLabel(isResidential?: boolean, companyType?: string) {
  if (isResidential) {
    return companyType ? `家庭住宅IP (${companyType.toUpperCase()})` : "家庭住宅IP";
  }

  if (isResidential === false) {
    return companyType ? `机房IP (${companyType.toUpperCase()})` : "机房IP";
  }

  return "未知";
}

function buildRiskSnapshot(
  source?: {
    trust_score?: number;
    country?: string;
    city?: string;
    asn?: number;
    asOrganization?: string;
    isResidential?: boolean;
    is_vpn?: boolean;
    is_proxy?: boolean;
    is_tor?: boolean;
    is_crawler?: boolean;
    is_abuser?: boolean;
    company_type?: string;
  }
): RiskSnapshot | undefined {
  if (!source) {
    return undefined;
  }

  return {
    trustScore: source.trust_score,
    trustLabel: trustLabel(source.trust_score),
    trustSummary: trustSummary(source.trust_score),
    country: source.country,
    city: source.city,
    ipType: ipTypeLabel(source.isResidential, source.company_type),
    asn: source.asn ? `AS${source.asn}` : "未知",
    carrier: source.asOrganization,
    vpn: source.is_vpn,
    proxy: source.is_proxy,
    tor: source.is_tor,
    crawler: source.is_crawler,
    abuser: source.is_abuser
  };
}

function serviceLabel(latencyMs?: number) {
  if (typeof latencyMs !== "number") {
    return "blocked" as const;
  }
  if (latencyMs < 250) return "normal" as const;
  if (latencyMs < 500) return "good" as const;
  return "slow" as const;
}

async function measureAvailability(id: string, label: string, url: string): Promise<ServiceObservation> {
  const start = performance.now();

  try {
    await fetch(url, {
      mode: "no-cors",
      signal: AbortSignal.timeout(6000)
    });

    const latencyMs = Math.round(performance.now() - start);
    return {
      id,
      label,
      latencyMs,
      status: serviceLabel(latencyMs)
    };
  } catch {
    return {
      id,
      label,
      status: "blocked"
    };
  }
}

function countryLooksChinese(value?: string) {
  const normalized = (value ?? "").toLowerCase();
  return normalized.includes("china") || normalized.includes("中国") || normalized === "cn";
}

async function detectDnsLeak(
  baselineCountries: Array<string | undefined>,
): Promise<DnsObservation> {
  const queries = Array.from({ length: 50 }, (_, index) => {
    const randomLabel = Math.random().toString(36).slice(2, 14);
    const family = index < 25 ? "dns4" : "dns6";
    const domain = DNS_TEST_DOMAINS[index % DNS_TEST_DOMAINS.length];
    return `https://${randomLabel}.${family}.${domain}`;
  });

  const results = await Promise.allSettled(
    queries.map(async (url) => {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000)
      });

      if (!response.ok) {
        return {};
      }

      return await response.json();
    })
  );

  const servers: Record<string, string[]> = {};
  results.forEach((result) => {
    if (result.status !== "fulfilled" || typeof result.value !== "object" || !result.value) {
      return;
    }
    Object.entries(result.value).forEach(([ip, info]) => {
      if (!servers[ip] && Array.isArray(info)) {
        servers[ip] = info as string[];
      }
    });
  });

  const entries = Object.entries(servers);
  if (entries.length === 0) {
    return {
      status: "neutral",
      statusLabel: "请使用免费第三方工具检测"
    };
  }

  const baselineSet = baselineCountries.filter(Boolean);
  const baselineAllNonChinese =
    baselineSet.length > 0 && baselineSet.every((country) => !countryLooksChinese(country));
  const resolverCountrySet = new Set<string>();
  let domesticResolverCount = 0;
  let globalResolverCount = 0;
  let selected: { ip: string; cc: string; location: string; isp: string; leaked: boolean } | undefined;

  for (const [ip, value] of entries) {
    const cc = value[0]?.toLowerCase() ?? "";
    const location = value[1] ?? "";
    const isp = value[2] ?? "";
    const leaked = cc === "cn" && baselineAllNonChinese;

    if (cc) {
      resolverCountrySet.add(cc);
      if (cc === "cn") {
        domesticResolverCount += 1;
      } else {
        globalResolverCount += 1;
      }
    }

    if (leaked && !selected?.leaked) {
      selected = { ip, cc, location, isp, leaked };
    } else if (!selected) {
      selected = { ip, cc, location, isp, leaked };
    }
  }

  const hasMixedResolvers = resolverCountrySet.size > 1;
  const leaked = Boolean(selected?.leaked);
  const status =
    leaked || (baselineAllNonChinese && hasMixedResolvers)
      ? "warn"
      : "safe";
  const statusLabel = leaked
    ? "可能泄露"
    : baselineAllNonChinese && hasMixedResolvers
      ? "出口混杂"
      : "未检测到泄露";

  return {
    status,
    statusLabel,
    ip: selected?.ip,
    countryCode: selected?.cc,
    isp: selected?.isp,
    location: selected?.location,
    resolverCount: entries.length,
    domesticResolverCount,
    globalResolverCount
  };
}

async function detectWebrtcLeak(baselineIps: Array<string | undefined>): Promise<WebrtcObservation> {
  const candidates = new Set<string>();
  const details: Array<{ candidateType: string; address?: string; protocol?: string }> = [];
  const normalizedBaselines = [...new Set(baselineIps.filter((value): value is string => Boolean(value)))];

  try {
    const connection = new RTCPeerConnection({
      iceServers: WEBRTC_STUN_SERVERS.map((urls) => ({ urls }))
    });
    connection.createDataChannel("");
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(() => {
        connection.close();
        resolve();
      }, 5000);

      connection.onicecandidate = (event) => {
        if (!event.candidate) {
          window.clearTimeout(timeout);
          connection.close();
          resolve();
          return;
        }

        const raw = event.candidate.candidate;
        const ipv4 = raw.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
        const ipv6 = raw.match(/([a-f0-9]{1,4}:){2,7}[a-f0-9]{1,4}/i);
        const address = ipv4?.[0] ?? ipv6?.[0];
        const candidateType = raw.match(/ typ ([a-z]+)/)?.[1] ?? "unknown";
        const protocol = raw.match(/ udp | tcp /i)?.[0]?.trim().toLowerCase() ?? "udp";

        details.push({ candidateType, address, protocol });

        if (address) {
          candidates.add(address);
        }
      };
    });
  } catch {}

  const publicIps = [...candidates].filter((ip) => {
    if (ip.includes(":")) {
      const normalized = ip.toLowerCase();
      return normalized !== "::1" && !normalized.startsWith("fc") && !normalized.startsWith("fd") && !normalized.startsWith("fe80:");
    }

    return (
      !ip.startsWith("10.") &&
      !ip.startsWith("192.168.") &&
      !ip.startsWith("127.") &&
      !/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    );
  });

  const relayCount = details.filter((candidate) => candidate.candidateType === "relay").length;
  const srflxCount = details.filter((candidate) => candidate.candidateType === "srflx").length;
  const hostCount = details.filter((candidate) => candidate.candidateType === "host").length;
  const tcpCount = details.filter((candidate) => candidate.protocol === "tcp").length;
  const udpCount = details.filter((candidate) => candidate.protocol === "udp").length;

  if (publicIps.length === 0) {
    return {
      status: "safe",
      statusLabel: "未检测到泄露",
      candidates: details,
      baselineIps: normalizedBaselines,
      publicCandidateCount: 0,
      ipv4Count: 0,
      ipv6Count: 0,
      stunServerCount: WEBRTC_STUN_SERVERS.length,
      relayCount,
      srflxCount,
      hostCount,
      tcpCount,
      udpCount
    };
  }

  const showIp = publicIps.find((ip) => normalizedBaselines.includes(ip)) ?? publicIps[0];
  const leaked =
    publicIps.some((ip) => !normalizedBaselines.includes(ip)) &&
    normalizedBaselines.length > 0;
  const geo = await fetchGeo(showIp);
  const ipv4Count = publicIps.filter((ip) => !ip.includes(":")).length;
  const ipv6Count = publicIps.filter((ip) => ip.includes(":")).length;

  return {
    status: leaked ? "warn" : "safe",
    statusLabel: leaked ? "可能泄露" : "未检测到泄露",
    ip: showIp,
    baselineIps: normalizedBaselines,
    countryCode: geo?.country_code,
    country: geo?.country,
    candidates: details,
    publicCandidateCount: publicIps.length,
    ipv4Count,
    ipv6Count,
    stunServerCount: WEBRTC_STUN_SERVERS.length,
    relayCount,
    srflxCount,
    hostCount,
    tcpCount,
    udpCount
  };
}

function loadHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storeHistory(ip?: string, countryCode?: string, city?: string) {
  if (!ip) {
    return loadHistory();
  }

  const history = loadHistory();
  const now = new Date().toISOString();
  const last = history[0];

  if (!last || last.ip !== ip) {
    history.unshift({ ip, countryCode, city, time: now });
  } else {
    last.time = now;
  }

  if (history.length > HISTORY_LIMIT) {
    history.length = HISTORY_LIMIT;
  }

  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return history;
}

function browserLabel() {
  const ua = navigator.userAgent;
  let os = "未知";
  let browser = "未知";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";

  if (ua.includes("Edg/")) browser = `Edge ${(ua.match(/Edg\/([\d.]+)/) || [])[1] ?? ""}`.trim();
  else if (ua.includes("Chrome/")) browser = `Chrome ${(ua.match(/Chrome\/([\d.]+)/) || [])[1] ?? ""}`.trim();
  else if (ua.includes("Firefox/")) browser = `Firefox ${(ua.match(/Firefox\/([\d.]+)/) || [])[1] ?? ""}`.trim();
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
    browser = `Safari ${(ua.match(/Version\/([\d.]+)/) || [])[1] ?? ""}`.trim();
  }

  return `${os} / ${browser}`;
}

function fingerprintCanvas() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return "不支持";
    }

    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(50, 0, 100, 50);
    ctx.fillStyle = "#069";
    ctx.fillText("ai risk", 2, 15);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("canvas fp", 4, 30);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasVisiblePixels = false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) {
        hasVisiblePixels = true;
        break;
      }
    }
    if (!hasVisiblePixels) {
      return "空白";
    }
    const data = canvas.toDataURL();

    let hash = 0;
    for (let index = 0; index < data.length; index += 1) {
      hash = ((hash << 5) - hash + data.charCodeAt(index)) | 0;
    }

    return (hash >>> 0).toString(16).toUpperCase();
  } catch {
    return "不支持";
  }
}

function fingerprintWebgl() {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;

    if (!gl) {
      return { renderer: "不支持", hash: "不支持" };
    }

    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "未知";
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : "";
    const raw = `${vendor}~${renderer}~${gl.getParameter(gl.VERSION)}~${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`;

    let hash = 0;
    for (let index = 0; index < raw.length; index += 1) {
      hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
    }

    return {
      renderer,
      hash: (hash >>> 0).toString(16).toUpperCase()
    };
  } catch {
    return { renderer: "不支持", hash: "不支持" };
  }
}

type BrowserIntegrityObservation = {
  canvasHash: string;
  webglRenderer: string;
  webglHash: string;
  issues: string[];
  automationDetected: boolean;
  canvasFailed: boolean;
  webglFailed: boolean;
};

function analyzeBrowserIntegrity(): BrowserIntegrityObservation {
  const canvasHash = fingerprintCanvas();
  const webgl = fingerprintWebgl();
  const ua = navigator.userAgent;
  const issues: string[] = [];
  const webdriverDetected = navigator.webdriver === true;
  const headlessUaDetected = /HeadlessChrome|PhantomJS|SlimerJS|Selenium|Playwright|Puppeteer/i.test(ua);
  const canvasFailed = canvasHash === "不支持" || canvasHash === "空白";
  const webglFailed = webgl.hash === "不支持";

  if (!navigator.cookieEnabled) {
    issues.push("Cookie 已禁用");
  }
  if (canvasFailed) {
    issues.push(canvasHash === "空白" ? "Canvas 输出为空白" : "Canvas 不可用");
  }
  if (webglFailed) {
    issues.push("WebGL 不可用");
  }
  if (webdriverDetected) {
    issues.push("navigator.webdriver 已启用");
  }
  if (headlessUaDetected) {
    issues.push("User-Agent 包含 Headless / 自动化标识");
  }

  return {
    canvasHash,
    webglRenderer: webgl.renderer,
    webglHash: webgl.hash,
    issues,
    automationDetected: webdriverDetected || headlessUaDetected,
    canvasFailed,
    webglFailed
  };
}

const MAINLAND_FONT_FAMILIES = [
  "Microsoft YaHei",
  "SimSun",
  "SimHei",
  "DengXian",
  "FangSong",
  "KaiTi"
] as const;

const TRADITIONAL_FONT_FAMILIES = [
  "PMingLiU",
  "MingLiU",
  "Microsoft JhengHei",
  "PingFang TC",
  "Heiti TC",
  "Songti TC"
] as const;

const MAINLAND_DEVICE_FONT_FAMILIES = [
  "HarmonyOS Sans SC",
  "HarmonyOS Sans",
  "HarmonyOS Sans TC",
  "MiSans",
  "Mi Lan Pro",
  "OPPO Sans",
  "vivo Sans",
  "vivo Sans SC",
  "vivoSans",
  "vivo Type",
  "HONOR Sans CN"
] as const;

const MAINLAND_STANDARD_TIMEZONES = [
  "Asia/Shanghai",
  "Asia/Chongqing",
  "Asia/Chungking",
  "Asia/Harbin"
] as const;
const MAINLAND_URUMQI_TIMEZONES = ["Asia/Urumqi", "Asia/Kashgar"] as const;

const COUNTRY_TIMEZONES: Record<string, string[]> = {
  China: [...MAINLAND_STANDARD_TIMEZONES, ...MAINLAND_URUMQI_TIMEZONES],
  Singapore: ["Asia/Singapore"],
  "United States": ["America/", "US/"],
  "United States of America": ["America/", "US/"],
  Japan: ["Asia/Tokyo"],
  "South Korea": ["Asia/Seoul"],
  Taiwan: ["Asia/Taipei"],
  "Hong Kong": ["Asia/Hong_Kong"],
  Malaysia: ["Asia/Kuala_Lumpur", "Asia/Kuching"],
  Australia: ["Australia/"],
  Canada: ["America/"],
  "United Kingdom": ["Europe/London"],
  Germany: ["Europe/Berlin"],
  France: ["Europe/Paris"]
};

const COUNTRY_LANGUAGE_PREFIXES: Record<string, string[]> = {
  Singapore: ["en", "zh", "ms", "ta"],
  "United States": ["en", "es"],
  "United States of America": ["en", "es"],
  Japan: ["ja"],
  "South Korea": ["ko"],
  Taiwan: ["zh"],
  "Hong Kong": ["zh", "en"],
  Malaysia: ["ms", "en", "zh", "ta"],
  Australia: ["en"],
  Canada: ["en", "fr"],
  "United Kingdom": ["en"],
  Germany: ["de"],
  France: ["fr"]
};

function fontIsAvailable(fontFamily: string) {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return false;
    }

    const samples = [
      "mmmmmmmmmmlliWQ@# 0123456789",
      "汉字字体测试门关骨系述语言",
      "漢字字體測試門關骨系述語言"
    ];
    const baselines = ["monospace", "sans-serif", "serif"];

    return baselines.some((baseline) => {
      return samples.some((sample) => {
        context.font = `72px ${baseline}`;
        const baselineMetrics = context.measureText(sample);
        context.font = `72px "${fontFamily}", ${baseline}`;
        const candidateMetrics = context.measureText(sample);
        return (
          Math.abs(candidateMetrics.width - baselineMetrics.width) > 0.35 ||
          Math.abs(candidateMetrics.actualBoundingBoxAscent - baselineMetrics.actualBoundingBoxAscent) > 0.35 ||
          Math.abs(candidateMetrics.actualBoundingBoxDescent - baselineMetrics.actualBoundingBoxDescent) > 0.35
        );
      });
    });
  } catch {
    return false;
  }
}

async function localFontIsAvailable(fontFamily: string) {
  if (typeof FontFace === "undefined") {
    return false;
  }

  const escapedFamily = fontFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const probe = new FontFace(
    `LeakTestLocalFont${Math.random().toString(36).slice(2)}`,
    `local("${escapedFamily}")`
  );
  let timeoutId: number | undefined;

  try {
    await Promise.race([
      probe.load(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("local_font_timeout")), 800);
      })
    ]);
    return probe.status === "loaded";
  } catch {
    return false;
  } finally {
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
    }
  }
}

async function detectFonts(fontFamilies: readonly string[]) {
  const directMatches = await Promise.all(fontFamilies.map(localFontIsAvailable));
  return fontFamilies.filter((fontFamily, index) => directMatches[index] || fontIsAvailable(fontFamily));
}

type EmojiColorStats = {
  visiblePixels: number;
  redPixels: number;
  bluePixels: number;
};

type NetworkProbeGroup = {
  reachable: number;
  total: number;
  medianLatencyMs?: number;
};

type MainlandNetworkObservation = {
  domestic: NetworkProbeGroup;
  global: NetworkProbeGroup;
  mainlandCloud: NetworkProbeGroup;
  regionalPortals: Record<keyof typeof REGIONAL_PORTAL_GROUPS, NetworkProbeGroup>;
};

const EMOJI_RED_REFERENCES: ReadonlyArray<readonly [number, number, number]> = [
  [254, 0, 0],
  [237, 41, 57],
  [220, 20, 60]
];

const EMOJI_BLUE_REFERENCES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 149],
  [0, 51, 160],
  [0, 82, 165]
];

function colorDistance(
  red: number,
  green: number,
  blue: number,
  reference: readonly [number, number, number]
) {
  return Math.sqrt(
    (red - reference[0]) ** 2 +
    (green - reference[1]) ** 2 +
    (blue - reference[2]) ** 2
  );
}

function isNearEmojiColor(
  red: number,
  green: number,
  blue: number,
  references: ReadonlyArray<readonly [number, number, number]>
) {
  return references.some((reference) => colorDistance(red, green, blue, reference) < 108);
}

function analyzeEmojiColors(emoji: string): EmojiColorStats | undefined {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return undefined;
    }

    canvas.width = 64;
    canvas.height = 64;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = '48px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    context.fillText(emoji, canvas.width / 2, canvas.height / 2);

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let visiblePixels = 0;
    let redPixels = 0;
    let bluePixels = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];

      if (alpha <= 30) {
        continue;
      }

      visiblePixels += 1;
      if (isNearEmojiColor(red, green, blue, EMOJI_RED_REFERENCES)) {
        redPixels += 1;
      }
      if (isNearEmojiColor(red, green, blue, EMOJI_BLUE_REFERENCES)) {
        bluePixels += 1;
      }
    }

    return { visiblePixels, redPixels, bluePixels };
  } catch {
    return undefined;
  }
}

function analyzeTaiwanFlagEnvironment() {
  const target = analyzeEmojiColors("🇹🇼");
  const targetRepeat = analyzeEmojiColors("🇹🇼");
  const baselineCandidates = [
    { label: "法国", emoji: "🇫🇷" },
    { label: "美国", emoji: "🇺🇸" }
  ].map((candidate) => ({
    ...candidate,
    first: analyzeEmojiColors(candidate.emoji),
    second: analyzeEmojiColors(candidate.emoji)
  }));

  if (!target || !targetRepeat) {
    return {
      status: "blocked" as const,
      detail: "Canvas 像素读取不可用，无法检查旗帜颜色"
    };
  }

  const statsAreStable = (first: EmojiColorStats, second: EmojiColorStats) => {
    const tolerance = Math.max(4, Math.round(first.visiblePixels * 0.025));
    return (
      Math.abs(first.visiblePixels - second.visiblePixels) <= tolerance &&
      Math.abs(first.redPixels - second.redPixels) <= tolerance &&
      Math.abs(first.bluePixels - second.bluePixels) <= tolerance
    );
  };

  if (!statsAreStable(target, targetRepeat)) {
    return {
      status: "blocked" as const,
      detail: "台湾旗帜重复采样结果不稳定，可能存在 Canvas 指纹扰动"
    };
  }

  const baseline = baselineCandidates.find((candidate) => {
    if (!candidate.first || !candidate.second || !statsAreStable(candidate.first, candidate.second)) {
      return false;
    }

    const redMinimum = Math.max(5, Math.round(candidate.first.visiblePixels * 0.008));
    const blueMinimum = Math.max(5, Math.round(candidate.first.visiblePixels * 0.008));
    return (
      candidate.first.visiblePixels >= 40 &&
      candidate.first.redPixels >= redMinimum &&
      candidate.first.bluePixels >= blueMinimum
    );
  });

  if (!baseline?.first) {
    return {
      status: "blocked" as const,
      detail: "对照旗帜无法稳定渲染，当前环境不具备可靠判定条件"
    };
  }

  const targetVisibleMinimum = Math.max(20, Math.round(baseline.first.visiblePixels * 0.18));
  const targetRedMinimum = Math.max(5, Math.round(target.visiblePixels * 0.006));
  const targetBlueMinimum = Math.max(2, Math.round(target.visiblePixels * 0.002));
  const targetMissing =
    target.visiblePixels < targetVisibleMinimum ||
    target.redPixels < targetRedMinimum ||
    target.bluePixels < targetBlueMinimum;
  return {
    status: targetMissing ? "restricted" as const : "normal" as const,
    detail: targetMissing
      ? `台湾旗帜关键颜色缺失，${baseline.label}对照旗帜正常`
      : "台湾旗帜红蓝颜色特征完整"
  };
}

async function measureOpaqueEndpoint(url: string, timeoutMs = 3500) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  try {
    const requestUrl = new URL(url);
    requestUrl.searchParams.set("_leaktest", `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await fetch(requestUrl.toString(), {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal
    });
    return Math.max(1, Math.round(performance.now() - started));
  } catch {
    return undefined;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function median(values: number[]) {
  if (!values.length) {
    return undefined;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

async function probeEndpointGroup(urls: readonly string[]): Promise<NetworkProbeGroup> {
  const results = await Promise.all(urls.map((url) => measureOpaqueEndpoint(url)));
  const latencies = results.filter((value): value is number => typeof value === "number");
  return {
    reachable: latencies.length,
    total: urls.length,
    medianLatencyMs: median(latencies)
  };
}

async function detectMainlandNetworkSignals(): Promise<MainlandNetworkObservation> {
  const [domestic, global, mainlandCloud, cnPortals, hkPortals, sgPortals, jpPortals, ukPortals, usPortals] = await Promise.all([
    probeEndpointGroup([
      "https://www.baidu.com/favicon.ico",
      "https://www.qq.com/favicon.ico",
      "https://www.taobao.com/favicon.ico"
    ]),
    probeEndpointGroup([
      "https://www.google.com/generate_204",
      "https://fonts.googleapis.com/css?family=Roboto",
      "https://abs.twimg.com/favicons/twitter.3.ico"
    ]),
    probeEndpointGroup([
      "https://oss-cn-hangzhou.aliyuncs.com/",
      "https://cos.ap-shanghai.myqcloud.com/"
    ]),
    probeEndpointGroup(REGIONAL_PORTAL_GROUPS.cn),
    probeEndpointGroup(REGIONAL_PORTAL_GROUPS.hk),
    probeEndpointGroup(REGIONAL_PORTAL_GROUPS.sg),
    probeEndpointGroup(REGIONAL_PORTAL_GROUPS.jp),
    probeEndpointGroup(REGIONAL_PORTAL_GROUPS.uk),
    probeEndpointGroup(REGIONAL_PORTAL_GROUPS.us)
  ]);

  return {
    domestic,
    global,
    mainlandCloud,
    regionalPortals: {
      cn: cnPortals,
      hk: hkPortals,
      sg: sgPortals,
      jp: jpPortals,
      uk: ukPortals,
      us: usPortals
    }
  };
}

async function buildEnvironmentSignals(
  country: string | undefined,
  timezone: string,
  network?: MainlandNetworkObservation,
  dns?: DnsObservation,
  webrtc?: WebrtcObservation,
  integrity?: BrowserIntegrityObservation
) {
  const languages = [...(navigator.languages || [navigator.language])];
  const primaryLanguage = languages[0] || navigator.language || "未知";
  const [mainlandRegionalFonts, traditionalRegionalFonts, mainlandDeviceFonts] = await Promise.all([
    detectFonts(MAINLAND_FONT_FAMILIES),
    detectFonts(TRADITIONAL_FONT_FAMILIES),
    detectFonts(MAINLAND_DEVICE_FONT_FAMILIES)
  ]);
  const taiwanFlag = analyzeTaiwanFlagEnvironment();
  const expectedTimezones = country ? COUNTRY_TIMEZONES[country] : undefined;
  const timezoneMatches = expectedTimezones?.some((expected) =>
    expected.endsWith("/") ? timezone.startsWith(expected) : timezone === expected
  );
  const expectedLanguages = country ? COUNTRY_LANGUAGE_PREFIXES[country] : undefined;
  const languageMatches = expectedLanguages?.some((expected) =>
    primaryLanguage.toLowerCase().startsWith(expected)
  );
  const signals: EnvironmentSignal[] = [];
  const mainlandStandardTimezone = MAINLAND_STANDARD_TIMEZONES.some((value) => value === timezone);
  const mainlandUrumqiTimezone = MAINLAND_URUMQI_TIMEZONES.some((value) => value === timezone);
  const mainlandTimezone = mainlandStandardTimezone || mainlandUrumqiTimezone;
  const mainlandTimezoneValue = mainlandUrumqiTimezone
    ? "中国内地时区（乌鲁木齐 / UTC+6）"
    : "中国内地时区（UTC+8）";
  const timezonePoints = mainlandTimezone ? 3 : 0;

  if (typeof timezoneMatches === "boolean") {
    signals.push({
      id: "timezone",
      label: "时区与出口",
      value: mainlandTimezone ? mainlandTimezoneValue : timezoneMatches ? "一致" : "存在差异",
      detail: `${timezone} / ${country ?? "未知出口"}`,
      tone: mainlandTimezone ? "review" : timezoneMatches ? "good" : "neutral",
      points: timezonePoints
    });
  } else {
    signals.push({
      id: "timezone",
      label: "浏览器时区",
      value: mainlandTimezone ? mainlandTimezoneValue : "已采集",
      detail: country ? `${timezone} / 暂无 ${country} 的映射规则` : timezone,
      tone: mainlandTimezone ? "review" : "neutral",
      points: mainlandTimezone ? 3 : 0
    });
  }

  if (network) {
    const domesticReady = network.domestic.reachable >= 2;
    const globalMostlyBlocked = network.global.reachable <= 1;
    const domesticLatency = network.domestic.medianLatencyMs;
    const globalLatency = network.global.medianLatencyMs;
    const strongAsymmetry =
      domesticReady &&
      typeof domesticLatency === "number" &&
      typeof globalLatency === "number" &&
      globalLatency - domesticLatency >= 600;
    const publicNetworkPoints = domesticReady && globalMostlyBlocked ? 2 : strongAsymmetry ? 1 : 0;

    signals.push({
      id: "public-network",
      label: "境内外公共网络",
      value: publicNetworkPoints === 2 ? "境外明显受限" : publicNetworkPoints === 1 ? "境内明显更快" : "无明显边界特征",
      detail: `境内 ${network.domestic.reachable}/${network.domestic.total} 可达，境外 ${network.global.reachable}/${network.global.total} 可达`,
      tone: publicNetworkPoints ? "review" : "good",
      points: publicNetworkPoints
    });

    const cloudLatency = network.mainlandCloud.medianLatencyMs;
    const anycastPoints =
      network.mainlandCloud.reachable >= 1 && typeof cloudLatency === "number"
        ? cloudLatency <= 35
          ? 2
          : cloudLatency <= 70
            ? 1
            : 0
        : 0;
    signals.push({
      id: "mainland-cloud-latency",
      label: "中国云边缘延迟",
      value: anycastPoints === 2 ? "极低延迟路径" : anycastPoints === 1 ? "低延迟路径" : cloudLatency ? "未见延迟塌陷" : "无法判定",
      detail: typeof cloudLatency === "number"
        ? `阿里云与腾讯云中国区域节点中位响应 ${cloudLatency} ms`
        : "中国云区域节点均未返回有效结果",
      tone: anycastPoints ? "review" : typeof cloudLatency === "number" ? "good" : "neutral",
      points: anycastPoints
    });

    const portalLatencies = network.regionalPortals;
    const mainlandPortalLatency = portalLatencies.cn.medianLatencyMs;
    const peerPortalCandidates = [
      { label: "香港", group: portalLatencies.hk },
      { label: "新加坡", group: portalLatencies.sg },
      { label: "日本", group: portalLatencies.jp },
      { label: "英国", group: portalLatencies.uk },
      { label: "美国", group: portalLatencies.us }
    ].flatMap(({ label, group }) =>
      group.reachable === group.total && typeof group.medianLatencyMs === "number"
        ? [{ label, latency: group.medianLatencyMs }]
        : []
    );
    const fastestPeerPortal = peerPortalCandidates.length
      ? peerPortalCandidates.reduce((fastest, candidate) =>
          candidate.latency < fastest.latency ? candidate : fastest
        )
      : undefined;
    const portalComparisonReady =
      portalLatencies.cn.reachable === portalLatencies.cn.total &&
      typeof mainlandPortalLatency === "number" &&
      Boolean(fastestPeerPortal) &&
      peerPortalCandidates.length >= 2;
    const mainlandPortalAdvantage = portalComparisonReady
      ? fastestPeerPortal!.latency - mainlandPortalLatency
      : undefined;
    const portalPoints = typeof mainlandPortalAdvantage === "number"
      ? mainlandPortalAdvantage >= 80
        ? 2
        : mainlandPortalAdvantage >= 40
          ? 1
          : 0
      : 0;
    const formatPortalLatency = (group: NetworkProbeGroup) =>
      typeof group.medianLatencyMs === "number" ? `${group.medianLatencyMs} ms` : "无数据";
    signals.push({
      id: "regional-public-portals",
      label: "政务 / 教育门户延迟",
      value: portalPoints === 2
        ? "中国内地门户显著更快"
        : portalPoints === 1
          ? "中国内地门户相对更快"
          : portalComparisonReady
            ? fastestPeerPortal!.latency < mainlandPortalLatency
              ? `${fastestPeerPortal!.label}门户更快`
              : "中国内地优势不足"
            : "数据不足",
      detail: `CN ${formatPortalLatency(portalLatencies.cn)} · HK ${formatPortalLatency(portalLatencies.hk)} · SG ${formatPortalLatency(portalLatencies.sg)} · JP ${formatPortalLatency(portalLatencies.jp)} · UK ${formatPortalLatency(portalLatencies.uk)} · US ${formatPortalLatency(portalLatencies.us)}`,
      tone: portalPoints ? "review" : portalComparisonReady ? "good" : "neutral",
      points: portalPoints
    });
  }

  const mainlandResolverCount = dns?.domesticResolverCount ?? 0;
  const mainlandDnsLeak = mainlandResolverCount > 0 && dns?.status === "warn";
  const mainlandWebrtcLeak =
    webrtc?.status === "warn" && webrtc.countryCode?.toLowerCase() === "cn";
  signals.push({
    id: "mainland-dns-leak",
    label: "DNS 泄露",
    value: mainlandDnsLeak
      ? "发现中国内地解析器"
      : !dns || dns.status === "neutral"
        ? "无法判定"
        : "未发现内地泄露",
    detail: mainlandDnsLeak
      ? `检测到 ${mainlandResolverCount} 个中国内地 DNS 解析器，与当前境外出口不一致`
      : !dns || dns.status === "neutral"
        ? "未取得有效的 DNS 解析器地域数据"
        : `已观测 ${dns.resolverCount ?? 0} 个解析器，未发现中国内地泄露出口`,
    tone: mainlandDnsLeak ? "review" : !dns || dns.status === "neutral" ? "neutral" : "good",
    points: mainlandDnsLeak ? 3 : 0
  });
  signals.push({
    id: "mainland-webrtc-leak",
    label: "WebRTC 泄露",
    value: mainlandWebrtcLeak
      ? "发现中国内地出口"
      : !webrtc
        ? "无法判定"
        : webrtc.status === "warn"
          ? "发现非内地泄露"
          : "未发现内地泄露",
    detail: mainlandWebrtcLeak
      ? `WebRTC 暴露中国内地公网地址 ${webrtc?.ip ?? "未知地址"}`
      : !webrtc
        ? "未取得有效的 WebRTC 候选地址数据"
        : webrtc.status === "warn"
          ? `WebRTC 存在地址泄露，但归属地为 ${webrtc.country ?? "非中国内地"}`
          : "WebRTC 未发现中国内地泄露出口",
    tone: mainlandWebrtcLeak ? "review" : !webrtc ? "neutral" : "good",
    points: mainlandWebrtcLeak ? 3 : 0
  });

  const integrityIssueCount = integrity?.issues.length ?? 0;
  const bothRenderHashesFailed = Boolean(integrity?.canvasFailed && integrity.webglFailed);
  const integrityPoints = integrity?.automationDetected || bothRenderHashesFailed
    ? 4
    : integrityIssueCount >= 2
        ? 2
        : integrityIssueCount === 1
          ? 1
          : 0;
  signals.push({
    id: "browser-integrity",
    label: "浏览器完整性",
    value: integrity?.automationDetected
      ? "明确自动化特征"
      : bothRenderHashesFailed
        ? "Canvas / WebGL 均失败"
        : integrityIssueCount > 0
          ? "局部功能受限"
          : "环境完整",
    detail: integrityIssueCount
      ? integrity?.issues.join("；") ?? "检测到浏览器完整性异常"
      : "Cookie、Canvas 与 WebGL 状态正常，未发现 Headless 或自动化标识",
    tone: integrityPoints ? "review" : "good",
    points: integrityPoints
  });

  const mainlandLanguageIndex = languages.findIndex((language) =>
    /^(zh-cn|zh-hans)(-|$)/i.test(language)
  );
  const traditionalLanguageIndex = languages.findIndex((language) =>
    /^(zh-tw|zh-hk|zh-hant)(-|$)/i.test(language)
  );
  const languagePoints = mainlandLanguageIndex === 0 ? 2 : mainlandLanguageIndex > 0 ? 1 : 0;
  signals.push({
    id: "language",
    label: "语言区域",
    value:
      languagePoints === 2
        ? "主语言为简体中文"
        : languagePoints === 1
          ? "语言链包含简体中文"
          : traditionalLanguageIndex >= 0
            ? "语言链偏向繁体中文"
          : languageMatches === false
            ? "与出口有差异"
            : "无内地特征",
    detail: languages.join(", "),
    tone: languagePoints ? "review" : languageMatches === false ? "neutral" : "good",
    points: languagePoints
  });

  const simplifiedFontPreference = mainlandRegionalFonts.length >= 2 && traditionalRegionalFonts.length === 0;
  const commonFontPoints = simplifiedFontPreference
    ? mainlandRegionalFonts.length >= 4
      ? 2
      : 1
    : 0;
  signals.push({
    id: "mainland-fonts",
    label: "中文字体画像",
    value: simplifiedFontPreference
      ? "简体字体偏好"
      : traditionalRegionalFonts.length > mainlandRegionalFonts.length
        ? "繁体字体偏好"
        : mainlandRegionalFonts.length || traditionalRegionalFonts.length
          ? "简繁字体并存"
          : "无区域字体",
    detail: simplifiedFontPreference
      ? "仅检测到简体中文区域字体"
      : traditionalRegionalFonts.length > mainlandRegionalFonts.length
        ? "繁体中文区域字体占优"
        : mainlandRegionalFonts.length || traditionalRegionalFonts.length
          ? "简体与繁体区域字体同时存在，不作为地区风险"
          : "未检测到具有地区识别价值的中文字体",
    tone: commonFontPoints ? "review" : "good",
    points: commonFontPoints
  });

  const ua = navigator.userAgent;
  const userAgentBrands = (
    navigator as Navigator & { userAgentData?: { brands?: Array<{ brand: string; version: string }> } }
  ).userAgentData?.brands?.map(({ brand }) => brand).join(" ") ?? "";
  const deviceIdentity = `${ua} ${userAgentBrands}`;
  const harmonySignal = /HarmonyOS|HongMeng|OpenHarmony|ArkWeb/i.test(deviceIdentity);
  const huaweiDeviceSignal = !harmonySignal && /HuaweiBrowser|\bHUAWEI\b/i.test(deviceIdentity);
  const vivoSignal = /\bvivo\b|VivoBrowser|OriginOS|\bV\d{4}[A-Z]{0,2}\b/i.test(deviceIdentity);
  const deviceEcosystemSignal = harmonySignal || huaweiDeviceSignal || vivoSignal;
  const deviceFontPoints = mainlandDeviceFonts.length && !deviceEcosystemSignal ? 3 : 0;
  signals.push({
    id: "device-fonts",
    label: "国产设备字体",
    value: mainlandDeviceFonts.length
      ? `${mainlandDeviceFonts.length} 项强信号`
      : deviceEcosystemSignal
        ? "设备命中，字体未暴露"
        : "未发现",
    detail: mainlandDeviceFonts.length
      ? `${mainlandDeviceFonts.join(", ")}${deviceEcosystemSignal ? "；已由设备生态信号覆盖，不重复加分" : ""}`
      : deviceEcosystemSignal
        ? "浏览器未向 CSS 暴露 vivo Sans / HarmonyOS Sans，本项不加字体分"
        : "未检测到 HarmonyOS、MiSans、OPPO、vivo、HONOR 等品牌字体",
    tone: mainlandDeviceFonts.length ? "review" : deviceEcosystemSignal ? "neutral" : "good",
    points: deviceFontPoints
  });

  const selectiveTaiwanFlagAbsence = taiwanFlag.status === "restricted";
  const emojiPoints = selectiveTaiwanFlagAbsence ? 5 : 0;
  signals.push({
    id: "flag-emoji",
    label: "旗帜 Emoji",
    value: selectiveTaiwanFlagAbsence
      ? "选择性屏蔽（高信号）"
      : taiwanFlag.status === "normal"
        ? "台湾旗帜正常"
        : "无法可靠判定",
    detail: selectiveTaiwanFlagAbsence
      ? "对照旗帜正常，但台湾旗帜缺失关键颜色特征"
      : taiwanFlag.detail,
    tone: selectiveTaiwanFlagAbsence ? "review" : taiwanFlag.status === "normal" ? "good" : "neutral",
    points: emojiPoints
  });

  const ecosystemPoints = harmonySignal ? 4 : vivoSignal ? 3 : huaweiDeviceSignal ? 2 : 0;
  signals.push({
    id: "device-ecosystem",
    label: "设备生态",
    value: harmonySignal
      ? "HarmonyOS / ArkWeb 特征"
      : vivoSignal
        ? "vivo / OriginOS 特征"
        : huaweiDeviceSignal
          ? "华为设备特征（系统未确认）"
          : "无显式国产系统标识",
    detail: harmonySignal
      ? "浏览器标识包含 HarmonyOS、OpenHarmony 或 ArkWeb 特征"
      : vivoSignal
        ? "浏览器标识包含 vivo、OriginOS、VivoBrowser 或 vivo 机型特征"
        : huaweiDeviceSignal
          ? "浏览器标识包含 HUAWEI 或 HuaweiBrowser，但不足以确认 HarmonyOS"
          : browserLabel(),
    tone: deviceEcosystemSignal ? "review" : "neutral",
    points: ecosystemPoints
  });

  const rawScore = signals.reduce((total, signal) => total + signal.points, 0);
  const score = Math.min(10, rawScore);
  const label: "安全" | "可疑" | "危险" = score <= 3 ? "安全" : score <= 7 ? "可疑" : "危险";
  const matchedSignals = signals.filter((signal) => signal.points > 0);

  return {
    score,
    label,
    summary: matchedSignals.length
      ? `累计命中 ${matchedSignals.length} 项中国内地环境或对抗风险特征，原始分 ${rawScore}，封顶计 ${score} 分。`
      : "未命中已检测的中国内地环境或对抗风险特征。",
    signals
  };
}

async function buildDeviceSnapshot(
  country?: string,
  network?: MainlandNetworkObservation,
  dns?: DnsObservation,
  webrtc?: WebrtcObservation
) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "未知";
  const offset = -(new Date().getTimezoneOffset() / 60);
  const timezoneLabel = `${timezone} (UTC${offset >= 0 ? "+" : ""}${offset})`;
  const languageLabel = (navigator.languages || [navigator.language]).join(", ");
  const integrity = analyzeBrowserIntegrity();
  const environment = await buildEnvironmentSignals(country, timezone, network, dns, webrtc, integrity);

  return {
    timezoneLabel:
      country && !timezone.includes("America") && country === "United States"
        ? `时区不一致\n本地: ${timezoneLabel}\n出口区域: United States (UTC-5~UTC-8)`
        : timezoneLabel,
    languageLabel,
    browserLabel: browserLabel(),
    cookieLabel: navigator.cookieEnabled ? "已启用" : "已禁用",
    webglRenderer: integrity.webglRenderer,
    canvasHash: integrity.canvasHash,
    webglHash: integrity.webglHash,
    mainlandRiskScore: environment.score,
    mainlandRiskLabel: environment.label,
    mainlandRiskSummary: environment.summary,
    signals: environment.signals
  };
}

async function fetchStatus() {
  const data = await fetchJson<{
    overall?: string;
    overall_indicator?: string;
    components?: Array<{ name?: string; status?: string; status_cn?: string }>;
    fetched_at?: string;
    page?: { updated_at?: string };
    status?: { indicator?: string; description?: string };
  }>(SOURCE_REGISTRY.officialStatus.claude.apiUrl);

  return {
    overallLabel: data.status?.description === "All Systems Operational" ? "全部正常" : data.status?.description ?? "未知",
    overallIndicator: data.status?.indicator ?? "none",
    components: (data.components ?? []).map((component) => ({
      name: component.name ?? "",
      status: component.status ?? "",
      statusCn: component.status === "operational" ? "正常运行" : component.status_cn ?? component.status ?? ""
    })),
    fetchedAt: data.page?.updated_at ?? data.fetched_at
  };
}

export function useLiveDiagnostics() {
  const [state, setState] = useState<LiveDiagnosticsState>(initialState);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const setProgress = (step: number) => {
      if (cancelled) {
        return;
      }

      setState((current) => ({
        ...current,
        loading: true,
        progress: makeProgress(step)
      }));
    };

    async function load() {
      try {
        setProgress(1);
        const [cnIp, localIpv6, cloudflareTrace, aiTrace, codexTrace] = await Promise.all([
          fetchCnIp(),
          fetchPublicIpv6(),
          fetchTrace("https://1.1.1.1/cdn-cgi/trace").catch(() => undefined),
          fetchTrace("https://claude.ai/cdn-cgi/trace").catch(() => undefined),
          fetchTrace("https://chatgpt.com/cdn-cgi/trace").catch(() => undefined)
        ]);

        setProgress(2);
        const [cnGeo, cfGeo, aiGeo, codexGeo, aiRisk, codexRisk, services, status, networkSignals] = await Promise.all([
          fetchGeo(cnIp).catch(() => undefined),
          fetchGeo(cloudflareTrace?.ip).catch(() => undefined),
          fetchGeo(aiTrace?.ip).catch(() => undefined),
          fetchGeo(codexTrace?.ip).catch(() => undefined),
          fetchRisk(aiTrace?.ip).catch(() => undefined),
          fetchRisk(codexTrace?.ip).catch(() => undefined),
          Promise.all([
            measureAvailability("ai-web", "AI Web", "https://claude.ai/cdn-cgi/trace"),
            measureAvailability("ai-api", "AI API", "https://www.anthropic.com/favicon.ico"),
            measureAvailability("codex", "Codex", "https://chatgpt.com/cdn-cgi/trace")
          ]),
          fetchStatus().catch(() => undefined),
          detectMainlandNetworkSignals().catch(() => undefined)
        ]);

        setProgress(4);
        const dns = await detectDnsLeak([
          aiRisk?.country,
          codexRisk?.country,
          cfGeo?.country
        ]).catch(() => undefined);
        setProgress(5);
        const webrtc = await detectWebrtcLeak([
          cnIp,
          localIpv6,
          cloudflareTrace?.ip
        ]).catch(() => undefined);
        setProgress(6);
        const history = storeHistory(aiTrace?.ip, aiGeo?.country_code, aiGeo?.city);
        const device = await buildDeviceSnapshot(aiRisk?.country, networkSignals, dns, webrtc);

        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          progress: undefined,
          cards: {
            local: {
              label: "中国内地",
              ips: buildIpList(cnIp, localIpv6),
              countryCode: cnGeo?.country_code ?? "cn",
              geo: formatGeo(cnGeo, "cn")
            },
            cloudflare: {
              label: "Cloudflare",
              ips: buildIpList(cloudflareTrace?.ip),
              countryCode: cfGeo?.country_code ?? cloudflareTrace?.countryCode,
              geo: formatGeo(cfGeo, cloudflareTrace?.countryCode)
            },
            ai: {
              label: "Claude",
              ips: buildIpList(aiTrace?.ip),
              countryCode: aiGeo?.country_code ?? aiTrace?.countryCode,
              geo: formatGeo(aiGeo, aiTrace?.countryCode)
            },
            codex: {
              label: "Codex",
              ips: buildIpList(codexTrace?.ip),
              countryCode: codexGeo?.country_code ?? codexTrace?.countryCode,
              geo: formatGeo(codexGeo, codexTrace?.countryCode)
            }
          },
          risk: buildRiskSnapshot(aiRisk),
          codexRisk: buildRiskSnapshot(codexRisk),
          services,
          dns,
          webrtc,
          device,
          history,
          status
        });
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            progress: undefined,
            cards: {},
            services: [],
            history: [],
            error: error instanceof Error ? error.message : "Failed to load diagnostics."
          });
        }
      }
    }

    setState((current) => ({
      ...current,
      loading: true,
      error: undefined,
      progress: makeProgress(1)
    }));
    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return {
    ...state,
    refresh: () => setRefreshToken((value) => value + 1)
  };
}
