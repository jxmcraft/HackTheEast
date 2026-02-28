import { NextResponse } from "next/server";
import { createClientOrThrow } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClientOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("last_canvas_sync_at")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    last_canvas_sync_at: profile?.last_canvas_sync_at ?? null,
  });
}
