"use client";

import type { ReactNode } from "react";
import { DiagnosticsSkeleton } from "../../components/diagnostics-skeleton";
import { FlagMark } from "../../components/flag-mark";
import { RiskShell } from "../../components/risk-shell";
import { useIpProviderReport } from "../../lib/use-ip-provider-report";

function statusMeta(status: "aligned" | "outlier" | "partial" | "error") {
  switch (status) {
    case "aligned":
      return { label: "一致", className: "tag tag-safe-dark" };
    case "outlier":
      return { label: "有差异", className: "tag tag-danger" };
    case "partial":
      return { label: "信息不全", className: "tag tag-warn" };
    case "error":
      return { label: "请求失败", className: "tag tag-warn" };
  }
}

function renderField(
  label: string,
  value: ReactNode,
  diff?: boolean,
  note?: string,
) {
  return (
    <div className={`ip-field-row${diff ? " is-diff" : ""}`}>
      <span className="ip-field-label">{label}</span>
      <div className="ip-field-value">
        <strong>{value}</strong>
        {diff ? <span className="ip-field-note">与多数来源不同</span> : null}
        {!diff && note ? <span className="ip-field-note">{note}</span> : null}
      </div>
    </div>
  );
}

export default function IpPage() {
  const { loading, error, progress, providers, consensus, refresh } = useIpProviderReport();

  return (
    <RiskShell
      section="ip"
      title="IP 查询"
      lead="比较多个公开 IP 查询商对当前公网 IPv4 / IPv6、位置、时区、运营商与风险类型的解释差异。"
      loading={loading}
      progress={progress}
      summary={
        <div className="card card-emphasis" style={{ gridColumn: "1 / -1" }}>
          <p className="section-eyebrow">多源共识</p>
          <div className="ip-consensus-grid">
            <div className="quality-stat">
              <span>当前 IPv4</span>
              <strong className="ip-consensus-value">{consensus.ipv4.value ?? "未检测到"}</strong>
            </div>
            <div className="quality-stat">
              <span>当前 IPv6</span>
              <strong className="ip-consensus-value">{consensus.ipv6.value ?? "未检测到"}</strong>
            </div>
            <div className="quality-stat">
              <span>位置共识</span>
              <strong className="ip-consensus-value">
                {consensus.location.value ? (
                  <>
                    <FlagMark countryCode={consensus.location.countryCode} /> {consensus.location.value}
                  </>
                ) : (
                  "暂未形成"
                )}
              </strong>
            </div>
            <div className="quality-stat">
              <span>时区共识</span>
              <strong className="ip-consensus-value">{consensus.timezone.value ?? "暂未形成"}</strong>
            </div>
            <div className="quality-stat">
              <span>运营商共识</span>
              <strong className="ip-consensus-value">{consensus.carrier.value ?? "暂未形成"}</strong>
            </div>
            <div className="quality-stat">
              <span>风险共识</span>
              <strong className="ip-consensus-value">{consensus.riskType.value ?? "暂未形成"}</strong>
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
              {consensus.successCount
                ? `${consensus.providerCount} 家来源中有 ${consensus.successCount} 家成功返回；${
                    consensus.outlierCount
                      ? `差异卡片 ${consensus.outlierCount} 张：${consensus.outlierLabels.join("、")}`
                      : "目前没有独有差异卡片"
                  }。`
                : "等待供应商返回结果。"}
            </p>
            <button type="button" className="button" onClick={refresh} disabled={loading}>
              {loading ? "查询中..." : "重新查询"}
            </button>
          </div>
        </div>
      }
    >
      {loading ? <DiagnosticsSkeleton cards={5} rows={6} /> : null}
      {error ? <p className="status danger">{error}</p> : null}

      {!loading ? (
        <section className="cards cards-two-col">
          {providers.map((provider) => {
            const meta = statusMeta(provider.status);

            return (
              <article
                key={provider.id}
                className={`card ip-provider-card${
                  provider.status === "outlier" ? " is-outlier" : ""
                }${provider.status === "error" ? " is-error" : ""}`}
              >
                <div className="ip-provider-head">
                  <div>
                    <span className="source-card-title">{provider.label}</span>
                  </div>
                  <span className={meta.className}>{meta.label}</span>
                </div>

                {provider.error ? (
                  <p className="status danger" style={{ marginBottom: 0 }}>
                    {provider.error}
                  </p>
                ) : (
                  <div className="ip-field-list">
                    {renderField("当前 IPv4", provider.ipv4 ?? "N/A", provider.diffFields.ipv4)}
                    {renderField("当前 IPv6", provider.ipv6 ?? "N/A", provider.diffFields.ipv6)}
                    {renderField(
                      "所在位置",
                      provider.location ? (
                        <>
                          <FlagMark countryCode={provider.countryCode} /> {provider.location}
                        </>
                      ) : (
                        "N/A"
                      ),
                      provider.diffFields.location,
                    )}
                    {renderField("时区", provider.timezone ?? "N/A", provider.diffFields.timezone)}
                    {renderField("运营商", provider.carrier ?? "N/A", provider.diffFields.carrier)}
                    {renderField("IP 风险", provider.riskType ?? "N/A", provider.diffFields.riskType)}
                  </div>
                )}

                {provider.familyNote ? <p className="ip-provider-note">{provider.familyNote}</p> : null}
                {provider.issueCount ? (
                  <p className="ip-provider-alert">这张卡片有 {provider.issueCount} 项与多数来源不同。</p>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}
    </RiskShell>
  );
}
