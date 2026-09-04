import { NextResponse } from "next/server";
import { SOURCE_REGISTRY } from "../../../lib/source-registry";

type OfficialComponent = {
  id?: string;
  name?: string;
  status?: string;
  updated_at?: string;
};

type SummaryResponse = {
  page?: {
    name?: string;
    url?: string;
    updated_at?: string;
  };
  status?: {
    description?: string;
    indicator?: string;
  };
  components?: OfficialComponent[];
};

type GoogleProduct = {
  id?: string;
  title?: string;
};

type GoogleIncident = {
  end?: string;
  modified?: string;
  service_key?: string;
  service_name?: string;
  status_impact?: string;
  most_recent_update?: {
    status?: string;
    when?: string;
  };
};

type AppleEvent = {
  eventStatus?: string;
  statusType?: string;
  endDate?: string;
  epochEndDate?: number;
};

type AppleService = {
  serviceName?: string;
  events?: AppleEvent[];
};

type AppleResponse = {
  services?: AppleService[];
};

type OfficialServiceStatus = {
  id: string;
  label: string;
  status: string;
  statusCn: string;
  sourceName: string;
  updatedAt?: string;
};

type OfficialVendorStatus = {
  id: string;
  label: string;
  pageUrl: string;
  apiUrl: string;
  overallLabel: string;
  overallIndicator: string;
  updatedAt?: string;
  services: OfficialServiceStatus[];
  sourceCount: number;
  error?: string;
};

type OpenAiFeedIncident = {
  updatedAt: string;
  resolved: boolean;
  components: Array<{
    name: string;
    status: string;
  }>;
};

type OpenAiFeed = {
  updatedAt: string;
  incidents: OpenAiFeedIncident[];
};

const MAX_FEED_BYTES = 2 * 1024 * 1024;

function statusLabel(status?: string) {
  switch (status) {
    case "operational":
      return "正常运行";
    case "degraded_performance":
      return "性能下降";
    case "partial_outage":
      return "部分中断";
    case "major_outage":
      return "重大故障";
    case "under_maintenance":
    case "maintenance":
      return "维护中";
    case "restricted":
      return "公开接口受限";
    default:
      return status || "未知";
  }
}

function indicatorLabel(indicator?: string, description?: string) {
  if (description) {
    if (description === "All Systems Operational") {
      return "正常运行";
    }

    return description;
  }

  switch (indicator) {
    case "none":
      return "正常运行";
    case "minor":
      return "轻微异常";
    case "major":
      return "重大异常";
    case "critical":
      return "严重故障";
    default:
      return "未知";
  }
}

