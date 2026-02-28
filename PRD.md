# 📄 Product Requirements Document: StudyBuddy AI – Interactive Voiced Tutor

## 1. Executive Summary
| Field | Description |
|-------|-------------|
| **One-Liner Pitch** | An interactive, voiced AI tutor that you customize—choose an avatar, define its teaching style, and learn from any lecture through spoken explanations, live chat, and adaptive practice. |
| **Problem Statement** | Students lose focus with static slides and one‑size‑fits‑all videos. Learning should feel like a personal conversation, adapting to your preferred style and pace. |
| **Target Users** | University students who want a study companion that explains complex topics conversationally and remembers their learning history. |
| **Key Value Proposition** | Your own AI tutor—with a face, voice, and personality you define—that turns any lecture into an interactive, voiced session with real‑time Q&A and practice. |
| **Fictional Team Name** | **EduTutorAI** |

## 2. Core Features (MVP)
*These are the MUST‑HAVES. If any of these fail, the demo is broken.*

| Feature | Description | User Value | Complexity |
|---------|-------------|------------|------------|
| **Avatar Studio + Personality Prompt** | User enters name, customizes a 2D avatar (Avataaars), and types a teaching‑style prompt (e.g., *“explain with enthusiasm, use sports analogies”*). All stored in `localStorage`. | Builds immediate emotional connection; the tutor feels *yours*. | 3 |
| **Pre‑loaded Lecture Content** | One pre‑processed topic: “Neural Networks Basics” divided into 3–4 clear sections. No live PDF parsing in MVP. | Guarantees content quality and avoids parsing failures. | 2 |
| **Voiced Section Explanation** | User clicks “Play” on a section. MiniMax LLM generates a spoken explanation (using personality prompt), MiniMax TTS voices it. Subtitles appear in real time. | Turns static text into an engaging, conversational lesson. | 4 |
| **Practice Question (On Demand)** | A single “Practice” button generates one MCQ with a hint via MiniMax LLM. User answers; feedback is shown. | Active recall, a proven learning technique. | 3 |
| **Live Chat** | User types questions; MiniMax LLM answers in context (topic + personality prompt). Reply is both displayed and spoken (TTS). | Makes the experience truly interactive. | 4 |
| **Memory & Reload** | On return, avatar greets by name and references a past struggle (simulated from stored wrong answers). | Creates continuity and personalization. | 2 |

**Total MVP Features:** 6  
**Estimated Implementation Time:** 12–13 hours (with 4 people)

## 3. Deferred / Stretch Features (Not in MVP)
- Smart grouping (simulated UI) – *drop to reduce complexity*
- Multiple topics or real PDF upload
- Lip‑sync animation
- Thumbs‑up/down adapting future responses
- Analytics dashboard

## 4. User Flow / Journey (Demo‑Ready)
1. **Entry:** User lands, avatar waves, asks for name.
2. **Avatar Studio:** User picks name, customizes avatar, enters personality prompt. All saved.
3. **Content Selection:** User sees “Neural Networks” (our single pre‑loaded topic) with sections listed.
4. **Voiced Lesson:** User clicks a section → avatar “thinks” (loading), then explanation appears with subtitles and TTS audio.
5. **Chat:** User types a question → avatar responds with text + voice.
6. **Practice:** User clicks “Practice” → MCQ appears, user answers, gets feedback + hint.
7. **Reload:** Refresh page → avatar greets by name, mentions a past wrong answer (from memory).

## 5. Tech Stack
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | Next.js + Tailwind + shadcn/ui | Rapid UI development. |
| Avatar | Avataaars React | Simple, customizable 2D avatars. |
| Memory | `localStorage` | Zero setup, privacy‑first. |
| LLM | MiniMax abab6.5 | Free credits, sponsor track. |
| TTS | MiniMax Audio | High‑quality, low‑latency voices. |
| Deployment | Vercel | One‑click deploy. |

## 6. Data Model (localStorage)
```json
{
  "user": {
    "name": "Alex",
    "avatarConfig": { "hair": "brown", "eyes": "happy", ... },
    "personalityPrompt": "Use sports analogies, be enthusiastic",
    "struggles": ["backpropagation"],
    "lastTopic": "neural_networks",
    "lastSection": "intro"
  }
}
```
## 7. API Endpoints Needed
*All endpoints are Next.js API routes (serverless functions).*

