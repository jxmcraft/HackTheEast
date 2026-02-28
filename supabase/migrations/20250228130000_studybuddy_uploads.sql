-- StudyBuddy user-uploaded materials (PDF, DOCX, PPTX). Temporary storage per user.
CREATE TABLE IF NOT EXISTS public.studybuddy_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pdf', 'docx', 'pptx')),
  extracted_text text,
  key_points jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studybuddy_uploads_user_id ON public.studybuddy_uploads(user_id);

ALTER TABLE public.studybuddy_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own uploads" ON public.studybuddy_uploads;
CREATE POLICY "Users can view own uploads"
  ON public.studybuddy_uploads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own uploads" ON public.studybuddy_uploads;
CREATE POLICY "Users can insert own uploads"
  ON public.studybuddy_uploads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own uploads" ON public.studybuddy_uploads;
CREATE POLICY "Users can delete own uploads"
  ON public.studybuddy_uploads FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.studybuddy_uploads IS 'User-uploaded materials for StudyBuddy: PDF, DOCX, PPTX. Extracted text and key points per page/slide.';
