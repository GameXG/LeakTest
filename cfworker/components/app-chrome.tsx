"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LanguageProvider } from "./language-provider";
import { TopNavigation } from "./top-navigation";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const replicaPrefixes = ["/claude", "/risk", "/ip", "/routing", "/webrtc", "/status", "/quality"];
  const isReplicaPage = replicaPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isReplicaPage) {
    return children;
  }

  return (
    <LanguageProvider>
      <div className="app-shell">
        <header className="topbar">
          <TopNavigation />
        </header>
        {children}
      </div>
    </LanguageProvider>
  );
}
