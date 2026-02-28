-- Store content hash per (course, canvas_item_id) so we skip re-ingesting unchanged materials
-- and replace chunks when content changes.
CREATE TABLE IF NOT EXISTS public.material_content_hashes (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  canvas_item_id text NOT NULL,
  content_hash text NOT NULL,
  PRIMARY KEY (course_id, canvas_item_id)
);

CREATE INDEX IF NOT EXISTS idx_material_content_hashes_course_id
  ON public.material_content_hashes(course_id);

ALTER TABLE public.material_content_hashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage material_content_hashes"
  ON public.material_content_hashes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
