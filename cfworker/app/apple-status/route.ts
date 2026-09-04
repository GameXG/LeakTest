import { SOURCE_REGISTRY } from "../../lib/source-registry";
import type { AppleStatusResponse } from "../../lib/status-normalizer";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8"
};

function isAppleStatusResponse(value: unknown): value is AppleStatusResponse {
  if (!value || typeof value !== "object") return false;

  const services = (value as { services?: unknown }).services;
  return Array.isArray(services);
}

export async function GET() {
  try {
    const upstream = await fetch(SOURCE_REGISTRY.officialStatus.apple.apiUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json, text/javascript;q=0.9"
      }
    });

    if (!upstream.ok) {
      return Response.json(
        { error: `Apple 官方状态源返回 HTTP ${upstream.status}` },
        { status: 502, headers: responseHeaders },
      );
    }

    const payload = (await upstream.json()) as unknown;
    if (!isAppleStatusResponse(payload)) {
      return Response.json(
        { error: "Apple 官方状态源返回了无法识别的数据结构" },
        { status: 502, headers: responseHeaders },
      );
    }

    return Response.json(payload, { headers: responseHeaders });
  } catch {
    return Response.json(
      { error: "Apple 官方状态源暂时不可用" },
      { status: 502, headers: responseHeaders },
    );
  }
}
