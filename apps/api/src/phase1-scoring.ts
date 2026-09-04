import type {
  AiObservation,
  DnsObservation,
  Finding,
  FingerprintSnapshot,
  HttpObservation,
  IpRegionSignal,
  ModuleStatus,
  SessionReport,
  WebrtcObservation,
} from "./types.js";

const REGION_PROFILES: Array<
  Omit<
    IpRegionSignal,
    "source" | "inferenceMethod" | "baselineIp" | "observedHttpCount"
  >
> = [
  {
    countryCode: "US",
    countryName: "United States",
    inferredTimezone: "America/New_York",
    primaryLocale: "en-US",
  },
  {
    countryCode: "DE",
    countryName: "Germany",
    inferredTimezone: "Europe/Berlin",
    primaryLocale: "de-DE",
  },
  {
    countryCode: "JP",
    countryName: "Japan",
    inferredTimezone: "Asia/Tokyo",
    primaryLocale: "ja-JP",
  },
  {
    countryCode: "SG",
    countryName: "Singapore",
    inferredTimezone: "Asia/Singapore",
    primaryLocale: "en-SG",
  },
];

const TIMEZONE_OFFSET_MINUTES: Record<string, number> = {
  "America/New_York": 240,
  "Europe/Berlin": -120,
  "Asia/Tokyo": -540,
  "Asia/Singapore": -480,
};

const clampScore = (value: number): number => {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
};

const scoreToModuleStatus = (score: number): ModuleStatus["status"] => {
  if (score >= 30) {
    return "critical";
  }
  if (score > 0) {
    return "warning";
  }
  return "ok";
};

const scoreToRiskLevel = (
  score: number,
): SessionReport["summary"]["riskLevel"] => {
  if (score >= 80) {
    return "high_risk";
  }
  if (score >= 50) {
    return "suspicious";
  }
  if (score >= 20) {
    return "mildly_suspicious";
  }
  return "consistent";
};

const normalizeLocalePrefix = (
  localeLike: string | undefined,
): string | undefined => {
  if (!localeLike) {
    return undefined;
  }
  const sanitized = localeLike.trim();
  if (!sanitized) {
    return undefined;
  }
  const first = sanitized.split(",")[0];
  return first?.split("-")[0]?.toLowerCase();
};

const deterministicHash = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % 100_000;
  }
  return hash;
};

const selectIpBaseline = (
  httpObservations: HttpObservation[],
): { baselineIp?: string; uniqueIps: string[]; uniqueVantages: string[] } => {
  const ipCounts = new Map<string, number>();
  const vantageSet = new Set<string>();
  for (const observation of httpObservations) {
    if (observation.vantage) {
      vantageSet.add(observation.vantage);
    }
    if (observation.observedIp) {
      ipCounts.set(observation.observedIp, (ipCounts.get(observation.observedIp) ?? 0) + 1);
    }
  }

  let baselineIp: string | undefined;
  let baselineCount = -1;
  for (const [ip, count] of ipCounts.entries()) {
    if (count > baselineCount) {
      baselineIp = ip;
      baselineCount = count;
    }
  }

  return {
    baselineIp,
    uniqueIps: [...ipCounts.keys()],
    uniqueVantages: [...vantageSet.values()],
  };
};

const buildIpRegionSignal = (
  sessionId: string,
  httpObservations: HttpObservation[],
): IpRegionSignal => {
  const { baselineIp } = selectIpBaseline(httpObservations);

  if (baselineIp) {
    const profile = REGION_PROFILES[deterministicHash(baselineIp) % REGION_PROFILES.length]!;
    return {
      ...profile,
      source: "http_observation_inferred",
      inferenceMethod: "stable_ip_hash",
      baselineIp,
      observedHttpCount: httpObservations.length,
    };
  }

  const profile = REGION_PROFILES[deterministicHash(sessionId) % REGION_PROFILES.length]!;
  return {
    ...profile,
    source: "deterministic_placeholder",
    inferenceMethod: "session_hash",
    observedHttpCount: httpObservations.length,
  };
};

const isDnsAuthoritative = (observation: DnsObservation): boolean =>
  observation.source === "authoritative_ingest" && observation.simulated === false;

