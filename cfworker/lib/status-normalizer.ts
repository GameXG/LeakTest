import { SOURCE_REGISTRY } from "./source-registry";

export type OfficialComponent = {
  id?: string;
  name?: string;
  status?: string;
  updated_at?: string;
};

export type OfficialSummaryResponse = {
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

export type GoogleIncident = {
  end?: string;
  modified?: string;
  service_name?: string;
  status_impact?: string;
  most_recent_update?: {
    status?: string;
    when?: string;
  };
};

export type AppleStatusEvent = {
  statusType?: string;
  eventStatus?: string;
  message?: string;
  datePosted?: string;
  startDate?: string;
  endDate?: string;
  epochStartDate?: number | string;
  epochEndDate?: number | string;
  usersAffected?: string;
  affectedServices?: string[];
};

export type AppleStatusService = {
  serviceName?: string;
  redirectUrl?: string | null;
  events?: AppleStatusEvent[];
};

export type AppleStatusResponse = {
  drMessage?: string | null;
  services?: AppleStatusService[];
  drpost?: boolean;
};

export type OfficialServiceStatus = {
  id: string;
  label: string;
  status: string;
  statusCn: string;
  sourceName: string;
  updatedAt?: string;
  detail?: string;
};

export type OfficialVendorStatus = {
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
    case "unknown":
      return "未提供";
    default:
      return status || "未知";
  }
}

function indicatorLabel(indicator?: string, description?: string) {
  if (description) {
    return description === "All Systems Operational" ? "正常运行" : description;
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
    case "unknown":
      return "未提供";
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
    case "operational":
      return 0;
    default:
      return -1;
  }
}

