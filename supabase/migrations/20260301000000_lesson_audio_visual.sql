-- Store generated podcast/slide-deck assets per lesson and mode (audio vs slides).
-- One row per (lesson_id, mode); reloads use this instead of regenerating.
CREATE TABLE IF NOT EXISTS public.lesson_audio_visual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('podcast', 'slides')),
  script text NOT NULL DEFAULT '',
  slides jsonb NOT NULL DEFAULT '[]',
  audio_url text NOT NULL DEFAULT '',
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, mode)
);

CREATE INDEX IF NOT EXISTS idx_lesson_audio_visual_lesson_id ON public.lesson_audio_visual(lesson_id);

ALTER TABLE public.lesson_audio_visual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lesson_audio_visual"
  ON public.lesson_audio_visual FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_audio_visual.lesson_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own lesson_audio_visual"
  ON public.lesson_audio_visual FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_audio_visual.lesson_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own lesson_audio_visual"
  ON public.lesson_audio_visual FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_audio_visual.lesson_id AND l.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id = lesson_audio_visual.lesson_id AND l.user_id = auth.uid()
    )
  );