const buildDnsEvidenceObservations = (
  dnsObservations: DnsObservation[],
): DnsObservation[] => {
  const probeKey = (item: DnsObservation): string =>
    `${item.targetId}:${item.probeId ?? item.observedAt ?? "no-probe-id"}`;

  const authoritative = dnsObservations.filter(isDnsAuthoritative);
  const clientReports = dnsObservations.filter(
    (item) => item.source === "client_report",
  );
  const probeHits = dnsObservations.filter(
    (item) => item.source === "probe_endpoint_hit",
  );

  const clientReportKeys = new Set(clientReports.map(probeKey));
  const unmatchedProbeHits = probeHits.filter(
    (item) => !clientReportKeys.has(probeKey(item)),
  );

  return [...authoritative, ...clientReports, ...unmatchedProbeHits];
};

const isPrivateAddress = (address: string | undefined): boolean => {
  if (!address) {
    return false;
  }

  return (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address) ||
    address === "127.0.0.1" ||
    address === "::1" ||
    address.startsWith("fc") ||
    address.startsWith("fd")
  );
};

const isLiteralIp = (address: string | undefined): boolean =>
  typeof address === "string" &&
  (/^\d{1,3}(\.\d{1,3}){3}$/.test(address) || address.includes(":"));

export const runPhase1Scoring = (input: {
  sessionId: string;
  fingerprint?: FingerprintSnapshot;
  httpObservations: HttpObservation[];
  dnsObservations: DnsObservation[];
  aiObservations: AiObservation[];
  webrtcObservations: WebrtcObservation[];
}): SessionReport => {
  const {
    sessionId,
    fingerprint,
    httpObservations,
    dnsObservations,
    aiObservations,
    webrtcObservations,
  } = input;

  const findings: Finding[] = [];
  const moduleStatuses: ModuleStatus[] = [];
  let totalScore = 0;
  let httpScore = 0;
  let timezoneScore = 0;
  let localeScore = 0;
  let dnsScore = 0;
  let aiScore = 0;
  let webrtcScore = 0;

  const addFinding = (finding: Finding): void => {
    findings.push(finding);
    totalScore += finding.scoreDelta;
  };

  const ipRegionSignal = buildIpRegionSignal(sessionId, httpObservations);
  const { baselineIp, uniqueIps, uniqueVantages } = selectIpBaseline(httpObservations);

  if (httpObservations.length === 0) {
    addFinding({
      code: "HTTP_OBSERVATIONS_MISSING",
      severity: "medium",
      scoreDelta: 20,
      title: "No HTTP echo observations were collected",
      titleKey: "finding.http_observations_missing.title",
      description:
        "Phase 1 did not receive multi-source HTTP observations, so network baseline confidence is limited.",
      descriptionKey: "finding.http_observations_missing.description",
      evidence: {
        expectedVantages: ["ap-sg", "eu-fr", "us-va"],
      },
    });
    httpScore += 20;
  } else {
    if (uniqueVantages.length < 2) {
      addFinding({
        code: "HTTP_VANTAGE_COVERAGE_LOW",
        severity: "low",
        scoreDelta: 6,
        title: "HTTP observations were collected from limited vantage coverage",
        titleKey: "finding.http_vantage_coverage_low.title",
        description:
          "Fewer than two vantages reported observations, reducing confidence in multi-source consistency checks.",
        descriptionKey: "finding.http_vantage_coverage_low.description",
        evidence: {
          observedVantages: uniqueVantages,
          observedCount: httpObservations.length,
        },
      });
      httpScore += 6;
    }

    if (uniqueIps.length > 1) {
      addFinding({
        code: "HTTP_IP_INCONSISTENT_ACROSS_VANTAGES",
        severity: "high",
        scoreDelta: 32,
        title: "HTTP observations reported multiple public IP values",
        titleKey: "finding.http_ip_inconsistent.title",
        description:
          "Collected HTTP observations did not agree on a single observed IP, which can indicate route instability or leak conditions.",
        descriptionKey: "finding.http_ip_inconsistent.description",
        evidence: {
          uniqueIps,
          observedVantages: uniqueVantages,
        },
      });
      httpScore += 32;
    }
  }

  if (ipRegionSignal.source === "http_observation_inferred") {
    addFinding({
      code: "IP_REGION_INFERENCE_SIMULATED_FROM_HTTP",
      severity: "info",
      scoreDelta: 0,
      title: "IP region baseline uses observed HTTP data with simulated geo mapping",
      titleKey: "finding.ip_region_inference_simulated.title",
      description:
        "The baseline IP came from collected HTTP observations, but country/timezone mapping is still simulated in local MVP via a stable IP hash.",
      descriptionKey: "finding.ip_region_inference_simulated.description",
      evidence: {
        baselineIp: ipRegionSignal.baselineIp,
        inferenceMethod: ipRegionSignal.inferenceMethod,
      },
    });
  } else {
    addFinding({
      code: "IP_REGION_PLACEHOLDER_USED",
      severity: "info",
      scoreDelta: 0,
      title: "Fallback network baseline is still deterministic placeholder",
      titleKey: "finding.ip_region_placeholder_used.title",
      description:
        "No usable observed IP was available, so the report used the session-hash placeholder region baseline.",
      descriptionKey: "finding.ip_region_placeholder_used.description",
      evidence: {
        inferenceMethod: ipRegionSignal.inferenceMethod,
      },
    });
  }

  const confidenceLevel = ipRegionSignal.source === "http_observation_inferred" ? "medium" : "low";
  const timezoneMismatchPenalty = confidenceLevel === "medium" ? 20 : 10;
  const offsetMismatchPenalty = confidenceLevel === "medium" ? 12 : 6;
  const localeMismatchPenalty = confidenceLevel === "medium" ? 10 : 5;

  if (!fingerprint) {
    addFinding({
      code: "FINGERPRINT_MISSING",
      severity: "medium",
      scoreDelta: 24,
      title: "No fingerprint data was collected",
      titleKey: "finding.fingerprint_missing.title",
      description:
        "The browser did not submit baseline fingerprint data, so timezone and locale consistency checks could not run fully.",
      descriptionKey: "finding.fingerprint_missing.description",
      evidence: {
        requiredFields: [
          "timezone",
          "utcOffsetMinutes",
          "language",
          "acceptLanguage",
        ],
      },
    });
    timezoneScore += 12;
    localeScore += 12;
  } else {
    const expectedTimezone = ipRegionSignal.inferredTimezone;
    if (fingerprint.timezone && fingerprint.timezone !== expectedTimezone) {
      addFinding({
        code: "TIMEZONE_IP_MISMATCH",
        severity: confidenceLevel === "medium" ? "high" : "medium",
        scoreDelta: timezoneMismatchPenalty,
        title: "Browser timezone conflicts with inferred network baseline",
        titleKey: "finding.timezone_ip_mismatch.title",
        description:
          "Browser timezone differs from the baseline timezone inferred for this session's network profile.",
        descriptionKey: "finding.timezone_ip_mismatch.description",
        evidence: {
          browserTimezone: fingerprint.timezone,
          inferredTimezone: expectedTimezone,
          baselineSource: ipRegionSignal.source,
          inferenceMethod: ipRegionSignal.inferenceMethod,
        },
      });
      timezoneScore += timezoneMismatchPenalty;
    } else if (!fingerprint.timezone) {
      addFinding({
        code: "TIMEZONE_MISSING",
        severity: "medium",
        scoreDelta: 10,
        title: "Browser timezone was not provided",
        titleKey: "finding.timezone_missing.title",
        description:
          "Browser timezone is missing, which reduces confidence of timezone consistency checks.",
        descriptionKey: "finding.timezone_missing.description",
        evidence: {
          inferredTimezone: expectedTimezone,
        },
      });
      timezoneScore += 10;
    }

    const expectedOffset = TIMEZONE_OFFSET_MINUTES[expectedTimezone];
    if (
      typeof expectedOffset === "number" &&
      typeof fingerprint.utcOffsetMinutes === "number" &&
      fingerprint.utcOffsetMinutes !== expectedOffset
    ) {
      addFinding({
        code: "UTC_OFFSET_MISMATCH",
        severity: "medium",
        scoreDelta: offsetMismatchPenalty,
        title: "UTC offset conflicts with inferred timezone",
        titleKey: "finding.utc_offset_mismatch.title",
        description:
          "The browser UTC offset does not match the offset expected for the inferred timezone baseline.",
        descriptionKey: "finding.utc_offset_mismatch.description",
        evidence: {
          utcOffsetMinutes: fingerprint.utcOffsetMinutes,
          expectedUtcOffsetMinutes: expectedOffset,
          inferredTimezone: expectedTimezone,
          baselineSource: ipRegionSignal.source,
        },
      });
      timezoneScore += offsetMismatchPenalty;
    }

    const expectedLocalePrefix = ipRegionSignal.primaryLocale
      .split("-")[0]
      ?.toLowerCase();
    const browserLocalePrefix = normalizeLocalePrefix(fingerprint.language);
    const acceptLanguagePrefix = normalizeLocalePrefix(fingerprint.acceptLanguage);

    if (browserLocalePrefix && browserLocalePrefix !== expectedLocalePrefix) {
      addFinding({
        code: "BROWSER_LOCALE_IP_MISMATCH",
        severity: "medium",
        scoreDelta: localeMismatchPenalty,
        title: "Browser language conflicts with inferred network baseline",
        titleKey: "finding.browser_locale_ip_mismatch.title",
        description:
          "The browser primary language does not align with the expected locale for this network baseline.",
        descriptionKey: "finding.browser_locale_ip_mismatch.description",
        evidence: {
          browserLanguage: fingerprint.language,
          inferredPrimaryLocale: ipRegionSignal.primaryLocale,
          baselineSource: ipRegionSignal.source,
        },
      });
      localeScore += localeMismatchPenalty;
    }

    if (acceptLanguagePrefix && acceptLanguagePrefix !== expectedLocalePrefix) {
      addFinding({
        code: "ACCEPT_LANGUAGE_IP_MISMATCH",
        severity: "medium",
        scoreDelta: localeMismatchPenalty,
        title: "Accept-Language conflicts with inferred network baseline",
        titleKey: "finding.accept_language_ip_mismatch.title",
        description:
          "The HTTP Accept-Language header does not align with the expected locale for this network baseline.",
        descriptionKey: "finding.accept_language_ip_mismatch.description",
        evidence: {
          acceptLanguage: fingerprint.acceptLanguage,
          inferredPrimaryLocale: ipRegionSignal.primaryLocale,
          baselineSource: ipRegionSignal.source,
        },
      });
      localeScore += localeMismatchPenalty;
    }
  }

  const authoritativeDns = dnsObservations.filter(isDnsAuthoritative);
  const clientDnsFailures = dnsObservations.filter(
    (item) =>
      item.source === "client_report" &&
      (item.status === "error" || item.status === "timeout"),
  );
  const dnsEvidenceObservations = buildDnsEvidenceObservations(dnsObservations);
  const reachableAi = aiObservations.filter((item) => item.status === "reachable");
  const failedAi = aiObservations.filter(
    (item) => item.status === "blocked" || item.status === "timeout" || item.status === "error",
  );
  const publicWebrtcObservations = webrtcObservations.filter(
    (item) => item.address && isLiteralIp(item.address) && !isPrivateAddress(item.address),
  );
  const webrtcAddresses = new Set(
    publicWebrtcObservations
      .map((item) => item.address)
      .filter((value): value is string => typeof value === "string"),
  );

  if (clientDnsFailures.length > 0) {
    const penalty = Math.min(12, clientDnsFailures.length * 3);
    addFinding({
      code: "DNS_PROBE_FAILURES_DETECTED",
      severity: "low",
      scoreDelta: penalty,
      title: "Some DNS probe attempts failed at the client layer",
      titleKey: "finding.dns_probe_failures_detected.title",
      description:
        "Client-reported DNS probe attempts include error or timeout results. This is operational signal only and not resolver-leak proof.",
      descriptionKey: "finding.dns_probe_failures_detected.description",
      evidence: {
        failureCount: clientDnsFailures.length,
        samples: clientDnsFailures.slice(0, 3).map((item) => ({
          targetId: item.targetId,
          status: item.status,
          error: item.error,
        })),
      },
    });
    dnsScore += penalty;
  }

  if (authoritativeDns.length > 0) {
    const resolverIps = new Set<string>();
    const resolverCountries = new Set<string>();
    for (const item of authoritativeDns) {
      if (item.resolverIp) {
        resolverIps.add(item.resolverIp);
      }
      if (item.resolverCountry) {
        resolverCountries.add(item.resolverCountry);
      }
    }

    if (resolverIps.size > 1) {
      addFinding({
        code: "DNS_MULTI_RESOLVER_OBSERVED",
        severity: "medium",
        scoreDelta: 12,
        title: "Multiple DNS resolvers were observed",
        titleKey: "finding.dns_multi_resolver_observed.title",
        description:
          "Authoritative DNS ingest reported more than one resolver IP for this session.",
        descriptionKey: "finding.dns_multi_resolver_observed.description",
        evidence: {
          resolverIps: [...resolverIps],
        },
      });
      dnsScore += 12;
    }

    if (
      ipRegionSignal.countryCode &&
      resolverCountries.size > 0 &&
      !resolverCountries.has(ipRegionSignal.countryCode)
    ) {
      addFinding({
        code: "DNS_RESOLVER_COUNTRY_MISMATCH",
        severity: "medium",
        scoreDelta: 10,
        title: "DNS resolver country differs from network baseline country",
        titleKey: "finding.dns_resolver_country_mismatch.title",
        description:
          "Resolver-country evidence from authoritative ingest diverges from the current network baseline country.",
        descriptionKey: "finding.dns_resolver_country_mismatch.description",
        evidence: {
          resolverCountries: [...resolverCountries],
          baselineCountry: ipRegionSignal.countryCode,
          baselineSource: ipRegionSignal.source,
        },
      });
      dnsScore += 10;
    }
  }

  const boundedScore = clampScore(totalScore);
  const riskLevel = scoreToRiskLevel(boundedScore);
  const headline =
    findings.filter((item) => item.scoreDelta > 0).length === 0
      ? "No inconsistency signals were detected in current Phase 1 checks."
      : `Phase 1 detected ${
          findings.filter((item) => item.scoreDelta > 0).length
        } scored inconsistency signal(s).`;
  const scoredFindingCount = findings.filter((item) => item.scoreDelta > 0).length;

  moduleStatuses.push({
    module: "HTTP observation consistency",
    moduleKey: "module.http_observation_consistency",
    status: scoreToModuleStatus(httpScore),
    scoreDelta: httpScore,
    summary:
      httpObservations.length === 0
        ? "No HTTP observations were collected."
        : uniqueIps.length <= 1
          ? `Collected ${httpObservations.length} HTTP observations with consistent observed IP values.`
          : `Collected ${httpObservations.length} HTTP observations with divergent observed IP values.`,
    summaryKey:
      httpObservations.length === 0
        ? "module.http_observation_consistency.summary.none"
        : uniqueIps.length <= 1
          ? "module.http_observation_consistency.summary.consistent"
          : "module.http_observation_consistency.summary.divergent",
    summaryParams:
      httpObservations.length === 0 ? undefined : { count: httpObservations.length },
  });

  moduleStatuses.push({
    module: "IP region baseline",
    moduleKey: "module.ip_region_baseline",
    status: "info",
    scoreDelta: 0,
    summary:
      ipRegionSignal.source === "http_observation_inferred"
        ? "Baseline IP is observed from HTTP collection; country/timezone mapping remains simulated via stable IP hash in local MVP."
        : "HTTP baseline was unavailable; session-hash placeholder baseline is used.",
    summaryKey:
      ipRegionSignal.source === "http_observation_inferred"
        ? "module.ip_region_baseline.summary.http_inferred"
        : "module.ip_region_baseline.summary.placeholder",
  });

  moduleStatuses.push({
    module: "Timezone consistency",
    moduleKey: "module.timezone_consistency",
    status: scoreToModuleStatus(timezoneScore),
    scoreDelta: timezoneScore,
    summary:
      timezoneScore === 0
        ? "Timezone signals are consistent with the current baseline."
        : "Timezone signals contain mismatches against the current baseline.",
    summaryKey:
      timezoneScore === 0
        ? "module.timezone_consistency.summary.consistent"
        : "module.timezone_consistency.summary.mismatch",
  });

  moduleStatuses.push({
    module: "Locale consistency",
    moduleKey: "module.locale_consistency",
    status: scoreToModuleStatus(localeScore),
    scoreDelta: localeScore,
    summary:
      localeScore === 0
        ? "Locale signals are consistent with the current baseline."
        : "Locale signals diverge from the current baseline.",
    summaryKey:
      localeScore === 0
        ? "module.locale_consistency.summary.consistent"
        : "module.locale_consistency.summary.mismatch",
  });

  moduleStatuses.push({
    module: "DNS observation pipeline",
    moduleKey: "module.dns_observation_pipeline",
    status: authoritativeDns.length > 0 ? scoreToModuleStatus(dnsScore) : "info",
    scoreDelta: dnsScore,
    summary:
      authoritativeDns.length > 0
        ? "Authoritative DNS ingest observations are present."
        : "Only local MVP probe-level DNS signals are present; resolver inference is not directly observed.",
    summaryKey:
      authoritativeDns.length > 0
        ? "module.dns_observation_pipeline.summary.authoritative"
        : "module.dns_observation_pipeline.summary.simulated",
  });

  moduleStatuses.push({
    module: "AI reachability",
    moduleKey: "module.ai_reachability",
    status:
      aiObservations.length === 0
        ? "info"
        : failedAi.length === 0
          ? "ok"
          : "warning",
    scoreDelta: aiScore,
    summary:
      aiObservations.length === 0
        ? "No AI reachability probes were collected."
        : `${reachableAi.length}/${aiObservations.length} AI targets were reachable from the browser environment.`,
    summaryKey:
      aiObservations.length === 0
        ? "module.ai_reachability.summary.none"
        : "module.ai_reachability.summary.count",
    summaryParams:
      aiObservations.length === 0
        ? undefined
        : { reachable: reachableAi.length, total: aiObservations.length },
  });

  if (publicWebrtcObservations.length > 0 && baselineIp && !webrtcAddresses.has(baselineIp)) {
    addFinding({
      code: "WEBRTC_PUBLIC_IP_DIFFERENT",
      severity: "high",
      scoreDelta: 24,
      title: "WebRTC surface exposes a different public IP",
      description:
        "Collected WebRTC candidates include a public-facing address that differs from the current HTTP baseline.",
      evidence: {
        baselineIp,
        webrtcPublicAddresses: [...webrtcAddresses],
      },
    });
    webrtcScore += 24;
  }

  moduleStatuses.push({
    module: "WebRTC surface",
    status:
      webrtcObservations.length === 0
        ? "info"
        : webrtcScore > 0
          ? "warning"
          : "ok",
    scoreDelta: webrtcScore,
    summary:
      webrtcObservations.length === 0
        ? "No WebRTC observations were collected yet."
        : publicWebrtcObservations.length > 0
          ? `Collected ${webrtcObservations.length} WebRTC candidates with ${publicWebrtcObservations.length} public-facing path(s).`
          : `Collected ${webrtcObservations.length} WebRTC candidates without public-facing leakage.`,
  });

  return {
    sessionId,
    summary: {
      totalScore: boundedScore,
      riskLevel,
      createdAt: new Date().toISOString(),
      headline,
      headlineKey:
        scoredFindingCount === 0
          ? "summary.headline.none"
          : "summary.headline.count",
      headlineParams:
        scoredFindingCount === 0 ? undefined : { count: scoredFindingCount },
    },
    moduleStatuses,
    findings,
    evidence: {
      ipRegionSignal: {
        ...ipRegionSignal,
        baselineIp: baselineIp ?? ipRegionSignal.baselineIp,
      },
      fingerprint,
      httpObservations,
      dnsObservations: dnsEvidenceObservations,
      aiObservations,
      webrtcObservations,
      dnsCapability: {
        mode: authoritativeDns.length > 0 ? "authoritative" : "simulated_http_probe",
        summary:
          authoritativeDns.length > 0
            ? "Resolver-side DNS observations were ingested through authoritative contract."
            : "Local MVP currently records browser-triggered probe hits/client reports, not true authoritative resolver inference.",
        summaryKey:
          authoritativeDns.length > 0
            ? "dns_capability.authoritative"
            : "dns_capability.simulated_http_probe",
      },
    },
  };
};
