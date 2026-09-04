"use client";

import { useEffect, useState } from "react";
import type { DiagnosticsProgress } from "./use-live-diagnostics";

export type OfficialServiceStatus = {
  id: string;
  label: string;
  status: string;
  statusCn: string;
  sourceName: string;
  updatedAt?: string;
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

function makeProgress(step: number): DiagnosticsProgress {
  return {
    label: PROGRESS_STEPS[Math.max(0, Math.min(step - 1, PROGRESS_STEPS.length - 1))],
    completed: step,
    total: PROGRESS_STEPS.length,
    percent: Math.round((step / PROGRESS_STEPS.length) * 100)
  };
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`请求失败：${new URL(url, window.location.origin).pathname}`);
  }

  return (await response.json()) as T;
}

export function useOfficialStatusReport() {
  const [state, setState] = useState<OfficialStatusState>(initialState);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState(initialState);

      try {
        const payload = await fetchJson<{
          checkedAt?: string;
          vendors?: OfficialVendorStatus[];
          error?: string;
        }>(
          "/api/official-status",
        );

        if (cancelled) {
          return;
        }

        if (payload.error) {
          throw new Error(payload.error);
        }

        const vendors = payload.vendors ?? [];

        setState({
          loading: false,
          progress: undefined,
          checkedAt: payload.checkedAt,
          vendors,
          totalServiceCount: vendors.reduce((sum, vendor) => sum + vendor.services.length, 0)
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          ...initialState,
          loading: false,
          progress: undefined,
          error: error instanceof Error ? error.message : "获取官方状态失败"
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
