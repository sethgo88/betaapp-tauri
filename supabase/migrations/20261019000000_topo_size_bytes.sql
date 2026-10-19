-- Issue #256: record encoded image size on topo tables
ALTER TABLE public.wall_topos  ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
ALTER TABLE public.route_topos ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
