-- Migration: add drop-set segments to set_logs
-- Date: 2026-06-03
-- Apply via Supabase SQL Editor (no automated runner).
--
-- A set whose `drops` is a non-empty JSON array [{"kg":number,"reps":number}, ...]
-- is a drop set. NULL / absent = a normal set. Existing set_logs RLS policies
-- cover the new column, so no policy change is needed.

ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS drops jsonb;
