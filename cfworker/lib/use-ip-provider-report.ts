"use client";

import { useEffect, useState } from "react";
import { SOURCE_REGISTRY } from "./source-registry";
import type { DiagnosticsProgress } from "./use-live-diagnostics";

type DiffField = "ipv4" | "ipv6" | "location" | "timezone" | "carrier" | "riskType";

type ProviderLookupRecord = {
  countryCode?: string;
  countryName?: string;
  region?: string;
  city?: string;
  timezone?: string;
  carrier?: string;
  riskTypes?: string[];
};

export type IpProviderCard = {
  id: string;
  label: string;
  note: string;
  ipv4?: string;
  ipv6?: string;
  countryCode?: string;
  location?: string;
  locationRegion?: string;
  timezone?: string;
  carrier?: string;
  riskType?: string;
  familyNote?: string;
  diffFields: Partial<Record<DiffField, boolean>>;
  issueCount: number;
  status: "aligned" | "outlier" | "partial" | "error";
  error?: string;
};

type ConsensusField = {
  value?: string;
  countryCode?: string;
  count: number;
};

export type IpConsensus = {
  ipv4: ConsensusField;
  ipv6: ConsensusField;
  location: ConsensusField;
  timezone: ConsensusField;
  carrier: ConsensusField;
  riskType: ConsensusField;
  successCount: number;
  providerCount: number;
  outlierCount: number;
  outlierLabels: string[];
};

type IpProviderState = {
  loading: boolean;
  error?: string;
  progress?: DiagnosticsProgress;
  consensus: IpConsensus;
  providers: IpProviderCard[];
};

type ProviderDefinition = {
  id: string;
  label: string;
  note: string;
  lookup: (ip: string) => Promise<ProviderLookupRecord>;
  httpOnly?: boolean;
};

const PROGRESS_STEPS = [
  "检测当前公网 IPv4 / IPv6",
  "向多家 IP 查询商发起请求",
  "归一化位置、时区与运营商",
  "识别独有差异项"
] as const;

const FIELD_KEYS: DiffField[] = ["ipv4", "ipv6", "location", "timezone", "carrier", "riskType"];

const emptyConsensusField: ConsensusField = { value: undefined, countryCode: undefined, count: 0 };

const initialState: IpProviderState = {
  loading: true,
  progress: {
    label: PROGRESS_STEPS[0],
    completed: 0,
    total: PROGRESS_STEPS.length,
    percent: 0
  },
  consensus: {
    ipv4: emptyConsensusField,
    ipv6: emptyConsensusField,
    location: emptyConsensusField,
    timezone: emptyConsensusField,
    carrier: emptyConsensusField,
    riskType: emptyConsensusField,
    successCount: 0,
    providerCount: 0,
    outlierCount: 0,
    outlierLabels: []
  },
  providers: []
};

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

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
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

function buildLocation(country?: string, region?: string, city?: string) {
  const values = [country, region, city].filter(Boolean);
  return values.length ? values.join(" · ") : undefined;
}

function normalizeCountryCode(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length === 2 ? normalized : undefined;
}

