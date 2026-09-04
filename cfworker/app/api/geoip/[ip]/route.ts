import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type IpApiResponse = {
  cc?: string;
  company_name?: string;
  asn_org?: string;
  location?: {
    country?: string;
    state?: string;
    city?: string;
    country_code?: string;
  };
  company?: {
    name?: string;
  };
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ ip: string }> }
) {
  try {
    const { ip } = await context.params;
    const upstream = await fetch(`https://api.ipapi.is?q=${encodeURIComponent(ip)}`, {
      cache: "no-store"
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "Failed to fetch geo data." }, { status: upstream.status });
    }

    const data = (await upstream.json()) as IpApiResponse;

    return NextResponse.json(
      {
        country: data.location?.country ?? data.cc ?? "",
        region: data.location?.state ?? "",
        city: data.location?.city ?? "",
        isp: data.company?.name ?? data.company_name ?? data.asn_org ?? "",
        country_code: (data.location?.country_code ?? data.cc ?? "").toLowerCase()
      },
      {
        headers: {
          "cache-control": "no-store"
        }
      }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch geo data." }, { status: 502 });
  }
}
