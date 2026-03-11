CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    first_name TEXT NOT NULL,
    username TEXT,
    daily_calorie_goal INTEGER NOT NULL DEFAULT 2000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS allowed_users (
    user_id BIGINT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS meals (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    food_items TEXT NOT NULL,
    total_calories INTEGER NOT NULL,
    meal_type TEXT NOT NULL DEFAULT 'snack',
    total_protein_g DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_carbs_g DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_fat_g DOUBLE PRECISION NOT NULL DEFAULT 0,
    photo_r2_key TEXT,
    audio_r2_key TEXT,
    follow_up_text TEXT,
    analysis_source TEXT NOT NULL DEFAULT 'photo',
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT meals_meal_type_check CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'))
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE TABLE IF NOT EXISTS weights (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight_kg DOUBLE PRECISION NOT NULL,
    note TEXT,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    event_name TEXT NOT NULL,
    user_id BIGINT,
    phone_number TEXT,
    business_phone TEXT,
    message_type TEXT,
    source TEXT,
    model TEXT,
    status TEXT NOT NULL DEFAULT 'ok',
    input_tokens INTEGER,
    cached_input_tokens INTEGER,
    output_tokens INTEGER,
    audio_input_tokens INTEGER,
    estimated_cost_usd DOUBLE PRECISION,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meals_user_logged_at ON meals(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_created_at ON messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weights_user_measured_at ON weights(user_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event_name_created_at ON analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user_created_at ON analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_source_created_at ON analytics_events(source, created_at DESC);
