"use client";

import { useEffect, useState } from "react";
import { SOURCE_REGISTRY } from "./source-registry";
import type { DiagnosticsProgress } from "./use-live-diagnostics";

type ProbeStatus = "primary" | "split" | "partial" | "error";

type ProbeDetail = {
  label: string;
  value?: string;
};

export type RoutingProbe = {
  id: string;
  label: string;
  category: "public" | "trace";
  endpoint: string;
  ip?: string;
  countryCode?: string;
  geo?: string;
  timezone?: string;
  carrier?: string;
  latencyMs?: number;
  status: ProbeStatus;
  note?: string;
  error?: string;
  details: ProbeDetail[];
};

export type RoutingCluster = {
  ip: string;
  countryCode?: string;
  countryLabel?: string;
  geo?: string;
  timezone?: string;
  carrier?: string;
  sourceLabels: string[];
  labels: string[];
  count: number;
};

export type RoutingSampleRow = {
  id: string;
  website: string;
  bucket: string;
  methodLabel: string;
  sourceLabel: string;
  ip?: string;
  countryCode?: string;
  geo?: string;
  status: ProbeStatus;
  note?: string;
  error?: string;
};

export type RoutingSummary = {
  ipv4?: string;
  ipv6?: string;
  primaryIp?: string;
  uniqueIpCount: number;
  successfulCount: number;
  splitLabel: string;
  splitTone: "safe" | "warn" | "danger" | "neutral";
  splitNote: string;
  clusters: RoutingCluster[];
};

type RoutingState = {
  loading: boolean;
  error?: string;
  progress?: DiagnosticsProgress;
  summary: RoutingSummary;
  publicProbes: RoutingProbe[];
  traceProbes: RoutingProbe[];
  samples: RoutingSampleRow[];
};

const PROGRESS_STEPS = [
  "检测当前 IPv4 / IPv6",
  "收集公开 IP 查询商结果",
  "解析 Cloudflare cdn-cgi/trace",
  "聚类出口并生成分流结论"
] as const;

const initialSummary: RoutingSummary = {
  uniqueIpCount: 0,
  successfulCount: 0,
  splitLabel: "等待检测",
  splitTone: "neutral",
  splitNote: "页面会对比公开 IP 查询商与 Cloudflare trace 看到的出口是否一致。",
  clusters: []
};

const initialState: RoutingState = {
  loading: true,
  progress: {
    label: PROGRESS_STEPS[0],
    completed: 0,
    total: PROGRESS_STEPS.length,
    percent: 0
  },
  summary: initialSummary,
  publicProbes: [],
  traceProbes: [],
  samples: []
};

type GeoRecord = {
  countryCode?: string;
  countryName?: string;
  region?: string;
  city?: string;
  timezone?: string;
  carrier?: string;
};

type SampleDefinition = {
  id: string;
  website: string;
  bucket: string;
  source: "public-majority" | string;
  methodLabel: string;
  fallbackSource?: "public-majority" | string;
  note?: string;
};

