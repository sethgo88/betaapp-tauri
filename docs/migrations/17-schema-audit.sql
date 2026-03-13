-- #17: Full schema audit migration for BetaApp
-- Idempotent — safe to re-run.
-- Run in Supabase SQL Editor.

-- ── 1. Missing columns on existing tables ────────────────────────────────────

-- sub_regions: description (v5)
alter table public.sub_regions
  add column if not exists description text;

-- crags: description (v5) + lat/lng (v10)
alter table public.crags
  add column if not exists description text,
  add column if not exists lat real,
  add column if not exists lng real;

-- walls: description (v5)
alter table public.walls
  add column if not exists description text;

-- ── 2. Shared updated_at trigger function ─────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── 3. users table (public profile mirror) ───────────────────────────────────

create table if not exists public.users (
  id           uuid        primary key references auth.users(id) on delete cascade,
  email        text        not null,
  role         text        not null default 'user',
  display_name text,
  height_cm    integer,
  ape_index_cm integer,
  max_redpoint_sport    text,
  max_redpoint_boulder  text,
  default_unit text        not null default 'metric',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

alter table public.users enable row level security;

drop policy if exists "Users can read own profile"   on public.users;
drop policy if exists "Users can update own profile" on public.users;
drop policy if exists "Users can insert own profile" on public.users;

create policy "Users can read own profile"
  on public.users for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.users for insert with check (auth.uid() = id);

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ── 4. burns table (#14) ─────────────────────────────────────────────────────

create table if not exists public.burns (
  id         uuid        primary key default gen_random_uuid(),
  climb_id   text        not null references public.climbs(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  date       text        not null,
  outcome    text        not null default 'attempt',
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.burns enable row level security;

drop policy if exists "Users can manage own burns" on public.burns;
create policy "Users can manage own burns"
  on public.burns for all using (auth.uid() = user_id);

drop trigger if exists burns_updated_at on public.burns;
create trigger burns_updated_at
  before update on public.burns
  for each row execute function public.set_updated_at();

-- ── 5. route_links table (#13) ───────────────────────────────────────────────

create table if not exists public.route_links (
  id         uuid        primary key default gen_random_uuid(),
  route_id   uuid        not null references public.routes(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  url        text        not null,
  title      text,
  link_type  text        not null default 'video',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.route_links enable row level security;

drop policy if exists "Authenticated users can read route_links"       on public.route_links;
drop policy if exists "Users can insert own route_links"               on public.route_links;
drop policy if exists "Users or admin can delete route_links"          on public.route_links;

create policy "Authenticated users can read route_links"
  on public.route_links for select using (auth.role() = 'authenticated');
create policy "Users can insert own route_links"
  on public.route_links for insert with check (auth.uid() = user_id);
create policy "Users or admin can delete route_links"
  on public.route_links for delete using (auth.uid() = user_id or public.is_admin());

-- ── 6. route_images table (#11) ──────────────────────────────────────────────

create table if not exists public.route_images (
  id         uuid        primary key default gen_random_uuid(),
  route_id   uuid        not null references public.routes(id) on delete cascade,
  url        text        not null,
  caption    text,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now()
);

alter table public.route_images enable row level security;

drop policy if exists "Authenticated users can read route_images" on public.route_images;
drop policy if exists "Admins can write route_images"             on public.route_images;

create policy "Authenticated users can read route_images"
  on public.route_images for select using (auth.role() = 'authenticated');
create policy "Admins can write route_images"
  on public.route_images for all using (public.is_admin());

-- ── 7. wall_images table (#11) ───────────────────────────────────────────────

create table if not exists public.wall_images (
  id         uuid        primary key default gen_random_uuid(),
  wall_id    uuid        not null references public.walls(id) on delete cascade,
  url        text        not null,
  caption    text,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now()
);

alter table public.wall_images enable row level security;

drop policy if exists "Authenticated users can read wall_images" on public.wall_images;
drop policy if exists "Admins can write wall_images"             on public.wall_images;

create policy "Authenticated users can read wall_images"
  on public.wall_images for select using (auth.role() = 'authenticated');
create policy "Admins can write wall_images"
  on public.wall_images for all using (public.is_admin());

-- ── 8. climb_images table (#12) ──────────────────────────────────────────────

create table if not exists public.climb_images (
  id         uuid        primary key default gen_random_uuid(),
  climb_id   text        not null references public.climbs(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  url        text        not null,
  caption    text,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.climb_images enable row level security;

drop policy if exists "Users can manage own climb_images" on public.climb_images;
create policy "Users can manage own climb_images"
  on public.climb_images for all using (auth.uid() = user_id);
