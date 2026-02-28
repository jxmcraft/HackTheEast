{
  "project": "HTE (HackTheEast)",
  "description": "Next.js 14 + TypeScript + Tailwind CSS + Supabase app for syncing Canvas LMS data (courses, assignments, calendar events) per user.",
  "techStack": {
    "frontend": ["Next.js 14", "React 18", "TypeScript"],
    "styling": ["Tailwind CSS", "shadcn/ui"],
    "auth": "Supabase",
    "database": "Supabase",
    "apiIntegration": "Canvas LMS API",
    "other": ["Bun", "Lucide React", "avataaars (deprecated - has compatibility issues)"]
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
    { "method": "GET", "endpoint": "/api/canvas/calendar", "description": "Returns calendar events (date range)" }
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
        "status": "Partially complete",
        "description": "User can enter name, customize avatar (dropdowns work but avatar is simplified circles with initials instead of full Avataaars rendering), and enter personality prompt. All saved to localStorage.",
        "issues": "Avatar doesn't show the full customizable Avataaars graphic due to library compatibility. Using fallback SimpleAvatar component."
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
        "status": "Not implemented",
        "description": "ORIGINAL PRD: A single 'Practice' button generates one MCQ with a hint via MiniMax LLM. User answers; feedback is shown. Stores wrong answers in localStorage 'struggles' array.",
        "whatsMissing": "No Practice component created. No /api/generate/quiz endpoint. No UI for MCQ display, answer selection, or feedback. recordPracticeResult() function exists in studybuddyStorage.ts but unused.",
        "issues": "Completely missing from current implementation"
      },
      "feature6_MemoryReload": {
        "status": "Partially implemented",
        "description": "ORIGINAL PRD: On return visit, avatar greets by name and references a past struggle (from wrong answers in practice questions).",
        "actualImplementation": "Avatar greets by name on content-selection page. localStorage stores struggles array and getFirstStruggle() utility exists.",
        "whatsMissing": "No reference to past struggles in greeting. Struggles array is never populated (requires Practice feature). Generic greeting instead of personalized one.",
        "issues": "Depends on Feature 5 being implemented first"
      },
      "newFeature_VideoTeacher": {
        "status": "Complete (UI only)",
        "description": "Twitch.tv style video player with avatar that 'speaks' using Web Speech API. Features: progress bar, play/pause, speed controls, subtitles, speaking indicators, chat sidebar.",
        "issues": "Uses browser TTS instead of MiniMax Audio API. Avatar animation is simple pulse effect, not true lip-sync."
      }
    }
  },
  
  "toFix": [
    {
      "priority": "HIGH",
      "issue": "No back button in VideoTeacher component",
      "details": "User cannot exit video lesson and return to content selection. Need to add back button in VideoTeacher header.",
      "location": "src/components/studybuddy/VideoTeacher.tsx"
    },
    {
      "priority": "HIGH",
      "issue": "Text input boxes don't show typed words in AvatarStudio",
      "details": "Input fields for name and personality prompt may not display text while typing due to state management issues. Check controlled component implementation.",
      "location": "src/components/studybuddy/AvatarStudio.tsx - handleNameChange, handlePersonalityChange"
    },
    {
      "priority": "HIGH",
      "issue": "Avatar doesn't show customizable picture",
      "details": "SimpleAvatar component only shows initials in colored circles. avataaars library was removed due to compatibility errors. Need to either: 1) Fix avataaars integration, 2) Use a different avatar library, or 3) Build custom avatar component.",
      "location": "src/components/studybuddy/AvatarStudio.tsx - SimpleAvatar function"
    },
    {
      "priority": "MEDIUM",
      "issue": "Cannot edit AI profile after creation",
      "details": "After completing avatar setup, user cannot go back to edit name, avatar, or personality prompt. Need 'Edit Profile' button in content selection page.",
      "location": "src/app/studybuddy/page.tsx - content-selection section"
    },
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
    "Fix AvatarStudio text input display bug",
    "Add back button to VideoTeacher",
    "Implement Edit Profile functionality",
    "Get MiniMax API keys and create /api/generate/chat endpoint",
    "Create /api/tts endpoint for better voice quality",
    "Fix or replace avataaars library for full avatar customization",
    "Add real lip-sync animation using audio analysis",
    "Implement Practice Question feature (PRD Feature 5) - CREATE component with MCQ UI, answer selection, feedback, and /api/generate/quiz endpoint",
    "Populate struggles array when user answers incorrectly in Practice",
    "Update greeting in content-selection to reference past struggles (PRD Feature 6)",
    "Optional: Implement /api/generate/explanation endpoint if you want AI-generated explanations instead of using pre-loaded content"
  ],
  
  "prdFeaturesStatus": {
    "feature1_AvatarStudio": "70% complete - works but avatar display is simplified",
    "feature2_PreloadedContent": "100% complete - extended with PDFs",
    "feature3_VoicedExplanation": "50% complete - VideoTeacher narrates but doesn't use MiniMax LLM/TTS",
    "feature4_LiveChat": "60% complete - UI done, needs real API",
    "feature5_PracticeQuestion": "0% complete - not started",
    "feature6_MemoryReload": "30% complete - greeting works, struggles reference missing"
  }
}

