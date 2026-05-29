-- docs/migrations/2026-05-29-ab-workout-sessions.sql

-- 1. Add variant to routine_exercises (nullable; NULL = no A/B split)
ALTER TABLE routine_exercises
  ADD COLUMN IF NOT EXISTS variant text CHECK (variant IN ('A', 'B'));

-- 2. Add variant to template_exercises (nullable)
ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS variant text CHECK (variant IN ('A', 'B'));

-- 3. Create workout_sessions table
CREATE TABLE IF NOT EXISTS workout_sessions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) NOT NULL,
  routine_id    uuid REFERENCES workout_routines(id) ON DELETE SET NULL,
  workout_type  text NOT NULL,
  variant       text CHECK (variant IN ('A', 'B')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

-- 4. RLS
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON workout_sessions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Index for last-session queries
CREATE INDEX IF NOT EXISTS idx_workout_sessions_lookup
  ON workout_sessions (user_id, routine_id, workout_type, completed_at DESC NULLS FIRST);
