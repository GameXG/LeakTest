export type Lang = "en" | "zh";

export const languageStorageKey = "leaktest-lang";

export const uiText = {
  en: {
    brand: "LeakTest",
    toggle: "中文",
    navHome: "Home",
    navRun: "Run",
    navAi: "AI",
    navIp: "IP",
    navDns: "DNS",
    navWebrtc: "WebRTC",
    navStatus: "Status",
    homeTitle: "Leak Detection MVP",
    homeBody:
      "Phase 1 validates core consistency signals across your browser and network session. It starts a test session, collects baseline browser fingerprint data, and generates a report.",
    homeLead:
      "A browser-native leak diagnostics workspace for AI access, proxy exit identity, DNS path behavior, and browser consistency.",
    homeHeroTag: "For AI workflows, proxy validation, and browser environment audits",
    startDetection: "Start Detection",
    apiBase: "API Base",
    homeCollectsTitle: "Detection surface",
    homeCollectsBody:
      "Multi-source HTTP exit identity, external IP probes, DNS path simulation, browser timezone and language consistency, and AI service reachability.",
    homeFlowTitle: "How it works",
    homeFlowBody:
      "Run a live browser session, collect network and browser signals, compare local and external exits, probe AI services, and render a structured report.",
    homeModulesTitle: "Core modules",
    homeModulesBody: "A single report built from network, browser, and service observations.",
    homeModuleIp: "IP and exit identity",
    homeModuleDns: "DNS leak diagnostics",
    homeModuleAi: "AI service matrix",
    homeModuleEnv: "Environment consistency",
    homeModuleRisk: "Readable findings",
    homeStartTitle: "Run a fresh session",
    homeStartBody:
      "The run page executes HTTP, DNS, and AI probes from your current browser environment and produces a new diagnosis report.",
    aiPageTitle: "AI Access Diagnostics",
    aiPageLead:
      "A dedicated diagnostics page for AI reachability, source identity, service matrix, and environment readiness.",
    aiPageBody:
      "Use this workflow when your focus is AI tools and service access rather than a generic browser leak audit.",
    aiPageFeatureTitle: "What the AI page checks",
    aiPageFeatureBody:
      "Exit identity, external probe drift, Claude-specific reachability, AI service matrix, DNS path context, and browser environment consistency.",
    aiPageActionTitle: "Run AI diagnostics",
    aiPageActionBody:
      "Start a fresh session to probe ChatGPT, Claude, Gemini, Copilot, and Perplexity from your current browser environment.",
    ipPageTitle: "IP and Exit Identity",
    ipPageLead:
      "A dedicated page for comparing local exits, external probes, and the network identity used by your browser session.",
    ipPageBody:
      "Use this page when you want to validate proxy exits, external IP drift, and whether multiple probes agree on your current source identity.",
    ipPageFeatureTitle: "What the IP page checks",
    ipPageFeatureBody:
      "Local HTTP exits, external IP probes, inferred source identity, and output consistency between internal and external views.",
    ipPageActionTitle: "Run IP diagnostics",
    ipPageActionBody:
      "Launch a new session to compare your current exit path across local and external probes.",
    dnsPageTitle: "DNS Leak Diagnostics",
    dnsPageLead:
      "A dedicated page for DNS path checks, probe-level DNS signals, and resolver-side expansion planning.",
    dnsPageBody:
      "Use this page when your main concern is whether DNS behavior diverges from your HTTP exit path or local expectations.",
    dnsPageFeatureTitle: "What the DNS page checks",
    dnsPageFeatureBody:
      "Probe-level DNS hits, simulated resolver paths, future authoritative ingest support, and alignment with the current network baseline.",
    dnsPageActionTitle: "Run DNS diagnostics",
    dnsPageActionBody:
      "Launch a new session to trigger DNS probes and compare them with the rest of your network profile.",
    webrtcPageTitle: "WebRTC and UDP Diagnostics",
    webrtcPageLead:
      "A dedicated page for WebRTC surface checks, UDP leak scenarios, and local interface exposure planning.",
    webrtcPageBody:
      "Use this page when your main concern is whether browser networking features reveal local or alternate network paths beyond the primary HTTP exit.",
    webrtcPageFeatureTitle: "What the WebRTC page checks",
    webrtcPageFeatureBody:
      "Candidate visibility, UDP path behavior, local interface exposure, and alignment with the current source identity.",
    webrtcPageActionTitle: "Run WebRTC diagnostics",
    webrtcPageActionBody:
      "Launch a new session to compare future WebRTC and UDP observations with your current exit identity and DNS profile.",
    webrtcPageResultTitle: "WebRTC candidate summary",
    webrtcCandidates: "WebRTC candidates",
    publicPaths: "Public paths",
    statusPageTitle: "Service and Probe Status",
    statusPageLead:
      "A control-plane page for the diagnostics stack, AI targets, and current observation surfaces exposed by LeakTest.",
    statusPageBody:
      "Use this page to understand what the current environment can check now, what is simulated, and what still depends on external deployment.",
    statusPageFeatureTitle: "Current service surfaces",
    statusPageFeatureBody:
      "HTTP exits, Cloudflare Trace, DNS simulation, AI reachability probes, and upcoming WebRTC and authoritative DNS expansion.",
    statusPageActionTitle: "Open live diagnostics",
    statusPageActionBody:
      "Jump into a fresh session when you want to verify the current environment against these service surfaces.",
    runTitle: "Run Detection Collector",
    runBody:
      "The run flow collects baseline browser signals, probes multi-region HTTP echo nodes, triggers DNS lookups, then submits all results for report generation.",
    runCollection: "Run Collection",
    running: "Running...",
    backHome: "Back Home",
    progress: "Progress",
    createSession: "Create session",
    collectFingerprint: "Collect fingerprint",
    httpObservation: "HTTP observation",
    dnsProbeTrigger: "DNS probe trigger",
    aiProbe: "AI reachability probe",
    submitHttp: "Submit HTTP observations",
    submitDns: "Submit DNS observations",
    submitAi: "Submit AI observations",
    finalize: "Finalize",
    httpNodeStatus: "HTTP Node Status",
    dnsProbeStatus: "DNS Probe Status",
    aiProbeStatus: "AI Reachability Status",
    webrtcProbeStatus: "WebRTC Surface Status",
    session: "Session",
    submittedCollectorPayload: "Submitted Collector Payload",
    idle: "idle",
    done: "done",
    error: "error",
    reportTitle: "Detection Report",
    runAgain: "Run Again",
    summary: "Summary",
    reportIntro:
      "A product-style diagnosis view for AI access, source identity, service reachability, and environment consistency.",
    totalScore: "Total score",
    riskLevel: "Risk level",
    generated: "Generated",
    detectedAt: "Detected at",
    aiProfile: "AI Access Profile",
    claudeChecks: "Claude checks",
    trustScore: "Trust score",
    sourceIdentity: "Source identity",
    aiMatrix: "AI service matrix",
    environment: "Environment",
    networkChecks: "Network checks",
    serviceReachability: "Service reachability",
    currentExit: "Current exit",
    externalProbe: "External probe",
    aiSource: "AI source",
    localBaseline: "Local baseline",
    statusText: "Status",
    browser: "Browser",
    timezoneStatus: "Timezone status",
    languageStatus: "Language status",
    dnsStatus: "DNS status",
    httpStatusTitle: "HTTP status",
    riskSummary: "Risk summary",
    confidence: "Confidence",
    reachabilityGood: "Good",
    reachabilitySlow: "Slow",
    reachabilityBlocked: "Blocked",
    simulatedProbe: "Simulated probe",
    authoritativeMode: "Authoritative ingest",
    serviceHttp: "HTTP exits",
    serviceCloudflare: "Cloudflare Trace",
    serviceDns: "DNS simulation",
    serviceAi: "AI probes",
    serviceWebrtc: "WebRTC",
    serviceAuthoritative: "Authoritative DNS ingest",
    modules: "Modules",
    noModuleStatuses: "No module statuses available yet.",
    moduleDetails: "View module details",
    noModuleDetails: "No detailed scenarios are available for this module yet.",
    findings: "Findings",
    noFindings: "No findings yet.",
    rawEvidence: "Raw Evidence",
    findingDetails: "View details",
    findingEvidence: "Evidence",
    rawJson: "Show raw JSON",
    target: "Target",
    provider: "Provider",
    source: "Source",
    region: "Region",
    observedIp: "Observed IP",
    latency: "Latency",
    httpStatus: "HTTP status",
    purpose: "Purpose",
    browserTimezone: "Browser timezone",
    utcOffset: "UTC offset",
    inferredTimezone: "Inferred timezone",
    browserLanguage: "Browser language",
    acceptLanguage: "Accept-Language",
    inferredLocale: "Inferred locale",
    baselineIp: "Baseline IP",
    sourceIp: "Source IP",
    sourceCountry: "Source country",
    inferenceSource: "Inference source",
    observedCount: "Observed count",
    loadingReport: "Loading report...",
    failedToLoadReport: "Failed to load report",
    noRecentSession: "No recent session is available yet.",
    openLatestReport: "Open latest report",
    runningDetection: "Running diagnostics...",
    ipCardsTitle: "Exit identity cards",
    ipConsistencyTitle: "IP consistency",
    ipConsistencyBody: "Compare your local exit, external probe, and inferred AI source identity.",
    uniqueIpCount: "Unique IP count",
    observedSources: "Observed sources",
    inferredCountry: "Inferred country",
    httpObservations: "HTTP observations",
    dnsObservations: "DNS observations",
    aiObservations: "AI observations",
    noEvidence:
      "No HTTP, DNS, or AI probe evidence is present in this report payload yet."
  },
  zh: {
    brand: "LeakTest",
    toggle: "EN",
    navHome: "首页",
    navRun: "运行",
    navAi: "AI",
    navIp: "IP",
    navDns: "DNS",
    navWebrtc: "WebRTC",
    navStatus: "状态",
    homeTitle: "泄露检测 MVP",
    homeBody:
      "一期用于校验浏览器与网络会话中的核心一致性信号。它会创建测试会话、采集基础浏览器指纹，并生成一份检测报告。",
    homeLead: "一个浏览器原生的泄露诊断工作台，用于检测 AI 访问、代理出口身份、DNS 路径行为以及浏览器环境一致性。",
    homeHeroTag: "用于 AI 工作流、代理验证与浏览器环境审计",
    startDetection: "开始检测",
    apiBase: "API 地址",
    homeCollectsTitle: "检测面",
    homeCollectsBody:
      "多源 HTTP 出口身份、外部 IP 探针、DNS 路径模拟、浏览器时区与语言一致性，以及 AI 服务可达性。",
    homeFlowTitle: "工作方式",
    homeFlowBody:
      "执行一次实时浏览器会话，采集网络与浏览器信号，对比本地与外部出口，探测 AI 服务，并生成结构化报告。",
    homeModulesTitle: "核心模块",
    homeModulesBody: "把网络、浏览器与服务探测整合成一份统一报告。",
    homeModuleIp: "IP 与出口身份",
    homeModuleDns: "DNS 泄露诊断",
    homeModuleAi: "AI 服务矩阵",
    homeModuleEnv: "环境一致性",
    homeModuleRisk: "可读发现项",
    homeStartTitle: "开始新的检测会话",
    homeStartBody:
      "进入运行页后，会基于你当前浏览器环境执行 HTTP、DNS 与 AI 探测，并生成一份新的诊断报告。",
    aiPageTitle: "AI 访问诊断",
    aiPageLead:
      "一个专门面向 AI 服务访问的诊断页面，用于集中查看源身份、服务矩阵、可达性和环境准备情况。",
    aiPageBody:
      "当你的重点是 AI 工具和服务访问，而不是通用浏览器泄露审计时，直接使用这个专题页。",
    aiPageFeatureTitle: "AI 专题页检测内容",
    aiPageFeatureBody:
      "出口身份、外部探针漂移、Claude 专项可达性、AI 服务矩阵、DNS 路径上下文，以及浏览器环境一致性。",
    aiPageActionTitle: "开始 AI 诊断",
    aiPageActionBody:
      "发起新的检测会话，针对当前浏览器环境探测 ChatGPT、Claude、Gemini、Copilot 和 Perplexity。",
    ipPageTitle: "IP 与出口身份",
    ipPageLead:
      "一个专门用于比较本地出口、外部探针与当前浏览器会话网络身份的专题页。",
    ipPageBody:
      "当你的重点是验证代理出口、外部 IP 漂移，以及多个探针对当前出口身份是否一致时，使用这个页面。",
    ipPageFeatureTitle: "IP 专题页检测内容",
    ipPageFeatureBody:
      "本地 HTTP 出口、外部 IP 探针、推断访问源身份，以及内部与外部观测之间的一致性。",
    ipPageActionTitle: "开始 IP 诊断",
    ipPageActionBody:
      "发起新的检测会话，对比当前出口路径在本地与外部探针中的表现。",
    dnsPageTitle: "DNS 泄露诊断",
    dnsPageLead:
      "一个专门用于查看 DNS 路径、探针级 DNS 信号，以及后续权威解析器接入规划的专题页。",
    dnsPageBody:
      "当你的重点是 DNS 行为是否与 HTTP 出口路径或本地预期不一致时，直接使用这个页面。",
    dnsPageFeatureTitle: "DNS 专题页检测内容",
    dnsPageFeatureBody:
      "探针级 DNS 命中、模拟解析路径、后续权威接入支持，以及与当前网络基线的一致性。",
    dnsPageActionTitle: "开始 DNS 诊断",
    dnsPageActionBody:
      "发起新的检测会话，触发 DNS 探测并与当前网络画像进行对比。",
    webrtcPageTitle: "WebRTC 与 UDP 诊断",
    webrtcPageLead:
      "一个专门用于查看 WebRTC 表面、UDP 泄露场景以及本地接口暴露风险的专题页。",
    webrtcPageBody:
      "当你的重点是浏览器网络能力是否暴露了主 HTTP 出口之外的本地或替代网络路径时，使用这个页面。",
    webrtcPageFeatureTitle: "WebRTC 专题页检测内容",
    webrtcPageFeatureBody:
      "候选地址可见性、UDP 路径行为、本地接口暴露，以及与当前访问源身份的一致性。",
    webrtcPageActionTitle: "开始 WebRTC 诊断",
    webrtcPageActionBody:
      "发起新的检测会话，为后续 WebRTC 与 UDP 观测和当前出口身份、DNS 画像做对照。",
    webrtcPageResultTitle: "WebRTC 候选摘要",
    webrtcCandidates: "WebRTC 候选数",
    publicPaths: "公网路径数",
    statusPageTitle: "服务与探测状态",
    statusPageLead:
      "一个面向诊断栈、AI 目标和当前 LeakTest 观测面的控制页。",
    statusPageBody:
      "在这里可以直接查看当前环境能检测什么、哪些是模拟能力、以及哪些还依赖外部部署。",
    statusPageFeatureTitle: "当前服务能力",
    statusPageFeatureBody:
      "HTTP 出口、Cloudflare Trace、DNS 模拟链路、AI 可达性探测，以及后续 WebRTC 与权威 DNS 扩展。",
    statusPageActionTitle: "进入实时诊断",
    statusPageActionBody:
      "如果你想验证当前环境在这些服务面上的表现，直接开始新的检测会话。",
    runTitle: "运行检测采集器",
    runBody:
      "此流程会采集基础浏览器信号、探测多区域 HTTP Echo 节点、触发 DNS 查询，再统一提交结果生成报告。",
    runCollection: "执行检测",
    running: "执行中...",
    backHome: "返回首页",
    progress: "进度",
    createSession: "创建会话",
    collectFingerprint: "采集指纹",
    httpObservation: "HTTP 观测",
    dnsProbeTrigger: "DNS 探测触发",
    aiProbe: "AI 可达性探测",
    submitHttp: "提交 HTTP 观测",
    submitDns: "提交 DNS 观测",
    submitAi: "提交 AI 观测",
    finalize: "生成报告",
    httpNodeStatus: "HTTP 节点状态",
    dnsProbeStatus: "DNS 探测状态",
    aiProbeStatus: "AI 可达性状态",
    webrtcProbeStatus: "WebRTC 表面状态",
    session: "会话信息",
    submittedCollectorPayload: "已提交采集载荷",
    idle: "未开始",
    done: "完成",
    error: "失败",
    reportTitle: "检测报告",
    runAgain: "重新检测",
    summary: "总览",
    reportIntro: "面向非技术用户的 AI 访问诊断视图，集中展示出口身份、服务可达性与环境一致性。",
    totalScore: "总分",
    riskLevel: "风险等级",
    generated: "生成时间",
    detectedAt: "检测时间",
    aiProfile: "AI 访问画像",
    claudeChecks: "Claude 专项检测",
    trustScore: "可信度评分",
    sourceIdentity: "访问源身份",
    aiMatrix: "AI 服务矩阵",
    environment: "环境信息",
    networkChecks: "网络检查",
    serviceReachability: "服务可达性",
    currentExit: "当前出口",
    externalProbe: "外部探针",
    aiSource: "AI 访问源",
    localBaseline: "本地基线",
    statusText: "状态",
    browser: "浏览器",
    timezoneStatus: "时区状态",
    languageStatus: "语言状态",
    dnsStatus: "DNS 状态",
    httpStatusTitle: "HTTP 状态",
    riskSummary: "风险摘要",
    confidence: "可信度",
    reachabilityGood: "良好",
    reachabilitySlow: "较慢",
    reachabilityBlocked: "受限",
    simulatedProbe: "模拟探测",
    authoritativeMode: "权威接入",
    serviceHttp: "HTTP 出口",
    serviceCloudflare: "Cloudflare Trace",
    serviceDns: "DNS 模拟链路",
    serviceAi: "AI 探测",
    serviceWebrtc: "WebRTC",
    serviceAuthoritative: "权威 DNS 接入",
    modules: "模块结果",
    noModuleStatuses: "当前还没有模块状态。",
    moduleDetails: "展开模块详情",
    noModuleDetails: "当前模块还没有可展示的详细场景。",
    findings: "发现项",
    noFindings: "当前没有发现项。",
    rawEvidence: "原始证据",
    findingDetails: "展开详情",
    findingEvidence: "证据",
    rawJson: "查看原始 JSON",
    target: "目标",
    provider: "提供方",
    source: "来源",
    region: "区域",
    observedIp: "观测 IP",
    latency: "耗时",
    httpStatus: "HTTP 状态",
    purpose: "用途",
    browserTimezone: "浏览器时区",
    utcOffset: "UTC 偏移",
    inferredTimezone: "推断时区",
    browserLanguage: "浏览器语言",
    acceptLanguage: "Accept-Language",
    inferredLocale: "推断语言环境",
    baselineIp: "基线 IP",
    sourceIp: "访问源 IP",
    sourceCountry: "访问源国家",
    inferenceSource: "推断来源",
    observedCount: "观测数量",
    loadingReport: "正在加载报告...",
    failedToLoadReport: "加载报告失败",
    noRecentSession: "当前还没有可用的最近检测会话。",
    openLatestReport: "打开最近报告",
    runningDetection: "正在执行检测...",
    ipCardsTitle: "出口身份卡",
    ipConsistencyTitle: "IP 一致性",
    ipConsistencyBody: "对比本地出口、外部探针与推断出的 AI 访问源身份。",
    uniqueIpCount: "不同 IP 数量",
    observedSources: "观测来源",
    inferredCountry: "推断国家",
    httpObservations: "HTTP 观测数",
    dnsObservations: "DNS 观测数",
    aiObservations: "AI 观测数",
    noEvidence: "当前报告里还没有 HTTP、DNS 或 AI 相关证据。"
  }
} as const;

