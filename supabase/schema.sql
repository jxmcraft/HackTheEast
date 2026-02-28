-- Supabase schema for HTE app
-- Run this in the Supabase SQL Editor or via migrations

-- Users: extend auth or store app-specific profile
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  music_preference text,
  avatar_personality text,
  updated_at timestamptz default now()
);

-- Courses: synced from Canvas
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  canvas_id bigint not null unique,
  user_id uuid references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_courses_user_id on public.courses(user_id);
create index if not exists idx_courses_canvas_id on public.courses(canvas_id);

-- Assignments: homework tasks from Canvas
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade not null,
  canvas_assignment_id bigint not null,
  name text not null,
  description text,
  due_date timestamptz,
  status text default 'pending' check (status in ('pending', 'completed', 'overdue')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(course_id, canvas_assignment_id)
);

create index if not exists idx_assignments_course_id on public.assignments(course_id);
create index if not exists idx_assignments_due_date on public.assignments(due_date);
create index if not exists idx_assignments_status on public.assignments(status);

-- Study sessions: logs for the dashboard
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes int,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_study_sessions_user_id on public.study_sessions(user_id);
create index if not exists idx_study_sessions_started_at on public.study_sessions(started_at);

-- RLS (optional: enable after configuring auth)
-- alter table public.users enable row level security;
-- alter table public.courses enable row level security;
-- alter table public.assignments enable row level security;
-- alter table public.study_sessions enable row level security;
