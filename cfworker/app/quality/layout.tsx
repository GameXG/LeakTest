import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "全球上网质量 | LeakTest",
  description: "挑选中国境内与境外主流网站进行首页异步测速，对比延迟和访问质量。"
};

export default function QualityLayout({ children }: { children: ReactNode }) {
  return children;
}
