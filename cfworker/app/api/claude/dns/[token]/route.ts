import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      error: "Legacy DNS endpoint is no longer used."
    },
    {
      status: 410,
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}
