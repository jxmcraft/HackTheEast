-- Store calendar events extracted from course materials (syllabi, announcements, etc.).
-- These are shown on the Sync Dashboard calendar alongside Canvas events and assignments.

CREATE TABLE IF NOT EXISTS public.extracted_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean DEFAULT false,
  source_canvas_item_id text,
  snippet text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_calendar_events_course_id
  ON public.extracted_calendar_events(course_id);

CREATE INDEX IF NOT EXISTS idx_extracted_calendar_events_start_at
  ON public.extracted_calendar_events(start_at);

ALTER TABLE public.extracted_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read extracted_calendar_events"
  ON public.extracted_calendar_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage extracted_calendar_events"
  ON public.extracted_calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.extracted_calendar_events IS 'Dates/times extracted from course materials for the calendar';
