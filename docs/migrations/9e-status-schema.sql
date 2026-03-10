-- Phase 9e: Replace verified boolean with status text
-- Run in Supabase SQL Editor before deploying the app update.

-- ── routes ────────────────────────────────────────────────────────────────────

alter table public.routes
  add column status text not null default 'pending';

-- Migrate existing data
update public.routes set status = 'verified' where verified = true;
update public.routes set status = 'pending'  where verified = false;

-- Drop old policies that reference the verified column before dropping it
drop policy if exists "Users can read verified routes or own submissions" on public.routes;
drop policy if exists "routes_select" on public.routes;
drop policy if exists "routes_insert" on public.routes;
drop policy if exists "routes_update" on public.routes;

alter table public.routes drop column verified;

-- Add soft-delete support
alter table public.routes
  add column if not exists deleted_at timestamptz;

-- New RLS using status
create policy "Users can read verified routes or own submissions"
  on public.routes for select using (
    (status = 'verified' or auth.uid() = created_by)
    and deleted_at is null
  );
create policy "Users can submit routes"
  on public.routes for insert with check (auth.uid() = created_by);
create policy "Users can update own routes"
  on public.routes for update using (auth.uid() = created_by);

-- ── sub_regions ───────────────────────────────────────────────────────────────

alter table public.sub_regions
  add column status     text        not null default 'verified',
  add column created_by uuid        references auth.users,
  add column deleted_at timestamptz;

-- Existing admin-inserted rows are already verified
update public.sub_regions set status = 'verified' where status = 'verified';

-- RLS
alter table public.sub_regions enable row level security;

drop policy if exists "Authenticated users can read locations" on public.sub_regions;
create policy "Users can read verified sub_regions or own submissions"
  on public.sub_regions for select using (
    (status = 'verified' or auth.uid() = created_by)
    and deleted_at is null
  );
create policy "Users can submit sub_regions"
  on public.sub_regions for insert with check (auth.uid() = created_by);

-- ── crags ─────────────────────────────────────────────────────────────────────

alter table public.crags
  add column status     text        not null default 'verified',
  add column created_by uuid        references auth.users,
  add column deleted_at timestamptz;

alter table public.crags enable row level security;

drop policy if exists "Authenticated users can read locations" on public.crags;
create policy "Users can read verified crags or own submissions"
  on public.crags for select using (
    (status = 'verified' or auth.uid() = created_by)
    and deleted_at is null
  );
create policy "Users can submit crags"
  on public.crags for insert with check (auth.uid() = created_by);

-- ── walls ─────────────────────────────────────────────────────────────────────

alter table public.walls
  add column status     text        not null default 'verified',
  add column created_by uuid        references auth.users,
  add column deleted_at timestamptz;

alter table public.walls enable row level security;

drop policy if exists "Authenticated users can read locations" on public.walls;
create policy "Users can read verified walls or own submissions"
  on public.walls for select using (
    (status = 'verified' or auth.uid() = created_by)
    and deleted_at is null
  );
create policy "Users can submit walls"
  on public.walls for insert with check (auth.uid() = created_by);
