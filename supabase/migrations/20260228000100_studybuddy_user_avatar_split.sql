-- Separate StudyBuddy user and avatar profiles for independent updates
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS studybuddy_user_profile jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS studybuddy_avatar_profile jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_preferences.studybuddy_user_profile IS 'StudyBuddy User Profile: name, sex, birthday, email, profilePicture';
COMMENT ON COLUMN public.user_preferences.studybuddy_avatar_profile IS 'StudyBuddy Avatar Profile: avatarName, avatarConfig, teachingStylePrompt, tutorVoice';

-- Backfill from legacy combined payload when available
UPDATE public.user_preferences
SET studybuddy_user_profile = jsonb_build_object(
  'name', COALESCE(studybuddy_data->>'name', ''),
  'sex', COALESCE(studybuddy_data->'userProfile'->>'sex', ''),
  'birthday', COALESCE(studybuddy_data->'userProfile'->>'birthday', ''),
  'email', COALESCE(studybuddy_data->'userProfile'->>'email', ''),
  'profilePicture', COALESCE(studybuddy_data->'userProfile'->>'profilePicture', '')
)
WHERE studybuddy_user_profile = '{}'::jsonb;

UPDATE public.user_preferences
SET studybuddy_avatar_profile = jsonb_build_object(
  'avatarName', COALESCE(studybuddy_data->'avatarProfile'->>'avatarName', studybuddy_data->>'name', ''),
  'avatarConfig', COALESCE(studybuddy_data->'avatarProfile'->'avatarConfig', studybuddy_data->'avatarConfig', '{}'::jsonb),
  'teachingStylePrompt', COALESCE(studybuddy_data->'avatarProfile'->>'teachingStylePrompt', studybuddy_data->>'personalityPrompt', ''),
  'tutorVoice', COALESCE(studybuddy_data->'avatarProfile'->>'tutorVoice', studybuddy_data->'avatarConfig'->>'voiceId', 'English_expressive_narrator')
)
WHERE studybuddy_avatar_profile = '{}'::jsonb;
