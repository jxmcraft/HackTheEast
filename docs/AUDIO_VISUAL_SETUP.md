# Audio-visual lessons (Phase 3) – setup and usage

**Summary**

- **MiniMax only** for structure and audio: always use `api.minimax.io` (never `.chat`). No `Group-Id` for chat.
- **Podcast mode:** MiniMax structure + MiniMax TTS → script + audio; slides use placeholders. Run `bun run create-lesson-audio-bucket` once.
- **Slide deck mode:** MiniMax structure + Featherless → slides with generated images; no audio.
- **Env:** `MINIMAX_API_KEY` (required). For slide deck images: `FEATHERLESS_API_KEY`. No ElevenLabs for podcast (MiniMax TTS is used).

**In the app:** Open a lesson → click **Generate podcast** (script + MiniMax TTS) or **Generate slide deck** (slides + Featherless images). From code: `POST /api/generate-audio-visual` with `{ topic, courseId, context?, avatarStyle?, mode: "podcast" | "slides" }`.

---

## 1. Env vars (add only what you need)

### Required for podcast and/or slide deck

- **MiniMax** (structure + podcast TTS; uses **api.minimax.io** only, no Group-Id)
  - `MINIMAX_API_KEY` – from [MiniMax platform.minimax.io](https://platform.minimax.io)
  - Optional: `MINIMAX_CHAT_MODEL=M2-her`, `MINIMAX_TTS_VOICE=English_expressive_narrator`

For **podcast** audio, create the storage bucket once:

```bash
bun run create-lesson-audio-bucket
```

### Required only for slide deck (generated slide images)

- **Featherless**
  - `FEATHERLESS_API_KEY` – you may already have this for chat
  - Optional: `FEATHERLESS_API_BASE`, `FEATHERLESS_IMAGE_MODEL`

Podcast mode does not use Featherless (slides get placeholders). Slide deck mode does not generate audio.

---

## 2. Using it in the app

1. Go to a lesson: **Sync Dashboard** → course → topic (or `/lesson/[courseId]/[topic]`).
2. Click **Generate podcast** (MiniMax script + MiniMax TTS, placeholders for slide images) or **Generate slide deck** (MiniMax slides + Featherless images, no audio).
3. Wait for “Generating your lesson…” then use the player (podcast has play button; slide deck shows images only).

---

## 3. Calling the API

**Request**

```http
POST /api/generate-audio-visual
Content-Type: application/json
Cookie: <session>
```

```json
{
  "topic": "Introduction to Neural Networks",
  "courseId": "12345",
  "context": "Optional context",
  "avatarStyle": "encouraging",
  "mode": "podcast"
}
```

- `mode` (optional): `"podcast"` = script + MiniMax TTS only; `"slides"` = MiniMax slides + Featherless images only. Defaults to podcast if omitted.
- Other fields as before.

**Success (200):** `{ "success": true, "lesson": { "script", "slides", ... }, "assets": { "audioUrl", "audioDuration", "slides": [...] }, "sources": [] }`

**Render:** While loading use `<AudioVisualLoading />`. On success use `<AudioVisualPlayer audioUrl={result.assets.audioUrl} slides={result.assets.slides} script={result.lesson.script} />`.
