import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "IP 查询 | LeakTest",
  description: "比较多个公开 IP 查询商对当前公网 IPv4 / IPv6、位置、时区、运营商与风险类型的解释差异。"
};

export default function IpLayout({ children }: { children: ReactNode }) {
  return children;
}
