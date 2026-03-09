CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    username TEXT,
    daily_calorie_goal INTEGER DEFAULT 2000,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    description TEXT NOT NULL,
    food_items TEXT NOT NULL,
    total_calories INTEGER NOT NULL,
    photo_r2_key TEXT,
    audio_r2_key TEXT,
    follow_up_text TEXT,
    analysis_source TEXT DEFAULT 'photo',
    logged_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE pending_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    chat_id INTEGER NOT NULL,
    photo_r2_key TEXT NOT NULL,
    caption TEXT,
    preliminary_analysis TEXT,
    status TEXT DEFAULT 'waiting',
    created_at TEXT DEFAULT (datetime('now'))
);
