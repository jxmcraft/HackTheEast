-- Add Canvas API columns to profiles (required for Settings → Canvas API Integration).
-- PostgREST schema cache will pick these up after migration.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS canvas_api_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS canvas_api_key text;
