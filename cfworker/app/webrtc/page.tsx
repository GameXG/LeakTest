"use client";

import { DiagnosticsSkeleton } from "../../components/diagnostics-skeleton";
import { FlagMark } from "../../components/flag-mark";
import { RiskShell } from "../../components/risk-shell";
import { useLiveDiagnostics } from "../../lib/use-live-diagnostics";

function isPrivateAddress(address?: string) {
  if (!address) {
    return false;
  }

  if (address.includes(":")) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    address.startsWith("127.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

function candidateVersion(address?: string) {
  if (!address) {
    return "未知";
  }

  return address.includes(":") ? "IPv6" : "IPv4";
}

export default function WebrtcPage() {
  const { loading, error, progress, webrtc, refresh } = useLiveDiagnostics();

  const uniqueCandidates = Array.from(
    new Map(
      (webrtc?.candidates ?? []).map((candidate, index) => [
        `${candidate.candidateType}-${candidate.protocol ?? "udp"}-${candidate.address ?? index}`,
        candidate
      ])
    ).values()
  );

  const classifiedCandidates = uniqueCandidates.map((candidate) => {
    const address = candidate.address;
    const isPrivate = isPrivateAddress(address);
    const isPublic = Boolean(address) && !isPrivate;
    const matchesBaseline = Boolean(
      address && (webrtc?.baselineIps ?? []).includes(address)
    );

    return {
      ...candidate,
      isPrivate,
      isPublic,
      version: candidateVersion(address),
      matchesBaseline
    };
  });

  const differentPublicCandidates = classifiedCandidates.filter(
    (candidate) =>
      candidate.address &&
      candidate.isPublic &&
      (webrtc?.baselineIps?.length ?? 0) > 0 &&
      !(webrtc?.baselineIps ?? []).includes(candidate.address)
  );
  const resultClass =
    webrtc?.status === "warn" ? "warn" : webrtc?.status === "safe" ? "ok" : "";

  return (
    <RiskShell
      section="webrtc"
      title="WebRTC 泄露分析"
      lead="比较浏览器通过 WebRTC 暴露的公网候选与当前主公共出口，判断是否存在真实 IP 泄露。"
      loading={loading}
      progress={progress}
      summary={
        <div className="card card-emphasis" style={{ gridColumn: "1 / -1" }}>
          <p className="section-eyebrow">泄露判断</p>
          <div className="split-overview">
            <div className="quality-stat">
              <span>结论</span>
              <strong className="split-overview-value">
                <span className={`status ${resultClass}`}>{webrtc?.statusLabel ?? "等待检测"}</span>
              </strong>
            </div>
            <div className="quality-stat">
              <span>UDP 出口</span>
              <strong className="split-overview-value">
                {webrtc?.ip ? (
                  <>
                    <FlagMark countryCode={webrtc.countryCode} /> {webrtc.ip}
                  </>
                ) : (
                  "N/A"
                )}
              </strong>
            </div>
            <div className="quality-stat">
              <span>公网候选</span>
              <strong className="split-overview-value">
                {typeof webrtc?.publicCandidateCount === "number" ? webrtc.publicCandidateCount : "N/A"}
              </strong>
            </div>
            <div className="quality-stat">
              <span>STUN 源数量</span>
              <strong className="split-overview-value">
                {typeof webrtc?.stunServerCount === "number" ? webrtc.stunServerCount : "N/A"}
              </strong>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="button" onClick={refresh} disabled={loading}>
              {loading ? "检测中..." : "刷新检测"}
            </button>
          </div>
        </div>
      }
    >
      {loading ? <DiagnosticsSkeleton cards={4} rows={4} /> : null}

      {!loading ? (
        <>
      <section className="cards cards-two-col">
        <article className="card">
          <p className="section-eyebrow">状态</p>
          {error ? <p className="status danger">{error}</p> : null}
          <div className="matrix-list">
            <div className="matrix-row">
              <div>
                <strong>检测结果</strong>
              </div>
              <div className="matrix-meta">
                <span className={`status ${resultClass}`}>{webrtc?.statusLabel ?? "N/A"}</span>
              </div>
            </div>
            <div className="matrix-row">
              <div>
                <strong>UDP 出口</strong>
              </div>
              <div className="matrix-meta">
                <span>{webrtc?.ip ?? "N/A"}</span>
              </div>
            </div>
            <div className="matrix-row">
              <div>
                    <strong>主公共出口</strong>
                  </div>
                  <div className="matrix-meta">
                    <span>{webrtc?.baselineIps?.join(" / ") ?? "N/A"}</span>
                  </div>
                </div>
            <div className="matrix-row">
              <div>
                <strong>归属地</strong>
              </div>
              <div className="matrix-meta">
                <span>{webrtc?.country ?? "N/A"}</span>
              </div>
            </div>
          </div>
        </article>

        <article className="card">
          <p className="section-eyebrow">探测源</p>
          <div className="matrix-list">
            <div className="matrix-row">
              <div>
                <strong>STUN 源数量</strong>
              </div>
              <div className="matrix-meta">
                <span>{typeof webrtc?.stunServerCount === "number" ? webrtc.stunServerCount : "N/A"}</span>
              </div>
            </div>
            <div className="matrix-row">
              <div>
                <strong>公网候选</strong>
              </div>
              <div className="matrix-meta">
                <span>{typeof webrtc?.publicCandidateCount === "number" ? webrtc.publicCandidateCount : "N/A"}</span>
              </div>
            </div>
            <div className="matrix-row">
              <div>
                <strong>IPv4 / IPv6</strong>
              </div>
              <div className="matrix-meta">
                <span>
                  {typeof webrtc?.ipv4Count === "number" || typeof webrtc?.ipv6Count === "number"
                    ? `${webrtc?.ipv4Count ?? 0} / ${webrtc?.ipv6Count ?? 0}`
                    : "N/A"}
                </span>
              </div>
            </div>
            <div className="matrix-row">
              <div>
                <strong>srflx / relay / host</strong>
              </div>
              <div className="matrix-meta">
                <span>
                  {typeof webrtc?.srflxCount === "number" || typeof webrtc?.relayCount === "number" || typeof webrtc?.hostCount === "number"
                    ? `${webrtc?.srflxCount ?? 0} / ${webrtc?.relayCount ?? 0} / ${webrtc?.hostCount ?? 0}`
                    : "N/A"}
                </span>
              </div>
            </div>
            <div className="matrix-row">
              <div>
                <strong>UDP / TCP</strong>
              </div>
              <div className="matrix-meta">
                <span>
                  {typeof webrtc?.udpCount === "number" || typeof webrtc?.tcpCount === "number"
                    ? `${webrtc?.udpCount ?? 0} / ${webrtc?.tcpCount ?? 0}`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </article>

        <article className="card card-emphasis">
          <p className="section-eyebrow">差异候选</p>
          <div className="matrix-list">
            {differentPublicCandidates.length ? (
              differentPublicCandidates.map((candidate, index) => (
                <div key={`${candidate.address}-${index}`} className="matrix-row">
                  <div>
                    <strong>{candidate.address}</strong>
                    <p className="muted">
                      {candidate.candidateType} · {candidate.protocol ?? "udp"} · {candidate.version}
                    </p>
                  </div>
                  <div className="matrix-meta">
                    <span className="tag tag-warn">与主公共出口不同</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="matrix-row">
                <div>
                  <strong>未发现额外公网候选</strong>
                  <p className="muted">当前公网候选没有偏离主公共出口。</p>
                </div>
              </div>
            )}
          </div>
        </article>

        <article className="card">
          <p className="section-eyebrow">候选分组</p>
          <div className="matrix-list">
            <div className="matrix-row">
              <div>
                <strong>公网 / 内网</strong>
              </div>
              <div className="matrix-meta">
                <span>
                  {classifiedCandidates.filter((candidate) => candidate.isPublic).length} / {classifiedCandidates.filter((candidate) => candidate.isPrivate).length}
                </span>
              </div>
            </div>
            <div className="matrix-row">
              <div>
                <strong>IPv4 / IPv6</strong>
              </div>
              <div className="matrix-meta">
                <span>
                  {classifiedCandidates.filter((candidate) => candidate.version === "IPv4").length} / {classifiedCandidates.filter((candidate) => candidate.version === "IPv6").length}
                </span>
              </div>
            </div>
            <div className="matrix-row">
              <div>
                <strong>与基准一致 / 不同</strong>
              </div>
              <div className="matrix-meta">
                <span>
                  {classifiedCandidates.filter((candidate) => candidate.matchesBaseline).length} / {differentPublicCandidates.length}
                </span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="stack">
        <article className="card card-emphasis">
          <p className="section-eyebrow">ICE Candidates</p>
          <div className="matrix-list">
            {classifiedCandidates.map((candidate, index) => (
              <div key={`${candidate.candidateType}-${candidate.address ?? index}`} className="matrix-row">
                <div>
                  <strong>{candidate.address ?? "N/A"}</strong>
                  <p className="muted">
                    {candidate.candidateType} · {candidate.protocol ?? "udp"} · {candidate.version}
                  </p>
                </div>
                <div className="matrix-meta">
                  <span className={`tag ${candidate.isPublic ? "tag-info" : "tag-neutral"}`}>
                    {candidate.isPublic ? "公网" : "内网"}
                  </span>
                  {candidate.matchesBaseline ? (
                    <span className="tag tag-safe-dark">与主公共出口一致</span>
                  ) : candidate.isPublic && (webrtc?.baselineIps?.length ?? 0) > 0 ? (
                    <span className="tag tag-warn">与主公共出口不同</span>
                  ) : null}
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
