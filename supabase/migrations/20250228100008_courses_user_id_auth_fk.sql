-- Fix courses.user_id to reference auth.users(id) so sync works (app uses auth, not public.users).
ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_user_id_fkey;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
