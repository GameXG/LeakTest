import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "全球分流检测 | LeakTest",
  description: "对比公开 IP 查询商与 Cloudflare 站点观测，观察当前网络是否存在按站点或按入口分流。"
};

export default function RoutingLayout({ children }: { children: ReactNode }) {
  return children;
}
