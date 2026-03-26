-- Add sent_date column to climbs (matches local SQLite migration v22)
ALTER TABLE climbs ADD COLUMN IF NOT EXISTS sent_date TEXT;
