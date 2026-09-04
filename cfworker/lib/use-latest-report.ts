import { useEffect, useState } from "react";
import { getReport, type ReportResponse } from "./api";
import { readRecentSessionId } from "./recent-session";

export function useLatestReport() {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const latestSessionId = readRecentSessionId();
      if (!latestSessionId) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      setSessionId(latestSessionId);

      try {
        const latestReport = await getReport(latestSessionId);
        if (!cancelled) {
          setReport(latestReport);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [version]);

  return {
    report,
    sessionId,
    loading,
    refresh: () => setVersion((value) => value + 1),
  };
}
