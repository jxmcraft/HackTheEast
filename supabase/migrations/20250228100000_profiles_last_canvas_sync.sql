-- Phase 2: last Canvas sync timestamp on profiles (for Settings UI)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_canvas_sync_at timestamptz;
