import { NextResponse } from "next/server";
import { syncAssignments } from "@/lib/canvas";
import { getCanvasCredentialsFromProfile } from "@/lib/canvas-credentials";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const credentials = await getCanvasCredentialsFromProfile();
    const assignments = await syncAssignments(credentials);
    return NextResponse.json(assignments);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to sync assignments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
