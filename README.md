# HTE – Canvas LMS Sync & Study Dashboard

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase. Syncs courses, calendar events, and assignments from the Canvas LMS API and displays them on a Sync Dashboard.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables**

   Copy `.env.example` to `.env.local` and set:

   - **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from [Supabase](https://supabase.com) project settings).
   - **Canvas:** `CANVAS_API_URL` (e.g. `https://your-school.instructure.com`), `CANVAS_ACCESS_TOKEN` (from Canvas → Profile → Settings → New Access Token).

3. **Supabase schema**

   In the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql), run the contents of `supabase/schema.sql` to create `users`, `courses`, `assignments`, and `study_sessions` tables.

   Then run `supabase/profiles.sql` to create the `profiles` table + RLS + the signup trigger.

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and go to **Sync Dashboard** to verify the Canvas connection (courses, calendar events, assignments in tables).

## Create an example user

This uses the Supabase **Service Role Key** (never expose this in the browser).

1. Set `SUPABASE_SERVICE_ROLE_KEY` in your shell (or a local env file you do not commit).
2. Run:

   ```bash
   npm run create-example-user
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

- `npm run dev` – Start dev server
- `npm run build` – Production build
- `npm run start` – Start production server
- `npm run lint` – Run ESLint
