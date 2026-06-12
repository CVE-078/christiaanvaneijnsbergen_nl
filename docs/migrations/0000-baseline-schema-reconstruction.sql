-- Migration: baseline schema for the earliest (untracked) tables
-- Date: 2026-06-11
-- Apply via Supabase SQL Editor (there is no automated runner).
--
-- WHY THIS FILE EXISTS
-- Four core tables were created in the live database before migrations were
-- tracked in version control, so docs/migrations had no `CREATE TABLE` for them:
--   profiles, set_logs, exercise_notes, bodyweight_logs
-- Without this file the database is not reproducible from VCS (you cannot rebuild
-- a fresh dev/staging DB from the migration history). Launch-floor reproducibility
-- gate, not a feature.
--
-- RECONCILED AGAINST THE LIVE SCHEMA on 2026-06-11 (pg_catalog +
-- information_schema audit via the Supabase session pooler). Column names, types,
-- defaults, primary keys, unique constraints, and the auth.users foreign-key
-- delete rules below match production. (A `supabase db dump` was not used because
-- it requires Docker and the direct connection is IPv6-only; the schema was read
-- directly with SQL instead.)
--
-- The `0000-` prefix means: apply this FIRST, before every dated migration.
-- Baseline + the dated migrations in order = the current schema. Each table here
-- carries only its ORIGINAL (base) columns; columns added later live in their own
-- dated ALTER migrations and are intentionally NOT repeated here:
--   profiles:  active_routine_id, onboarding_completed, goal_weight_kg, gender,
--              length_unit, priority_muscle, timezone, accent_color, training_style,
--              variety_preference, loading_lean, movement_restrictions,
--              active_equipment_profile_id
--   set_logs:  drops (2026-06-03-set-logs-drops),
--              session_id + workout_date (2026-06-06-14-30-53-session-linked-logs)
-- RLS policies for all four tables live in 2026-06-03-enable-rls-core-tables.sql;
-- the display_name length CHECK and the set_logs (user_id, week) index live in
-- 2026-05-25-audit-schema-fixes.sql. Those are NOT duplicated here.
--
-- AUTH FK DELETE RULES: in production today, profiles.id, set_logs.user_id, and
-- bodyweight_logs.user_id reference auth.users with NO ACTION (so they are written
-- without an ON DELETE clause below); exercise_notes.user_id is already CASCADE.
-- The dated migration 2026-06-11-18-50-42-fk-cascade-auth-users.sql flips the three
-- NO ACTION ones to ON DELETE CASCADE, so baseline + that migration = the intended
-- end state.
--
-- KNOWN RECONSTRUCTION GAP: in production, set_logs.routine_exercise_id has a
-- foreign key to routine_exercises(id) ON DELETE CASCADE. routine_exercises is
-- created by the later dated migration 2026-05-26-exercise-library-schema.sql, so
-- that FK cannot be declared here (forward reference) and is intentionally omitted
-- from the baseline. A fresh replay therefore lacks only that one FK; add a trailing
-- migration after 2026-05-26 if full replay fidelity is needed. `CREATE TABLE IF NOT
-- EXISTS` makes this whole file a no-op against the existing prod DB; its real job is
-- recreating these tables on a fresh database.

-- ============================================================
-- 1. profiles (owner column: id = auth.uid())
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id           uuid PRIMARY KEY REFERENCES auth.users (id),  -- NO ACTION today; flipped to CASCADE by the dated fk-cascade migration
    display_name text,                                          -- length CHECK added by 2026-05-25-audit-schema-fixes
    unit         text NOT NULL DEFAULT 'kg',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. set_logs (owner column: user_id)
--    Surrogate id PK; one row per (user_id, week, routine_exercise_id, set_idx),
--    which is the app's upsert conflict target / delete key.
-- ============================================================
CREATE TABLE IF NOT EXISTS set_logs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users (id),  -- NO ACTION today; flipped to CASCADE by the dated fk-cascade migration
    week                smallint NOT NULL,
    set_idx             smallint NOT NULL,
    kg                  numeric NOT NULL,
    reps                smallint NOT NULL,
    rir                 smallint NOT NULL,
    saved               boolean NOT NULL DEFAULT true,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    routine_exercise_id uuid NOT NULL,  -- FK to routine_exercises(id) ON DELETE CASCADE exists in prod; omitted here (forward reference, see header)
    UNIQUE (user_id, week, routine_exercise_id, set_idx)
);

-- ============================================================
-- 3. exercise_notes (owner column: user_id)
--    Composite PK (user_id, week, routine_exercise_id); one note per slot per week.
-- ============================================================
CREATE TABLE IF NOT EXISTS exercise_notes (
    user_id             uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    week                smallint NOT NULL,
    routine_exercise_id uuid NOT NULL,  -- no FK in prod (plain uuid), unlike set_logs
    note                text NOT NULL,
    PRIMARY KEY (user_id, week, routine_exercise_id)
);

-- ============================================================
-- 4. bodyweight_logs (owner column: user_id)
--    Surrogate id PK; one weigh-in per user per calendar day.
-- ============================================================
CREATE TABLE IF NOT EXISTS bodyweight_logs (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES auth.users (id),  -- NO ACTION today; flipped to CASCADE by the dated fk-cascade migration
    logged_at  date NOT NULL DEFAULT CURRENT_DATE,
    weight_kg  numeric NOT NULL,
    UNIQUE (user_id, logged_at)
);
