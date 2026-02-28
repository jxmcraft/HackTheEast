-- Users profile table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  canvas_api_url text,
  canvas_api_key text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add Canvas URL column if it was missing (e.g. existing profiles table)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS canvas_api_url text;

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- RLS Policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Function to automatically create profile on signup (skips if profile already exists)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for automatic profile creation
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

