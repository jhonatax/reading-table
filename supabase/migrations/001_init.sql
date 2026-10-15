-- The Reading Table: database schema for saved accounts.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste this file -> Run.
-- Every table uses Row Level Security: a signed-in user can only read/write their own rows.

-- One row per user: their quiz answers and latest recommendations.
create table if not exists public.profiles (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  display_name    text,
  answers         jsonb,
  recommendations jsonb,            -- snapshot: [{"id": "OL...W", "score": 87}, ...]
  updated_at      timestamptz not null default now()
);

-- People the user added to "The table" (their reading group).
create table if not exists public.group_members (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name       text not null,
  answers    jsonb not null,
  added_at   timestamptz not null default now()
);
create index if not exists group_members_user_idx on public.group_members (user_id);

-- Books the user has read (excluded from their recommendations).
create table if not exists public.read_books (
  user_id  uuid not null references auth.users (id) on delete cascade default auth.uid(),
  book_id  text not null,           -- Open Library work id, e.g. OL82563W
  read_at  timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.profiles      enable row level security;
alter table public.group_members enable row level security;
alter table public.read_books    enable row level security;

create policy "own profile"       on public.profiles      for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own group members" on public.group_members for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own read books"    on public.read_books    for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