const SAMPLE_DEFINITIONS: SampleDefinition[] = [
  {
    id: "alibaba-cn",
    website: "阿里巴巴",
    bucket: "国内",
    source: "public-majority",
    methodLabel: "公开 IP 查询商多数出口"
  },
  {
    id: "netease-cn",
    website: "网易",
    bucket: "国内",
    source: "public-majority",
    methodLabel: "公开 IP 查询商多数出口"
  },
  {
    id: "bytedance-cn",
    website: "字节跳动",
    bucket: "国内",
    source: "public-majority",
    methodLabel: "公开 IP 查询商多数出口"
  },
  {
    id: "tencent-cn",
    website: "腾讯",
    bucket: "国内",
    source: "public-majority",
    methodLabel: "公开 IP 查询商多数出口"
  },
  {
    id: "cf-cn",
    website: "Cloudflare 中国网络",
    bucket: "国内",
    source: "cf-1dot1",
    fallbackSource: "public-majority",
    methodLabel: "Cloudflare CDN 代表出口"
  },
  {
    id: "qualcomm-cn",
    website: "www.qualcomm.cn",
    bucket: "国内",
    source: "public-majority",
    methodLabel: "公开 IP 查询商多数出口"
  },
  {
    id: "cloudflare-global",
    website: "www.cloudflare.com",
    bucket: "国际",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "Cloudflare CDN 代表出口"
  },
  {
    id: "bytedance-global",
    website: "字节跳动 海外",
    bucket: "国际",
    source: "public-majority",
    fallbackSource: "cf-www",
    methodLabel: "中国系国际站代表出口"
  },
  {
    id: "discord",
    website: "discord.com",
    bucket: "国际",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "Cloudflare 国际站代表出口"
  },
  {
    id: "x",
    website: "x.com",
    bucket: "国际",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "Cloudflare 国际站代表出口"
  },
  {
    id: "medium",
    website: "medium.com",
    bucket: "国际",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "Cloudflare 国际站代表出口"
  },
  {
    id: "chatgpt",
    website: "chatgpt.com",
    bucket: "国际 AI",
    source: "cf-codex",
    fallbackSource: "cf-openai",
    methodLabel: "Codex 站点出口"
  },
  {
    id: "sora",
    website: "sora.com",
    bucket: "国际 AI",
    source: "cf-openai",
    fallbackSource: "cf-codex",
    methodLabel: "OpenAI 家族代表出口"
  },
  {
    id: "openai",
    website: "openai.com",
    bucket: "国际 AI",
    source: "cf-openai",
    fallbackSource: "cf-codex",
    methodLabel: "OpenAI 站点出口"
  },
  {
    id: "claude",
    website: "claude.ai",
    bucket: "国际 AI",
    source: "cf-claude",
    methodLabel: "Claude 站点出口"
  },
  {
    id: "grok",
    website: "grok.com",
    bucket: "国际 AI",
    source: "cf-openai",
    fallbackSource: "cf-codex",
    methodLabel: "国际 AI 代表出口"
  },
  {
    id: "anthropic",
    website: "anthropic.com",
    bucket: "国际 AI",
    source: "cf-claude",
    fallbackSource: "cf-openai",
    methodLabel: "Anthropic 家族代表出口"
  },
  {
    id: "perplexity",
    website: "www.perplexity.ai",
    bucket: "国际 AI",
    source: "cf-openai",
    fallbackSource: "cf-codex",
    methodLabel: "国际 AI 代表出口"
  },
  {
    id: "ehentai",
    website: "e-hentai.org",
    bucket: "国际 NSFW",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "missav-ws",
    website: "missav.ws",
    bucket: "国际 NSFW",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "missav-ai",
    website: "missav.ai",
    bucket: "国际 NSFW",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "missav-live",
    website: "missav.live",
    bucket: "国际 NSFW",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "hanime1-me",
    website: "hanime1.me",
    bucket: "国际 NSFW",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "hanimeone-me",
    website: "hanimeone.me",
    bucket: "国际 NSFW",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "hanime1-com",
    website: "hanime1.com",
    bucket: "国际 NSFW",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "javchu",
    website: "javchu.com",
    bucket: "国际 NSFW",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "jkforum",
    website: "av.jkforum.net",
    bucket: "国际 NSFW",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "javdb",
    website: "javdb.com",
    bucket: "国际 NSFW",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "coinbase",
    website: "coinbase.com",
    bucket: "国际 Crypto",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "okx",
    website: "www.okx.com",
    bucket: "国际 Crypto",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "jsdelivr",
    website: "cdn.jsdelivr.net",
    bucket: "国际 Static",
    source: "cf-cdnjs",
    fallbackSource: "cf-www",
    methodLabel: "Cloudflare CDN 代表出口"
  },
  {
    id: "cdnjs",
    website: "cdnjs.cloudflare.com",
    bucket: "国际 Static",
    source: "cf-cdnjs",
    fallbackSource: "cf-www",
    methodLabel: "Cloudflare CDN 代表出口"
  },
  {
    id: "cf-mirrors",
    website: "cloudflaremirrors.com",
    bucket: "国际 Static",
    source: "cf-cdnjs",
    fallbackSource: "cf-www",
    methodLabel: "Cloudflare CDN 代表出口"
  },
  {
    id: "npm-registry",
    website: "registry.npmjs.org",
    bucket: "国际 Static",
    source: "cf-cdnjs",
    fallbackSource: "cf-www",
    methodLabel: "Cloudflare CDN 代表出口"
  },
  {
    id: "kali-download",
    website: "kali.download",
    bucket: "国际 Static",
    source: "cf-cdnjs",
    fallbackSource: "cf-www",
    methodLabel: "Cloudflare CDN 代表出口"
  },
  {
    id: "unpkg",
    website: "unpkg.com",
    bucket: "国际 Static",
    source: "cf-cdnjs",
    fallbackSource: "cf-www",
    methodLabel: "Cloudflare CDN 代表出口"
  },
  {
    id: "crunchyroll",
    website: "crunchyroll.com",
    bucket: "国际",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "nodejs",
    website: "nodejs.org",
    bucket: "国际",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  },
  {
    id: "gitlab",
    website: "gitlab.com",
    bucket: "国际",
    source: "cf-www",
    fallbackSource: "cf-1dot1",
    methodLabel: "国际站代表出口"
  }
];