const reportKeyText = {
  en: {
    "summary.headline.none": "No inconsistency signals were detected in current Phase 1 checks.",
    "summary.headline.count": "Phase 1 detected {count} scored inconsistency signal(s).",
    "finding.http_observations_missing.title": "No HTTP echo observations were collected",
    "finding.http_observations_missing.description":
      "Phase 1 did not receive multi-source HTTP observations, so network baseline confidence is limited.",
    "finding.http_vantage_coverage_low.title":
      "HTTP observations were collected from limited vantage coverage",
    "finding.http_vantage_coverage_low.description":
      "Fewer than two vantages reported observations, reducing confidence in multi-source consistency checks.",
    "finding.http_ip_inconsistent.title": "HTTP observations reported multiple public IP values",
    "finding.http_ip_inconsistent.description":
      "Collected HTTP observations did not agree on a single observed IP, which can indicate route instability or leak conditions.",
    "finding.ip_region_inference_simulated.title":
      "IP region baseline uses observed HTTP data with simulated geo mapping",
    "finding.ip_region_inference_simulated.description":
      "The baseline IP came from collected HTTP observations, but country/timezone mapping is still simulated in local MVP via a stable IP hash.",
    "finding.ip_region_placeholder_used.title":
      "Fallback network baseline is still deterministic placeholder",
    "finding.ip_region_placeholder_used.description":
      "No usable observed IP was available, so the report used the session-hash placeholder region baseline.",
    "finding.fingerprint_missing.title": "No fingerprint data was collected",
    "finding.fingerprint_missing.description":
      "The browser did not submit baseline fingerprint data, so timezone and locale consistency checks could not run fully.",
    "finding.timezone_ip_mismatch.title":
      "Browser timezone conflicts with inferred network baseline",
    "finding.timezone_ip_mismatch.description":
      "Browser timezone differs from the baseline timezone inferred for this session's network profile.",
    "finding.timezone_missing.title": "Browser timezone was not provided",
    "finding.timezone_missing.description":
      "Browser timezone is missing, which reduces confidence of timezone consistency checks.",
    "finding.utc_offset_mismatch.title": "UTC offset conflicts with inferred timezone",
    "finding.utc_offset_mismatch.description":
      "The browser UTC offset does not match the offset expected for the inferred timezone baseline.",
    "finding.browser_locale_ip_mismatch.title":
      "Browser language conflicts with inferred network baseline",
    "finding.browser_locale_ip_mismatch.description":
      "The browser primary language does not align with the expected locale for this network baseline.",
    "finding.accept_language_ip_mismatch.title":
      "Accept-Language conflicts with inferred network baseline",
    "finding.accept_language_ip_mismatch.description":
      "The HTTP Accept-Language header does not align with the expected locale for this network baseline.",
    "finding.dns_probe_failures_detected.title":
      "Some DNS probe attempts failed at the client layer",
    "finding.dns_probe_failures_detected.description":
      "Client-reported DNS probe attempts include error or timeout results. This is operational signal only and not resolver-leak proof.",
    "finding.dns_multi_resolver_observed.title": "Multiple DNS resolvers were observed",
    "finding.dns_multi_resolver_observed.description":
      "Authoritative DNS ingest reported more than one resolver IP for this session.",
    "finding.dns_resolver_country_mismatch.title":
      "DNS resolver country differs from network baseline country",
    "finding.dns_resolver_country_mismatch.description":
      "Resolver-country evidence from authoritative ingest diverges from the current network baseline country.",
    "finding.webrtc_public_ip_different.title":
      "WebRTC surface exposes a different public IP",
    "finding.webrtc_public_ip_different.description":
      "Collected WebRTC candidates include a public-facing address that differs from the current HTTP baseline.",
    "module.http_observation_consistency": "HTTP observation consistency",
    "module.http_observation_consistency.summary.none": "No HTTP observations were collected.",
    "module.http_observation_consistency.summary.consistent":
      "Collected {count} HTTP observations with consistent observed IP values.",
    "module.http_observation_consistency.summary.divergent":
      "Collected {count} HTTP observations with divergent observed IP values.",
    "module.ip_region_baseline": "IP region baseline",
    "module.ip_region_baseline.summary.http_inferred":
      "Baseline IP is observed from HTTP collection; country/timezone mapping remains simulated via stable IP hash in local MVP.",
    "module.ip_region_baseline.summary.placeholder":
      "HTTP baseline was unavailable; session-hash placeholder baseline is used.",
    "module.timezone_consistency": "Timezone consistency",
    "module.timezone_consistency.summary.consistent":
      "Timezone signals are consistent with the current baseline.",
    "module.timezone_consistency.summary.mismatch":
      "Timezone signals contain mismatches against the current baseline.",
    "module.locale_consistency": "Locale consistency",
    "module.locale_consistency.summary.consistent":
      "Locale signals are consistent with the current baseline.",
    "module.locale_consistency.summary.mismatch":
      "Locale signals diverge from the current baseline.",
    "module.dns_observation_pipeline": "DNS observation pipeline",
    "module.dns_observation_pipeline.summary.authoritative":
      "Authoritative DNS ingest observations are present.",
    "module.dns_observation_pipeline.summary.simulated":
      "Only local MVP probe-level DNS signals are present; resolver inference is not directly observed.",
    "module.ai_reachability": "AI reachability",
    "module.ai_reachability.summary.none": "No AI reachability probes were collected.",
    "module.ai_reachability.summary.count":
      "{reachable}/{total} AI targets were reachable from the browser environment.",
    "module.webrtc_surface": "WebRTC surface",
    "module.webrtc_surface.summary.none": "No WebRTC observations were collected yet.",
    "module.webrtc_surface.summary.public":
      "Collected {total} WebRTC candidates with {public} public-facing path(s).",
    "module.webrtc_surface.summary.private_only":
      "Collected {total} WebRTC candidates without public-facing leakage.",
    "dns_capability.authoritative":
      "Resolver-side DNS observations were ingested through authoritative contract.",
    "dns_capability.simulated_http_probe":
      "Local MVP currently records browser-triggered probe hits/client reports, not true authoritative resolver inference."
  },
  zh: {
    "summary.headline.none": "当前一期检查未发现不一致信号。",
    "summary.headline.count": "一期检测到 {count} 个计分不一致信号。",
    "finding.http_observations_missing.title": "未采集到 HTTP Echo 观测结果",
    "finding.http_observations_missing.description":
      "一期未收到多源 HTTP 观测，因此网络基线可信度有限。",
    "finding.http_vantage_coverage_low.title": "HTTP 观测覆盖的观测点过少",
    "finding.http_vantage_coverage_low.description":
      "少于两个观测点返回了结果，降低了多源一致性检查的可信度。",
    "finding.http_ip_inconsistent.title": "HTTP 观测报告了多个公网 IP",
    "finding.http_ip_inconsistent.description":
      "采集到的 HTTP 观测没有收敛到同一个 IP，可能表示链路不稳定或存在泄露。",
    "finding.ip_region_inference_simulated.title":
      "IP 区域基线使用了已观测的 HTTP 数据，但地理映射仍为模拟值",
    "finding.ip_region_inference_simulated.description":
      "基线 IP 来自实际 HTTP 观测，但国家与时区映射在本地 MVP 中仍通过稳定哈希进行模拟。",
    "finding.ip_region_placeholder_used.title": "当前网络基线仍回退为确定性占位值",
    "finding.ip_region_placeholder_used.description":
      "由于没有可用的观测 IP，报告使用了基于会话哈希的占位区域基线。",
    "finding.fingerprint_missing.title": "未采集到指纹数据",
    "finding.fingerprint_missing.description":
      "浏览器没有提交基础指纹数据，因此时区和语言一致性检查无法完整运行。",
    "finding.timezone_ip_mismatch.title": "浏览器时区与推断网络基线不一致",
    "finding.timezone_ip_mismatch.description":
      "浏览器时区与当前会话网络画像推断出的基线时区不一致。",
    "finding.timezone_missing.title": "未提供浏览器时区",
    "finding.timezone_missing.description":
      "浏览器时区缺失，降低了时区一致性检查的可信度。",
    "finding.utc_offset_mismatch.title": "UTC 偏移与推断时区不一致",
    "finding.utc_offset_mismatch.description":
      "浏览器 UTC 偏移与推断时区基线的预期偏移不一致。",
    "finding.browser_locale_ip_mismatch.title": "浏览器语言与推断网络基线不一致",
    "finding.browser_locale_ip_mismatch.description":
      "浏览器主语言与该网络基线的预期语言环境不一致。",
    "finding.accept_language_ip_mismatch.title":
      "Accept-Language 与推断网络基线不一致",
    "finding.accept_language_ip_mismatch.description":
      "HTTP Accept-Language 请求头与该网络基线的预期语言环境不一致。",
    "finding.dns_probe_failures_detected.title": "部分 DNS 探测在客户端层失败",
    "finding.dns_probe_failures_detected.description":
      "客户端上报的 DNS 探测包含错误或超时结果。它仅表示运行层信号，并不能直接证明存在 DNS 泄露。",
    "finding.dns_multi_resolver_observed.title": "观测到多个 DNS 解析器",
    "finding.dns_multi_resolver_observed.description":
      "权威 DNS 接入结果显示该会话出现了多个解析器 IP。",
    "finding.dns_resolver_country_mismatch.title":
      "DNS 解析器所在国家与网络基线国家不一致",
    "finding.dns_resolver_country_mismatch.description":
      "权威 DNS 接入得到的解析器国家与当前网络基线国家不一致。",
    "finding.webrtc_public_ip_different.title":
      "WebRTC 表面暴露了不同的公网 IP",
    "finding.webrtc_public_ip_different.description":
      "采集到的 WebRTC 候选中包含与当前 HTTP 基线不同的公网地址。",
    "module.http_observation_consistency": "HTTP 观测一致性",
    "module.http_observation_consistency.summary.none": "未采集到 HTTP 观测。",
    "module.http_observation_consistency.summary.consistent":
      "共采集 {count} 条 HTTP 观测，观测到的 IP 保持一致。",
    "module.http_observation_consistency.summary.divergent":
      "共采集 {count} 条 HTTP 观测，但观测到的 IP 存在分歧。",
    "module.ip_region_baseline": "IP 区域基线",
    "module.ip_region_baseline.summary.http_inferred":
      "基线 IP 来自 HTTP 采集，但国家和时区映射在本地 MVP 中仍通过稳定哈希模拟。",
    "module.ip_region_baseline.summary.placeholder":
      "HTTP 基线不可用，当前使用基于会话哈希的占位基线。",
    "module.timezone_consistency": "时区一致性",
    "module.timezone_consistency.summary.consistent": "时区信号与当前基线一致。",
    "module.timezone_consistency.summary.mismatch": "时区信号与当前基线存在不一致。",
    "module.locale_consistency": "语言一致性",
    "module.locale_consistency.summary.consistent": "语言信号与当前基线一致。",
    "module.locale_consistency.summary.mismatch": "语言信号与当前基线存在偏差。",
    "module.dns_observation_pipeline": "DNS 观测链路",
    "module.dns_observation_pipeline.summary.authoritative": "已存在权威 DNS 接入观测。",
    "module.dns_observation_pipeline.summary.simulated":
      "当前只有本地 MVP 级别的 DNS 探测信号，还没有直接的解析器侧观测。",
    "module.ai_reachability": "AI 可达性",
    "module.ai_reachability.summary.none": "未采集到 AI 可达性探测结果。",
    "module.ai_reachability.summary.count":
      "共 {total} 个 AI 目标，其中 {reachable} 个可从当前浏览器环境访问。",
    "module.webrtc_surface": "WebRTC 表面",
    "module.webrtc_surface.summary.none": "当前还没有采集到 WebRTC 观测。",
    "module.webrtc_surface.summary.public":
      "共采集 {total} 个 WebRTC 候选，其中 {public} 个包含公网路径。",
    "module.webrtc_surface.summary.private_only":
      "共采集 {total} 个 WebRTC 候选，未发现公网泄露路径。",
    "dns_capability.authoritative": "已通过权威接入拿到解析器侧 DNS 观测。",
    "dns_capability.simulated_http_probe":
      "当前本地 MVP 只记录浏览器触发的探测命中和客户端上报，并非真正的权威 DNS 解析器推断。"
  }
} as const;

