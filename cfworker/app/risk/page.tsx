import type { Metadata } from "next";
import { RiskPageContent } from "../../components/risk-page-content";

export const metadata: Metadata = {
  title: "AI 封号分析 | LeakTest",
  description: "比较当前出口 IP 的纯净度、风险属性与本地环境一致性，判断 AI 服务场景下的封号风险。"
};

export default function RiskPage() {
  return <RiskPageContent />;
}