| Method | Endpoint | Request Body | Response | Purpose |
|--------|----------|--------------|----------|---------|
| POST | /api/generate/explanation | `{ sectionId: string, topic: string, content: string, personalityPrompt: string }` | `{ explanation: string }` | Generate the spoken explanation text for a section. |
| POST | /api/generate/quiz | `{ topic: string, personalityPrompt: string }` | `{ question: string, options: string[], correctIndex: number, hint: string }` | Generate one multiple‑choice question with a hint. |
| POST | /api/generate/chat | `{ message: string, context: { topic: string, section: string, history: array }, personalityPrompt: string }` | `{ reply: string }` | Generate a conversational answer to a user's chat message. |
| POST | /api/tts | `{ text: string, voice?: string }` | `{ audioUrl: string }` | Convert text to speech using MiniMax Audio API. |

**Note:** All generation endpoints will cache results in `localStorage` where appropriate (e.g., explanation for a section) to avoid repeat API calls and reduce latency during the demo.

## 8. External Dependencies
- [ ] **MiniMax LLM API (abab6.5)** – Requires API key (email duolamei@minimaxi.com). Free tier available.
- [ ] **MiniMax Audio API** – For text‑to‑speech. Free tier.
- [ ] **Avataaars React** – Open‑source library for avatar customization.
- [ ] **Vercel** – Deployment platform. Free tier.
- [ ] **Next.js, Tailwind CSS, shadcn/ui** – Open source.

## 9. Novelty & AI/ML Justification
- **Unique aspect:** A fully customizable AI tutor that combines avatar creation, user‑defined teaching‑style prompts, and voiced interactive lessons over lecture content. The ability to steer the AI’s personality via natural language is a powerful differentiator from static chatbots or generic video tutors.
- **AI integration depth:**
  - Core explanations, practice questions, and chat responses are all generated on the fly by MiniMax LLM, conditioned on the user’s personality prompt.
  - MiniMax TTS brings the avatar to life with high‑quality voice output, creating a truly multimodal experience.
  - The feedback loop (storing wrong answers and referencing them later) demonstrates a simple but effective personalization mechanism.
- **Ethical considerations:** All user data remains in the browser’s `localStorage`; no cloud storage or tracking. The personality prompt can be designed with safety filters, and in a production version we would add content moderation to prevent harmful instructions.
- **Sponsor alignment:** We prominently feature “Powered by MiniMax abab6.5” and “Voice by MiniMax Speech” in the UI, directly meeting the sponsor’s expectations for the MiniMax Creative Usage Award.

## 10. Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **TTS latency** | Medium | High | Pre‑generate and cache audio for the first section; show a “thinking” animation; use shorter text chunks. |
| **LLM off‑topic or low‑quality output** | Medium | Medium | Constrain domain to “neural networks basics”; use strong system prompts (“You are a university tutor…”); test all prompts beforehand. |
| **Malformed JSON from quiz endpoint** | Low | Medium | Validate response; if parsing fails, serve a hardcoded template question with hint. |
| **API rate limits / downtime** | Low | High | Cache all generated content in `localStorage` per section; have fallback text if API is unavailable (though demo will assume it works). |
| **Feature creep** | High | High | Strictly adhere to MVP list; move any nice‑to‑haves to stretch. Team lead enforces “no new features” after hour 10. |
| **Demo feels slow or buggy** | Medium | High | Conduct a full rehearsal at hour 12; record the demo video early; fix only critical bugs afterward. |

## 11. Success Criteria
*The MVP is successful when all of the following can be demonstrated in a live demo or video:*

- [ ] **Avatar Studio complete:** User can enter name, customize avatar (Avataaars), and type a personality prompt; all saved to `localStorage`.
- [ ] **On reload:** Avatar greets user by name and references a previously stored wrong answer (simulated by storing the first wrong answer from practice).
- [ ] **Section playback:** Clicking a section plays an AI‑generated explanation (text + TTS audio) with subtitles.
- [ ] **Chat works:** User types a question; avatar responds with text + voice in the context of the current topic and personality.
- [ ] **Practice works:** Clicking “Practice” generates a valid MCQ; user can select an answer and receive feedback + hint.
- [ ] **Live site:** Deployed on Vercel and accessible to judges.
- [ ] **Demo video:** A 2‑minute video showing the entire flow (avatar creation → lesson → chat → practice → return visit) with clear audio and smooth interactions.
- [ ] **README:** Complete with setup instructions, tech stack, sponsor callouts, and credits.