import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await fetch("https://status.claude.com/api/v2/summary.json", {
      cache: "no-store"
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "Failed to fetch status data." }, { status: upstream.status });
    }

    const data = (await upstream.json()) as {
      page?: { updated_at?: string };
      status?: { indicator?: string; description?: string };
      components?: Array<{ name?: string; status?: string }>;
      incidents?: Array<{
        name?: string;
        status?: string;
        impact?: string;
        created_at?: string;
        updated_at?: string;
      }>;
    };

    return NextResponse.json(
      {
        overall: data.status?.description === "All Systems Operational" ? "全部正常" : "异常且不稳定",
        overall_indicator: data.status?.indicator ?? "none",
        components: (data.components ?? []).map((component) => ({
          name: component.name ?? "",
          status: component.status ?? "",
          status_cn: component.status === "operational" ? "正常运行" : component.status ?? ""
        })),
        incidents: data.incidents ?? [],
        fetched_at: data.page?.updated_at ?? new Date().toISOString()
      },
      {
        headers: {
          "cache-control": "no-store"
        }
      }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch Claude status." }, { status: 502 });
  }
}
