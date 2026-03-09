CREATE TABLE allowed_users (
    user_id INTEGER PRIMARY KEY
);

-- Admin is always allowed
INSERT INTO allowed_users (user_id) VALUES (157401208);
