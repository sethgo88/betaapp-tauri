-- Migration: add approach text to crags and walls
-- Issue #92: approach description for crags and walls

ALTER TABLE crags ADD COLUMN IF NOT EXISTS approach TEXT;
ALTER TABLE walls ADD COLUMN IF NOT EXISTS approach TEXT;
