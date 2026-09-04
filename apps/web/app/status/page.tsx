"use client";

import { DiagnosticsSkeleton } from "../../components/diagnostics-skeleton";
import { RiskShell } from "../../components/risk-shell";
import { useOfficialStatusReport } from "../../lib/use-official-status-report";

function indicatorClass(indicator?: string) {
  if (indicator === "none") return "ok";
  if (indicator === "minor") return "warn";
  if (indicator === "unavailable") return "";
  return "danger";
}

function serviceClass(status?: string) {
  if (status === "operational") return "ok";
  if (status === "degraded_performance" || status === "maintenance" || status === "under_maintenance") {
    return "warn";
  }

  if (status === "unknown") {
    return "";
  }

  return "danger";
}

function formatDateTime(value?: string) {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export default function StatusPage() {
  const { loading, error, progress, checkedAt, vendors, refresh } = useOfficialStatusReport();

  return (
    <RiskShell
      section="status"
      title="服务状态查询"
      lead="获取主流网站尤其是 AI 服务的官方在线状态接口数据，比如 Claude、ChatGPT、Codex、Google、Apple 等。"
      loading={loading}
      progress={progress}
      summary={
        <div className="card card-emphasis" style={{ gridColumn: "1 / -1" }}>
          <p className="section-eyebrow">官方状态总览</p>
          <div className="split-overview split-overview-equal">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="quality-stat">
                <span>{vendor.label}</span>
                <strong className="split-overview-value">
                  <span className={`status ${indicatorClass(vendor.overallIndicator)}`}>
                    {vendor.overallLabel}
                  </span>
                </strong>
              </div>
            ))}
            <div className="quality-stat">
              <span>本次检测</span>
              <strong className="split-overview-value">{formatDateTime(checkedAt)}</strong>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="button" onClick={refresh} disabled={loading}>
              {loading ? "获取中..." : "刷新状态"}
            </button>
          </div>
        </div>
      }
    >
      {loading ? <DiagnosticsSkeleton cards={4} rows={4} /> : null}
      {error ? <p className="status danger">{error}</p> : null}

      {!loading ? (
        <section className="status-vendor-list">
          {vendors.map((vendor) => (
            <article key={vendor.id} className="card card-emphasis status-vendor-card">
              <div className="status-vendor-overview">
                <div className="status-vendor-heading">
                  <p className="section-eyebrow">{vendor.label}</p>
                  <a href={vendor.pageUrl} target="_blank" rel="noreferrer" className="status-vendor-link">
                    官方状态页 ↗
                  </a>
                </div>

                <div className="status-vendor-summary">
                  <div className="status-vendor-stat">
                    <span>状态情况</span>
                    <strong>
                      <span className={`status ${indicatorClass(vendor.overallIndicator)}`}>
                        {vendor.overallLabel}
                      </span>
                    </strong>
                  </div>
                  <div className="status-vendor-stat">
                    <span>最近事件更新</span>
                    <strong>{formatDateTime(vendor.updatedAt)}</strong>
                  </div>
                </div>

                {vendor.error ? <p className="status warn status-vendor-error">{vendor.error}</p> : null}
              </div>

              <div className="status-vendor-services">
                <div className="status-vendor-services-heading">
                  <p className="section-eyebrow">服务列表</p>
                  <span className="muted">{vendor.services.length} 项</span>
                </div>
                {vendor.services.length ? (
                <div className="matrix-list">
                  {vendor.services.map((service) => (
                    <div key={service.id} className="matrix-row">
                      <div>
                        <strong>{service.label}</strong>
                        <p className="muted" style={{ wordBreak: "break-all" }}>{service.sourceName}</p>
                      </div>
                      <div className="matrix-meta">
                        <span className={`status ${serviceClass(service.status)}`}>{service.statusCn}</span>
                        {service.status !== "operational" && service.updatedAt ? (
                          <span className="muted">最近变更 {formatDateTime(service.updatedAt)}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                ) : (
                  <p className="muted">当前没有可展示的服务明细。</p>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </RiskShell>
  );
}
