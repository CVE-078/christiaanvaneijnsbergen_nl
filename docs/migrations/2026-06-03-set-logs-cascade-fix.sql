-- Fix: deleting a routine (or removing an exercise) fails once sets are logged.
-- Apply via the Supabase SQL Editor.
--
-- set_logs.routine_exercise_id referenced routine_exercises(id) with no ON DELETE
-- clause (defaults to NO ACTION / restrict). Deleting a workout_routine cascades
-- to its routine_exercises, but logged set_logs rows then block that cascade,
-- so the whole delete errors with "Failed to delete routine". Switching the FK
-- to ON DELETE CASCADE deletes a routine_exercise's logged sets along with it.
--
-- If the constraint name below differs in your DB, find it with:
--   select conname from pg_constraint
--   where conrelid = 'set_logs'::regclass and contype = 'f';

ALTER TABLE set_logs DROP CONSTRAINT IF EXISTS set_logs_routine_exercise_id_fkey;

ALTER TABLE set_logs
    ADD CONSTRAINT set_logs_routine_exercise_id_fkey
    FOREIGN KEY (routine_exercise_id) REFERENCES routine_exercises(id) ON DELETE CASCADE;
