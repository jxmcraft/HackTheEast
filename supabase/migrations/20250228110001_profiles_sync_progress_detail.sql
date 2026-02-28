-- Detailed sync progress: materials and chunks counts for progress bar.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_materials_stored int DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_chunks_created int DEFAULT 0;

COMMENT ON COLUMN public.profiles.sync_materials_stored IS 'Cumulative materials stored so far (for progress bar)';
COMMENT ON COLUMN public.profiles.sync_chunks_created IS 'Cumulative embedding chunks created so far (for progress bar)';
