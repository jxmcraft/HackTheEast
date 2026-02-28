-- Phase 4: Lesson Q&A chat history and user bookmarks/highlights

-- lesson_chat: store Q&A messages per lesson for context and memory
CREATE TABLE IF NOT EXISTS public.lesson_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'tutor')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_chat_lesson_id ON public.lesson_chat(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_chat_user_id ON public.lesson_chat(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_chat_created_at ON public.lesson_chat(lesson_id, created_at);

ALTER TABLE public.lesson_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lesson_chat"
  ON public.lesson_chat FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lesson_chat"
  ON public.lesson_chat FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- user_bookmarks: highlights, notes, bookmarks (lesson or slide)
CREATE TABLE IF NOT EXISTS public.user_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('highlight', 'note', 'bookmark')),
  content text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_id ON public.user_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_lesson_id ON public.user_bookmarks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_type ON public.user_bookmarks(user_id, type);

ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_bookmarks"
  ON public.user_bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own user_bookmarks"
  ON public.user_bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own user_bookmarks"
  ON public.user_bookmarks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own user_bookmarks"
  ON public.user_bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);
