-- Ensure last_canvas_sync_at exists on profiles (for Settings "Last sync" and Sync courses).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_canvas_sync_at timestamptz;