function aggregateService(
  id: string,
  label: string,
  names: string[],
  components: OfficialComponent[],
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
    updatedAt
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

export function buildClaudeVendor(summary: OfficialSummaryResponse): OfficialVendorStatus {
  const components = summary.components ?? [];

  return {
    id: "claude",
    label: "Claude",
    pageUrl: summary.page?.url ?? SOURCE_REGISTRY.officialStatus.claude.pageUrl,
    apiUrl: SOURCE_REGISTRY.officialStatus.claude.apiUrl,
    overallLabel: indicatorLabel(summary.status?.indicator, summary.status?.description),
    overallIndicator: summary.status?.indicator ?? "unknown",
    updatedAt: summary.page?.updated_at,
    sourceCount: components.length,
    services: mapClaudeServices(components)
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
        "File uploads",
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

export function buildOpenAiVendor(summary: OfficialSummaryResponse): OfficialVendorStatus {
  const components = summary.components ?? [];

  return {
    id: "openai",
    label: "OpenAI",
    pageUrl: summary.page?.url ?? SOURCE_REGISTRY.officialStatus.openai.pageUrl,
    apiUrl: SOURCE_REGISTRY.officialStatus.openai.apiUrl,
    overallLabel: indicatorLabel(summary.status?.indicator, summary.status?.description),
    overallIndicator: summary.status?.indicator ?? "unknown",
    updatedAt: summary.page?.updated_at,
    sourceCount: components.length,
    services: mapOpenAiServices(components)
  };
}

function normalizeGoogleStatus(status?: string, impact?: string) {
  const normalized = status?.toUpperCase() ?? impact?.toUpperCase() ?? "";

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

function latestGoogleTimestamp(incident: GoogleIncident) {
  return incident.modified ?? incident.most_recent_update?.when;
}

export function buildGoogleVendor(incidents: GoogleIncident[]): OfficialVendorStatus {
  const definitions: Array<readonly [string, string, readonly string[]]> = [
    ["google-gemini", "Gemini", ["Gemini"]],
    ["google-gmail", "Gmail", ["Gmail"]],
    ["google-drive", "Google Drive", ["Google Drive"]],
    ["google-meet", "Google Meet", ["Google Meet"]],
    ["google-chat", "Google Chat", ["Google Chat"]]
  ] as const;

  const services = definitions.map(([id, label, names]) => {
    const matched = incidents.filter((incident) => names.includes(incident.service_name ?? ""));
    const latest = [...matched].sort((left, right) =>
      String(latestGoogleTimestamp(right) ?? "").localeCompare(String(latestGoogleTimestamp(left) ?? "")),
    )[0];

    if (!latest) {
      return {
        id,
        label,
        status: "unknown",
        statusCn: "未提供",
        sourceName: names.join(" / ")
      } satisfies OfficialServiceStatus;
    }

    const status = latest.end
      ? "operational"
      : normalizeGoogleStatus(latest.most_recent_update?.status, latest.status_impact);

    return {
      id,
      label,
      status,
      statusCn: statusLabel(status),
      sourceName: names.join(" / "),
      updatedAt: latestGoogleTimestamp(latest)
    } satisfies OfficialServiceStatus;
  });
  const knownServices = services.filter((service) => service.status !== "unknown");
  const worst = [...knownServices].sort(
    (left, right) => severityRank(right.status) - severityRank(left.status),
  )[0];
  const updatedAt = [...incidents]
    .map(latestGoogleTimestamp)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    id: "google",
    label: "Google",
    pageUrl: SOURCE_REGISTRY.officialStatus.google.pageUrl,
    apiUrl: SOURCE_REGISTRY.officialStatus.google.incidentsUrl,
    overallLabel: worst ? statusLabel(worst.status) : "未提供可验证明细",
    overallIndicator: worst ? (worst.status === "operational" ? "none" : worst.status) : "unknown",
    updatedAt,
    sourceCount: incidents.length,
    services,
    error: worst
      ? undefined
      : "官方事件源没有提供可直接匹配的服务明细，无法据此确认正常运行。"
  };
}

function appleEventDate(value?: string | number) {
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value === "number" || /^\d+$/.test(value)) {
    const numericValue = Number(value);
    const milliseconds = numericValue < 10_000_000_000 ? numericValue * 1000 : numericValue;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function appleEventTimestamp(event: AppleStatusEvent) {
  return (
    appleEventDate(event.datePosted) ??
    appleEventDate(event.startDate) ??
    appleEventDate(event.epochStartDate)
  );
}

function appleEventEnded(event: AppleStatusEvent) {
  const eventText = `${event.statusType ?? ""} ${event.eventStatus ?? ""}`.toLowerCase();
  if (/resolved|complete|completed|closed|ended|restored/.test(eventText)) return true;

  const endDate = appleEventDate(event.endDate) ?? appleEventDate(event.epochEndDate);
  return Boolean(endDate && Date.parse(endDate) <= Date.now());
}

function normalizeAppleEventStatus(event: AppleStatusEvent) {
  const eventText = `${event.statusType ?? ""} ${event.eventStatus ?? ""}`.toLowerCase();

  if (/maintenance|maintain/.test(eventText)) return "maintenance";
  if (/major|outage|down|unavailable|failure|critical/.test(eventText)) return "major_outage";
  if (/partial|degrad|disruption|intermittent|slow|investigat|issue/.test(eventText)) {
    return "partial_outage";
  }

  return "unknown";
}

function appleServiceId(name: string | undefined, index: number) {
  const slug = (name ?? "service")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `apple-${index}-${slug || "service"}`;
}

export function buildAppleVendor(data: AppleStatusResponse): OfficialVendorStatus {
  const services = (data.services ?? []).map((service, index) => {
    const activeEvents = (service.events ?? []).filter((event) => !appleEventEnded(event));
    const latestEvent = [...activeEvents].sort((left, right) => {
      const severityDifference =
        severityRank(normalizeAppleEventStatus(right)) - severityRank(normalizeAppleEventStatus(left));
      if (severityDifference !== 0) return severityDifference;

      return String(appleEventTimestamp(right) ?? "").localeCompare(String(appleEventTimestamp(left) ?? ""));
    })[0];
    const status = latestEvent ? normalizeAppleEventStatus(latestEvent) : "operational";

    return {
      id: appleServiceId(service.serviceName, index),
      label: service.serviceName ?? `Apple 服务 ${index + 1}`,
      status,
      statusCn: statusLabel(status),
      sourceName: service.redirectUrl ?? "",
      updatedAt: latestEvent ? appleEventTimestamp(latestEvent) : undefined,
      detail: latestEvent?.message
    } satisfies OfficialServiceStatus;
  });
  const activeServices = services.filter((service) => service.status !== "operational");
  const worst = [...activeServices].sort(
    (left, right) => severityRank(right.status) - severityRank(left.status),
  )[0];
  const hasMaintenanceNotice = Boolean(data.drpost);
  const overallIndicator = worst?.status ?? (hasMaintenanceNotice ? "maintenance" : "none");
  const updatedAt = services
    .map((service) => service.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const overallLabel = worst
    ? statusLabel(worst.status)
    : hasMaintenanceNotice
      ? data.drMessage ?? "维护公告"
      : "正常运行";

  return {
    id: "apple",
    label: "Apple",
    pageUrl: SOURCE_REGISTRY.officialStatus.apple.pageUrl,
    apiUrl: SOURCE_REGISTRY.officialStatus.apple.apiUrl,
    overallLabel,
    overallIndicator,
    updatedAt,
    sourceCount: services.length,
    services,
    error: hasMaintenanceNotice && data.drMessage ? data.drMessage : undefined
  };
}

export function buildUnavailableVendor(
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
    error: error instanceof Error ? error.message : String(error || "官方状态源不可用")
  };
}

export function buildBrowserRestrictedVendor(
  id: string,
  label: string,
  pageUrl: string,
  apiUrl: string,
  message: string,
) {
  return buildUnavailableVendor(id, label, pageUrl, apiUrl, message);
}
