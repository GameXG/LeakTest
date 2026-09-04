import {
  collectAi,
  collectDns,
  collectFingerprint,
  collectHttp,
  collectWebrtc,
  createSession,
  finalizeSession,
  type AiObservation,
  type DnsObservation,
  type HttpObservation,
  type WebrtcObservation,
} from "./api";
import { collectBasicFingerprint } from "./fingerprint";
import { saveRecentSessionId } from "./recent-session";

export type DetectionMode = "full" | "ip" | "dns" | "ai" | "webrtc";

type DetectionStep =
  | "create_session"
  | "collect_fingerprint"
  | "collect_http"
  | "collect_dns"
  | "collect_ai"
  | "collect_webrtc"
  | "finalize";

type ProgressCallback = (step: DetectionStep, status: "running" | "done" | "error") => void;

function safeDateIsoNow(): string {
  return new Date().toISOString();
}

function extractObservedIp(responseBody: unknown): string | undefined {
  if (!responseBody || typeof responseBody !== "object") {
    return undefined;
  }

  const bag = responseBody as Record<string, unknown>;
  const direct =
    bag.observedIp ??
    bag.observed_ip ??
    bag.clientIp ??
    bag.client_ip ??
    bag.ip ??
    bag.address;
  return typeof direct === "string" ? direct : undefined;
}

async function fetchWithTimeout(input: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function observeHttpNode(node: {
  vantage: string;
  region: string;
  url: string;
}): Promise<HttpObservation> {
  const started = performance.now();

  try {
    const requestUrl = new URL(node.url);
    requestUrl.searchParams.set("t", String(Date.now()));
    requestUrl.searchParams.set("vantage", node.vantage);

    const response = await fetchWithTimeout(requestUrl.toString(), 7000, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      mode: "cors"
    });

    const finishedAt = safeDateIsoNow();
    const rttMs = Math.max(1, Math.round(performance.now() - started));
    const contentType = response.headers.get("content-type") || "";

    let responseBody: unknown;
    if (contentType.toLowerCase().includes("application/json")) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    const observationBag =
      responseBody && typeof responseBody === "object" && "observation" in responseBody
        ? (responseBody as { observation?: Record<string, unknown> }).observation
        : undefined;

    return {
      vantage: node.vantage,
      region: node.region,
      url: node.url,
      rttMs,
      observedIp:
        observationBag && typeof observationBag.observedIp === "string"
          ? observationBag.observedIp
          : extractObservedIp(responseBody),
      observedIpFamily:
        observationBag && typeof observationBag.observedIpFamily === "string"
          ? (observationBag.observedIpFamily as "ipv4" | "ipv6" | "unknown")
          : undefined,
      statusCode: response.status,
      requestHost:
        observationBag && typeof observationBag.requestHost === "string"
          ? observationBag.requestHost
          : requestUrl.host,
      observedAt: finishedAt,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    const finishedAt = safeDateIsoNow();
    const rttMs = Math.max(1, Math.round(performance.now() - started));
    const isAbortError = error instanceof DOMException && error.name === "AbortError";

    return {
      vantage: node.vantage,
      region: node.region,
      url: node.url,
      rttMs,
      observedAt: finishedAt,
      error: isAbortError ? "timeout" : error instanceof Error ? error.message : "request_failed"
    };
  }
}

function buildProbeId(targetId: string): string {
  return `${targetId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function triggerDnsFetch(probeUrl: string): Promise<"ok" | "timeout" | "failed"> {
  try {
    await fetchWithTimeout(probeUrl, 4500, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer"
    });
    return "ok";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "timeout";
    }
    return "failed";
  }
}

async function triggerDnsImage(probeUrl: string): Promise<"ok" | "timeout"> {
  return new Promise((resolve) => {
    const img = new Image();
    const timeoutId = window.setTimeout(() => resolve("timeout"), 4500);

    img.onload = () => {
      window.clearTimeout(timeoutId);
      resolve("ok");
    };
    img.onerror = () => {
      window.clearTimeout(timeoutId);
      resolve("ok");
    };
    img.referrerPolicy = "no-referrer";
    img.src = probeUrl;
  });
}

async function triggerDnsTarget(target: {
  id: string;
  host: string;
  purpose: "base" | "uncached" | "dualstack" | "low_ttl";
  probeUrl?: string;
}): Promise<DnsObservation> {
  const started = performance.now();
  const probeId = buildProbeId(target.id);
  const probeUrl = new URL(
    target.probeUrl ?? `https://${target.host}/dns-probe.gif?probe=${target.id}&t=${Date.now()}`
  );
  probeUrl.searchParams.set("probeId", probeId);

  try {
    const [fetchResult, imageResult] = await Promise.all([
      triggerDnsFetch(probeUrl.toString()),
      triggerDnsImage(probeUrl.toString())
    ]);
    const elapsedMs = Math.max(1, Math.round(performance.now() - started));
    const allTimedOut = fetchResult === "timeout" && imageResult === "timeout";

    return {
      targetId: target.id,
      targetHost: target.host,
      purpose: target.purpose,
      probeId,
      observedAt: safeDateIsoNow(),
      latencyMs: elapsedMs,
      status: allTimedOut ? "timeout" : "success",
      simulated: true,
      source: "client_report",
      error: `fetch=${fetchResult}; image=${imageResult}`
    };
  } catch (error) {
    return {
      targetId: target.id,
      targetHost: target.host,
      purpose: target.purpose,
      probeId,
      observedAt: safeDateIsoNow(),
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      status: "error",
      simulated: true,
      source: "client_report",
      error: error instanceof Error ? error.message : "dns_probe_failed"
    };
  }
}

