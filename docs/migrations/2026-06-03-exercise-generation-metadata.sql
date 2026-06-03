-- Generation metadata for routine generation.
-- Apply via the Supabase SQL Editor BEFORE the seed file
-- (2026-06-03-exercise-generation-metadata-seed.sql).
--
-- Nullable/defaulted so user-created exercises are unaffected; only global
-- exercises (user_id IS NULL) are seeded, and only globals drive generation.

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS movement_pattern text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_compound boolean NOT NULL DEFAULT false;
