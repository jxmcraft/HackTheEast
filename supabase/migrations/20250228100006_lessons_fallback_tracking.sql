-- Track fallback usage and retrieval quality for lessons.
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS fallback_used text DEFAULT 'none';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS retrieval_score float;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS source_count int;

-- Mark user-uploaded / user-provided materials.
ALTER TABLE public.course_materials ADD COLUMN IF NOT EXISTS is_user_provided boolean DEFAULT false;
