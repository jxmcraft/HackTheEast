import { NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";
import { getExtractedCalendarEvents } from "@/lib/calendar/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/calendar/extracted?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * Returns calendar events extracted from course materials for the current user's courses.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get("start_date");
  const endDateParam = searchParams.get("end_date");

  if (!startDateParam || !endDateParam) {
    return NextResponse.json(
      { error: "start_date and end_date (YYYY-MM-DD) are required" },
      { status: 400 }
    );
  }

  const supabase = createClientOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: courses, error: coursesErr } = await supabase
    .from("courses")
    .select("id, name")
    .eq("user_id", user.id);

  if (coursesErr || !courses?.length) {
    return NextResponse.json([]);
  }

  const courseIds = courses.map((c) => c.id);
  const courseNames = new Map(courses.map((c) => [c.id, c.name]));
  const startDate = startDateParam;
  const endDate = endDateParam.endsWith("T")
    ? endDateParam
    : `${endDateParam}T23:59:59.999Z`;

  const events = await getExtractedCalendarEvents(
    courseIds,
    startDate,
    endDate,
    { supabase }
  );

  const withSubtitle = events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    start_at: ev.start_at,
    end_at: ev.end_at,
    all_day: ev.all_day,
    subtitle: courseNames.get(ev.course_id) ?? "Course",
    kind: "extracted" as const,
    snippet: ev.snippet,
  }));

  return NextResponse.json(withSubtitle);
}
