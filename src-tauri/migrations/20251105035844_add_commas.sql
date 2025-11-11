CREATE TABLE IF NOT EXISTS climbs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    route_type TEXT NOT NULL,
    grade TEXT NOT NULL,
    moves TEXT NOT NULL,
    created_date INTEGER NOT NULL,
    last_update_date INTEGER NOT NULL,
    link TEXT,
    route_location TEXT,
    country TEXT,
    area TEXT,
    sub_area TEXT,
    sent_status VARCHAR(30) NOT NULL,
    synced TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    email TEXT,
    phone TEXT,
    synced TEXT
);
