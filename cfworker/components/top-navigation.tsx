"use client";

import Link from "next/link";
import { LanguageToggle, useLanguage } from "./language-provider";

export function TopNavigation() {
  const { lang } = useLanguage();
  const labels =
    lang === "zh"
      ? {
          brand: "LeakTest",
          home: "风险",
          ping: "上网质量",
          ip: "IP",
          dns: "分流",
          webrtc: "WebRTC",
          status: "状态"
        }
      : {
          brand: "LeakTest",
          home: "Risk",
          ping: "Quality",
          ip: "IP",
          dns: "Routing",
          webrtc: "WebRTC",
          status: "Status"
        };

  return (
    <div className="topbar-inner">
      <Link href="/" className="brand-mark nav-link">
        {labels.brand}
      </Link>
      <nav className="topnav-links" aria-label="Primary">
        <Link href="/risk" className="nav-link">
          {labels.home}
        </Link>
        <Link href="/quality" className="nav-link">
          {labels.ping}
        </Link>
        <Link href="/ip" className="nav-link">
          {labels.ip}
        </Link>
        <Link href="/routing" className="nav-link">
          {labels.dns}
        </Link>
        <Link href="/webrtc" className="nav-link">
          {labels.webrtc}
        </Link>
        <Link href="/status" className="nav-link">
          {labels.status}
        </Link>
      </nav>
      <LanguageToggle />
    </div>
  );
}
