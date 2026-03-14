-- Issue #25: Add climbing type counts and wall_type to crags/walls
-- Run in Supabase SQL editor before deploying the app update.

-- ── 1. Add columns ──────────────────────────────────────────────────────────

ALTER TABLE walls
  ADD COLUMN wall_type TEXT NOT NULL DEFAULT 'wall',
  ADD COLUMN sport_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN trad_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN boulder_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE crags
  ADD COLUMN sport_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN trad_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN boulder_count INTEGER NOT NULL DEFAULT 0;

-- ── 2. Trigger: recalculate wall counts from verified routes ────────────────

CREATE OR REPLACE FUNCTION recalculate_wall_counts()
RETURNS TRIGGER AS $$
DECLARE
  target_wall_id UUID;
  target_crag_id UUID;
BEGIN
  -- Determine which wall was affected
  IF TG_OP = 'DELETE' THEN
    target_wall_id := OLD.wall_id;
  ELSE
    target_wall_id := NEW.wall_id;
  END IF;

  -- Recalculate counts on the wall
  UPDATE walls SET
    sport_count = COALESCE((
      SELECT COUNT(*) FROM routes
      WHERE wall_id = target_wall_id AND route_type = 'sport' AND status = 'verified'
    ), 0),
    trad_count = COALESCE((
      SELECT COUNT(*) FROM routes
      WHERE wall_id = target_wall_id AND route_type = 'trad' AND status = 'verified'
    ), 0),
    boulder_count = COALESCE((
      SELECT COUNT(*) FROM routes
      WHERE wall_id = target_wall_id AND route_type = 'boulder' AND status = 'verified'
    ), 0)
  WHERE id = target_wall_id;

  -- Get the parent crag
  SELECT crag_id INTO target_crag_id FROM walls WHERE id = target_wall_id;

  -- Roll up to crag
  UPDATE crags SET
    sport_count = COALESCE((
      SELECT SUM(sport_count) FROM walls WHERE crag_id = target_crag_id
    ), 0),
    trad_count = COALESCE((
      SELECT SUM(trad_count) FROM walls WHERE crag_id = target_crag_id
    ), 0),
    boulder_count = COALESCE((
      SELECT SUM(boulder_count) FROM walls WHERE crag_id = target_crag_id
    ), 0)
  WHERE id = target_crag_id;

  -- Handle wall_id change (route moved between walls)
  IF TG_OP = 'UPDATE' AND OLD.wall_id IS DISTINCT FROM NEW.wall_id THEN
    -- Recalculate the old wall too
    UPDATE walls SET
      sport_count = COALESCE((
        SELECT COUNT(*) FROM routes
        WHERE wall_id = OLD.wall_id AND route_type = 'sport' AND status = 'verified'
      ), 0),
      trad_count = COALESCE((
        SELECT COUNT(*) FROM routes
        WHERE wall_id = OLD.wall_id AND route_type = 'trad' AND status = 'verified'
      ), 0),
      boulder_count = COALESCE((
        SELECT COUNT(*) FROM routes
        WHERE wall_id = OLD.wall_id AND route_type = 'boulder' AND status = 'verified'
      ), 0)
    WHERE id = OLD.wall_id;

    -- Roll up old crag
    SELECT crag_id INTO target_crag_id FROM walls WHERE id = OLD.wall_id;
    UPDATE crags SET
      sport_count = COALESCE((
        SELECT SUM(sport_count) FROM walls WHERE crag_id = target_crag_id
      ), 0),
      trad_count = COALESCE((
        SELECT SUM(trad_count) FROM walls WHERE crag_id = target_crag_id
      ), 0),
      boulder_count = COALESCE((
        SELECT SUM(boulder_count) FROM walls WHERE crag_id = target_crag_id
      ), 0)
    WHERE id = target_crag_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER routes_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON routes
FOR EACH ROW EXECUTE FUNCTION recalculate_wall_counts();

-- ── 3. Backfill existing counts ─────────────────────────────────────────────

UPDATE walls w SET
  sport_count = COALESCE((
    SELECT COUNT(*) FROM routes WHERE wall_id = w.id AND route_type = 'sport' AND status = 'verified'
  ), 0),
  trad_count = COALESCE((
    SELECT COUNT(*) FROM routes WHERE wall_id = w.id AND route_type = 'trad' AND status = 'verified'
  ), 0),
  boulder_count = COALESCE((
    SELECT COUNT(*) FROM routes WHERE wall_id = w.id AND route_type = 'boulder' AND status = 'verified'
  ), 0);

UPDATE crags c SET
  sport_count = COALESCE((
    SELECT SUM(sport_count) FROM walls WHERE crag_id = c.id
  ), 0),
  trad_count = COALESCE((
    SELECT SUM(trad_count) FROM walls WHERE crag_id = c.id
  ), 0),
  boulder_count = COALESCE((
    SELECT SUM(boulder_count) FROM walls WHERE crag_id = c.id
  ), 0);