function makeProgress(step: number): DiagnosticsProgress {
  return {
    label: PROGRESS_STEPS[Math.max(0, Math.min(step - 1, PROGRESS_STEPS.length - 1))],
    completed: step,
    total: PROGRESS_STEPS.length,
    percent: Math.round((step / PROGRESS_STEPS.length) * 100)
  };
}

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isIpv4(value?: string) {
  return Boolean(value && /^(\d{1,3}\.){3}\d{1,3}$/.test(value));
}

function isIpv6(value?: string) {
  return Boolean(value && value.includes(":") && /^[0-9a-f:]+$/i.test(value));
}

function toCountryName(countryCode?: string) {
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

function normalizeCountryCode(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length === 2 ? normalized : undefined;
}

function buildLocation(country?: string, region?: string, city?: string) {
  const values = [country, region, city].filter(Boolean);
  return values.length ? values.join(" · ") : undefined;
}

function mostCommon(values: Array<string | undefined>) {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

function describeError(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "请求超时";
  }

  if (
    error instanceof Error &&
    /load failed|failed to fetch|networkerror|network request failed/i.test(error.message)
  ) {
    return "浏览器未能完成跨域探测";
  }

  return error instanceof Error ? error.message : "请求失败";
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`请求失败：${new URL(url).host}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`请求失败：${new URL(url).host}`);
  }

  return response.text();
}

async function timed<T>(run: () => Promise<T>) {
  const start = performance.now();
  const value = await run();
  return {
    value,
    latencyMs: Math.round(performance.now() - start)
  };
}

async function detectIpFamily(family: "ipv4" | "ipv6") {
  const sourceGroup =
    family === "ipv4" ? SOURCE_REGISTRY.ip.publicIp.ipv4 : SOURCE_REGISTRY.ip.publicIp.ipv6;
  const sources = [
    ...sourceGroup.json.map(
      (url) => async () => asString((await fetchJson<{ ip?: string }>(url)).ip),
    ),
    ...sourceGroup.text.map(
      (url) => async () => asString((await fetchText(url)).trim()),
    )
  ];

  for (const source of sources) {
    try {
      const ip = await source();

      if ((family === "ipv4" && isIpv4(ip)) || (family === "ipv6" && isIpv6(ip))) {
        return ip;
      }
    } catch {}
  }

  return undefined;
}

function parseTrace(text: string) {
  const entries: Record<string, string> = {};

  for (const line of text.trim().split("\n")) {
    const index = line.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index);
    const value = line.slice(index + 1);
    entries[key] = value;
  }

  return entries;
}

async function lookupGeo(ip: string, cache: Map<string, Promise<GeoRecord | undefined>>) {
  const existing = cache.get(ip);

  if (existing) {
    return existing;
  }

  const task = (async () => {
    const sources = [
      async () => {
        const data = await fetchJson<Record<string, unknown>>(
          `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
        );

        if (data.error) {
          return undefined;
        }

        const countryCode = normalizeCountryCode(asString(data.country_code));
        const countryName = asString(data.country_name) ?? toCountryName(countryCode);

        return {
          countryCode,
          countryName,
          region: asString(data.region),
          city: asString(data.city),
          timezone: asString(data.timezone),
          carrier: asString(data.org) ?? asString(data.network)
        } satisfies GeoRecord;
      },
      async () => {
        const data = await fetchJson<Record<string, unknown>>(
          `https://api.ipapi.is?q=${encodeURIComponent(ip)}`,
        );
        const location = asObject(data.location);
        const company = asObject(data.company);
        const asn = asObject(data.asn);
        const countryCode = normalizeCountryCode(
          asString(location?.country_code) ?? asString(data.cc),
        );
        const countryName = asString(location?.country) ?? toCountryName(countryCode);

        return {
          countryCode,
          countryName,
          region: asString(location?.state),
          city: asString(location?.city),
          timezone:
            asString(location?.timezone) ??
            asString(location?.time_zone) ??
            asString(data.timezone),
          carrier:
            asString(company?.name) ??
            asString(asn?.org) ??
            asString(data.company_name) ??
            asString(data.asn_org)
        } satisfies GeoRecord;
      }
    ];

    for (const source of sources) {
      try {
        const result = await source();

        if (result?.countryCode || result?.countryName || result?.region || result?.city) {
          return result;
        }
      } catch {}
    }

    return undefined;
  })();

  cache.set(ip, task);
  return task;
}

