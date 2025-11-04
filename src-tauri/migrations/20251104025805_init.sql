CREATE TABLE climbs (
    id TEXT PRIMARY KEY,
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
    sent_status VARCHAR(30) NOT NULL
);