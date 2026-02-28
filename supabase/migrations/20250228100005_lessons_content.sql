-- Store generated lesson content and mode for Phase 3.
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS learning_mode text DEFAULT 'text';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS content jsonb;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS sources jsonb;
