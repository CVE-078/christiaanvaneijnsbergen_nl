-- ============================================================
-- Migration: schedule-variant
-- 2026-06-04
-- ============================================================
-- Multi-session variant model. Two changes:
--
-- 1. Pin each scheduled day to its session variant (A-D) so a
--    multi-session full-body style (e.g. three full-body days
--    A/B/C) can be represented, and the train screen jumps to
--    the correct variant tab when a day is selected.
-- 2. Widen the existing variant CHECK constraints from ('A','B')
--    to ('A','B','C','D'). WorkoutVariant now spans A-D, and the
--    generator writes C/D into routine_exercises.variant, so the
--    old CHECK would reject those inserts.
--
-- Apply via the Supabase SQL Editor. Idempotent: ADD COLUMN IF
-- NOT EXISTS, and DROP/ADD CONSTRAINT IF EXISTS. Re-running is
-- safe.
--
-- NULL variant = no A/B/C/D split (a focus that appears once).
-- RLS: routine_schedule already has policies scoped via
-- routine_id; a new column needs no policy change.

-- ── 1. routine_schedule.variant (NEW column) ─────────────────
ALTER TABLE routine_schedule
  ADD COLUMN IF NOT EXISTS variant text DEFAULT NULL CHECK (variant IN ('A', 'B', 'C', 'D'));

-- ── 2. Widen existing variant CHECK constraints to A-D ────────
-- Default Postgres constraint name is <table>_<column>_check.
ALTER TABLE routine_exercises DROP CONSTRAINT IF EXISTS routine_exercises_variant_check;
ALTER TABLE routine_exercises
  ADD CONSTRAINT routine_exercises_variant_check CHECK (variant IN ('A', 'B', 'C', 'D'));

ALTER TABLE template_exercises DROP CONSTRAINT IF EXISTS template_exercises_variant_check;
ALTER TABLE template_exercises
  ADD CONSTRAINT template_exercises_variant_check CHECK (variant IN ('A', 'B', 'C', 'D'));

ALTER TABLE workout_sessions DROP CONSTRAINT IF EXISTS workout_sessions_variant_check;
ALTER TABLE workout_sessions
  ADD CONSTRAINT workout_sessions_variant_check CHECK (variant IN ('A', 'B', 'C', 'D'));
