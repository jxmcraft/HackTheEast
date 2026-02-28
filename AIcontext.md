{
  "project": "HTE (HackTheEast)",
  "description": "Next.js 14 + TypeScript + Tailwind CSS + Supabase app for syncing Canvas LMS data (courses, assignments, calendar events) per user.",
  "techStack": {
    "frontend": ["Next.js 14", "React 18", "TypeScript"],
    "styling": ["Tailwind CSS", "shadcn/ui"],
    "auth": "Supabase",
    "database": "Supabase",
    "apiIntegration": "Canvas LMS API",
    "other": ["Bun", "Lucide React", "boring-avatars"]
  },
  "features": [
    "User authentication (sign up, sign in, password reset, sign out)",
    "Sync Canvas LMS courses, assignments, calendar events",
    "Settings page for Canvas API credentials",
    "Protected routes via middleware",
    "Sync Dashboard with tables for Canvas data",
    "Reusable UI components",
    "StudyBuddy AI - Interactive Voiced Tutor (NEW)"
  ],
  "dataModel": {
    "users": "Extends auth.users, stores music preference, avatar personality",
    "profiles": "Email, full name, avatar URL, Canvas API credentials",
    "courses": "Canvas courses per user",
    "assignments": "Canvas assignments per course",
    "study_sessions": "Logs for dashboard",
    "studybuddy_user": "localStorage - name, avatarConfig, personalityPrompt, struggles, lastTopic, lastSection"
  },
  "apiEndpoints": [
    { "method": "GET", "endpoint": "/api/canvas/courses", "description": "Returns user's Canvas courses" },
    { "method": "GET", "endpoint": "/api/canvas/assignments", "description": "Returns assignments for all enrolled courses" },
    { "method": "GET", "endpoint": "/api/canvas/calendar", "description": "Returns calendar events (date range)" },
    { "method": "POST", "endpoint": "/api/generate/quiz", "description": "Generate MCQ with hint for practice (MiniMax LLM)" }
  ],
  "userFlow": [
    "Sign Up / Sign In",
    "Enter Canvas API credentials in Settings",
    "View and sync Canvas data in Dashboard",
    "Protected routes redirect unauthenticated users",
    "Logout",
    "StudyBuddy: Avatar Setup → Content Selection → Video Lesson"
  ],
  "security": {
    "canvasCredentials": "Stored securely per user in Supabase",
    "routeProtection": "Middleware enforces authentication"
  },
  "scripts": [
    "bun dev",
    "bun build",
    "bun start",
    "bun lint",
    "npm run create-example-user"
  ],
  "extensibility": "Modular structure for easy feature addition; reusable UI components",
  
  "recentWork": {
    "implementedBy": "AI Assistant (Feb 28, 2026)",
    "summary": "Built StudyBuddy AI - Interactive Voiced Tutor with avatar customization, PDF lectures, and Twitch-style video teaching",
    "filesCreated": [
      "src/components/studybuddy/AvatarStudio.tsx - Avatar customization with localStorage",
      "src/components/studybuddy/LiveChat.tsx - Chat UI with mock responses",
      "src/components/studybuddy/VideoTeacher.tsx - Twitch-style video player with lip-sync",
      "src/lib/neuralNetworksContent.ts - Pre-loaded Neural Networks content (4 sections)",
      "src/lib/pdfContent.ts - Pre-loaded PDF lectures (ML Textbook, DL Slides)",
      "src/lib/studybuddyStorage.ts - localStorage utility for user data",
      "src/app/studybuddy/page.tsx - Main orchestration page",
      "STUDYBUDDY_IMPLEMENTATION.md - Comprehensive documentation"
    ],
    "issuesEncountered": [
      "avataaars library has compatibility issues with Next.js 14 (optionContext.addStateChangeListener error)",
      "Replaced avataaars with SimpleAvatar component (initials + colored circles)",
      "Text input state management required fixes for controlled components",
      "avatarStyle prop validation issues - library expects specific enum values"
    ],
    "whatWasBuilt": {
      "feature1_AvatarStudio": {
        "status": "Complete",
        "description": "User can enter name, customize avatar (boring-avatars), and enter personality prompt. Edit Profile button allows re-editing. Text input displays correctly.",
        "issues": "None"
      },
      "feature2_PreloadedContent": {
        "status": "Complete",
        "description": "Created comprehensive pre-loaded content: Neural Networks Basics (4 sections) + PDF lectures (ML Textbook with 3 sections, DL Slides with 2 sections). All content is rich and educational.",
        "issues": "None - works as expected"
      },
      "feature3_VoicedExplanation": {
        "status": "Not implemented (replaced by VideoTeacher)",
        "description": "ORIGINAL PRD: User clicks 'Play' on a section. MiniMax LLM generates a spoken explanation using personality prompt, MiniMax TTS voices it. Subtitles appear in real time.",
        "actualImplementation": "Built VideoTeacher component instead which narrates entire sections with Web Speech API. Similar concept but different execution.",
        "issues": "No MiniMax LLM integration. No /api/generate/explanation endpoint. Uses pre-loaded content directly instead of AI-generated explanations."
      },
      "feature4_LiveChat": {
        "status": "Partially complete",
        "description": "Chat UI fully functional with message history, timestamps, audio playback buttons. Uses Web Speech API for TTS.",
        "issues": "Mock responses are hardcoded keyword-based. No real MiniMax API integration yet. Needs /api/generate/chat endpoint."
      },
      "feature5_PracticeQuestion": {
        "status": "Complete",
        "description": "PracticeQuestion component with MCQ, Get Hint, Submit, feedback. /api/generate/quiz endpoint with MiniMax LLM (fallback when no API key). Wrong answers saved to struggles via addStruggle().",
        "issues": "None"
      },
      "feature6_MemoryReload": {
        "status": "Complete",
        "description": "Greeting now references past struggles when getFirstStruggle() returns data. Shows section title for friendly display.",
        "issues": "None"
      },
      "newFeature_VideoTeacher": {
        "status": "Complete",
        "description": "Twitch.tv style video player with back button, Chat + Practice tabs in sidebar. Avatar uses boring-avatars.",
        "issues": "Uses browser TTS instead of MiniMax Audio API."
      }
    }
  },
  
  "toFix": [
    {
      "priority": "MEDIUM",
      "issue": "Chat responses are hardcoded",
      "details": "LiveChat uses keyword-based mock responses instead of real AI. Need to implement /api/generate/chat endpoint with MiniMax API.",
      "location": "src/components/studybuddy/LiveChat.tsx - generateMockResponse function"
    },
    {
      "priority": "LOW",
      "issue": "Video narration uses browser TTS instead of MiniMax Audio",
      "details": "VideoTeacher uses window.speechSynthesis (browser TTS) instead of MiniMax Audio API. Quality and voice options are limited.",
      "location": "src/components/studybuddy/VideoTeacher.tsx - narrateNextSentence function"
    },
    {
      "priority": "LOW",
      "issue": "No real lip-sync animation",
      "details": "Avatar just pulses when speaking. True lip-sync would require mouth movement synchronized with audio waveform.",
      "location": "src/components/studybuddy/VideoTeacher.tsx - Speaking Indicator section"
    }
  ],
  
  "nextSteps": [
    "Get MiniMax API keys and create /api/generate/chat endpoint",
    "Create /api/tts endpoint for better voice quality",
    "Add real lip-sync animation using audio analysis",
    "Optional: Implement /api/generate/explanation endpoint if you want AI-generated explanations instead of using pre-loaded content"
  ],
  
  "prdFeaturesStatus": {
    "feature1_AvatarStudio": "95% complete - boring-avatars, text input fixed, Edit Profile",
    "feature2_PreloadedContent": "100% complete - extended with PDFs",
    "feature3_VoicedExplanation": "50% complete - VideoTeacher narrates but doesn't use MiniMax LLM/TTS",
    "feature4_LiveChat": "60% complete - UI done, needs real API",
    "feature5_PracticeQuestion": "100% complete - PracticeQuestion + /api/generate/quiz",
    "feature6_MemoryReload": "100% complete - greeting references struggles"
  },
  
  "recentCompleted": [
    "Fixed text input display in AvatarStudio (deferred localStorage save to useEffect)",
    "Added back button to VideoTeacher",
    "Replaced SimpleAvatar with boring-avatars",
    "Added Edit Profile button in content-selection",
    "Created PracticeQuestion component + /api/generate/quiz",
    "Personalized greeting with past struggles",
    "Fixed initializeUser to update existing user on Edit Profile"
  ]
}

