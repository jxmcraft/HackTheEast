-- Current-course progress for more detailed progress bar (materials/chunks in active course).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_current_course_materials int DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_current_course_chunks int DEFAULT 0;

COMMENT ON COLUMN public.profiles.sync_current_course_materials IS 'Materials stored in the course currently being ingested';
COMMENT ON COLUMN public.profiles.sync_current_course_chunks IS 'Chunks created in the course currently being ingested';
