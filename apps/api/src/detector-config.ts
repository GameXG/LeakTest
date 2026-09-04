import type { DetectorConfig } from "./types.js";

export const SESSION_TTL_MS = 15 * 60 * 1000;

const joinUrl = (baseUrl: string, path: string): string => {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
};

export const buildDetectorConfig = (
  sessionId: string,
  clientToken: string,
  publicBaseUrl: string,
): DetectorConfig => {
  const shortSession = sessionId.slice(0, 8);

  return {
    echoNodes: [
      {
        vantage: "ap-sg",
        url: joinUrl(
          publicBaseUrl,
          `/api/public/echo/ap-sg?sessionId=${sessionId}&token=${clientToken}`,
        ),
        region: "apac",
      },
      {
        vantage: "eu-fr",
        url: joinUrl(
          publicBaseUrl,
          `/api/public/echo/eu-fr?sessionId=${sessionId}&token=${clientToken}`,
        ),
        region: "europe",
      },
      {
        vantage: "us-va",
        url: joinUrl(
          publicBaseUrl,
          `/api/public/echo/us-va?sessionId=${sessionId}&token=${clientToken}`,
        ),
        region: "north_america",
      },
    ],
    externalIpSources: [
      {
        id: "cloudflare-trace",
        provider: "cloudflare",
        label: "Cloudflare Trace",
        url: joinUrl(
          publicBaseUrl,
          `/api/public/ip-source/cloudflare-trace?sessionId=${sessionId}&token=${clientToken}`,
        ),
        parser: "cloudflare_trace",
      },
    ],
    stunServers: [
      {
        id: "stun-ap",
        urls: ["stun:stun-ap.example.leaktest:3478"],
        region: "apac",
      },
      {
        id: "stun-eu",
        urls: ["stun:stun-eu.example.leaktest:3478"],
        region: "europe",
      },
      {
        id: "stun-us",
        urls: ["stun:stun-us.example.leaktest:3478"],
        region: "north_america",
      },
    ],
    dnsTargets: [
      {
        id: "base",
        host: `${shortSession}.base.dns-check.local-mvp.leaktest`,
        purpose: "base",
        mode: "simulated_http_probe",
        probeUrl: joinUrl(
          publicBaseUrl,
          `/api/public/probe/dns/base?sessionId=${sessionId}&token=${clientToken}`,
        ),
      },
      {
        id: "uncached",
        host: `${shortSession}.uncached.dns-check.local-mvp.leaktest`,
        purpose: "uncached",
        mode: "simulated_http_probe",
        probeUrl: joinUrl(
          publicBaseUrl,
          `/api/public/probe/dns/uncached?sessionId=${sessionId}&token=${clientToken}`,
        ),
      },
      {
        id: "dualstack",
        host: `${shortSession}.dualstack.dns-check.local-mvp.leaktest`,
        purpose: "dualstack",
        mode: "simulated_http_probe",
        probeUrl: joinUrl(
          publicBaseUrl,
          `/api/public/probe/dns/dualstack?sessionId=${sessionId}&token=${clientToken}`,
        ),
      },
      {
        id: "low-ttl",
        host: `${shortSession}.ttl10.dns-check.local-mvp.leaktest`,
        purpose: "low_ttl",
        mode: "simulated_http_probe",
        probeUrl: joinUrl(
          publicBaseUrl,
          `/api/public/probe/dns/low-ttl?sessionId=${sessionId}&token=${clientToken}`,
        ),
      },
    ],
    aiTargets: [
      {
        id: "chatgpt",
        provider: "openai",
        label: "ChatGPT",
        probeUrl: "https://chatgpt.com/favicon.ico",
      },
      {
        id: "claude",
        provider: "anthropic",
        label: "Claude",
        probeUrl: "https://claude.ai/favicon.ico",
      },
      {
        id: "gemini",
        provider: "google",
        label: "Gemini",
        probeUrl: "https://gemini.google.com/favicon.ico",
      },
      {
        id: "copilot",
        provider: "microsoft",
        label: "Copilot",
        probeUrl: "https://copilot.microsoft.com/favicon.ico",
      },
      {
        id: "perplexity",
        provider: "perplexity",
        label: "Perplexity",
        probeUrl: "https://www.perplexity.ai/favicon.ico",
      },
    ],
  };
};
