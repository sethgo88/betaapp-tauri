-- Add sort_order to routes table for admin-defined wall layout ordering
ALTER TABLE routes ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill: set sort_order based on current alphabetical order per wall
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY wall_id ORDER BY name ASC) - 1 AS rn
  FROM routes
  WHERE deleted_at IS NULL
)
UPDATE routes
SET sort_order = ranked.rn
FROM ranked
WHERE routes.id = ranked.id;
