import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "WebRTC 与 UDP 检测 | LeakTest",
  description: "检测 ICE 候选、UDP 出口与可能的 WebRTC 泄露路径。"
};

export default function WebrtcLayout({ children }: { children: ReactNode }) {
  return children;
}
