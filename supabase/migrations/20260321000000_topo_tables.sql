-- Topo tables: wall_topos, wall_topo_lines, route_topos
-- Run in Supabase SQL Editor or via `supabase db push`

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists public.wall_topos (
  id         text        primary key,
  wall_id    text        not null,
  image_url  text        not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.wall_topo_lines (
  id         text        primary key,
  topo_id    text        not null references public.wall_topos(id) on delete cascade,
  route_id   text        not null,
  points     text        not null,  -- JSON array: [{x_pct: 0-1, y_pct: 0-1}, ...]
  color      text        not null,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.route_topos (
  id         text        primary key,
  route_id   text        not null,
  image_url  text        not null,
  points     text        not null,  -- JSON array: [{x_pct: 0-1, y_pct: 0-1}, ...]
  color      text        not null default '#EF4444',
  created_by text,
  created_at timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.wall_topos      enable row level security;
alter table public.wall_topo_lines enable row level security;
alter table public.route_topos     enable row level security;

-- wall_topos
create policy "Authenticated users can read wall_topos"
  on public.wall_topos for select using (auth.role() = 'authenticated');
create policy "Admins can write wall_topos"
  on public.wall_topos for all using (public.is_admin());

-- wall_topo_lines
create policy "Authenticated users can read wall_topo_lines"
  on public.wall_topo_lines for select using (auth.role() = 'authenticated');
create policy "Admins can write wall_topo_lines"
  on public.wall_topo_lines for all using (public.is_admin());

-- route_topos
create policy "Authenticated users can read route_topos"
  on public.route_topos for select using (auth.role() = 'authenticated');
create policy "Admins can write route_topos"
  on public.route_topos for all using (public.is_admin());

-- ── Storage ───────────────────────────────────────────────────────────────────
-- No changes needed. Topo images use the existing `route-images` public bucket
-- under paths: topos/walls/{wallId}/{uuid}.jpg and topos/routes/{routeId}/{uuid}.jpg
