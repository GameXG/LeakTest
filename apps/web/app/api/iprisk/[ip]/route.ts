import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type IpApiResponse = {
  ip?: string;
  cc?: string;
  company_name?: string;
  asn_num?: number;
  asn_org?: string;
  is_datacenter?: boolean;
  is_tor?: boolean;
  is_proxy?: boolean;
  is_vpn?: boolean;
  is_crawler?: boolean;
  is_abuser?: boolean;
  is_mobile?: boolean;
  company?: {
    name?: string;
    type?: string;
    abuser_score?: string;
  };
  datacenter?: {
    datacenter?: string;
  };
  asn?: {
    asn?: number;
    org?: string;
    route?: string;
    type?: string;
  };
  location?: {
    country?: string;
    state?: string;
    city?: string;
    country_code?: string;
  };
};

function deriveTrustScore(data: IpApiResponse) {
  if (data.is_tor) return 5;
  if (data.is_vpn) return 25;
  if (data.is_proxy) return 35;
  if (data.is_datacenter) return 45;
  if (data.is_abuser) return 30;
  return 100;
}

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
      return NextResponse.json({ error: "Failed to fetch IP risk data." }, { status: upstream.status });
    }

    const data = (await upstream.json()) as IpApiResponse;

    return NextResponse.json(
      {
        ip: data.ip ?? ip,
        cidr: data.asn?.route ?? "",
        is_datacenter: data.is_datacenter ?? false,
        isResidential: data.is_datacenter === false ? true : false,
        isBroadcast: null,
        is_vpn: data.is_vpn ?? false,
        is_proxy: data.is_proxy ?? false,
        is_tor: data.is_tor ?? false,
        is_crawler: data.is_crawler ?? false,
        is_abuser: data.is_abuser ?? false,
        is_mobile: data.is_mobile ?? false,
        company_type: data.company?.type ?? data.asn?.type ?? "",
        company_name: data.company?.name ?? data.asn?.org ?? data.company_name ?? data.asn_org ?? "",
        abuser_score: data.company?.abuser_score ?? "",
        datacenter_name: data.datacenter?.datacenter ?? "",
        asn: data.asn?.asn ?? data.asn_num ?? null,
        asOrganization: data.asn?.org ?? data.asn_org ?? data.company_name ?? "",
        country: data.location?.country ?? data.cc ?? "",
        countryCode: (data.location?.country_code ?? data.cc ?? "").toLowerCase(),
        region: data.location?.state ?? "",
        city: data.location?.city ?? "",
        source: "ipapi.is",
        trust_score: deriveTrustScore(data)
      },
      {
        headers: {
          "cache-control": "no-store"
        }
      }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch IP risk data." }, { status: 502 });
  }
}
