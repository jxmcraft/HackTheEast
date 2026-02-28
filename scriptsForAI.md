This md is for AI to easily find scripts that are frequently used. Make sure after creating a script, update this MD.

## StudyBuddy AI – Interactive Voiced Tutor

### Setup & Dependencies

```bash
# Install required dependencies (already done)
npm install avataaars --legacy-peer-deps

# Run development server
npm run dev

# Build for production
npm run build
```

### Core Components & Files

#### Frontend Components
- `src/components/studybuddy/AvatarStudio.tsx` - Avatar customization (name, appearance, personality prompt) with localStorage persistence
- `src/components/studybuddy/LiveChat.tsx` - Interactive chat interface with text + voice responses
- `src/lib/neuralNetworksContent.ts` - Pre-loaded "Neural Networks Basics" lecture content (4 sections)
- `src/lib/studybuddyStorage.ts` - localStorage utility for managing user data (avatar config, struggles, practice results)

#### API Routes (To Be Built)
- `/api/generate/explanation` - Generate voiced section explanation (POST)
- `/api/generate/quiz` - Generate practice MCQ (POST)
- `/api/generate/chat` - Generate chat response (POST)
- `/api/tts` - Text-to-speech conversion (POST)

### Data Model (localStorage)

All user data is stored client-side in localStorage under key `studybuddy_user`:

```json
{
  "name": "Alex",
  "avatarConfig": { "hair": "brown", "eyes": "happy", ... },
  "personalityPrompt": "Use sports analogies, be enthusiastic",
  "struggles": ["backpropagation"],
  "lastTopic": "neural_networks",
  "lastSection": "intro",
  "completedSections": ["intro"],
  "practiceResults": [
    {
      "sectionId": "training",
      "question": "What is backpropagation?",
      "userAnswer": "Wrong",
      "correctAnswer": "Correct",
      "isCorrect": false,
      "timestamp": 1708892400000
    }
  ]
}
```

### Key Features Status

- ✅ Avatar Studio (customization + localStorage)
- ✅ Pre-loaded lecture content (Neural Networks)
- ✅ Live Chat component (mock responses + TTS UI)
- ⏳ /api/generate/explanation (MiniMax integration pending)
- ⏳ /api/generate/quiz (MiniMax integration pending)
- ⏳ /api/generate/chat (MiniMax integration pending)
- ⏳ /api/tts (MiniMax Audio integration pending)

### Attribution & Sponsor Alignment

All components include:
- "Powered by MiniMax abab6.5" (for LLM)
- "Voice by MiniMax Speech" (for TTS)
- Avataaars attribution (open-source avatar library)

### Next Steps

1. Create API routes using MiniMax API credentials (email duolamei@minimaxi.com for keys)
2. Build main StudyBuddy page with section list and navigation
3. Integrate components into main app flow
4. Add practice question component
5. Create demo video showing full user journey 