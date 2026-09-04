"use client";

import type { DiagnosticsProgress } from "../lib/use-live-diagnostics";

export function LoadingProgress({
  loading,
  progress
}: {
  loading: boolean;
  progress?: DiagnosticsProgress;
}) {
  if (!loading || !progress) {
    return null;
  }

  return (
    <div className="card card-emphasis diagnostic-progress">
      <p className="section-eyebrow">实时检测</p>
      <div className="row diagnostic-progress-head">
        <strong>{progress.label}</strong>
        <span className="diagnostic-progress-count">
          {progress.completed}/{progress.total}
        </span>
      </div>
      <div className="diagnostic-progress-track">
        <span
          className="diagnostic-progress-value"
          style={{
            width: `${progress.percent}%`
          }}
        />
      </div>
      <div className="diagnostic-progress-meta">
        <span>PROCESS {String(progress.percent).padStart(2, "0")}%</span>
        <span>当前步骤：{progress.label}</span>
      </div>
    </div>
  );
}