function severityRank(status?: string) {
  switch (status) {
    case "major_outage":
      return 4;
    case "partial_outage":
      return 3;
    case "degraded_performance":
      return 2;
    case "maintenance":
    case "under_maintenance":
      return 1;
    case "restricted":
      return 0;
    case "operational":
    default:
      return 0;
  }
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`请求失败：${new URL(url).host}`);
  }

  return {
    data: (await response.json()) as T,
    response
  };
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`请求失败：${new URL(url).host}`);
  }

  if (!response.body) {
    throw new Error(`响应为空：${new URL(url).host}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_FEED_BYTES) {
      await reader.cancel();
      throw new Error(`响应过大：${new URL(url).host}`);
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

function decodeFeedText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function normalizeOpenAiFeedStatus(value: string) {
  const normalized = decodeFeedText(value).toLowerCase();

  if (normalized.includes("major outage")) {
    return "major_outage";
  }

  if (normalized.includes("partial outage")) {
    return "partial_outage";
  }

  if (normalized.includes("degraded performance")) {
    return "degraded_performance";
  }

  if (normalized.includes("maintenance")) {
    return "maintenance";
  }

  return "operational";
}

function parseOpenAiFeed(xml: string): OpenAiFeed {
  const incidents = [...xml.matchAll(
    /<(?:entry|item)\b[\s\S]*?<\/(?:entry|item)>/gi,
  )].flatMap(([entry]) => {
    const rawDate = entry.match(
      /<(?:updated|pubDate)>(?:<!\[CDATA\[)?\s*([^<\]]+?)(?:\]\]>)?<\/(?:updated|pubDate)>/i,
    )?.[1]?.trim();
    const timestamp = rawDate ? Date.parse(rawDate) : Number.NaN;

    if (!Number.isFinite(timestamp)) {
      return [];
    }

    const body = entry.match(
      /<(?:summary|description|content(?::encoded)?)(?:\s[^>]*)?>([\s\S]*?)<\/(?:summary|description|content(?::encoded)?)>/i,
    )?.[1] ?? "";
    const status = body.match(/<b>\s*Status:\s*([^<]+)<\/b>/i)?.[1] ?? "";
    const components = [...body.matchAll(/<li>\s*([\s\S]*?)\s*\(([^()]+)\)\s*<\/li>/gi)]
      .map(([, name, componentStatus]) => ({
        name: decodeFeedText(name),
        status: normalizeOpenAiFeedStatus(componentStatus)
      }))
      .filter((component) => component.name);

    return [{
      updatedAt: new Date(timestamp).toISOString(),
      resolved: /resolved|completed/i.test(decodeFeedText(status)),
      components
    }];
  });

  if (!incidents.length) {
    throw new Error("OpenAI 状态订阅源没有事件时间");
  }

  return {
    updatedAt: incidents.reduce(
      (latest, incident) => incident.updatedAt > latest ? incident.updatedAt : latest,
      incidents[0].updatedAt,
    ),
    incidents
  };
}

function latestSettledFeed(...results: PromiseSettledResult<OpenAiFeed>[]) {
  return results
    .filter((result): result is PromiseFulfilledResult<OpenAiFeed> => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function aggregateService(
  id: string,
  label: string,
  names: string[],
  components: OfficialComponent[],
  includeComponentUpdatedAt = true,
): OfficialServiceStatus {
  const matched = components.filter((component) => names.includes(component.name ?? ""));

  if (!matched.length) {
    return {
      id,
      label,
      status: "unknown",
      statusCn: "未提供",
      sourceName: names.join(" / ")
    };
  }

  const worst = [...matched].sort(
    (left, right) => severityRank(right.status) - severityRank(left.status),
  )[0];
  const updatedAt = [...matched]
    .map((component) => component.updated_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    id,
    label,
    status: worst.status ?? "unknown",
    statusCn: statusLabel(worst.status),
    sourceName: matched.map((component) => component.name ?? "").join(" / "),
    updatedAt: includeComponentUpdatedAt ? updatedAt : undefined
  };
}

function buildClaudeVendor(summary: SummaryResponse): OfficialVendorStatus {
  const components = summary.components ?? [];
  const services = mapClaudeServices(components);

  return {
    id: "claude",
    label: "Claude",
    pageUrl: summary.page?.url ?? SOURCE_REGISTRY.officialStatus.claude.pageUrl,
    apiUrl: SOURCE_REGISTRY.officialStatus.claude.apiUrl,
    overallLabel: indicatorLabel(summary.status?.indicator, summary.status?.description),
    overallIndicator: summary.status?.indicator ?? "none",
    updatedAt: summary.page?.updated_at,
    sourceCount: components.length,
    services
  };
}

function mapClaudeServices(components: OfficialComponent[]) {
  return [
    aggregateService("claude-web", "Claude", ["claude.ai"], components),
    aggregateService("claude-api", "Claude API", ["Claude API (api.anthropic.com)"], components),
    aggregateService("claude-code", "Claude Code", ["Claude Code"], components),
    aggregateService(
      "claude-platform",
      "Claude Platform",
      [
        "Claude Console (platform.claude.com)",
        "platform.claude.com (formerly console.anthropic.com)"
      ],
      components,
    )
  ];
}

function buildOpenAiVendor(
  summary: SummaryResponse,
  feed?: OpenAiFeed,
): OfficialVendorStatus {
  const activeIncidents = feed?.incidents.filter((incident) => !incident.resolved) ?? [];
  const activeComponents = new Map<string, OfficialComponent>();

  for (const incident of activeIncidents) {
    for (const component of incident.components) {
      const current = activeComponents.get(component.name);
      if (!current || severityRank(component.status) >= severityRank(current.status)) {
        activeComponents.set(component.name, {
          name: component.name,
          status: component.status,
          updated_at: incident.updatedAt
        });
      }
    }
  }

  const summaryComponents = (summary.components ?? []).map((component) => ({
    ...component,
    updated_at: undefined
  }));
  const summaryNames = new Set(summaryComponents.map((component) => component.name));
  const components = summaryComponents
    .map((component) => activeComponents.get(component.name ?? "") ?? component)
    .concat(
      [...activeComponents.values()].filter((component) => !summaryNames.has(component.name)),
    );
  const services = mapOpenAiServices(components);
  const activeWorst = [...activeComponents.values()].sort(
    (left, right) => severityRank(right.status) - severityRank(left.status),
  )[0];
  const activeSeverity = activeIncidents.length
    ? Math.max(2, severityRank(activeWorst?.status))
    : 0;

  return {
    id: "openai",
    label: "OpenAI",
    pageUrl: summary.page?.url ?? SOURCE_REGISTRY.officialStatus.openai.pageUrl,
    apiUrl: SOURCE_REGISTRY.officialStatus.openai.atomUrl,
    overallLabel: activeIncidents.length
      ? activeIncidents.length === 1 ? "存在进行中的事件" : `${activeIncidents.length} 个进行中的事件`
      : indicatorLabel(summary.status?.indicator, summary.status?.description),
    overallIndicator: activeIncidents.length
      ? activeSeverity >= 4 ? "critical" : activeSeverity >= 3 ? "major" : "minor"
      : summary.status?.indicator ?? "none",
    updatedAt: feed?.updatedAt,
    sourceCount: components.length,
    services
  };
}

function mapOpenAiServices(components: OfficialComponent[]) {
  return [
    aggregateService("chatgpt", "ChatGPT", ["App", "Conversations", "Login"], components),
    aggregateService(
      "openai-api",
      "OpenAI API",
      [
        "Responses",
        "Chat Completions",
        "Realtime",
        "Embeddings",
        "Files",
        "Batch",
        "Fine-tuning",
        "Images",
        "Audio",
        "Moderations",
        "Compliance API"
      ],
      components,
    ),
    aggregateService("sora", "Sora", ["Sora", "Video generation", "Video viewing"], components),
    aggregateService("codex-web", "Codex Web", ["Codex Web"], components),
    aggregateService("codex-api", "Codex API", ["Codex API"], components)
  ];
}

function normalizeGoogleStatus(status?: string, impact?: string) {
  const normalized = status?.toUpperCase() ?? impact?.toUpperCase() ?? "AVAILABLE";

  if (normalized.includes("OUTAGE")) {
    return "major_outage";
  }

  if (normalized.includes("DISRUPTION")) {
    return "partial_outage";
  }

  if (normalized.includes("INFORMATION")) {
    return "degraded_performance";
  }

  return "operational";
}

function buildGoogleVendor(products: GoogleProduct[], incidents: GoogleIncident[]): OfficialVendorStatus {
  const productMap = new Map(
    products.map((product) => [product.title, product.id] as const),
  );

  const buildService = (id: string, label: string, titles: string[]): OfficialServiceStatus => {
    const productIds = titles
      .map((title) => productMap.get(title))
      .filter((value): value is string => Boolean(value));

    const matched = incidents.filter(
      (incident) =>
        (incident.service_key && productIds.includes(incident.service_key)) ||
        (incident.service_name && titles.includes(incident.service_name)),
    );

    const active = matched.filter((incident) => !incident.end);
    const latest = [...(active.length ? active : matched)].sort((left, right) =>
      String(right.modified ?? right.most_recent_update?.when ?? "").localeCompare(
        String(left.modified ?? left.most_recent_update?.when ?? ""),
      ),
    )[0];

    if (!latest) {
      return {
        id,
        label,
        status: "operational",
        statusCn: "正常运行",
        sourceName: titles.join(" / ")
      };
    }

    const mapped = normalizeGoogleStatus(
      latest.most_recent_update?.status,
      latest.status_impact,
    );

    return {
      id,
      label,
      status: mapped,
      statusCn: statusLabel(mapped),
      sourceName: titles.join(" / "),
      updatedAt: latest.modified ?? latest.most_recent_update?.when
    };
  };

  const services = [
    buildService("google-gemini", "Gemini", ["Gemini"]),
    buildService("google-gmail", "Gmail", ["Gmail"]),
    buildService("google-drive", "Google Drive", ["Google Drive"]),
    buildService("google-meet", "Google Meet", ["Google Meet"]),
    buildService("google-chat", "Google Chat", ["Google Chat"])
  ];

  const worst = [...services].sort(
    (left, right) => severityRank(right.status) - severityRank(left.status),
  )[0];

  return {
    id: "google",
    label: "Google",
    pageUrl: SOURCE_REGISTRY.officialStatus.google.pageUrl,
    apiUrl: SOURCE_REGISTRY.officialStatus.google.incidentsUrl,
    overallLabel: statusLabel(worst?.status ?? "operational"),
    overallIndicator: worst?.status === "operational" ? "none" : worst?.status ?? "minor",
    updatedAt: [...incidents]
      .map((incident) => incident.modified ?? incident.most_recent_update?.when)
      .filter(Boolean)
      .sort()
      .at(-1),
    sourceCount: products.length,
    services
  };
}

function normalizeAppleStatus(event?: AppleEvent) {
  const type = event?.statusType?.toLowerCase();

  if (!event || event.eventStatus === "resolved") {
    return "operational";
  }

  if (type === "outage") {
    return "major_outage";
  }

  if (type === "issue") {
    return "partial_outage";
  }

  return "degraded_performance";
}

function buildAppleVendor(data: AppleResponse, updatedAt?: string): OfficialVendorStatus {
  const services = (data.services ?? []).map((service) => {
    const latestEvent = [...(service.events ?? [])].sort(
      (left, right) => (right.epochEndDate ?? 0) - (left.epochEndDate ?? 0),
    )[0];
    const mapped = normalizeAppleStatus(latestEvent);

    return {
      id: service.serviceName ?? "",
      label: service.serviceName ?? "",
      status: mapped,
      statusCn: statusLabel(mapped),
      sourceName: service.serviceName ?? "",
      updatedAt: latestEvent?.endDate
    } satisfies OfficialServiceStatus;
  });

  const pick = (names: string[]) =>
    services.find((service) => names.includes(service.label)) ?? {
      id: names[0],
      label: names[0],
      status: "unknown",
      statusCn: "未提供",
      sourceName: names.join(" / ")
    };

  const selected = [
    pick(["App Store", "Mac App Store"]),
    pick(["Apple Music"]),
    pick(["iCloud Mail"]),
    pick(["iMessage"]),
    pick(["Apple TV"])
  ];

  const worst = [...selected].sort(
    (left, right) => severityRank(right.status) - severityRank(left.status),
  )[0];

  return {
    id: "apple",
    label: "Apple",
    pageUrl: SOURCE_REGISTRY.officialStatus.apple.pageUrl,
    apiUrl: SOURCE_REGISTRY.officialStatus.apple.apiUrl,
    overallLabel: statusLabel(worst?.status ?? "operational"),
    overallIndicator: worst?.status === "operational" ? "none" : worst?.status ?? "minor",
    updatedAt,
    sourceCount: data.services?.length ?? 0,
    services: selected
  };
}

function buildUnavailableVendor(
  id: string,
  label: string,
  pageUrl: string,
  apiUrl: string,
  error: unknown,
): OfficialVendorStatus {
  return {
    id,
    label,
    pageUrl,
    apiUrl,
    overallLabel: "暂时无法获取",
    overallIndicator: "unavailable",
    sourceCount: 0,
    services: [],
    error: error instanceof Error ? error.message : "官方状态源不可用"
  };
}

function settledError(...results: PromiseSettledResult<unknown>[]) {
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  return rejected?.reason;
}

export async function GET() {
  const [
    claudeSummary,
    openAiSummary,
    openAiAtom,
    openAiRss,
    googleProducts,
    googleIncidents,
    appleStatus
  ] = await Promise.allSettled([
      fetchJson<SummaryResponse>(SOURCE_REGISTRY.officialStatus.claude.apiUrl),
      fetchJson<SummaryResponse>(SOURCE_REGISTRY.officialStatus.openai.apiUrl),
      fetchText(SOURCE_REGISTRY.officialStatus.openai.atomUrl).then(parseOpenAiFeed),
      fetchText(SOURCE_REGISTRY.officialStatus.openai.rssUrl).then(parseOpenAiFeed),
      fetchJson<{ products?: GoogleProduct[] }>(SOURCE_REGISTRY.officialStatus.google.productsUrl),
      fetchJson<GoogleIncident[]>(SOURCE_REGISTRY.officialStatus.google.incidentsUrl),
      fetchJson<AppleResponse>(SOURCE_REGISTRY.officialStatus.apple.apiUrl)
  ]);

  const claudeVendor = claudeSummary.status === "fulfilled"
    ? buildClaudeVendor(claudeSummary.value.data)
    : buildUnavailableVendor(
        "claude",
        "Claude",
        SOURCE_REGISTRY.officialStatus.claude.pageUrl,
        SOURCE_REGISTRY.officialStatus.claude.apiUrl,
        claudeSummary.reason,
      );
  const openAiVendor = openAiSummary.status === "fulfilled"
    ? buildOpenAiVendor(
        openAiSummary.value.data,
        latestSettledFeed(openAiAtom, openAiRss),
      )
    : buildUnavailableVendor(
        "openai",
        "OpenAI",
        SOURCE_REGISTRY.officialStatus.openai.pageUrl,
        SOURCE_REGISTRY.officialStatus.openai.apiUrl,
        openAiSummary.reason,
      );
  const googleError = settledError(googleProducts, googleIncidents);
  const googleVendor = !googleError && googleProducts.status === "fulfilled" && googleIncidents.status === "fulfilled"
    ? buildGoogleVendor(
        googleProducts.value.data.products ?? [],
        googleIncidents.value.data ?? [],
      )
    : buildUnavailableVendor(
        "google",
        "Google",
        SOURCE_REGISTRY.officialStatus.google.pageUrl,
        SOURCE_REGISTRY.officialStatus.google.incidentsUrl,
        googleError,
      );
  const appleVendor = appleStatus.status === "fulfilled"
    ? buildAppleVendor(
        appleStatus.value.data,
        appleStatus.value.response.headers.get("last-modified") ?? undefined,
      )
    : buildUnavailableVendor(
        "apple",
        "Apple",
        SOURCE_REGISTRY.officialStatus.apple.pageUrl,
        SOURCE_REGISTRY.officialStatus.apple.apiUrl,
        appleStatus.reason,
      );

  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      vendors: [claudeVendor, openAiVendor, googleVendor, appleVendor]
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    },
  );
}
