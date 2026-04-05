-- v28: climb_links table — per-climb external links (#205)
-- Run this in the Supabase SQL editor before shipping this build.

create table if not exists public.climb_links (
  id         uuid primary key default gen_random_uuid(),
  climb_id   uuid not null references public.climbs(id) on delete cascade,
  user_id    uuid not null references auth.users(id),
  url        text not null,
  title      text,
  link_type  text not null default 'link',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.climb_links enable row level security;

create policy "Users can manage their own climb links"
  on public.climb_links
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
