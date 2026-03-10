-- Phase 10: Add route_id to climbs (links a logged climb to a verified route)
-- Run in Supabase SQL Editor before deploying the app update.

alter table public.climbs
  add column if not exists route_id uuid references public.routes(id) on delete set null;