const exactBackendText: Record<string, string> = {
  "No inconsistency signals were detected in current Phase 1 checks.": "当前一期检查未发现不一致信号。",
  "No HTTP echo observations were collected": "未采集到 HTTP Echo 观测结果",
  "HTTP observations were collected from limited vantage coverage": "HTTP 观测覆盖的观测点过少",
  "HTTP observations reported multiple public IP values": "HTTP 观测报告了多个公网 IP",
  "IP region baseline uses observed HTTP data with simulated geo mapping":
    "IP 区域基线使用了已观测的 HTTP 数据，但地理映射仍为模拟值",
  "Fallback network baseline is still deterministic placeholder": "当前网络基线仍回退为确定性占位值",
  "No fingerprint data was collected": "未采集到指纹数据",
  "Browser timezone conflicts with inferred network baseline": "浏览器时区与推断网络基线不一致",
  "Browser timezone was not provided": "未提供浏览器时区",
  "UTC offset conflicts with inferred timezone": "UTC 偏移与推断时区不一致",
  "Browser language conflicts with inferred network baseline": "浏览器语言与推断网络基线不一致",
  "Accept-Language conflicts with inferred network baseline":
    "Accept-Language 与推断网络基线不一致",
  "Some DNS probe attempts failed at the client layer": "部分 DNS 探测在客户端层失败",
  "Multiple DNS resolvers were observed": "观测到多个 DNS 解析器",
  "DNS resolver country differs from network baseline country":
    "DNS 解析器所在国家与网络基线国家不一致",
  "Phase 1 did not receive multi-source HTTP observations, so network baseline confidence is limited.":
    "一期未收到多源 HTTP 观测，因此网络基线可信度有限。",
  "Fewer than two vantages reported observations, reducing confidence in multi-source consistency checks.":
    "少于两个观测点返回了结果，降低了多源一致性检查的可信度。",
  "Collected HTTP observations did not agree on a single observed IP, which can indicate route instability or leak conditions.":
    "采集到的 HTTP 观测没有收敛到同一个 IP，可能表示链路不稳定或存在泄露。",
  "The baseline IP came from collected HTTP observations, but country/timezone mapping is still simulated in local MVP via a stable IP hash.":
    "基线 IP 来自实际 HTTP 观测，但国家与时区映射在本地 MVP 中仍通过稳定哈希进行模拟。",
  "No usable observed IP was available, so the report used the session-hash placeholder region baseline.":
    "由于没有可用的观测 IP，报告使用了基于会话哈希的占位区域基线。",
  "The browser did not submit baseline fingerprint data, so timezone and locale consistency checks could not run fully.":
    "浏览器没有提交基础指纹数据，因此时区和语言一致性检查无法完整运行。",
  "Browser timezone differs from the baseline timezone inferred for this session's network profile.":
    "浏览器时区与当前会话网络画像推断出的基线时区不一致。",
  "Browser timezone is missing, which reduces confidence of timezone consistency checks.":
    "浏览器时区缺失，降低了时区一致性检查的可信度。",
  "The browser UTC offset does not match the offset expected for the inferred timezone baseline.":
    "浏览器 UTC 偏移与推断时区基线的预期偏移不一致。",
  "The browser primary language does not align with the expected locale for this network baseline.":
    "浏览器主语言与该网络基线的预期语言环境不一致。",
  "The HTTP Accept-Language header does not align with the expected locale for this network baseline.":
    "HTTP Accept-Language 请求头与该网络基线的预期语言环境不一致。",
  "Client-reported DNS probe attempts include error or timeout results. This is operational signal only and not resolver-leak proof.":
    "客户端上报的 DNS 探测包含错误或超时结果。它仅表示运行层信号，并不能直接证明存在 DNS 泄露。",
  "Authoritative DNS ingest reported more than one resolver IP for this session.":
    "权威 DNS 接入结果显示该会话出现了多个解析器 IP。",
  "Resolver-country evidence from authoritative ingest diverges from the current network baseline country.":
    "权威 DNS 接入得到的解析器国家与当前网络基线国家不一致。",
  "WebRTC surface exposes a different public IP": "WebRTC 表面暴露了不同的公网 IP",
  "Collected WebRTC candidates include a public-facing address that differs from the current HTTP baseline.":
    "采集到的 WebRTC 候选中包含与当前 HTTP 基线不同的公网地址。",
  "WebRTC surface": "WebRTC 表面",
  "No WebRTC observations were collected yet.": "当前还没有采集到 WebRTC 观测。",
  "HTTP observation consistency": "HTTP 观测一致性",
  "IP region baseline": "IP 区域基线",
  "Timezone consistency": "时区一致性",
  "Locale consistency": "语言一致性",
  "DNS observation pipeline": "DNS 观测链路",
  "No HTTP observations were collected.": "未采集到 HTTP 观测。",
  "Baseline IP is observed from HTTP collection; country/timezone mapping remains simulated via stable IP hash in local MVP.":
    "基线 IP 来自 HTTP 采集，但国家和时区映射在本地 MVP 中仍通过稳定哈希模拟。",
  "HTTP baseline was unavailable; session-hash placeholder baseline is used.":
    "HTTP 基线不可用，当前使用基于会话哈希的占位基线。",
  "Timezone signals are consistent with the current baseline.": "时区信号与当前基线一致。",
  "Timezone signals contain mismatches against the current baseline.":
    "时区信号与当前基线存在不一致。",
  "Locale signals are consistent with the current baseline.": "语言信号与当前基线一致。",
  "Locale signals diverge from the current baseline.": "语言信号与当前基线存在偏差。",
  "Authoritative DNS ingest observations are present.": "已存在权威 DNS 接入观测。",
  "Only local MVP probe-level DNS signals are present; resolver inference is not directly observed.":
    "当前只有本地 MVP 级别的 DNS 探测信号，还没有直接的解析器侧观测。",
  "Local MVP currently records browser-triggered probe hits/client reports, not true authoritative resolver inference.":
    "当前本地 MVP 只记录浏览器触发的探测命中和客户端上报，并非真正的权威 DNS 解析器推断。"
};

