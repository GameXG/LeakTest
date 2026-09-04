import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await request.text();
    return NextResponse.json(
      { ok: true, stored: false },
      {
        status: 200,
        headers: {
          "cache-control": "no-store"
        }
      }
    );
  } catch {
    return NextResponse.json({ error: "Failed to record local session." }, { status: 502 });
  }
}
