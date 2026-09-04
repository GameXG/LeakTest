"use client";

import type { ReactNode } from "react";
import type { DiagnosticsProgress } from "../lib/use-live-diagnostics";
import { LoadingProgress } from "./loading-progress";
import { RiskNavigation } from "./risk-navigation";

export function RiskShell({
  section,
  title,
  lead,
  description,
  summary,
  loading = false,
  progress,
  children
}: {
  section: string;
  title: string;
  lead: string;
  description?: string;
  summary?: ReactNode;
  loading?: boolean;
  progress?: DiagnosticsProgress;
  children: ReactNode;
}) {
  return (
    <main data-claude-page-root>
      <div className="container">
        <RiskNavigation />

        <header className="page-intro">
          <div className="section-index">LT / {section.toUpperCase()}</div>
          <p className="section-eyebrow">NETWORK DIAGNOSTICS</p>
          <h3>{title}</h3>
          <p className="desc">{lead}</p>
          {description ? <p className="desc desc-secondary">{description}</p> : null}
        </header>
        <div className="signal-rail" aria-label="检测维度">
          <span>IP IDENTITY</span>
          <span>AI ACCESS</span>
          <span>DNS ROUTING</span>
          <span>WEBRTC</span>
          <span>NETWORK STATUS</span>
        </div>

        <LoadingProgress loading={loading} progress={progress} />

        {summary ? <section className="cards">{summary}</section> : null}

        {children}

      </div>

      <footer>&copy; 2026 <a href="/risk/">LeakTest</a></footer>
    </main>
  );
}
