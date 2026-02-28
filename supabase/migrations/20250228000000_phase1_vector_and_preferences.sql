-- Phase 1: Vector DB and user preferences for AI Study Companion
-- Run in Supabase SQL Editor or via: supabase db push

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. course_materials table (course_id references our courses.id for RLS consistency)
CREATE TABLE IF NOT EXISTS public.course_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  canvas_item_id text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('lecture', 'file', 'page', 'assignment')),
  content_text text NOT NULL,
  metadata jsonb DEFAULT '{}',
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  UNIQUE(canvas_item_id)
);

CREATE INDEX IF NOT EXISTS idx_course_materials_course_id ON public.course_materials(course_id);
CREATE INDEX IF NOT EXISTS idx_course_materials_content_type ON public.course_materials(content_type);
CREATE INDEX IF NOT EXISTS idx_course_materials_embedding ON public.course_materials
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 3. Vector search function
CREATE OR REPLACE FUNCTION match_course_materials(
  query_embedding vector(1536),
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

-- 4. user_preferences table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_mode text DEFAULT 'text' CHECK (learning_mode IN ('text', 'audio', 'slides')),
  avatar_style text DEFAULT 'encouraging' CHECK (avatar_style IN ('strict', 'encouraging', 'socratic')),
  avatar_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. RLS
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- course_materials: read for authenticated users (materials are scoped by course -> user via courses table)
CREATE POLICY "Authenticated users can read course_materials"
  ON public.course_materials FOR SELECT
  TO authenticated
  USING (true);

-- Allow insert/update/delete for authenticated users (ingest runs as authenticated user; restrict by course ownership in app)
CREATE POLICY "Authenticated users can manage course_materials"
  ON public.course_materials FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- user_preferences: users can only read/write their own row
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger to keep updated_at on user_preferences
CREATE OR REPLACE FUNCTION public.set_user_preferences_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_user_preferences_updated_at();
