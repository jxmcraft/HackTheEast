# HTE – Canvas LMS Sync & Study Dashboard

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase. Syncs courses, calendar events, and assignments from the Canvas LMS API and displays them on a Sync Dashboard.

## Setup

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Environment variables**

   Copy `.env.example` to `.env` (or `.env.local`) and set:

   - **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from [Supabase](https://supabase.com) project settings). For **background sync** (sync runs without blocking the UI), also set `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → service_role secret).
   - **Canvas:** Set per user in **Settings** (Canvas API URL and Access Token); no env vars.
   - **Embeddings (sync & semantic search):** **Local in-process model** by default — no API keys or separate server. When you run the app (`bun dev`), the embedding model loads on first use (**all-MiniLM-L6-v2**, 384 dimensions). Run the migration `supabase/migrations/20250228100010_embedding_384_local.sql` so the DB uses vector(384). Optional: set `EMBEDDING_PROVIDER=openai` and `OPENAI_EMBEDDING_API_KEY` to use OpenAI instead.

3. **Supabase schema**

   In the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql), run the contents of `supabase/schema.sql` to create `users`, `courses`, `assignments`, and `study_sessions` tables.

   Then run `supabase/profiles.sql` to create the `profiles` table + RLS + the signup trigger.

4. **Run the app**

   Run Next.js: `bun dev`. Next.js: [http://localhost:3000](http://localhost:3000).

   LiteLLM is installed automatically when you run `bun install` (requires Python and pip). To install it manually: `bun run setup-litellm`.

   Either run both in one go: `bun run dev:all`, or in two terminals: `bun run proxy` then `bun dev`.

   - Next.js: [http://localhost:3000](http://localhost:3000)
   - LiteLLM proxy: http://localhost:4000

   Set LiteLLM vars in your env: `LITELLM_EMBEDDING_API_BASE=http://localhost:4000`, `LITELLM_EMBEDDING_API_KEY=sk-1234` (match `master_key` in `litellm/config.yaml`), `LITELLM_EMBEDDING_MODEL=minimax-embed`. For the proxy (run `bun run proxy`): set `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`, and `OPENAI_API_KEY` (same as `MINIMAX_API_KEY`) so embeddings work. See `litellm/config.yaml` for details.

   **Test embeddings:** With app (and optionally proxy) running, open http://localhost:3000/api/embedding-test. You should get `{ "ok": true, "dimensions": 384, ... }` when using the local model (all-MiniLM-L6-v2), or the proxy's dimensions when using LiteLLM.

   **Lesson generation (Phase 3):** Set `FEATHERLESS_API_KEY` in `.env.local` for chat completions (works in Hong Kong and globally; no OpenAI required). Optional: `FEATHERLESS_CHAT_MODEL` (default: `Qwen/Qwen2.5-7B-Instruct`). Alternatively set `OPENAI_API_KEY` for OpenAI.

5. Open [http://localhost:3000](http://localhost:3000) and go to **Sync Dashboard** to verify the Canvas connection (courses, calendar events, assignments in tables).

## Create an example user

This uses the Supabase **Service Role Key** (never expose this in the browser).

1. Add `SUPABASE_SERVICE_ROLE_KEY` to your env (see `.env.example`), or set it in your shell.
2. From the project root, run:

   ```bash
   bun run create-example-user
   ```

Defaults:
- email: `test@example.com`
- password: `ChangeMe123!`
- full name: `Test User`

Override with:
- `EXAMPLE_USER_EMAIL`
- `EXAMPLE_USER_PASSWORD`
- `EXAMPLE_USER_FULL_NAME`

## Project structure

- `src/app/` – App Router pages and API routes
- `src/app/sync-dashboard` – Sync Dashboard page (Shadcn-style tables)
- `src/app/api/canvas/` – API routes that call Canvas sync (courses, calendar, assignments)
- `src/lib/canvas.ts` – Canvas LMS API client: `syncCourses()`, `syncCalendar()`, `syncAssignments()`
- `src/lib/supabase/` – Supabase client
- `supabase/schema.sql` – DB schema for users, courses, assignments, study_sessions

## Scripts

- `bun dev` – Next.js dev server
- `bun run dev:all` – Next.js and LiteLLM proxy together
- `bun run proxy` – LiteLLM proxy only (port 4000)
- `bun run setup-litellm` – Install LiteLLM proxy (runs automatically after `bun install`)
- `bun run build` – Production build
- `bun run start` – Start production server
- `bun run lint` – Run ESLint
- `bun run create-example-user` – Create a test user (requires `SUPABASE_SERVICE_ROLE_KEY` in env)

## How to run with Bun

```bash
# Install dependencies (generates bun.lock)
bun install

# Dev
bun dev

# Build / Run
bun run build
bun run start
```
