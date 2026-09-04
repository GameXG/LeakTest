"use client";

import { DiagnosticsSkeleton } from "./diagnostics-skeleton";
import { FlagMark } from "./flag-mark";
import { RiskShell } from "./risk-shell";
import { useGlobalRoutingReport } from "../lib/use-global-routing-report";

function countryName(countryCode?: string) {
  const normalized = countryCode?.trim().toUpperCase();

  if (!normalized || normalized.length !== 2) {
    return undefined;
  }

  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

function splitToneClass(tone: "safe" | "warn" | "danger" | "neutral") {
  if (tone === "safe") return "tag tag-safe-dark";
  if (tone === "warn") return "tag tag-warn";
  if (tone === "danger") return "tag tag-danger";
  return "tag tag-neutral";
}

export function VpnPageContent() {
  const { loading, error, progress, summary, samples, refresh } =
    useGlobalRoutingReport();
  const estimatedSampleCount = samples.filter((sample) => sample.note?.includes("估算")).length;

  return (
    <RiskShell
      section="Routing"
      title="全球分流检测"
      lead="比较国内、国际和 AI 站点看到的公网出口与地理位置，判断当前网络是否存在按站点分流。"
      loading={loading}
      progress={progress}
      summary={
        <div className="card card-emphasis" style={{ gridColumn: "1 / -1" }}>
          <p className="section-eyebrow">分流结论</p>
          <div className="split-overview">
            <div className="quality-stat">
              <span>当前 IPv4</span>
              <strong className="split-overview-value">{summary.ipv4 ?? "未检测到"}</strong>
            </div>
            <div className="quality-stat">
              <span>当前 IPv6</span>
              <strong className="split-overview-value">{summary.ipv6 ?? "未检测到"}</strong>
            </div>
            <div className="quality-stat">
              <span>唯一出口数</span>
              <strong className="split-overview-value">{summary.uniqueIpCount || "0"}</strong>
            </div>
            <div className="quality-stat">
              <span>判断</span>
              <strong className="split-overview-value">{summary.splitLabel}</strong>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap"
            }}
          >
            <p className="quality-note" style={{ marginTop: 0 }}>
              <span className={splitToneClass(summary.splitTone)}>{summary.splitLabel}</span>{" "}
              {summary.splitNote}
            </p>
            <button
              type="button"
              className="button"
              style={{ marginLeft: "auto" }}
              onClick={refresh}
              disabled={loading}
            >
              {loading ? "检测中..." : "刷新检测"}
            </button>
          </div>
        </div>
      }
    >
      {loading ? <DiagnosticsSkeleton cards={6} rows={4} /> : null}
      {error ? <p className="status danger">{error}</p> : null}

      {!loading ? (
        <>
          <section className="stack">
            <article className="card card-emphasis">
              <p className="section-eyebrow">分流详情</p>
              {estimatedSampleCount ? (
                <p className="muted">
                  部分站点因代表探针受限，已使用可用出口估算（{estimatedSampleCount} 项）。
                </p>
              ) : null}
              <div className="routing-sample-wrap">
                <div className="routing-sample-table">
                  <div className="routing-sample-header">
                    <span>主流站点</span>
                    <span>类别</span>
                    <span>IP</span>
                    <span>国家或地区</span>
                  </div>

                  {samples.map((sample) => (
                    <div
                      key={sample.id}
                      className={`routing-sample-row${
                        sample.status === "split" ? " is-split" : ""
                      }${sample.status === "error" ? " is-error" : ""}`}
                    >
                      <div>
                        <strong>{sample.website}</strong>
                      </div>
                      <div>{sample.bucket}</div>
                      <div>
                        {sample.ip ? (
                          <>
                            <FlagMark countryCode={sample.countryCode} /> {sample.ip}
                          </>
                        ) : (
                          sample.error ?? "N/A"
                        )}
                      </div>
                      <div>
                        {sample.geo ? (
                          <>
                            <FlagMark countryCode={sample.countryCode} /> {sample.geo}
                          </>
                        ) : sample.countryCode ? (
                          <>
                            <FlagMark countryCode={sample.countryCode} />{" "}
                            {countryName(sample.countryCode) ?? sample.countryCode.toUpperCase()}
                          </>
                        ) : (
                          sample.error ?? "N/A"
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </section>

          <section className="stack">
            <article className="card">
              <p className="section-eyebrow">出口聚类</p>
              <div className="matrix-list">
                {summary.clusters.map((cluster) => (
                  <details key={cluster.ip} className="routing-cluster-card">
                    <summary className="routing-cluster-summary">
                      <div>
                        <strong>
                          <FlagMark countryCode={cluster.countryCode} /> {cluster.ip}
                        </strong>
                        <p className="muted">{cluster.countryLabel ?? cluster.geo ?? "位置未补充"}</p>
                      </div>
                      <div className="matrix-meta">
                        <span>{cluster.count} 个探针</span>
                        <span className="muted">点击展开完整结果</span>
                      </div>
                    </summary>

                    <div className="routing-cluster-expanded">
                      <div className="routing-cluster-stat">
                        <span>所在位置</span>
                        <strong>{cluster.geo ?? cluster.countryLabel ?? "N/A"}</strong>
                      </div>
                      <div className="routing-cluster-stat">
                        <span>时区</span>
                        <strong>{cluster.timezone ?? "N/A"}</strong>
                      </div>
                      <div className="routing-cluster-stat">
                        <span>运营商</span>
                        <strong>{cluster.carrier ?? "N/A"}</strong>
                      </div>
                    </div>
                  </details>
                ))}
                {!summary.clusters.length ? (
                  <div className="matrix-row">
                    <div>
                      <strong>暂无聚类结果</strong>
                      <p className="muted">等待至少一条探针成功返回出口 IP。</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </RiskShell>
  );
}