function normalizeCompanyLabel(value?: string) {
  return value
    ?.toLowerCase()
    .replace(/[.,()]/g, " ")
    .replace(/\b(inc|llc|ltd|limited|company|co|corp|corporation|gmbh|plc|pte|ag|sa|bv|sarl)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueValues(values: Array<string | undefined>) {
  const output: string[] = [];

  for (const value of values) {
    if (!value || output.includes(value)) {
      continue;
    }

    output.push(value);
  }

  return output;
}

function formatRiskTypes(values?: string[]) {
  return values?.length ? values.join("，") : undefined;
}

function inferRiskTypes(input: {
  tor?: boolean;
  vpn?: boolean;
  proxy?: boolean;
  mobile?: boolean;
  hosting?: boolean;
  carrier?: string;
  companyType?: string;
}) {
  const tags: string[] = [];

  if (input.tor) {
    tags.push("Tor");
  }

  if (input.vpn) {
    tags.push("VPN");
  }

  if (input.proxy) {
    tags.push("代理");
  }

  if (input.mobile) {
    tags.push("基站");
  }

  if (input.hosting) {
    tags.push("主机");
  }

  const typeText = `${input.companyType ?? ""} ${input.carrier ?? ""}`.toLowerCase();

  if (/(mobile|wireless|cellular|5g|lte|cmcc|cucc|ctcc|中国移动|中国联通|中国电信|verizon|vodafone|orange|telefonica)/i.test(typeText)) {
    tags.push("基站");
  }

  if (/(hosting|datacenter|data center|cloud|aws|amazon|azure|oracle|digitalocean|linode|vultr|hetzner|ovh|aliyun|alibaba cloud|tencent cloud|huawei cloud|机房|主机)/i.test(typeText)) {
    tags.push("主机");
  }

  if (/(enterprise|business|dedicated|leased line|backbone|transit|colo|colocation|专线|企业|商宽)/i.test(typeText)) {
    tags.push("专线");
  }

  if (/(residential|consumer|broadband|cable|fiber|fibra|ftth|home|isp|家庭|家宽|宽带)/i.test(typeText)) {
    tags.push("家宽");
  }

  return uniqueValues(tags);
}

function normalizeFieldValue(field: DiffField, value?: string) {
  if (!value) {
    return undefined;
  }

  if (field === "carrier") {
    return normalizeCompanyLabel(value);
  }

  return value
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIpv4(value?: string) {
  return Boolean(value && /^(\d{1,3}\.){3}\d{1,3}$/.test(value));
}

function isIpv6(value?: string) {
  return Boolean(value && value.includes(":") && /^[0-9a-f:]+$/i.test(value));
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
      const value = await source();

      if ((family === "ipv4" && isIpv4(value)) || (family === "ipv6" && isIpv6(value))) {
        return value;
      }
    } catch {}
  }

  return undefined;
}

function buildFamilyNote(ipv4Result?: ProviderLookupRecord, ipv6Result?: ProviderLookupRecord) {
  if (!ipv4Result || !ipv6Result) {
    return undefined;
  }

  const differs = (field: DiffField, ipv4Value?: string, ipv6Value?: string) => {
    const left = normalizeFieldValue(field, ipv4Value);
    const right = normalizeFieldValue(field, ipv6Value);

    return Boolean(left && right && left !== right);
  };
  const diffs = [
    differs(
      "location",
      buildLocation(ipv4Result.countryName, ipv4Result.region, ipv4Result.city),
      buildLocation(ipv6Result.countryName, ipv6Result.region, ipv6Result.city),
    )
      ? "位置"
      : undefined,
    differs("timezone", ipv4Result.timezone, ipv6Result.timezone)
      ? "时区"
      : undefined,
    differs("carrier", ipv4Result.carrier, ipv6Result.carrier)
      ? "运营商"
      : undefined,
    differs("riskType", formatRiskTypes(ipv4Result.riskTypes), formatRiskTypes(ipv6Result.riskTypes))
      ? "风险类型"
      : undefined
  ].filter(Boolean);

  return diffs.length ? `IPv6 的${diffs.join("、")}与 IPv4 不同，卡片当前按 IPv4 优先展示。` : undefined;
}

function describeLookupError(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

function buildConsensusField(
  cards: IpProviderCard[],
  field: DiffField,
): { consensus: ConsensusField; stableKey?: string } {
  const entries = new Map<string, { count: number; value: string; countryCode?: string }>();

  for (const card of cards) {
    if (card.error) {
      continue;
    }

    const rawValue =
      field === "location"
        ? card.locationRegion ?? card.location
        : card[field];
    const normalized = normalizeFieldValue(field, rawValue);

    if (!rawValue || !normalized) {
      continue;
    }

    const current = entries.get(normalized);

    if (current) {
      current.count += 1;
    } else {
      entries.set(normalized, {
        count: 1,
        value: rawValue,
        countryCode: field === "location" ? card.countryCode : undefined
      });
    }
  }

  const sorted = [...entries.entries()].sort((left, right) => right[1].count - left[1].count);
  const top = sorted[0];
  const runnerUp = sorted[1];

  if (!top) {
    return { consensus: emptyConsensusField };
  }

  const stable = top[1].count >= 2 && (!runnerUp || top[1].count > runnerUp[1].count);

  return {
    consensus: {
      value: top[1].value,
      countryCode: top[1].countryCode,
      count: top[1].count
    },
    stableKey: stable ? top[0] : undefined
  };
}

async function lookupIpApiIs(ip: string): Promise<ProviderLookupRecord> {
  const data = await fetchJson<Record<string, unknown>>(`https://api.ipapi.is?q=${encodeURIComponent(ip)}`);
  const location = asObject(data.location);
  const company = asObject(data.company);
  const asn = asObject(data.asn);

  const countryCode = normalizeCountryCode(
    asString(location?.country_code) ?? asString(data.cc),
  );
  const countryName = asString(location?.country) ?? toCountryName(countryCode);
  const carrier =
    asString(company?.name) ??
    asString(asn?.org) ??
    asString(data.company_name) ??
    asString(data.asn_org);

  return {
    countryCode,
    countryName,
    region: asString(location?.state),
    city: asString(location?.city),
    timezone:
      asString(location?.timezone) ??
      asString(location?.time_zone) ??
      asString(data.timezone),
    carrier,
    riskTypes: inferRiskTypes({
      tor: asBoolean(data.is_tor),
      vpn: asBoolean(data.is_vpn),
      proxy: asBoolean(data.is_proxy),
      mobile: asBoolean(data.is_mobile),
      hosting: asBoolean(data.is_datacenter),
      carrier,
      companyType: asString(company?.type)
    })
  };
}

async function lookupIpApiCo(ip: string): Promise<ProviderLookupRecord> {
  const data = await fetchJson<Record<string, unknown>>(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);

  if (data.error) {
    throw new Error(asString(data.reason) ?? "ipapi.co 未返回结果");
  }

  const countryCode = normalizeCountryCode(asString(data.country_code));
  const countryName = asString(data.country_name) ?? toCountryName(countryCode);
  const carrier = asString(data.org) ?? asString(data.network);

  return {
    countryCode,
    countryName,
    region: asString(data.region),
    city: asString(data.city),
    timezone: asString(data.timezone),
    carrier,
    riskTypes: inferRiskTypes({ carrier })
  };
}

async function lookupFreeIpApi(ip: string): Promise<ProviderLookupRecord> {
  const data = await fetchJson<Record<string, unknown>>(
    `https://free.freeipapi.com/api/json/${encodeURIComponent(ip)}`,
  );
  const countryCode = normalizeCountryCode(asString(data.countryCode));
  const countryName = asString(data.countryName) ?? toCountryName(countryCode);
  const timeZones = Array.isArray(data.timeZones)
    ? data.timeZones.filter((value): value is string => typeof value === "string")
    : [];

  return {
    countryCode,
    countryName,
    region: asString(data.regionName),
    city: asString(data.cityName),
    timezone: timeZones[0],
    carrier: asString(data.asnOrganization),
    riskTypes: inferRiskTypes({
      proxy: asBoolean(data.isProxy),
      carrier: asString(data.asnOrganization)
    })
  };
}

async function lookupIpSb(ip: string): Promise<ProviderLookupRecord> {
  const data = await fetchJson<Record<string, unknown>>(`https://api.ip.sb/geoip/${encodeURIComponent(ip)}`);
  const countryCode = normalizeCountryCode(asString(data.country_code));
  const countryName = asString(data.country) ?? toCountryName(countryCode);
  const carrier = asString(data.organization);

  return {
    countryCode,
    countryName,
    region: asString(data.region),
    city: asString(data.city),
    timezone: asString(data.timezone),
    carrier,
    riskTypes: inferRiskTypes({ carrier })
  };
}

async function lookupIp2Location(ip: string): Promise<ProviderLookupRecord> {
  const data = await fetchJson<Record<string, unknown>>(
    `https://api.ip2location.io/?ip=${encodeURIComponent(ip)}`,
  );
  const countryCode = normalizeCountryCode(asString(data.country_code));
  const countryName = asString(data.country_name) ?? toCountryName(countryCode);
  const proxy = asObject(data.proxy);
  const usageType = asString(data.usage_type) ?? asString(asObject(data.as_info)?.as_usage_type);

  return {
    countryCode,
    countryName,
    region: asString(data.region_name),
    city: asString(data.city_name),
    timezone: asString(data.time_zone),
    carrier: asString(data.isp) ?? asString(data.as),
    riskTypes: inferRiskTypes({
      proxy:
        asBoolean(data.is_proxy) ??
        asBoolean(proxy?.is_public_proxy) ??
        asBoolean(proxy?.is_web_proxy),
      vpn:
        asBoolean(proxy?.is_vpn) ??
        asBoolean(proxy?.is_consumer_privacy_network) ??
        asBoolean(proxy?.is_enterprise_private_network),
      tor: asBoolean(proxy?.is_tor),
      mobile: usageType === "MOB" || usageType === "ISP/MOB",
      hosting: usageType === "DCH" || usageType === "CDN",
      carrier: asString(data.isp) ?? asString(data.as),
      companyType: usageType
    })
  };
}

async function lookupGeoJs(ip: string): Promise<ProviderLookupRecord> {
  const data = await fetchJson<Record<string, unknown>>(
    `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`,
  );
  const countryCode = normalizeCountryCode(asString(data.country_code));
  const countryName = asString(data.country) ?? toCountryName(countryCode);
  const carrier = asString(data.organization_name) ?? asString(data.organization);

  return {
    countryCode,
    countryName,
    region: asString(data.region),
    city: asString(data.city),
    timezone: asString(data.timezone),
    carrier,
    riskTypes: inferRiskTypes({ carrier })
  };
}

async function lookupIpQuery(ip: string): Promise<ProviderLookupRecord> {
  const data = await fetchJson<Record<string, unknown>>(`https://api.ipquery.io/${encodeURIComponent(ip)}`);
  const location = asObject(data.location);
  const risk = asObject(data.risk);
  const ispObject = asObject(data.isp);
  const asnObject = asObject(data.asn);

  const countryCode = normalizeCountryCode(
    asString(location?.country_code) ?? asString(data.country_code),
  );
  const countryName =
    asString(location?.country) ?? asString(data.country) ?? toCountryName(countryCode);
  const carrier =
    asString(data.isp) ??
    asString(ispObject?.name) ??
    asString(ispObject?.isp) ??
    asString(ispObject?.organization) ??
    asString(asnObject?.org) ??
    asString(data.organization);

  return {
    countryCode,
    countryName,
    region: asString(location?.state) ?? asString(data.region),
    city: asString(location?.city) ?? asString(data.city),
    timezone: asString(location?.timezone) ?? asString(data.timezone),
    carrier,
    riskTypes: inferRiskTypes({
      tor: asBoolean(risk?.is_tor),
      vpn: asBoolean(risk?.is_vpn),
      proxy: asBoolean(risk?.is_proxy),
      mobile: asBoolean(risk?.is_mobile),
      carrier
    })
  };
}

async function lookupIpApi(ip: string): Promise<ProviderLookupRecord> {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    throw new Error("HTTPS 页面下无法直连 ip-api.com");
  }

  const data = await fetchJson<Record<string, unknown>>(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city,timezone,isp,org,mobile,proxy,hosting,query`,
  );

  if (asString(data.status) !== "success") {
    throw new Error(asString(data.message) ?? "ip-api.com 未返回结果");
  }

  const countryCode = normalizeCountryCode(asString(data.countryCode));
  const countryName = asString(data.country) ?? toCountryName(countryCode);
  const carrier = asString(data.isp) ?? asString(data.org);

  return {
    countryCode,
    countryName,
    region: asString(data.regionName),
    city: asString(data.city),
    timezone: asString(data.timezone),
    carrier,
    riskTypes: inferRiskTypes({
      mobile: asBoolean(data.mobile),
      proxy: asBoolean(data.proxy),
      hosting: asBoolean(data.hosting),
      carrier
    })
  };
}

const IP_PROVIDER_LOOKUPS: Record<string, (ip: string) => Promise<ProviderLookupRecord>> = {
  ipapiIs: lookupIpApiIs,
  ipapiCo: lookupIpApiCo,
  freeIpApi: lookupFreeIpApi,
  ipSb: lookupIpSb,
  ip2Location: lookupIp2Location,
  geoJs: lookupGeoJs,
  ipQuery: lookupIpQuery,
  ipApi: lookupIpApi
};

function getProviders() {
  return SOURCE_REGISTRY.ip.providers
    .filter((provider) => {
      const httpOnly = "httpOnly" in provider ? provider.httpOnly === true : false;

      return !(httpOnly && typeof window !== "undefined" && window.location.protocol === "https:");
    })
    .map((provider) => ({
      id: provider.id,
      label: provider.label,
      note: provider.note,
      httpOnly: "httpOnly" in provider ? provider.httpOnly : undefined,
      lookup: IP_PROVIDER_LOOKUPS[provider.lookupKey]
    })) satisfies ProviderDefinition[];
}

async function buildProviderCard(definition: ProviderDefinition, subject: { ipv4?: string; ipv6?: string }) {
  const [ipv4Result, ipv6Result] = await Promise.all([
    subject.ipv4
      ? definition.lookup(subject.ipv4).catch((error) => ({ error: describeLookupError(error) }))
      : Promise.resolve(undefined),
    subject.ipv6
      ? definition.lookup(subject.ipv6).catch((error) => ({ error: describeLookupError(error) }))
      : Promise.resolve(undefined)
  ]);

  const ipv4Lookup = ipv4Result && "error" in ipv4Result ? undefined : ipv4Result;
  const ipv6Lookup = ipv6Result && "error" in ipv6Result ? undefined : ipv6Result;
  const primary = ipv4Lookup ?? ipv6Lookup;
  const error =
    !primary && (ipv4Result && "error" in ipv4Result ? ipv4Result.error : undefined) && (ipv6Result && "error" in ipv6Result ? ipv6Result.error : undefined)
      ? `${"error" in ipv4Result! ? ipv4Result.error : ""}${subject.ipv6 ? "；" : ""}${"error" in ipv6Result! ? ipv6Result.error : ""}`
      : !primary
        ? "供应商没有返回可用结果"
        : undefined;

  return {
    id: definition.id,
    label: definition.label,
    note: definition.note,
    ipv4: subject.ipv4,
    ipv6: subject.ipv6,
    countryCode: primary?.countryCode,
    location: buildLocation(primary?.countryName, primary?.region, primary?.city),
    locationRegion: buildLocation(primary?.countryName, primary?.region),
    timezone: primary?.timezone,
    carrier: primary?.carrier,
    riskType: formatRiskTypes(primary?.riskTypes),
    familyNote: buildFamilyNote(ipv4Lookup, ipv6Lookup),
    diffFields: {},
    issueCount: 0,
    status: error ? "error" : "aligned",
    error
  } satisfies IpProviderCard;
}

function finalizeCards(cards: IpProviderCard[]) {
  const stableConsensus = {
    ipv4: buildConsensusField(cards, "ipv4"),
    ipv6: buildConsensusField(cards, "ipv6"),
    location: buildConsensusField(cards, "location"),
    timezone: buildConsensusField(cards, "timezone"),
    carrier: buildConsensusField(cards, "carrier"),
    riskType: buildConsensusField(cards, "riskType")
  };

  const hydratedCards = cards.map((card) => {
    let issueCount = 0;
    const diffFields: Partial<Record<DiffField, boolean>> = {};

    for (const field of FIELD_KEYS) {
      const consensus = stableConsensus[field];

      if (!consensus.stableKey) {
        continue;
      }

      const normalized = normalizeFieldValue(
        field,
        field === "location" ? card.locationRegion ?? card.location : card[field],
      );

      if (normalized && normalized !== consensus.stableKey) {
        diffFields[field] = true;
        issueCount += 1;
      }
    }

    const missingCount = FIELD_KEYS.filter((field) => !card[field]).length;
    const status: IpProviderCard["status"] = card.error
      ? "error"
      : issueCount > 0
        ? "outlier"
        : missingCount > 0
          ? "partial"
          : "aligned";

    return {
      ...card,
      diffFields,
      issueCount,
      status
    };
  });

  const successCount = hydratedCards.filter((card) => !card.error).length;
  const outlierCards = hydratedCards.filter((card) => card.status === "outlier");

  return {
    cards: hydratedCards,
    consensus: {
      ipv4: stableConsensus.ipv4.consensus,
      ipv6: stableConsensus.ipv6.consensus,
      location: stableConsensus.location.consensus,
      timezone: stableConsensus.timezone.consensus,
      carrier: stableConsensus.carrier.consensus,
      riskType: stableConsensus.riskType.consensus,
      successCount,
      providerCount: hydratedCards.length,
      outlierCount: outlierCards.length,
      outlierLabels: outlierCards.map((card) => card.label)
    } satisfies IpConsensus
  };
}

export function useIpProviderReport() {
  const [state, setState] = useState<IpProviderState>(initialState);
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

        if (!ipv4 && !ipv6) {
          throw new Error("未能检测到当前浏览器的公网 IPv4 或 IPv6。");
        }

        setState((current) => ({
          ...current,
          progress: makeProgress(2)
        }));

        const providers = getProviders();
        const providerCards = await Promise.all(providers.map((provider) => buildProviderCard(provider, { ipv4, ipv6 })));

        if (cancelled) {
          return;
        }

        setState((current) => ({
          ...current,
          progress: makeProgress(3),
          providers: providerCards
        }));

        const { cards, consensus } = finalizeCards(providerCards);

        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          progress: makeProgress(PROGRESS_STEPS.length),
          providers: cards,
          consensus,
          error:
            consensus.successCount > 0
              ? undefined
              : "所有供应商都没有返回可用结果，请检查当前网络、浏览器跨域策略或供应商接口限制。"
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          ...initialState,
          loading: false,
          progress: undefined,
          error: describeLookupError(error)
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