async function fetchIpifyProbe(geoCache: Map<string, Promise<GeoRecord | undefined>>): Promise<RoutingProbe> {
  try {
    const { value, latencyMs } = await timed(() =>
      fetchJson<{ ip?: string }>("https://api64.ipify.org?format=json"),
    );
    const ip = asString(value.ip);

    if (!ip) {
      throw new Error("api64.ipify.org 未返回 IP");
    }

    const geo = await lookupGeo(ip, geoCache);

    return {
      id: "ipify",
      label: "基础出口",
      category: "public",
      endpoint: "https://api64.ipify.org?format=json",
      ip,
      countryCode: geo?.countryCode,
      geo: buildLocation(geo?.countryName, geo?.region, geo?.city),
      timezone: geo?.timezone,
      carrier: geo?.carrier,
      latencyMs,
      status: "primary",
      details: [
        { label: "出口 IP", value: ip },
        { label: "所在位置", value: buildLocation(geo?.countryName, geo?.region, geo?.city) ?? "未补充" },
        { label: "时区", value: geo?.timezone ?? "未补充" },
        { label: "运营商", value: geo?.carrier ?? "未补充" },
        { label: "观测方式", value: "纯 IP API，适合做默认出口对照" }
      ]
    };
  } catch (error) {
    return {
      id: "ipify",
      label: "基础出口",
      category: "public",
      endpoint: "https://api64.ipify.org?format=json",
      status: "error",
      error: describeError(error),
      details: []
    };
  }
}

async function fetchIpSbProbe(): Promise<RoutingProbe> {
  try {
    const { value, latencyMs } = await timed(() =>
      fetchJson<Record<string, unknown>>("https://api.ip.sb/geoip"),
    );

    const countryCode = normalizeCountryCode(asString(value.country_code));
    const countryName = asString(value.country) ?? toCountryName(countryCode);
    const geo = buildLocation(countryName, asString(value.region), asString(value.city));
    const ip = asString(value.ip);

    if (!ip) {
      throw new Error("地理出口没有返回公网 IP");
    }

    return {
      id: "ip-sb",
      label: "地理出口",
      category: "public",
      endpoint: "https://api.ip.sb/geoip",
      ip,
      countryCode,
      geo,
      timezone: asString(value.timezone),
      carrier: asString(value.organization),
      latencyMs,
      status: "primary",
      details: [
        { label: "出口 IP", value: asString(value.ip) ?? "N/A" },
        { label: "所在位置", value: geo ?? "N/A" },
        { label: "时区", value: asString(value.timezone) ?? "N/A" },
        { label: "运营商", value: asString(value.organization) ?? "N/A" },
        { label: "观测方式", value: "自带地理和 ASN 信息的 GeoIP 接口" }
      ]
    };
  } catch (error) {
    return {
      id: "ip-sb",
      label: "地理出口",
      category: "public",
      endpoint: "https://api.ip.sb/geoip",
      status: "error",
      error: describeError(error),
      details: []
    };
  }
}

