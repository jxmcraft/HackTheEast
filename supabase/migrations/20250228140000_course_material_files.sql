-- Store references to original file binaries for course materials (PDF, DOCX, PPTX).
-- Binary content is stored in Supabase Storage bucket course-material-files; this table holds metadata.

CREATE TABLE IF NOT EXISTS public.course_material_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  canvas_item_id text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  created_at timestamptz DEFAULT now(),
  UNIQUE(course_id, canvas_item_id)
);

CREATE INDEX IF NOT EXISTS idx_course_material_files_course_id
  ON public.course_material_files(course_id);

ALTER TABLE public.course_material_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read course_material_files"
  ON public.course_material_files FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage course_material_files"
  ON public.course_material_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.course_material_files IS 'References to original file binaries (PDF, DOCX, PPTX) stored in Storage bucket course-material-files';

-- Create Storage bucket and RLS for course material file binaries.
-- If your Supabase project has the storage schema, run the following in SQL Editor after this migration:
--
--   INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
--   VALUES ('course-material-files', 'course-material-files', false, 52428800,
--     ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
--   ON CONFLICT (id) DO NOTHING;
--
--   CREATE POLICY "Authenticated read course material files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'course-material-files');
--   CREATE POLICY "Authenticated insert course material files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'course-material-files');
--   CREATE POLICY "Authenticated update course material files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'course-material-files');
--   CREATE POLICY "Authenticated delete course material files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'course-material-files');
--
-- Or create the bucket "course-material-files" (private, 50MB limit) in Dashboard > Storage.
