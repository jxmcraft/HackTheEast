import { NextResponse } from "next/server";
import { syncCalendar } from "@/lib/canvas";
import { getCanvasCredentialsFromProfile } from "@/lib/canvas-credentials";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date") ?? undefined;
  const endDate = searchParams.get("end_date") ?? undefined;
  try {
    const credentials = await getCanvasCredentialsFromProfile();
    const events = await syncCalendar({ startDate, endDate }, credentials);
    return NextResponse.json(events);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to sync calendar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