async function fetchIpApiCoProbe(): Promise<RoutingProbe> {
  try {
    const { value, latencyMs } = await timed(() =>
      fetchJson<Record<string, unknown>>("https://ipapi.co/json/"),
    );

    if (value.error) {
      throw new Error(asString(value.reason) ?? "ipapi.co 未返回结果");
    }

    const countryCode = normalizeCountryCode(asString(value.country_code));
    const countryName = asString(value.country_name) ?? toCountryName(countryCode);
    const geo = buildLocation(countryName, asString(value.region), asString(value.city));
    const ip = asString(value.ip);

    if (!ip) {
      throw new Error("运营商出口没有返回公网 IP");
    }

    return {
      id: "ipapi-co",
      label: "运营商出口",
      category: "public",
      endpoint: "https://ipapi.co/json/",
      ip,
      countryCode,
      geo,
      timezone: asString(value.timezone),
      carrier: asString(value.org) ?? asString(value.network),
      latencyMs,
      status: "primary",
      details: [
        { label: "出口 IP", value: asString(value.ip) ?? "N/A" },
        { label: "所在位置", value: geo ?? "N/A" },
        { label: "时区", value: asString(value.timezone) ?? "N/A" },
        { label: "运营商", value: asString(value.org) ?? asString(value.network) ?? "N/A" },
        { label: "观测方式", value: "浏览器直连的地理出口接口" }
      ]
    };
  } catch (error) {
    return {
      id: "ipapi-co",
      label: "运营商出口",
      category: "public",
      endpoint: "https://ipapi.co/json/",
      status: "error",
      error: describeError(error),
      details: []
    };
  }
}

async function fetchTraceProbe(
  id: string,
  label: string,
  endpoint: string,
  geoCache: Map<string, Promise<GeoRecord | undefined>>,
): Promise<RoutingProbe> {
  try {
    const { value, latencyMs } = await timed(() => fetchText(endpoint));
    const trace = parseTrace(value);
    const ip = asString(trace.ip);
    const geoLookup = ip ? await lookupGeo(ip, geoCache) : undefined;
    const countryCode = normalizeCountryCode(asString(trace.loc) ?? geoLookup?.countryCode);
    const countryName = geoLookup?.countryName ?? toCountryName(countryCode);
    const geo = buildLocation(countryName, geoLookup?.region, geoLookup?.city) ?? countryName;
    const gateway = trace.gateway === "on" ? "开启" : trace.gateway === "off" ? "关闭" : trace.gateway || "N/A";
    const warp = trace.warp === "on" ? "开启" : trace.warp === "off" ? "关闭" : trace.warp || "N/A";

    return {
      id,
      label,
      category: "trace",
      endpoint,
      ip,
      countryCode,
      geo,
      timezone: geoLookup?.timezone,
      carrier: geoLookup?.carrier,
      latencyMs,
      status: "primary",
      details: [
        { label: "出口 IP", value: ip ?? "N/A" },
        { label: "国家 / 地区", value: geo ?? "N/A" },
        { label: "Cloudflare 机房", value: asString(trace.colo) ?? "N/A" },
        {
          label: "访问协议",
          value:
            [asString(trace.visit_scheme), asString(trace.http) ? `http/${trace.http}` : undefined]
              .filter(Boolean)
              .join(" · ") || "N/A"
        },
        { label: "Gateway", value: gateway },
        { label: "WARP", value: warp }
      ]
    };
  } catch (error) {
    return {
      id,
      label,
      category: "trace",
      endpoint,
      status: "error",
      error: describeError(error),
      details: []
    };
  }
}

