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

   Run Next.js: `bun dev`. Open [http://localhost:3000](http://localhost:3000).

   **Embeddings:** By default the app uses the local in-process model (all-MiniLM-L6-v2, 384 dimensions). Optional: set `EMBEDDING_PROVIDER=openai` and `OPENAI_EMBEDDING_API_KEY` for OpenAI, or `EMBEDDING_PROVIDER=minimax` with `MINIMAX_API_KEY` and `MINIMAX_GROUP_ID` for MiniMax.

   **Test embeddings:** With the app running, open http://localhost:3000/api/embedding-test. You should get `{ "ok": true, "dimensions": 384, ... }` when using the local model.

   **Lesson generation (Phase 3):** Set `FEATHERLESS_API_KEY` in `.env.local` for chat completions (works in Hong Kong and globally; no OpenAI required). Optional: `FEATHERLESS_CHAT_MODEL` (default: `Qwen/Qwen2.5-7B-Instruct`). Alternatively set `OPENAI_API_KEY` for OpenAI.

5. Open [http://localhost:3000](http://localhost:3000) and go to **Sync Dashboard** to verify the Canvas connection (courses, calendar events, assignments in tables).

## Deploy to Vercel

The project includes a `vercel.json` that configures the build to use **Bun** (`bun install`, `bun run build`).

### Option A: Connect your Git repo (recommended)

1. Push your code to **GitHub**, **GitLab**, or **Bitbucket**.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo.
3. Vercel will detect Next.js and use the settings from `vercel.json`. Click **Deploy**.
4. In the project **Settings → Environment Variables**, add the same variables you use locally (from `.env.example`), e.g.:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (if you use background sync)
   - Optional: `EMBEDDING_PROVIDER`, `OPENAI_EMBEDDING_API_KEY` (or MiniMax keys), `OPENAI_API_KEY` / `FEATHERLESS_API_KEY`, etc.
5. Redeploy after adding env vars so they take effect.

### Option B: Deploy from the CLI

```bash
bunx vercel login    # log in once
bunx vercel          # deploy (prompts for project setup on first run)
bunx vercel --prod   # deploy to production
```

Add environment variables in the [Vercel dashboard](https://vercel.com/dashboard) under your project → **Settings → Environment Variables**.

### Embeddings on Vercel

The default **local in-process** embedding model (all-MiniLM-L6-v2) can be heavy for serverless (cold starts, memory). For production on Vercel, consider setting **`EMBEDDING_PROVIDER=openai`** and **`OPENAI_EMBEDDING_API_KEY`** (and ensure your Supabase migration uses the matching vector dimensions, e.g. 1536 for `text-embedding-3-small`), or use MiniMax with `EMBEDDING_PROVIDER=minimax` and the corresponding keys.

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
- `bun run dev:all` – Same as `bun dev`
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
