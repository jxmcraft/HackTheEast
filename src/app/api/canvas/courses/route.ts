import { NextResponse } from "next/server";
import { syncCourses } from "@/lib/canvas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const courses = await syncCourses();
    return NextResponse.json(courses);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to sync courses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
