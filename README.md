# HTE – Canvas LMS Sync & Study Dashboard

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase. Syncs courses, calendar events, and assignments from the Canvas LMS API and displays them on a Sync Dashboard.

## Setup

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Environment variables**

   Copy `.env.example` to `.env` (or `.env.local`) and set:

   - **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from [Supabase](https://supabase.com) project settings).
   - **Canvas:** Set per user in **Settings** (Canvas API URL and Access Token); no env vars.
   - **LiteLLM (embeddings):** `LITELLM_EMBEDDING_API_BASE=http://localhost:4000`, `LITELLM_EMBEDDING_API_KEY=sk-1234`, `LITELLM_EMBEDDING_MODEL=minimax-embed` (or `featherless-embed`). Minimax and Featherless credentials are set only in the proxy’s environment

3. **Supabase schema**

   In the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql), run the contents of `supabase/schema.sql` to create `users`, `courses`, `assignments`, and `study_sessions` tables.

   Then run `supabase/profiles.sql` to create the `profiles` table + RLS + the signup trigger.

4. **Run the app**

   All embedding requests go through the **LiteLLM proxy**. Run the proxy and the app.

   Install the LiteLLM proxy once (Python):

   ```bash
   pip install 'litellm[proxy]'
   ```

   Either run both in one go: `bun run dev:all`, or in two terminals: `bun run proxy` then `bun dev`.

   - Next.js: [http://localhost:3000](http://localhost:3000)
   - LiteLLM proxy: http://localhost:4000

   Set LiteLLM vars in your env: `LITELLM_EMBEDDING_API_BASE=http://localhost:4000`, `LITELLM_EMBEDDING_API_KEY=sk-1234` (match `master_key` in `litellm/config.yaml`), `LITELLM_EMBEDDING_MODEL=minimax-embed` (or `featherless-embed`). Put proxy keys in `.env` or `.env.local` (they are loaded when you run `bun run proxy`; no OpenAI connection – traffic goes only to Minimax/Featherless): for **minimax-embed** set `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`, and `OPENAI_API_KEY` (same value as `MINIMAX_API_KEY`); for **featherless-embed** set `FEATHERLESS_API_KEY` and `OPENAI_API_KEY` (same as `FEATHERLESS_API_KEY`). See `litellm/config.yaml` for details.

   **Test embeddings:** With app and proxy running, open http://localhost:3000/api/embedding-test. You should get `{ "ok": true, "dimensions": 1536, ... }` when configured correctly.

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
