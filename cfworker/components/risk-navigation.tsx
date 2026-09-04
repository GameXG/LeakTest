"use client";

import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/ip/", full: "IP 查询", short: "IP查询" },
  { href: "/risk/", full: "AI 封号分析", short: "封号分析" },
  { href: "/quality/", full: "全球上网质量", short: "质量" },
  { href: "/routing/", full: "全球分流检测", short: "分流" },
  { href: "/webrtc/", full: "WebRTC 检测", short: "WebRTC" },
  { href: "/status/", full: "服务状态查询", short: "状态" }
] as const;

export function RiskNavigation() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <a href="/risk/" className="console-brand" aria-label="LeakTest 首页">
        <span className="brand-signal" aria-hidden="true" />
        <span className="brand-copy">
          <strong>LEAKTEST</strong>
          <small>NETWORK INTELLIGENCE</small>
        </span>
      </a>
      <div className="nav-links">
        {NAV_ITEMS.map((item) => {
          const normalizedHref = item.href.slice(0, -1);
          const active = pathname === normalizedHref || pathname === item.href;

          return (
            <a key={item.href} href={item.href} className={active ? "active" : undefined}>
              <span className="full">{item.full}</span>
              <span className="short">{item.short}</span>
            </a>
          );
        })}
      </div>
      <div className="system-live"><span aria-hidden="true" />LIVE</div>
    </nav>
  );
}
