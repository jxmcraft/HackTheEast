-- Persist synced courses and assignments per user.
-- Allow same Canvas course for different users; add course_code for display.

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS course_code text;

-- Drop single-column unique on canvas_id so we can have (canvas_id, user_id) per user
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'courses_canvas_id_key' AND conrelid = 'public.courses'::regclass
  ) THEN
    ALTER TABLE public.courses DROP CONSTRAINT courses_canvas_id_key;
  END IF;
END $$;

-- Unique per user per Canvas course (for upsert)
ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_canvas_id_user_id_key;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_canvas_id_user_id_key UNIQUE (canvas_id, user_id);
