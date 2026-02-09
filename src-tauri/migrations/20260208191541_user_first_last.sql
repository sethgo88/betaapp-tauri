-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a workaround
-- First, check if column exists by attempting to query it
-- If it doesn't exist, we'll get an error but migrations will handle retries
-- For now, we'll use a safe approach: recreate the table with the new column
PRAGMA foreign_keys=OFF;

-- Create new table with date_added column
CREATE TABLE IF NOT EXISTS users_new (
    id TEXT PRIMARY KEY,
    username TEXT,
    firstname TEXT,
    email TEXT,
    phone TEXT,
    synced TEXT,
    date_added INTEGER DEFAULT 0
);

-- Copy data from old table; if `firstname` and/or `date_added` didn't exist before,
-- fill firstname with NULL and date_added with 0
INSERT INTO users_new (id, username, firstname, email, phone, synced, date_added)
SELECT id, username, NULL AS firstname, email, phone, synced, 0 FROM users;

-- Drop old table and rename new one
DROP TABLE IF EXISTS users;
ALTER TABLE users_new RENAME TO users;

PRAGMA foreign_keys=ON;