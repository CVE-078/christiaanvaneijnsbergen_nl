-- Migration: baseline schema reconstruction for the earliest (untracked) tables
-- Date: 2026-06-11
-- Apply via Supabase SQL Editor (there is no automated runner).
--
-- WHY THIS FILE EXISTS
-- Four core tables were created in the live database before migrations were
-- tracked in version control, so docs/migrations had no `CREATE TABLE` for them:
--   profiles, set_logs, exercise_notes, bodyweight_logs
-- Without this file the database is not reproducible from VCS (you cannot rebuild
-- a fresh dev/staging DB from the migration history). This is a launch-floor
-- reproducibility gate, not a feature.
--
-- The `0000-` prefix means: apply this FIRST, before every dated migration. The
-- baseline + the dated migrations in order = the current schema. Each table here
-- carries only its ORIGINAL (base) columns; every column added later lives in its
-- own dated ALTER migration and is intentionally NOT repeated here:
--   profiles:  timezone, onboarding_completed, active_routine_id, goal_weight_kg,
--              length_unit, gender, priority_muscle, accent_color, training_style,
--              variety_preference, loading_lean, movement_restrictions,
--              active_equipment_profile_id  (all added by their dated migrations)
--   set_logs:  drops (2026-06-03-set-logs-drops),
--              session_id + workout_date (2026-06-06-14-30-53-session-linked-logs)
-- RLS policies for all four tables live in 2026-06-03-enable-rls-core-tables.sql;
-- the display_name length CHECK and the set_logs (user_id, week) index live in
-- 2026-05-25-audit-schema-fixes.sql. Those are NOT duplicated here.
--
-- ACCURACY / HOW TO LOCK THIS TO TRUTH
-- Column NAMES below are ground-truth (read from src/lib/pulse/queries.ts and the
-- action upserts). Column TYPES, defaults, precision, and the exact primary-key /
-- foreign-key shape are a best-effort reconstruction and are flagged `-- VERIFY`.
-- The authoritative baseline is the live schema. Before treating this as final,
-- run a schema-only dump and reconcile this file against it:
--
--   supabase db dump --schema-only > /tmp/live-schema.sql
--   # or, with a direct connection string:
--   pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > /tmp/live-schema.sql
--
-- then diff the four CREATE TABLE blocks below against the dump and correct any
-- type/default/constraint that differs. `CREATE TABLE IF NOT EXISTS` makes this
-- file safe to apply against the existing prod DB (it is a no-op there); its real
-- job is recreating these tables on a fresh database.

-- ============================================================
-- 1. profiles (owner column: id = auth.uid())
--    Base columns only. The profile row id equals the auth user id.
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id           uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    display_name text,                                   -- length CHECK added by 2026-05-25-audit-schema-fixes
    unit         text NOT NULL DEFAULT 'kg',             -- VERIFY: likely CHECK (unit IN ('kg','lbs'))
    updated_at   timestamptz NOT NULL DEFAULT now()      -- VERIFY: written by profile actions; no tracked migration created it
);

-- ============================================================
-- 2. set_logs (owner column: user_id)
--    Natural key = (user_id, week, routine_exercise_id, set_idx); the app upserts
--    on exactly that conflict target and deletes by that tuple.
-- ============================================================
CREATE TABLE IF NOT EXISTS set_logs (
    user_id             uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    week                integer NOT NULL,                            -- VERIFY: range 1..52 enforced elsewhere?
    routine_exercise_id uuid NOT NULL REFERENCES routine_exercises (id) ON DELETE CASCADE, -- VERIFY: FK + on-delete
    set_idx             integer NOT NULL,
    kg                  numeric NOT NULL,                            -- VERIFY: precision (e.g. numeric(6,2))
    reps                integer NOT NULL,
    rir                 integer NOT NULL,                            -- VERIFY: nullable?
    saved               boolean NOT NULL DEFAULT false,
    updated_at          timestamptz NOT NULL DEFAULT now(),          -- proven to exist (upsert writes it); VERIFY default
    PRIMARY KEY (user_id, week, routine_exercise_id, set_idx)        -- VERIFY: composite PK vs a surrogate id + UNIQUE on this tuple
);

-- ============================================================
-- 3. exercise_notes (owner column: user_id)
--    Natural key = (user_id, week, routine_exercise_id); one note per slot per week.
-- ============================================================
CREATE TABLE IF NOT EXISTS exercise_notes (
    user_id             uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    week                integer NOT NULL,
    routine_exercise_id uuid NOT NULL REFERENCES routine_exercises (id) ON DELETE CASCADE, -- VERIFY: FK + on-delete
    note                text NOT NULL,                               -- VERIFY: length CHECK? app caps at 500
    PRIMARY KEY (user_id, week, routine_exercise_id)                 -- VERIFY: composite PK vs surrogate id + UNIQUE
);

-- ============================================================
-- 4. bodyweight_logs (owner column: user_id)
--    Surrogate id PK (deleted by id); one weigh-in per user per calendar day.
-- ============================================================
CREATE TABLE IF NOT EXISTS bodyweight_logs (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    logged_at  date NOT NULL DEFAULT CURRENT_DATE,                   -- VERIFY: date vs timestamptz; user can override the day
    weight_kg  numeric NOT NULL,                                     -- VERIFY: precision (e.g. numeric(6,2))
    UNIQUE (user_id, logged_at)                                      -- upsert onConflict 'user_id,logged_at'
);
