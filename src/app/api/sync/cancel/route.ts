/**
 * POST /api/sync/cancel
 * Sets sync status to idle so the background task stops on its next check.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resetSyncProgress } from "@/lib/sync-progress-db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await resetSyncProgress(supabase, user.id);
    return NextResponse.json({ ok: true, message: "Sync cancelled" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cancel failed";
    console.error("[POST /api/sync/cancel]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
