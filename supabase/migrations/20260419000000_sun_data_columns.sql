-- Migration: add sun_data JSONB to walls and routes tables
-- Issue #224: sun/shade Supabase column additions + sync wiring

ALTER TABLE walls ADD COLUMN IF NOT EXISTS sun_data JSONB;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS sun_data JSONB;

-- RLS: sun_data is a column on existing tables that already have row-level
-- security (authenticated read, admin write via is_admin()). No new policies
-- are needed — the existing table policies cover the new column automatically.
