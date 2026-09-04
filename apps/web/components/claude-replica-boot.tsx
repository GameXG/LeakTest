"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __bootClaudeReplica?: () => void;
    __destroyClaudeReplica?: () => void;
  }
}

export function ClaudeReplicaBoot() {
  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const tryBoot = (): boolean => {
      if (cancelled) {
        return true;
      }

      if (typeof window.__bootClaudeReplica === "function") {
        window.__bootClaudeReplica();
        return true;
      }

      return false;
    };

    if (!tryBoot()) {
      intervalId = window.setInterval(() => {
        if (tryBoot() && intervalId !== undefined) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      }, 50);
    }

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
      if (typeof window.__destroyClaudeReplica === "function") {
        window.__destroyClaudeReplica();
      }
    };
  }, []);

  return null;
}
