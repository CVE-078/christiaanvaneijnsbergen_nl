-- Migration: Enable Row-Level Security on core base tables
-- Date: 2026-06-03
-- Apply via Supabase SQL Editor (there is no automated runner).
--
-- The base tables set_logs, profiles, bodyweight_logs and exercise_notes had no
-- RLS in tracked migrations. Without RLS, any authenticated client could read
-- and write every user's rows. This migration enables RLS on each table and adds
-- per-operation select/insert/update/delete policies so a row is only visible and
-- writable to its owner.
--
-- Ownership columns:
--   set_logs        -> user_id = auth.uid()
--   bodyweight_logs -> user_id = auth.uid()
--   exercise_notes  -> user_id = auth.uid()
--   profiles        -> id      = auth.uid()  (the profile row id equals the user id)
--
-- This script is safe to re-run: ENABLE ROW LEVEL SECURITY is idempotent and each
-- policy is dropped with DROP POLICY IF EXISTS before being recreated.
--
-- After applying, verify RLS is on in the live database with:
--   select relname, relrowsecurity
--   from pg_class
--   where relname in ('set_logs', 'profiles', 'bodyweight_logs', 'exercise_notes');
-- relrowsecurity must be true (t) for all four rows.

-- ============================================================
-- 1. set_logs (owner column: user_id)
-- ============================================================

ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "set_logs_select" ON set_logs;
CREATE POLICY "set_logs_select"
    ON set_logs FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "set_logs_insert" ON set_logs;
CREATE POLICY "set_logs_insert"
    ON set_logs FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "set_logs_update" ON set_logs;
CREATE POLICY "set_logs_update"
    ON set_logs FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "set_logs_delete" ON set_logs;
CREATE POLICY "set_logs_delete"
    ON set_logs FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================
-- 2. bodyweight_logs (owner column: user_id)
-- ============================================================

ALTER TABLE bodyweight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bodyweight_logs_select" ON bodyweight_logs;
CREATE POLICY "bodyweight_logs_select"
    ON bodyweight_logs FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bodyweight_logs_insert" ON bodyweight_logs;
CREATE POLICY "bodyweight_logs_insert"
    ON bodyweight_logs FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bodyweight_logs_update" ON bodyweight_logs;
CREATE POLICY "bodyweight_logs_update"
    ON bodyweight_logs FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bodyweight_logs_delete" ON bodyweight_logs;
CREATE POLICY "bodyweight_logs_delete"
    ON bodyweight_logs FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================
-- 3. exercise_notes (owner column: user_id)
-- ============================================================

ALTER TABLE exercise_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exercise_notes_select" ON exercise_notes;
CREATE POLICY "exercise_notes_select"
    ON exercise_notes FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "exercise_notes_insert" ON exercise_notes;
CREATE POLICY "exercise_notes_insert"
    ON exercise_notes FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "exercise_notes_update" ON exercise_notes;
CREATE POLICY "exercise_notes_update"
    ON exercise_notes FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "exercise_notes_delete" ON exercise_notes;
CREATE POLICY "exercise_notes_delete"
    ON exercise_notes FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================
-- 4. profiles (owner column: id, which equals auth.uid())
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select"
    ON profiles FOR SELECT
    USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update"
    ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete"
    ON profiles FOR DELETE
    USING (id = auth.uid());
