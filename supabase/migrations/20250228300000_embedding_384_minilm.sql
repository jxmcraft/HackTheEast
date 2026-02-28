-- Use 384-dimensional embeddings for local all-MiniLM-L6-v2.
-- Run after 20250228200000 if the app uses the local MiniLM model. Converts vector(768) -> vector(384).

DROP INDEX IF EXISTS idx_course_materials_embedding;

ALTER TABLE public.course_materials ADD COLUMN IF NOT EXISTS embedding_new vector(384);
UPDATE public.course_materials SET embedding_new = NULL;
ALTER TABLE public.course_materials DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.course_materials RENAME COLUMN embedding_new TO embedding;

CREATE INDEX IF NOT EXISTS idx_course_materials_embedding ON public.course_materials
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE OR REPLACE FUNCTION match_course_materials(
  query_embedding vector(384),
  match_count int DEFAULT 5,
  filter_course_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, content_text text, metadata jsonb, similarity float)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.content_text,
    cm.metadata,
    (cm.embedding <=> query_embedding)::float AS similarity
  FROM public.course_materials cm
  WHERE (filter_course_id IS NULL OR cm.course_id = filter_course_id)
    AND cm.embedding IS NOT NULL
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
