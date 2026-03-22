-- Migration: create wall_topos, wall_topo_lines, and route_topos tables
-- Issue #86/#91: topo image support for walls and routes

CREATE TABLE IF NOT EXISTS wall_topos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id     UUID NOT NULL REFERENCES walls(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wall_topo_lines (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topo_id    UUID NOT NULL REFERENCES wall_topos(id) ON DELETE CASCADE,
  route_id   UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  points     TEXT NOT NULL,
  color      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS route_topos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  points     TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#EF4444',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: admin write; authenticated read
ALTER TABLE wall_topos ENABLE ROW LEVEL SECURITY;
ALTER TABLE wall_topo_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_topos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read wall_topos" ON wall_topos;
CREATE POLICY "Authenticated users can read wall_topos"
  ON wall_topos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage wall_topos" ON wall_topos;
CREATE POLICY "Admins can manage wall_topos"
  ON wall_topos FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read wall_topo_lines" ON wall_topo_lines;
CREATE POLICY "Authenticated users can read wall_topo_lines"
  ON wall_topo_lines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage wall_topo_lines" ON wall_topo_lines;
CREATE POLICY "Admins can manage wall_topo_lines"
  ON wall_topo_lines FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can read route_topos" ON route_topos;
CREATE POLICY "Authenticated users can read route_topos"
  ON route_topos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage route_topos" ON route_topos;
CREATE POLICY "Admins can manage route_topos"
  ON route_topos FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
