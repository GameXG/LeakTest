"use client";

import { useEffect, useState } from "react";
import { SOURCE_REGISTRY } from "./source-registry";
import {
  buildBrowserRestrictedVendor,
  buildClaudeVendor,
  buildGoogleVendor,
  buildOpenAiVendor,
  buildUnavailableVendor,
  type GoogleIncident,
  type OfficialSummaryResponse,
  type OfficialVendorStatus
} from "./status-normalizer";
import type { DiagnosticsProgress } from "./use-live-diagnostics";

export type { OfficialVendorStatus } from "./status-normalizer";

type OfficialStatusState = {
  loading: boolean;
  error?: string;
  progress?: DiagnosticsProgress;
  checkedAt?: string;
  vendors: OfficialVendorStatus[];
  totalServiceCount: number;
};

const PROGRESS_STEPS = [
  "读取 Claude / OpenAI 官方状态",
  "读取 Google / Apple 官方状态",
  "整理关键服务状态"
] as const;

const initialState: OfficialStatusState = {
  loading: true,
  progress: {
    label: PROGRESS_STEPS[0],
    completed: 0,
    total: PROGRESS_STEPS.length,
    percent: 0
  },
  vendors: [],
  totalServiceCount: 0
};

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "omit",
    mode: "cors",
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`请求失败：${new URL(url).host}`);
  }

  return (await response.json()) as T;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "官方状态源不可用";
}

export function useOfficialStatusReport() {
  const [state, setState] = useState<OfficialStatusState>(initialState);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState(initialState);

      const [claudeSummary, openAiSummary, googleIncidents] = await Promise.allSettled([
        fetchJson<OfficialSummaryResponse>(SOURCE_REGISTRY.officialStatus.claude.apiUrl),
        fetchJson<OfficialSummaryResponse>(SOURCE_REGISTRY.officialStatus.openai.apiUrl),
        fetchJson<GoogleIncident[]>(SOURCE_REGISTRY.officialStatus.google.incidentsUrl)
      ]);

      if (cancelled) {
        return;
      }

      const claudeVendor = claudeSummary.status === "fulfilled"
        ? buildClaudeVendor(claudeSummary.value)
        : buildUnavailableVendor(
            "claude",
            "Claude",
            SOURCE_REGISTRY.officialStatus.claude.pageUrl,
            SOURCE_REGISTRY.officialStatus.claude.apiUrl,
            errorMessage(claudeSummary.reason),
          );
      const openAiVendor = openAiSummary.status === "fulfilled"
        ? buildOpenAiVendor(openAiSummary.value)
        : buildUnavailableVendor(
            "openai",
            "OpenAI",
            SOURCE_REGISTRY.officialStatus.openai.pageUrl,
            SOURCE_REGISTRY.officialStatus.openai.apiUrl,
            errorMessage(openAiSummary.reason),
          );
      const googleVendor = googleIncidents.status === "fulfilled"
        ? buildGoogleVendor(googleIncidents.value)
        : buildUnavailableVendor(
            "google",
            "Google",
            SOURCE_REGISTRY.officialStatus.google.pageUrl,
            SOURCE_REGISTRY.officialStatus.google.incidentsUrl,
            errorMessage(googleIncidents.reason),
          );
      const appleVendor = buildBrowserRestrictedVendor(
        "apple",
        "Apple",
        SOURCE_REGISTRY.officialStatus.apple.pageUrl,
        SOURCE_REGISTRY.officialStatus.apple.apiUrl,
        "Apple 官方状态数据未开放浏览器跨域读取，请打开官方状态页核对。",
      );
      const vendors: OfficialVendorStatus[] = [claudeVendor, openAiVendor, googleVendor, appleVendor];
      const readableVendors = vendors.filter((vendor) => vendor.id !== "apple");
      const error = readableVendors.every((vendor) => vendor.overallIndicator === "unavailable")
        ? "当前浏览器无法读取任何可用的官方状态源。请检查网络或直接打开各厂商官方状态页。"
        : undefined;

      setState({
        loading: false,
        progress: undefined,
        checkedAt: new Date().toISOString(),
        vendors,
        totalServiceCount: vendors.reduce((sum, vendor) => sum + vendor.services.length, 0),
        error
      });
    }

    void run();

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
