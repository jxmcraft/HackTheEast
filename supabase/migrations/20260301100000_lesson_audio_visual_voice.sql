-- Add voice_id to lesson_audio_visual for persistence and display.
ALTER TABLE public.lesson_audio_visual
  ADD COLUMN IF NOT EXISTS voice_id text;
