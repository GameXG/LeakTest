import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppChrome } from "../components/app-chrome";
import "./globals.css";
import "./claude/claude.css";
import "./console.css";

export const metadata: Metadata = {
  title: "LeakTest",
  description: "面向 AI 访问、DNS、WebRTC 与出口身份的本地检测工作台。"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
