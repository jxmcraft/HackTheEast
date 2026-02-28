-- StudyBuddy avatar & chatbot sync to account (user_preferences)
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS studybuddy_data jsonb DEFAULT '{}';

COMMENT ON COLUMN public.user_preferences.studybuddy_data IS 'StudyBuddy profile: name, avatarConfig, personalityPrompt, struggles, lastTopic, lastSection, etc.';
