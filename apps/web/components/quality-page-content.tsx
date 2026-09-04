"use client";

import { DiagnosticsSkeleton } from "./diagnostics-skeleton";
import { RiskShell } from "./risk-shell";
import { useNetworkQuality, type NetworkQualityLevel } from "../lib/use-network-quality";

function qualityLabel(level: NetworkQualityLevel) {
  if (level === "excellent") return "优秀";
  if (level === "good") return "良好";
  if (level === "fair") return "一般";
  if (level === "slow") return "缓慢";
  return "探测受限";
}

function qualityClass(level: NetworkQualityLevel) {
  if (level === "excellent") return "ok";
  if (level === "good") return "ok";
  if (level === "fair") return "warn";
  if (level === "slow") return "warn";
  return "danger";
}

function qualityTone(level: NetworkQualityLevel) {
  if (level === "excellent") return "#0a6e1e";
  if (level === "good") return "#0a9396";
  if (level === "fair") return "#d4a017";
  if (level === "slow") return "#b45309";
  return "#c62828";
}

function averageLevel(latency?: number): NetworkQualityLevel {
  if (typeof latency !== "number") return "unavailable";
  if (latency < 300) return "excellent";
  if (latency < 800) return "good";
  if (latency < 1600) return "fair";
  return "slow";
}

function categoryLabel(category: string) {
  if (category === "search") return "搜索";
  if (category === "commerce") return "电商";
  if (category === "social") return "社交";
  if (category === "video") return "视频";
  if (category === "content") return "内容";
  if (category === "dev") return "开发";
  return category;
}

export function QualityPageContent() {
  const {
    loading,
    progress,
    error,
    domestic,
    global,
    domesticAverage,
    globalAverage,
    fastest,
    slowest,
    refresh
  } = useNetworkQuality();

  const domesticLevel = averageLevel(domesticAverage);
  const globalLevel = averageLevel(globalAverage);
  const gap =
    typeof domesticAverage === "number" && typeof globalAverage === "number"
      ? globalAverage - domesticAverage
      : undefined;
  const gapLabel =
    typeof gap === "number"
      ? gap > 500
        ? "境外访问明显慢于境内"
        : gap < -200
          ? "境外访问表现优于境内"
          : "境内与境外访问差异较小"
      : "等待测速完成";
  const summaryLabel =
    typeof gap === "number"
      ? gap > 500
        ? "当前网络更适合境内网站"
        : gap < -200
          ? "当前网络更适合境外网站"
          : "当前网络在境内外访问较均衡"
      : "等待测速完成";

  return (
    <RiskShell
      section="quality"
      title="全球上网质量"
      lead="比较中国境内与境外主流网站的访问耗时，判断当前网络的整体上网质量。"
      loading={loading}
      progress={progress}
      summary={
        <div className="card card-emphasis" style={{ gridColumn: "1 / -1" }}>
          <p className="section-eyebrow">测速概览</p>
          <div className="quality-overview">
            <div className="quality-stat">
              <span>中国境内</span>
              <strong style={{ color: qualityTone(domesticLevel) }}>
                {typeof domesticAverage === "number" ? `${domesticAverage} ms` : "N/A"}
              </strong>
              <div className={`status ${qualityClass(domesticLevel)}`}>{qualityLabel(domesticLevel)}</div>
            </div>
            <div className="quality-stat">
              <span>境外网站</span>
              <strong style={{ color: qualityTone(globalLevel) }}>
                {typeof globalAverage === "number" ? `${globalAverage} ms` : "N/A"}
              </strong>
              <div className={`status ${qualityClass(globalLevel)}`}>{qualityLabel(globalLevel)}</div>
            </div>
            <div className="quality-stat">
              <span>速度差异</span>
              <strong style={{ color: typeof gap === "number" && gap > 500 ? "#c62828" : "#0b4f60" }}>
                {typeof gap === "number" ? `${gap > 0 ? "+" : ""}${gap} ms` : "N/A"}
              </strong>
              <button type="button" className="button" onClick={refresh} disabled={loading}>
                {loading ? "测速中..." : "重新测速"}
              </button>
            </div>
          </div>
          <p className="quality-note">{gapLabel}</p>
        </div>
      }
    >
      {loading ? <DiagnosticsSkeleton cards={2} rows={6} /> : null}

      {!loading ? (
        <>
      <section className="cards">
        <article className="card">
          <p className="section-eyebrow">总评</p>
          <h2 style={{ marginTop: 0 }}>网络结论</h2>
          <p className="desc" style={{ marginBottom: 0 }}>{summaryLabel}</p>
        </article>

        <article className="card">
          <p className="section-eyebrow">最快站点</p>
          <h2 style={{ marginTop: 0 }}>{fastest?.label ?? "N/A"}</h2>
          <p className="muted">
            {fastest
              ? `${categoryLabel(fastest.category)} · ${fastest.latencyMs} ms · ${qualityLabel(fastest.level)}`
              : "等待测速完成"}
          </p>
        </article>

        <article className="card">
          <p className="section-eyebrow">最慢站点</p>
          <h2 style={{ marginTop: 0 }}>{slowest?.label ?? "N/A"}</h2>
          <p className="muted">
            {slowest
              ? `${categoryLabel(slowest.category)} · ${slowest.latencyMs} ms · ${qualityLabel(slowest.level)}`
              : "等待测速完成"}
          </p>
        </article>
      </section>

      <section className="report-grid report-grid-secondary">
        <article className="card">
          <p className="section-eyebrow">中国境内</p>
          {error ? <p className="status danger">{error}</p> : null}
          <div className="matrix-list">
            {domestic.map((probe) => (
              <div key={probe.id} className="matrix-row">
                <div>
                  <strong>{probe.label}</strong>
                  <p className="muted">{categoryLabel(probe.category)}</p>
                </div>
                <div className="matrix-meta">
                  <span className={`status ${qualityClass(probe.level)}`}>{qualityLabel(probe.level)}</span>
                  <span className="muted">
                    {typeof probe.latencyMs === "number" ? `${probe.latencyMs} ms` : probe.note ?? "未测得"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card card-emphasis">
          <p className="section-eyebrow">境外主流网站</p>
          <div className="matrix-list">
            {global.map((probe) => (
              <div key={probe.id} className="matrix-row">
                <div>
                  <strong>{probe.label}</strong>
                  <p className="muted">{categoryLabel(probe.category)}</p>
                </div>
                <div className="matrix-meta">
                  <span className={`status ${qualityClass(probe.level)}`}>{qualityLabel(probe.level)}</span>
                  <span className="muted">
                    {typeof probe.latencyMs === "number" ? `${probe.latencyMs} ms` : probe.note ?? "未测得"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
        </>
      ) : null}
    </RiskShell>
  );
}
