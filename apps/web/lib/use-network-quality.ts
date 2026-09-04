"use client";

import { useEffect, useState } from "react";

export type NetworkQualityLevel = "excellent" | "good" | "fair" | "slow" | "unavailable";

export type NetworkQualityProbe = {
  id: string;
  label: string;
  group: "cn" | "global";
  category: "search" | "commerce" | "social" | "video" | "content" | "dev";
  url: string;
  latencyMs?: number;
  level: NetworkQualityLevel;
  note?: string;
};

export type NetworkQualityProgress = {
  label: string;
  completed: number;
  total: number;
  percent: number;
};

const PROBE_TARGETS: Array<{
  id: string;
  label: string;
  group: "cn" | "global";
  category: "search" | "commerce" | "social" | "video" | "content" | "dev";
  url: string;
  mode?: RequestMode;
}> = [
  { id: "baidu", label: "Baidu", group: "cn", category: "search", url: "https://www.baidu.com/" },
  { id: "taobao", label: "Taobao", group: "cn", category: "commerce", url: "https://www.taobao.com/" },
  { id: "qq", label: "Tencent QQ", group: "cn", category: "social", url: "https://www.qq.com/" },
  { id: "jd", label: "JD.com", group: "cn", category: "commerce", url: "https://www.jd.com/" },
  { id: "bilibili", label: "Bilibili", group: "cn", category: "video", url: "https://www.bilibili.com/" },
  { id: "zhihu", label: "Zhihu", group: "cn", category: "content", url: "https://www.zhihu.com/" },
  { id: "google", label: "Google", group: "global", category: "search", url: "https://www.google.com/" },
  { id: "youtube", label: "YouTube", group: "global", category: "video", url: "https://www.youtube.com/" },
  { id: "github", label: "GitHub", group: "global", category: "dev", url: "https://github.com/" },
  {
    id: "x",
    label: "X",
    group: "global",
    category: "social",
    url: "https://x.com/",
    mode: "cors"
  },
  { id: "wikipedia", label: "Wikipedia", group: "global", category: "content", url: "https://www.wikipedia.org/" },
  { id: "reddit", label: "Reddit", group: "global", category: "social", url: "https://www.reddit.com/" }
];

function makeProgress(completed: number): NetworkQualityProgress {
  return {
    label: completed >= PROBE_TARGETS.length ? "整理测速结果" : `探测 ${PROBE_TARGETS[completed]?.label ?? "结果"}`,
    completed,
    total: PROBE_TARGETS.length,
    percent: Math.round((completed / PROBE_TARGETS.length) * 100)
  };
}

function classifyLatency(latencyMs?: number): NetworkQualityLevel {
  if (typeof latencyMs !== "number") {
    return "unavailable";
  }
  if (latencyMs < 300) return "excellent";
  if (latencyMs < 800) return "good";
  if (latencyMs < 1600) return "fair";
  return "slow";
}

async function measureHomepage(
  target: (typeof PROBE_TARGETS)[number]
): Promise<NetworkQualityProbe> {
  const start = performance.now();

  try {
    await fetch(target.url, {
      mode: target.mode ?? "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });

    const latencyMs = Math.round(performance.now() - start);
    return {
      ...target,
      latencyMs,
      level: classifyLatency(latencyMs)
    };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";

    return {
      ...target,
      level: "unavailable",
      note: timedOut ? "请求超时" : "浏览器探测受限"
    };
  }
}

export function useNetworkQuality() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<NetworkQualityProgress>(makeProgress(0));
  const [probes, setProbes] = useState<NetworkQualityProbe[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(undefined);
      setProbes([]);
      setProgress(makeProgress(0));

      try {
        const results: NetworkQualityProbe[] = [];

        await Promise.all(
          PROBE_TARGETS.map(async (target, index) => {
            const result = await measureHomepage(target);
            if (cancelled) {
              return;
            }
            results.push(result);
            setProbes([...results].sort((a, b) => a.label.localeCompare(b.label)));
            setProgress(makeProgress(index + 1));
          })
        );

        if (!cancelled) {
          setLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoading(false);
          setError(caught instanceof Error ? caught.message : "Failed to run network quality probes.");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const domestic = probes.filter((probe) => probe.group === "cn");
  const global = probes.filter((probe) => probe.group === "global");

  const average = (items: NetworkQualityProbe[]) => {
    const values = items
      .map((item) => item.latencyMs)
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) return undefined;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  };

  const fastest = probes
    .filter((probe) => typeof probe.latencyMs === "number")
    .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))[0];

  const slowest = probes
    .filter((probe) => typeof probe.latencyMs === "number")
    .sort((a, b) => (b.latencyMs ?? 0) - (a.latencyMs ?? 0))[0];

  return {
    loading,
    progress,
    error,
    probes,
    domestic,
    global,
    domesticAverage: average(domestic),
    globalAverage: average(global),
    fastest,
    slowest,
    refresh: () => setRefreshToken((value) => value + 1)
  };
}
