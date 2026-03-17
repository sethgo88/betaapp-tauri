-- Migration: add updated_at to regions + triggers to bump it on child changes
-- Issue #31: staleness detection for downloaded region data

-- 1. Add updated_at column to regions (default to now for existing rows)
ALTER TABLE regions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Trigger function: bump regions.updated_at when called
CREATE OR REPLACE FUNCTION bump_region_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_region_id UUID;
BEGIN
  -- Resolve region_id from the changed row depending on table depth
  IF TG_TABLE_NAME = 'sub_regions' THEN
    v_region_id := COALESCE(NEW.region_id, OLD.region_id);

  ELSIF TG_TABLE_NAME = 'crags' THEN
    SELECT region_id INTO v_region_id
      FROM sub_regions WHERE id = COALESCE(NEW.sub_region_id, OLD.sub_region_id);

  ELSIF TG_TABLE_NAME = 'walls' THEN
    SELECT sr.region_id INTO v_region_id
      FROM crags c
      JOIN sub_regions sr ON sr.id = c.sub_region_id
      WHERE c.id = COALESCE(NEW.crag_id, OLD.crag_id);

  ELSIF TG_TABLE_NAME = 'routes' THEN
    SELECT sr.region_id INTO v_region_id
      FROM walls w
      JOIN crags c  ON c.id  = w.crag_id
      JOIN sub_regions sr ON sr.id = c.sub_region_id
      WHERE w.id = COALESCE(NEW.wall_id, OLD.wall_id);
  END IF;

  IF v_region_id IS NOT NULL THEN
    UPDATE regions SET updated_at = now() WHERE id = v_region_id;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. Attach trigger to sub_regions
DROP TRIGGER IF EXISTS trg_sub_regions_bump_region ON sub_regions;
CREATE TRIGGER trg_sub_regions_bump_region
  AFTER INSERT OR UPDATE OR DELETE ON sub_regions
  FOR EACH ROW EXECUTE FUNCTION bump_region_updated_at();

-- 4. Attach trigger to crags
DROP TRIGGER IF EXISTS trg_crags_bump_region ON crags;
CREATE TRIGGER trg_crags_bump_region
  AFTER INSERT OR UPDATE OR DELETE ON crags
  FOR EACH ROW EXECUTE FUNCTION bump_region_updated_at();

-- 5. Attach trigger to walls
DROP TRIGGER IF EXISTS trg_walls_bump_region ON walls;
CREATE TRIGGER trg_walls_bump_region
  AFTER INSERT OR UPDATE OR DELETE ON walls
  FOR EACH ROW EXECUTE FUNCTION bump_region_updated_at();

-- 6. Attach trigger to routes
DROP TRIGGER IF EXISTS trg_routes_bump_region ON routes;
CREATE TRIGGER trg_routes_bump_region
  AFTER INSERT OR UPDATE OR DELETE ON routes
  FOR EACH ROW EXECUTE FUNCTION bump_region_updated_at();
