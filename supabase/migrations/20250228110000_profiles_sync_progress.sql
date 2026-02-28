-- Sync progress on profiles: status, phase, course index/total, message, error, result.
-- Frontend polls GET /api/sync/status to read these columns.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'idle' CHECK (sync_status IN ('idle', 'running', 'completed', 'failed'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_started_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_completed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_phase text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_course_index int DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_course_total int DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_message text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_error text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_result jsonb;

COMMENT ON COLUMN public.profiles.sync_status IS 'Current sync job: idle | running | completed | failed';
COMMENT ON COLUMN public.profiles.sync_result IS 'On completion: { courses, assignments, ingest } for display';
