-- Applied 2026-05-25 via Supabase SQL Editor

-- D2: Enforce max 50 chars on display_name
ALTER TABLE profiles
ADD CONSTRAINT profiles_display_name_length
CHECK (display_name IS NULL OR char_length(display_name) <= 50);

-- D4: Index for user+week query pattern in set_logs
CREATE INDEX IF NOT EXISTS idx_set_logs_user_week
ON set_logs(user_id, week);
