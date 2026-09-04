"use client";

import { FlagMark } from "./flag-mark";
import { LoadingProgress } from "./loading-progress";
import { RiskNavigation } from "./risk-navigation";
import {
  useLiveDiagnostics,
  type DeviceSnapshot,
  type RiskSnapshot
} from "../lib/use-live-diagnostics";

function EnvironmentRiskCard({ device }: { device?: DeviceSnapshot }) {
  return (
    <div className="card environment-card">
      <div className="card-title">中国内地用户特征评分</div>
      <div className="environment-overview">
        <div className="environment-score">
          <strong>{device?.mainlandRiskScore ?? "N/A"}</strong>
          <span>/ 10</span>
        </div>
        <div>
          <span
            className={`tag ${
              (device?.mainlandRiskScore ?? 0) <= 3
                ? "tag-safe"
                : (device?.mainlandRiskScore ?? 0) <= 7
                  ? "tag-warn"
                  : "tag-danger"
            }`}
          >
            {device?.mainlandRiskLabel ?? "等待检测"}
          </span>
          <p className="environment-summary">
            {device?.mainlandRiskSummary ?? "正在采集浏览器环境信号。"}
          </p>
        </div>
      </div>
      <div className="environment-signals">
        {(device?.signals ?? []).map((signal) => (
          <div key={signal.id} className={`environment-signal is-${signal.tone}`}>
            <span className="environment-signal-mark" aria-hidden="true" />
            <div className="environment-signal-copy">
              <strong>{signal.label}</strong>
              <p>{signal.detail}</p>
            </div>
            <div className="environment-signal-result">
              <span className="environment-signal-value">{signal.value}</span>
              <span className={`environment-points${signal.points ? " has-points" : ""}`}>
                +{signal.points}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="environment-disclaimer">
        0–3 分安全，4–7 分可疑，8–10 分危险。全部检测与评分仅在浏览器本地完成，不代表 Anthropic 已公开或实际使用这些具体规则。
      </p>
    </div>
  );
}

function formatRiskFlags(snapshot?: RiskSnapshot) {
  if (!snapshot) {
    return "等待分析";
  }

  const flags = [
    snapshot.vpn ? "VPN" : undefined,
    snapshot.proxy ? "代理" : undefined,
    snapshot.tor ? "Tor" : undefined,
    snapshot.crawler ? "机器人" : undefined,
    snapshot.abuser ? "滥用记录" : undefined
  ].filter((value): value is string => Boolean(value));
  const hasKnownFlags = [snapshot.vpn, snapshot.proxy, snapshot.tor, snapshot.crawler, snapshot.abuser]
    .some((value) => typeof value === "boolean");

  return flags.length ? flags.join(" / ") : hasKnownFlags ? "未检测到风险标记" : "暂无风险数据";
}

export function RiskPageContent() {
  const {
    loading,
    progress,
    cards,
    risk,
    codexRisk,
    device,
    history
  } = useLiveDiagnostics();

  const cardList = [
    { card: cards.local },
    { card: cards.cloudflare },
    { card: cards.ai, snapshot: risk, showRiskDetails: true },
    { card: cards.codex, snapshot: codexRisk, showRiskDetails: true }
  ].reduce<
    Array<{
      label: string;
      ips?: Array<{ version: "IPv4" | "IPv6"; value: string }>;
      countryCode?: string;
      geo?: string;
      snapshot?: RiskSnapshot;
      showRiskDetails?: boolean;
    }>
  >((list, { card, snapshot, showRiskDetails }) => {
    if (card) {
      list.push({ ...card, snapshot, showRiskDetails });
    }

    return list;
  }, []);

  return (
    <main data-claude-page-root>
      <div className="container">
        <RiskNavigation />

        <header className="page-intro">
          <div className="section-index">LT / RISK</div>
          <p className="section-eyebrow">NETWORK DIAGNOSTICS</p>
          <h3>AI 封号分析</h3>
          <p className="desc">
            比较当前出口 IP 的纯净度、风险属性与本地环境一致性，判断 AI 服务场景下的封号风险。
          </p>
        </header>
        <div className="signal-rail" aria-label="检测维度">
          <span>IP IDENTITY</span>
          <span>AI ACCESS</span>
          <span>DNS ROUTING</span>
          <span>WEBRTC</span>
          <span>NETWORK STATUS</span>
        </div>

        <LoadingProgress loading={loading} progress={progress} />

        <div className="cards cards-two-col score-grid">
          <div className="card">
            <div className="card-title">IP 可信度评分</div>
            <div className="score-ip-list">
              {cardList.map((card) => (
                <div key={card.label} className={`score-ip-row${card.showRiskDetails ? " has-risk-details" : ""}`}>
                  <strong className="score-ip-label">{card.label}</strong>
                  <div className="score-ip-addresses">
                    {(card.ips?.length ? card.ips : [{ version: "IPv4" as const, value: "N/A" }]).map((ip) => (
                      <span key={`${card.label}-${ip.version}-${ip.value}`} className="score-ip-address">
                        <span className="tag tag-neutral">{ip.version}</span>
                        <code>{ip.value}</code>
                      </span>
                    ))}
                  </div>
                  <span className="score-ip-geo">
                    <FlagMark countryCode={card.countryCode} /> {card.geo ?? "N/A"}
                  </span>
                  {card.showRiskDetails ? (
                    <dl className="score-ip-risk-details">
                      <div className="score-ip-risk-item">
                        <dt>地区 / 城市</dt>
                        <dd>{[card.snapshot?.country, card.snapshot?.city].filter(Boolean).join(" / ") || "N/A"}</dd>
                      </div>
                      <div className="score-ip-risk-item">
                        <dt>IP 属性</dt>
                        <dd>{card.snapshot?.ipType ?? "N/A"}</dd>
                      </div>
                      <div className="score-ip-risk-item">
                        <dt>ASN</dt>
                        <dd>{card.snapshot?.asn ?? "N/A"}</dd>
                      </div>
                      <div className="score-ip-risk-item">
                        <dt>运营商</dt>
                        <dd>{card.snapshot?.carrier ?? "N/A"}</dd>
                      </div>
                      <div className="score-ip-risk-item is-wide">
                        <dt>风险标记</dt>
                        <dd>{formatRiskFlags(card.snapshot)}</dd>
                      </div>
                    </dl>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="gauge-wrap">
              <div className="gauge-score">
                <span
                  style={{
                    color:
                      (risk?.trustScore ?? 0) >= 95
                        ? "#0a6e1e"
                        : (risk?.trustScore ?? 0) >= 80
                          ? "#1b8a2d"
                          : (risk?.trustScore ?? 0) >= 50
                            ? "#6fcf7c"
                            : "#d4a017"
                  }}
                >
                  {risk?.trustScore ?? "N/A"}
                </span>{" "}
                {risk?.trustLabel ? <span className="tag tag-safe">{risk.trustLabel}</span> : null}
              </div>
              <div className="gauge-text">{risk?.trustSummary ?? "等待检测"}</div>
              <div className="gauge-bar">
                <div className="gauge-pointer" style={{ left: `${Math.min(risk?.trustScore ?? 0, 100)}%` }} />
              </div>
              <div className="gauge-labels">
                <span>0 高危</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100 可信</span>
              </div>
            </div>
            <div className="score-history">
              <div className="score-history-head">
                <strong>历史 IP 出口变化</strong>
                <span>{history.length} 条记录</span>
              </div>
              <div className="score-history-list">
                {history.map((item, index) => (
                  <div key={`${item.ip}-${item.time}`} className="score-history-row">
                    <span className="score-history-time">
                      {new Date(item.time).toLocaleString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                      {index === 0 ? " 当前" : ""}
                    </span>
                    <strong>
                      <FlagMark countryCode={item.countryCode} /> {item.ip}
                    </strong>
                    <span>{item.city ?? "N/A"}</span>
                  </div>
                ))}
                {!history.length ? <p className="score-history-empty">暂无历史出口记录</p> : null}
              </div>
            </div>
          </div>
          <EnvironmentRiskCard device={device} />
        </div>

      </div>

      <footer>&copy; 2026 <a href="/risk/">LeakTest</a></footer>
    </main>
  );
}