export function translateUi(lang: Lang) {
  return uiText[lang];
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key)
      ? String(params[key])
      : `{${key}}`,
  );
}

export function translateStatusLabel(value: string, lang: Lang): string {
  if (lang === "en") {
    return value;
  }

  const map: Record<string, string> = {
    idle: uiText.zh.idle,
    running: "执行中",
    done: uiText.zh.done,
    error: uiText.zh.error,
    ok: "正常",
    reachable: "可访问",
    blocked: "疑似受限",
    timeout: "超时",
    warning: "警告",
    critical: "严重",
    info: "信息",
    consistent: "一致",
    mildly_suspicious: "轻度可疑",
    suspicious: "可疑",
    high_risk: "高风险",
    low: "低",
    medium: "中",
    high: "高"
  };

  return map[value] ?? value;
}

export function translateBackendText(value: string, lang: Lang): string {
  if (lang === "en") {
    return value;
  }

  if (exactBackendText[value]) {
    return exactBackendText[value];
  }

  const phaseCount = value.match(/^Phase 1 detected (\d+) scored inconsistency signal\(s\)\.$/);
  if (phaseCount) {
    return `一期检测到 ${phaseCount[1]} 个计分不一致信号。`;
  }

  const httpConsistent = value.match(
    /^Collected (\d+) HTTP observations with consistent observed IP values\.$/,
  );
  if (httpConsistent) {
    return `共采集 ${httpConsistent[1]} 条 HTTP 观测，观测到的 IP 保持一致。`;
  }

  const httpDivergent = value.match(
    /^Collected (\d+) HTTP observations with divergent observed IP values\.$/,
  );
  if (httpDivergent) {
    return `共采集 ${httpDivergent[1]} 条 HTTP 观测，但观测到的 IP 存在分歧。`;
  }

  return value;
}

export function translateReportKey(
  key: string | undefined,
  lang: Lang,
  params?: Record<string, string | number>,
): string | undefined {
  if (!key) {
    return undefined;
  }

  const table = reportKeyText[lang] as Record<string, string>;
  const template = table[key];
  if (!template) {
    return undefined;
  }

  return interpolate(template, params);
}
