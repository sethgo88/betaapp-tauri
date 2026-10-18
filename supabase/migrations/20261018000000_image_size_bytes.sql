-- Issue #251: record encoded image size so the app can show download sizes
ALTER TABLE public.climb_images ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
ALTER TABLE public.route_images ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
ALTER TABLE public.wall_images  ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