function finalizeProbes(publicProbes: RoutingProbe[], traceProbes: RoutingProbe[], ipv4?: string, ipv6?: string) {
  const probes = [...publicProbes, ...traceProbes];
  const probeGroups = new Map<string, RoutingProbe[]>();

  for (const probe of probes) {
    if (!probe.ip) {
      continue;
    }

    const group = probeGroups.get(probe.ip);

    if (group) {
      group.push(probe);
    } else {
      probeGroups.set(probe.ip, [probe]);
    }
  }

  const clusters = [...probeGroups.entries()]
    .map(([ip, group]) => {
      const countryCode = mostCommon(group.map((probe) => probe.countryCode));
      const countryLabel =
        mostCommon(
          group.map((probe) => {
            if (!probe.geo) {
              return countryCode ? toCountryName(countryCode) : undefined;
            }

            return probe.geo.split(" · ")[0];
          }),
        ) ?? (countryCode ? toCountryName(countryCode) : undefined);

      return {
        ip,
        countryCode,
        countryLabel,
        geo: mostCommon(group.map((probe) => probe.geo)) ?? countryLabel,
        timezone: mostCommon(group.map((probe) => probe.timezone)),
        carrier: mostCommon(group.map((probe) => probe.carrier)),
        sourceLabels: group.map((probe) => probe.label),
        labels: group.map((probe) => probe.label),
        count: group.length
      } satisfies RoutingCluster;
    })
    .sort((left, right) => right.count - left.count);
  const primaryIp = clusters[0]?.ip;
  const publicMajority = [...clusters]
    .filter((cluster) => cluster.labels.some((label) => publicProbes.some((probe) => probe.label === label)))
    .sort((left, right) => right.count - left.count)[0]?.ip;
  const traceCounts = new Map<string, number>();

  for (const probe of traceProbes) {
    if (!probe.ip) {
      continue;
    }

    traceCounts.set(probe.ip, (traceCounts.get(probe.ip) ?? 0) + 1);
  }

  const traceMajority = [...traceCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  const successfulCount = probes.filter((probe) => !probe.error).length;

  let splitLabel = "等待检测";
  let splitTone: RoutingSummary["splitTone"] = "neutral";
  let splitNote = "页面会对比公开 IP 查询商与 Cloudflare trace 看到的出口是否一致。";

  if (successfulCount === 0) {
    splitLabel = "探针全部失败";
    splitTone = "danger";
    splitNote = "没有任何探针返回出口信息，当前网络或浏览器策略拦截了所有请求。";
  } else if (clusters.length <= 1) {
    splitLabel = "未观察到明显分流";
    splitTone = "safe";
    splitNote = "公开 IP 查询商和 Cloudflare trace 基本看到同一个公网出口。";
  } else if (publicMajority && traceMajority && publicMajority !== traceMajority) {
    splitLabel = "存在按站点分流";
    splitTone = "warn";
    splitNote = `公开 IP 查询商主要看到 ${publicMajority}，但 Cloudflare trace 主要看到 ${traceMajority}，说明不同站点可能走了不同出口。`;
  } else {
    splitLabel = "存在多出口差异";
    splitTone = "warn";
    splitNote = `当前共观察到 ${clusters.length} 个公网出口，不同探针返回结果并不完全一致。`;
  }

  const patchedProbes = probes.map((probe) => {
    if (probe.error) {
      return probe;
    }

    const clusterCount = probe.ip ? probeGroups.get(probe.ip)?.length ?? 0 : 0;
    const status: ProbeStatus = probe.ip && primaryIp && probe.ip !== primaryIp ? "split" : probe.ip ? "primary" : "partial";
    const note =
      status === "split"
        ? `这条探针命中了与主要出口不同的公网 IP。`
        : clusterCount > 1
          ? `这条探针与 ${clusterCount - 1} 条探针共享同一出口。`
          : probe.note;

    return {
      ...probe,
      status,
      note
    };
  });

  return {
    summary: {
      ipv4,
      ipv6,
      primaryIp,
      uniqueIpCount: clusters.length,
      successfulCount,
      splitLabel,
      splitTone,
      splitNote,
      clusters
    } satisfies RoutingSummary,
    publicProbes: patchedProbes.filter((probe) => probe.category === "public"),
    traceProbes: patchedProbes.filter((probe) => probe.category === "trace")
  };
}

function resolveSampleProbe(
  definition: SampleDefinition,
  traceMap: Map<string, RoutingProbe>,
  publicMajorityProbe?: RoutingProbe,
) {
  const primary =
    definition.source === "public-majority" ? publicMajorityProbe : traceMap.get(definition.source);
  const fallback = definition.fallbackSource
    ? definition.fallbackSource === "public-majority"
      ? publicMajorityProbe
      : traceMap.get(definition.fallbackSource)
    : undefined;
  const selected = [primary, fallback, publicMajorityProbe].find(
    (probe): probe is RoutingProbe => Boolean(probe && !probe.error),
  );

  return {
    primary,
    selected,
    usedFallback: Boolean(selected && selected !== primary)
  };
}

function buildSamples(
  publicProbes: RoutingProbe[],
  traceProbes: RoutingProbe[],
  summary: RoutingSummary,
): RoutingSampleRow[] {
  const traceMap = new Map(traceProbes.map((probe) => [probe.id, probe] as const));
  const publicMajorityProbe =
    publicProbes.find((probe) => probe.ip === summary.primaryIp && !probe.error) ??
    publicProbes.find((probe) => !probe.error);

  return SAMPLE_DEFINITIONS.map((definition) => {
    const { primary, selected: probe, usedFallback } = resolveSampleProbe(
      definition,
      traceMap,
      publicMajorityProbe,
    );

    if (!probe) {
      return {
        id: definition.id,
        website: definition.website,
        bucket: definition.bucket,
        methodLabel: definition.methodLabel,
        sourceLabel: primary?.label ?? "未命中可用探针",
        status: "partial",
        note: definition.note,
        error: "代表探针受限"
      };
    }

    const fallbackNote = usedFallback
      ? `${primary?.label ?? "首选代表探针"}受限，当前使用${probe.label}估算。`
      : undefined;

    return {
      id: definition.id,
      website: definition.website,
      bucket: definition.bucket,
      methodLabel: definition.methodLabel,
      sourceLabel: probe.label,
      ip: probe.ip,
      countryCode: probe.countryCode,
      geo: probe.geo,
      status: probe.status,
      note: definition.note ?? fallbackNote ?? probe.note
    };
  });
}

export function useGlobalRoutingReport() {
  const [state, setState] = useState<RoutingState>(initialState);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState(initialState);

      try {
        const [ipv4, ipv6] = await Promise.all([detectIpFamily("ipv4"), detectIpFamily("ipv6")]);

        if (cancelled) {
          return;
        }

        setState((current) => ({
          ...current,
          progress: makeProgress(2)
        }));

        const geoCache = new Map<string, Promise<GeoRecord | undefined>>();

        const publicProbeHandlers = {
          ipify: () => fetchIpifyProbe(geoCache),
          "ip-sb": () => fetchIpSbProbe(),
          "ipapi-co": () => fetchIpApiCoProbe()
        } as const;
        const publicProbes = await Promise.all(
          SOURCE_REGISTRY.routing.publicProbes.map((probe) => publicProbeHandlers[probe.id as keyof typeof publicProbeHandlers]())
        );

        if (cancelled) {
          return;
        }

        setState((current) => ({
          ...current,
          progress: makeProgress(3),
          publicProbes
        }));

        const traceProbes = await Promise.all(
          SOURCE_REGISTRY.routing.traceProbes.map((probe) =>
            fetchTraceProbe(probe.id, probe.label, probe.endpoint, geoCache),
          )
        );

        if (cancelled) {
          return;
        }

        const finalized = finalizeProbes(publicProbes, traceProbes, ipv4, ipv6);
        const samples = buildSamples(finalized.publicProbes, finalized.traceProbes, finalized.summary);

        setState({
          loading: false,
          progress: makeProgress(PROGRESS_STEPS.length),
          error:
            finalized.summary.successfulCount > 0
              ? undefined
              : "所有全球分流探针都失败了，请检查当前网络、浏览器跨域策略或上游接口可用性。",
          summary: finalized.summary,
          publicProbes: finalized.publicProbes,
          traceProbes: finalized.traceProbes,
          samples
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          ...initialState,
          loading: false,
          progress: undefined,
          error: describeError(error)
        });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return {
    ...state,
    refresh() {
      setRefreshToken((value) => value + 1);
    }
  };
}