async function probeAiFetch(probeUrl: string): Promise<"ok" | "timeout" | "failed"> {
  try {
    await fetchWithTimeout(probeUrl, 5000, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer"
    });
    return "ok";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "timeout";
    }
    return "failed";
  }
}

async function probeAiImage(probeUrl: string): Promise<"ok" | "timeout"> {
  return new Promise((resolve) => {
    const img = new Image();
    const timeoutId = window.setTimeout(() => resolve("timeout"), 5000);

    img.onload = () => {
      window.clearTimeout(timeoutId);
      resolve("ok");
    };
    img.onerror = () => {
      window.clearTimeout(timeoutId);
      resolve("ok");
    };
    img.referrerPolicy = "no-referrer";
    img.src = `${probeUrl}${probeUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
  });
}

async function probeAiTarget(target: {
  id: string;
  provider: string;
  label: string;
  probeUrl: string;
}): Promise<AiObservation> {
  const started = performance.now();
  try {
    const [fetchResult, imageResult] = await Promise.all([
      probeAiFetch(target.probeUrl),
      probeAiImage(target.probeUrl)
    ]);
    const latencyMs = Math.max(1, Math.round(performance.now() - started));

    let status: AiObservation["status"];
    if (fetchResult === "ok" || imageResult === "ok") {
      status = "reachable";
    } else if (fetchResult === "timeout" && imageResult === "timeout") {
      status = "timeout";
    } else {
      status = "blocked";
    }

    return {
      targetId: target.id,
      provider: target.provider,
      label: target.label,
      probeUrl: target.probeUrl,
      status,
      latencyMs,
      error: `fetch=${fetchResult}; image=${imageResult}`,
      observedAt: safeDateIsoNow()
    };
  } catch (error) {
    return {
      targetId: target.id,
      provider: target.provider,
      label: target.label,
      probeUrl: target.probeUrl,
      status: "error",
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      error: error instanceof Error ? error.message : "ai_probe_failed",
      observedAt: safeDateIsoNow()
    };
  }
}

function parseCandidate(rawCandidate: string): WebrtcObservation | null {
  const trimmed = rawCandidate.trim();
  const candidate = trimmed.startsWith("candidate:")
    ? trimmed
    : trimmed.startsWith("a=candidate:")
      ? trimmed.slice(2)
      : trimmed;

  const parts = candidate.split(" ");
  if (parts.length < 8) {
    return null;
  }

  const foundation = parts[0]?.replace(/^candidate:/, "");
  const protocol = parts[2]?.toLowerCase();
  const address = parts[4];
  const port = Number(parts[5]);
  const typeIndex = parts.indexOf("typ");
  const candidateType =
    typeIndex >= 0 && parts[typeIndex + 1]
      ? (parts[typeIndex + 1] as WebrtcObservation["candidateType"])
      : "unknown";
  const relatedAddressIndex = parts.indexOf("raddr");
  const relatedPortIndex = parts.indexOf("rport");
  const relatedAddress =
    relatedAddressIndex >= 0 ? parts[relatedAddressIndex + 1] : undefined;
  const relatedPort =
    relatedPortIndex >= 0 ? Number(parts[relatedPortIndex + 1]) : undefined;

  const addressFamily =
    typeof address === "string"
      ? address.includes(":")
        ? "ipv6"
        : /^\d{1,3}(\.\d{1,3}){3}$/.test(address)
          ? "ipv4"
          : "unknown"
      : "unknown";

  return {
    candidateType:
      candidateType === "host" ||
      candidateType === "srflx" ||
      candidateType === "relay" ||
      candidateType === "prflx"
        ? candidateType
        : "unknown",
    address,
    addressFamily,
    protocol,
    port: Number.isFinite(port) ? port : undefined,
    relatedAddress,
    relatedPort: Number.isFinite(relatedPort ?? NaN) ? relatedPort : undefined,
    foundation,
    rawCandidate: rawCandidate.trim(),
    observedAt: safeDateIsoNow()
  };
}

async function collectWebrtcCandidates(
  stunServers: Array<{ id: string; urls: string[]; region: string }>
): Promise<WebrtcObservation[]> {
  if (!stunServers.length || typeof RTCPeerConnection === "undefined") {
    return [];
  }

  const observations = new Map<string, WebrtcObservation>();

  await new Promise<void>((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: stunServers.flatMap((server) =>
        server.urls.map((url) => ({ urls: url }))
      )
    });

    const finalize = () => {
      pc.onicecandidate = null;
      void pc.close();
      resolve();
    };

    const timeoutId = window.setTimeout(finalize, 5000);

    pc.onicecandidate = (event) => {
      if (!event.candidate?.candidate) {
        window.clearTimeout(timeoutId);
        finalize();
        return;
      }

      const parsed = parseCandidate(event.candidate.candidate);
      if (parsed) {
        const key = `${parsed.candidateType}:${parsed.address ?? "none"}:${parsed.port ?? "none"}:${parsed.protocol ?? "none"}`;
        observations.set(key, parsed);
      }
    };

    pc.createDataChannel("leaktest");
    void pc
      .createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => {
        window.clearTimeout(timeoutId);
        finalize();
      });
  });

  return [...observations.values()];
}

export async function runDetectionSession(
  mode: DetectionMode,
  onProgress?: ProgressCallback,
): Promise<{ sessionId: string }> {
  const mark = (step: DetectionStep, status: "running" | "done" | "error") => {
    onProgress?.(step, status);
  };

  mark("create_session", "running");
  const session = await createSession();
  mark("create_session", "done");

  mark("collect_fingerprint", "running");
  const fingerprint = collectBasicFingerprint(session.sessionId, session.clientToken);
  await collectFingerprint(fingerprint);
  mark("collect_fingerprint", "done");

  const echoNodes = session.detectorConfig?.echoNodes || [];
  const externalIpSources = session.detectorConfig?.externalIpSources || [];
  const dnsTargets = session.detectorConfig?.dnsTargets || [];
  const aiTargets = session.detectorConfig?.aiTargets || [];
  const stunServers = session.detectorConfig?.stunServers || [];

  mark("collect_http", "running");
  const httpObservations = await Promise.all(
    [...echoNodes, ...externalIpSources.map((source) => ({
      vantage: source.id,
      region: "external",
      url: source.url,
    }))].map((node) => observeHttpNode(node))
  );
  await collectHttp(session.sessionId, session.clientToken, httpObservations);
  mark("collect_http", "done");

  if (mode === "dns" || mode === "full") {
    mark("collect_dns", "running");
    const dnsObservations = [];
    for (const target of dnsTargets) {
      dnsObservations.push(await triggerDnsTarget(target));
    }
    await collectDns(session.sessionId, session.clientToken, dnsObservations);
    mark("collect_dns", "done");
  }

  if (mode === "ai" || mode === "full") {
    mark("collect_ai", "running");
    const aiObservations = [];
    for (const target of aiTargets) {
      aiObservations.push(await probeAiTarget(target));
    }
    await collectAi(session.sessionId, session.clientToken, aiObservations);
    mark("collect_ai", "done");
  }

  if (mode === "webrtc" || mode === "full") {
    mark("collect_webrtc", "running");
    const webrtcObservations = await collectWebrtcCandidates(stunServers);
    if (webrtcObservations.length > 0) {
      await collectWebrtc(session.sessionId, session.clientToken, webrtcObservations);
      mark("collect_webrtc", "done");
    } else {
      mark("collect_webrtc", "error");
    }
  }

  mark("finalize", "running");
  await finalizeSession(session.sessionId, session.clientToken);
  mark("finalize", "done");
  saveRecentSessionId(session.sessionId);

  return { sessionId: session.sessionId };
}
