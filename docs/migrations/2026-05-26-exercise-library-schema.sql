-- Migration: Exercise Library schema
-- Date: 2026-05-26
-- Apply via Supabase SQL Editor

-- ============================================================
-- 1. New tables
-- ============================================================

CREATE TABLE exercises (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name            text NOT NULL,
    category        text NOT NULL CHECK (category IN ('push', 'pull', 'legs', 'other')),
    default_sets    text NOT NULL,
    default_reps    text NOT NULL,
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE
    -- NULL = global / seeded exercise
);

CREATE TABLE workout_routines (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name        text NOT NULL,
    created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE routine_exercises (
    id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    routine_id           uuid REFERENCES workout_routines(id) ON DELETE CASCADE NOT NULL,
    exercise_id          uuid REFERENCES exercises(id) NOT NULL,
    "order"              integer NOT NULL,
    sets                 text NOT NULL,
    reps                 text NOT NULL,
    starting_weight_kg   numeric(6,2)
);

-- ============================================================
-- 2. Modify existing tables
-- ============================================================

ALTER TABLE profiles
    ADD COLUMN active_routine_id uuid REFERENCES workout_routines(id) ON DELETE SET NULL;

-- set_logs: drop old columns and unique constraint, add new column
ALTER TABLE set_logs
    DROP COLUMN workout_type,
    DROP COLUMN ex_idx;

ALTER TABLE set_logs
    ADD COLUMN routine_exercise_id uuid REFERENCES routine_exercises(id) NOT NULL;

ALTER TABLE set_logs
    DROP CONSTRAINT IF EXISTS set_logs_user_id_week_workout_type_ex_idx_set_idx_key;

ALTER TABLE set_logs
    ADD CONSTRAINT set_logs_user_id_week_routine_exercise_id_set_idx_key
    UNIQUE (user_id, week, routine_exercise_id, set_idx);

-- ============================================================
-- 3. Row-Level Security
-- ============================================================

-- exercises
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises_select"
    ON exercises FOR SELECT
    USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "exercises_insert"
    ON exercises FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "exercises_update"
    ON exercises FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "exercises_delete"
    ON exercises FOR DELETE
    USING (user_id = auth.uid());

-- workout_routines
ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_routines_all"
    ON workout_routines FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- routine_exercises
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "routine_exercises_all"
    ON routine_exercises FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workout_routines wr
            WHERE wr.id = routine_exercises.routine_id
              AND wr.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workout_routines wr
            WHERE wr.id = routine_exercises.routine_id
              AND wr.user_id = auth.uid()
        )
    );

-- ============================================================
-- 4. Seed global exercises (user_id = NULL)
-- ============================================================

-- Push
INSERT INTO exercises (name, category, default_sets, default_reps, user_id) VALUES
    ('Dumbbell Bench Press',             'push', '3-4', '8-12',       NULL),
    ('Incline DB Press',                 'push', '3',   '10-14',      NULL),
    ('DB Lateral Raise',                 'push', '3-4', '12-16',      NULL),
    ('DB Overhead Press',                'push', '3',   '8-12',       NULL),
    ('DB Tricep Overhead Extension',     'push', '3',   '10-15',      NULL),
    ('Diamond / Close-Grip Push-Up',     'push', '2-3', 'to RIR',     NULL);

-- Pull
INSERT INTO exercises (name, category, default_sets, default_reps, user_id) VALUES
    ('DB Bent-Over Row',                 'pull', '3-4', '8-12',       NULL),
    ('DB Single-Arm Row',                'pull', '3',   '10-14',      NULL),
    ('DB Reverse Fly',                   'pull', '3',   '12-16',      NULL),
    ('DB Bicep Curl',                    'pull', '3',   '10-14',      NULL),
    ('DB Hammer Curl',                   'pull', '2-3', '10-14',      NULL),
    ('DB Face Pull bent-over',           'pull', '2',   '15-20',      NULL);

-- Legs
INSERT INTO exercises (name, category, default_sets, default_reps, user_id) VALUES
    ('DB Goblet Squat',                  'legs', '4',   '10-15',      NULL),
    ('DB Romanian Deadlift',             'legs', '3-4', '8-12',       NULL),
    ('DB Bulgarian Split Squat',         'legs', '3',   '10-12 per leg', NULL),
    ('DB Sumo Squat',                    'legs', '3',   '12-15',      NULL),
    ('DB Leg Curl lying on bench',       'legs', '3',   '12-15',      NULL),
    ('DB Calf Raise',                    'legs', '3',   '15-20',      NULL);
