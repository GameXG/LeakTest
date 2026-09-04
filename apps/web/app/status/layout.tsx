import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "服务状态查询 | LeakTest",
  description: "获取主流网站尤其是 AI 服务的官方在线状态接口数据，比如 Claude、ChatGPT、Codex 等。"
};

export default function StatusLayout({ children }: { children: ReactNode }) {
  return children;
}
