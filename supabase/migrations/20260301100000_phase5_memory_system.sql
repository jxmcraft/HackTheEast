-- Phase 5: Memory & Context System
-- user_memories: learning memories (struggles, mastered, preferences)
-- learning_progress: per-user per-course per-topic status
-- study_sessions: session logs (course_id/topic as text to match app)

-- user_memories
CREATE TABLE IF NOT EXISTS public.user_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN ('concept_struggle', 'concept_mastered', 'learning_preference', 'topic_interest')),
  content text NOT NULL,
  importance_score int DEFAULT 5 CHECK (importance_score >= 1 AND importance_score <= 10),
  source_lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  last_accessed timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user ON public.user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_type ON public.user_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memories_importance ON public.user_memories(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_user_importance ON public.user_memories(user_id, importance_score DESC);

ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_memories"
  ON public.user_memories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own user_memories"
  ON public.user_memories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own user_memories"
  ON public.user_memories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own user_memories"
  ON public.user_memories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- learning_progress (course_id as text to match Canvas course id in app)
CREATE TABLE IF NOT EXISTS public.learning_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  topic text NOT NULL,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'struggling', 'mastered')),
  interactions_count int DEFAULT 0,
  last_activity timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_learning_progress_user ON public.learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_course ON public.learning_progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_status ON public.learning_progress(user_id, status);

ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning_progress"
  ON public.learning_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own learning_progress"
  ON public.learning_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own learning_progress"
  ON public.learning_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- study_sessions
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text,
  topic text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  lessons_generated int DEFAULT 0,
  questions_asked int DEFAULT 0,
  rating int CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON public.study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_started ON public.study_sessions(started_at DESC);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own study_sessions"
  ON public.study_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study_sessions"
  ON public.study_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study_sessions"
  ON public.study_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
