-- Phase 2: lesson requests for dashboard "recent lessons"
CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id_canvas bigint NOT NULL,
  course_name text,
  topic text NOT NULL,
  context text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lessons_user_id ON public.lessons(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_created_at ON public.lessons(created_at DESC);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lessons"
  ON public.lessons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lessons"
  ON public.lessons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lessons"
  ON public.lessons FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
