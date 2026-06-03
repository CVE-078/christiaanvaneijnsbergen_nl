-- Exercise instructions: muscle groups and technique cues per global exercise.
-- Apply via the Supabase SQL Editor BEFORE the seed file
-- (2026-05-31-exercise-instructions-seed.sql).
--
-- Read-only for the app: rows are seeded, never written from the client.

CREATE TABLE IF NOT EXISTS exercise_instructions (
    exercise_id       UUID PRIMARY KEY REFERENCES exercises(id) ON DELETE CASCADE,
    primary_muscles   TEXT[] NOT NULL DEFAULT '{}',
    secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
    cues              TEXT[] NOT NULL DEFAULT '{}'
);

ALTER TABLE exercise_instructions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "instructions_read_authenticated" ON exercise_instructions;
CREATE POLICY "instructions_read_authenticated"
    ON exercise_instructions
    FOR SELECT
    TO authenticated
    USING (true);
