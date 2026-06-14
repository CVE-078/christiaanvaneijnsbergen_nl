-- Allow 'favorite' alongside 'hidden' for user_exercise_preferences.preference.
-- v1 stored only 'hidden'. The column may carry a CHECK constraint limiting it.
-- This drops the known check (if present) and recreates it to allow both values.
-- VERIFY the live constraint name first:
--   select conname from pg_constraint
--   where conrelid = 'public.user_exercise_preferences'::regclass and contype = 'c';
-- If the name differs from the guess below, edit the DROP line to match.
-- If the column has NO check (free text), this is a harmless no-op add of one.
--
-- Apply by hand against Supabase (no automated runner in this repo).

alter table user_exercise_preferences
    drop constraint if exists user_exercise_preferences_preference_check;

alter table user_exercise_preferences
    add constraint user_exercise_preferences_preference_check
    check (preference in ('hidden', 'favorite'));
