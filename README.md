# HackTheEast – Canvas LMS Sync & Study Dashboard

**Mastering Insight** – Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase. Sync courses, calendar, and assignments from Canvas LMS; study with AI-generated lessons, a Study Buddy, and Instagram-style reels.

**Demo video**

<video src="docs/demo.mp4" controls width="640"></video>

**[Watch on YouTube](https://youtu.be/-W1GsITHeCg)**

## Features

- **Sync Dashboard** – Connect Canvas (API URL + token in Settings). Sync courses, calendar events, and assignments into Supabase.
- **Lessons** – AI-generated lessons from your course content (Featherless or OpenAI). Audio-visual slides with optional voice (MiniMax TTS).
- **Study Buddy** – Chat tutor and slide deck generator from synced materials; custom avatar and style.
- **Reels** – Generate Instagram 15-second reels from what you’re learning. Random short reels from recent lessons or course materials; voice + video via MiniMax (no ffmpeg; play video + audio together in the browser).
- **Progress & Memory** – Track learning and memories per course.
- **Auth** – Sign up / sign in with Supabase Auth.

## Team Members and Roles

| Name    | Role / Focus        |
|---------|---------------------|
| William | Backend, API Pulling |
| Drake   | Frontend, MiniMax    |
| Sen Yi  | Backend, Video Editing |
| Jerome  | Frontend, Video Director |

## Side Awards we're applying

- **MiniMax Creative Usage Award**
- **RevisionDojo Future of Learning Award**
- **OAX Foundation AI EdTech Platform Award**
- **HKUST Entrepreneurship Centre Innovation Award**

## Tech stack

Technologies we used to build Mastering Insight:

| Category | Technologies |
|----------|--------------|
| **Runtime / package manager** | [Bun](https://bun.sh) (≥1.1.0) |
| **Framework** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling** | Tailwind CSS |
| **Backend / database** | [Supabase](https://supabase.com) (Auth, Postgres, Storage) |
| **APIs & integrations** | Canvas LMS API, [Featherless](https://featherless.ai) / OpenAI (chat, LLM), [MiniMax](https://api.minimax.io) (chat, TTS, image, text-to-video for reels) |
| **AI / embeddings** | Local MiniLM, OpenAI Embeddings, or MiniMax (optional) |
| **Deploy** | Vercel (Bun build) |

- **Frontend:** React, Tailwind, Framer Motion, Radix UI, Lucide icons
- **Backend / API routes:** Next.js API routes, Supabase server client
- **Reels pipeline:** MiniMax TTS (voice), MiniMax text-to-video (video), Supabase Storage (signed URLs)
- **Tooling:** ESLint, TypeScript, dotenv

## Prerequisites

- [Bun](https://bun.sh) installed
- A [Supabase](https://supabase.com) project
- Optional: Canvas LMS API URL + access token (set per user in Settings)
- Optional: API keys for Featherless/OpenAI (lesson generation, chat), MiniMax (reels, TTS, images), embeddings (OpenAI / MiniMax / local)

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Environment variables

Copy `.env.example` to `.env` or `.env.local` and fill in:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | For scripts (example user, bucket creation) and server-only APIs — **do not expose in client** |
| `OPENAI_API_KEY` or `FEATHERLESS_API_KEY` | Chat / LLM (lesson generation, reels script, etc.) |
| `MINIMAX_API_KEY` | Reels (voice + video), lesson TTS, Study Buddy images. Required for **Instagram 15-second reel** generation |
| `EMBEDDING_PROVIDER` | `""` / `local` (default), `openai`, or `minimax` for sync & semantic search |
| (Optional) `OPENAI_EMBEDDING_API_KEY`, `MINIMAX_GROUP_ID`, `ELEVENLABS_*`, `FEATHERLESS_*` | See `.env.example` |

Canvas credentials are set **per user** in the app (Settings), not in env.

### 3. Supabase schema and migrations

- In the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql), run `supabase/schema.sql` and `supabase/profiles.sql` if you’re not using migrations.
- Or run migrations in order from `supabase/migrations/` (e.g. via Supabase CLI or by applying each file in the dashboard). Key migrations include profiles, lessons, embeddings (e.g. `20250228100010_embedding_384_local.sql` for local 384-d embeddings), Study Buddy, lesson audio/visual, memory, and calendar events.

### 4. Storage bucket (audio, video, reels)

Create a bucket named **`lesson-audio`** in Supabase Storage (Dashboard → Storage). Then either:

- **New projects:** run once:  
  `bun run create-lesson-audio-bucket`  
  (creates the bucket with allowed MIME types for audio, video/mp4, and images).

- **Existing bucket (reels already added):** if you see “mime type video/mp4 is not supported” or “image/png is not supported”, run once:  
  `bun run update-lesson-audio-bucket-mime`  
  to allow `video/mp4`, `image/png`, etc.

### 5. Run the app

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up or use the example user, then go to **Sync Dashboard** to connect Canvas and sync.

- **Embeddings:** Default is local in-process (all-MiniLM-L6-v2, 384 dimensions). Run the 384-d embedding migration if you use local. For production/serverless, consider `EMBEDDING_PROVIDER=openai` and `OPENAI_EMBEDDING_API_KEY`.
- **Reels:** Set `MINIMAX_API_KEY` to generate Instagram 15-second reels (voice + video). One tap on `/reels`; content is chosen from recent lessons or course materials.

---

## About the project — Project Story (MIT of the Far East)

### Inspiration

We wanted study tools that use **your real course content** instead of generic material. Canvas LMS already holds your syllabus, assignments, and materials—so we asked: what if one app could sync that once and then turn it into lessons, a chat tutor, and short reels you would actually watch?

Short-form video (e.g. Instagram reels) felt like a natural fit for “study tips in 15 seconds”: a person talking, a few clear visuals, and one takeaway. We aimed to make revision feel like scrolling something useful rather than opening another long document.

### What it does

- **Sync Dashboard** — Connect your Canvas (API URL and token in Settings). The app syncs courses, calendar events, and assignments into Supabase.
- **AI lessons** — Generates lessons from your course content (Featherless), with optional voiceover (MiniMax TTS) and audio-visual slides.
- **Study Buddy** — Chat tutor and slide decks from your synced materials, with a configurable avatar and style.
- **Reels** — Generates Instagram-style 15-second reels from what you are learning: random content from recent lessons or course materials, with MiniMax for voice and video. One button plays video and audio in sync; no server-side ffmpeg.
- **Progress and memory** — Track what you have studied and attach memories to courses.

### How we built it

We used Next.js 14 (App Router), TypeScript, Tailwind CSS, and Supabase (Auth, Postgres, Storage). Bun handles install and scripts.

- **Canvas sync** — API routes call Canvas, normalize data, and store it in Supabase. Optional embeddings (local MiniLM, OpenAI, or MiniMax) for semantic search.
- **Lessons** — An LLM turns course material into lessons; MiniMax TTS adds voice; assets go to the `lesson-audio` bucket.
- **Study Buddy** — Chat and slide generation from synced content; MiniMax (or other) for images and chat.
- **Reels** — We pick random content, generate a short script (LLM), then MiniMax TTS to MP3 and MiniMax text-to-video (from a visual prompt: person talking, 3–4 different shots) to MP4. We upload both to Storage and return signed URLs. The client plays video (muted) and audio in sync with one **Play** button.
- **Progress and memory** — Stored in Postgres with UI to view and manage them.

### Challenges we ran into

- **Storage MIME types** — The bucket initially allowed only audio. When we added reels (video and cover images), uploads failed with “mime type video/mp4 is not supported.” We fixed it by updating the bucket allowed MIME types and added a script so existing deployments can do the same.
- **Video not playing** — Sometimes the UI showed the storage URL as text. We switched to signed URLs and only set `src` when the value is a proper `http` URL.
- **Build and types** — `require("ffmpeg-static")` broke ESLint; the package default export could be `null`. We switched to ESM `import` and a safe cast (e.g. via `unknown`) when reading the path.
- **Making reels feel longer** — The video API max is 10 seconds. We request 10s and emphasise “long,” “full-length,” and “at least 10 seconds” in the visual prompt so the model uses the full duration.

### Accomplishments that we're proud of

- **Single pipeline for reels** — One flow from random content to playable reel (script, voice, video, upload, signed URLs) with clear fallbacks (e.g. cover image and MP3 if video fails).
- **No ffmpeg in production for reels** — The client plays separate MP4 and MP3 in sync; simpler deployment and no binary dependency for this feature.
- **Clear docs and scripts** — README, env table, bucket setup, and an “update bucket MIME” script so both new and existing setups work.
- **Reusable patterns** — Signed URLs for media, prompt design (narration vs. visual), and handling API limits in code and prompts.

### What we learned

- **Supabase Storage** — Bucket allowlists for MIME types matter; signed URLs give reliable inline playback for `<video>` and `<img>`.
- **Video APIs** — Duration limits are fixed (e.g. 6s or 10s); we use prompt design (“long,” “full-length,” “3–4 shots”) to get the most out of that time.
- **Two prompts for reels** — Narration script for voice; separate visual prompt for video (who is talking, how many shots). Keeping them distinct made the pipeline easier to reason about and debug.
- **ESLint and types** — Prefer ESM `import`; use `as unknown as ...` when dealing with nullable or loosely typed package exports.

### What's next for MITFE

- **Longer reels** — If MiniMax (or another provider) supports longer clips, we will extend duration and adjust prompts.
- **User choice of content** — Let users pick a course, topic, or lesson before generating a reel instead of only random selection.
- **Reel history and favourites** — Save and list past reels, with optional “favourite” or “share” actions.
- **Richer Study Buddy** — Deeper integration with lesson progress and memory (e.g. “review what you struggled with” or “quiz from last week”).
- **Mobile-friendly UI** — Optimise the reels and lesson experience for small screens and touch.

---

## Login credentials (demo)

| | |
|--|--|
| **Email** | `test@example.com` |
| **Password** | `ChangeMe123!` |

Use these to log in after running the app (or after creating the example user with `bun run create-example-user`).

---

## Scripts

| Command | Description |
|--------|-------------|
| `bun dev` | Start Next.js dev server |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run create-example-user` | Create test user (needs `SUPABASE_SERVICE_ROLE_KEY`) |
| `bun run create-lesson-audio-bucket` | Create `lesson-audio` bucket with allowed MIME types |
| `bun run update-lesson-audio-bucket-mime` | Update existing bucket to allow video/image MIME types for reels |

## Create an example user

Requires `SUPABASE_SERVICE_ROLE_KEY` in env.

```bash
bun run create-example-user
```

Defaults: email `test@example.com`, password `ChangeMe123!`, full name `Test User`. Override with env: `EXAMPLE_USER_EMAIL`, `EXAMPLE_USER_PASSWORD`, `EXAMPLE_USER_FULL_NAME`.

## Project structure

```
src/
├── app/
│   ├── api/           # API routes (canvas, reels, lessons, chat, materials, etc.)
│   ├── lesson/         # Lesson viewer (course/topic)
│   ├── reels/          # Instagram 15-second reels (generate + play)
│   ├── settings/       # User settings (Canvas, memories)
│   ├── studybuddy/     # Study Buddy chat & slides
│   ├── sync-dashboard/ # Canvas sync UI
│   ├── progress/       # Learning progress
│   └── memory/         # Memory by course
├── components/
├── lib/                # Canvas client, AI (LLM, MiniMax, Featherless), reels, video, audio
├── utils/
└── types/
supabase/
├── migrations/         # DB migrations (schema, embeddings, lessons, reels, etc.)
├── schema.sql
└── profiles.sql
scripts/
├── create-example-user.ts
├── create-lesson-audio-bucket.ts
└── update-lesson-audio-bucket-mime.ts
```

## Deploy to Vercel

- Use **Bun** on Vercel (see `vercel.json`: `bun install`, `bun run build`).
- **Option A:** Connect your Git repo at [vercel.com](https://vercel.com) → Add New Project → import repo. Add env vars in Settings → Environment Variables (same as `.env.example`), then deploy.
- **Option B:** `bunx vercel login`, then `bunx vercel` / `bunx vercel --prod`; add env vars in the Vercel dashboard.

**Embeddings on Vercel:** The default local embedding model can be heavy for serverless. Prefer `EMBEDDING_PROVIDER=openai` and `OPENAI_EMBEDDING_API_KEY` (and the matching vector dimension in your migrations) for production.

## License

ISC
