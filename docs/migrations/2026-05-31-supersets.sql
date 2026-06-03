-- Add superset grouping to routine exercises.
--
-- Apply via the Supabase SQL Editor (no automated runner).
--
-- Invariant (enforced in the API, not the schema): a superset group has EXACTLY
-- two members, both in the SAME routine_id, with adjacent order. The app model
-- (groupExercises, SupersetCard) assumes pairs; a group of 3+ would render the
-- third member as an unpaired single.
--
-- RLS: no new policy is needed. routine_exercises already has a FOR ALL policy
-- scoped through workout_routines.user_id = auth.uid(), and RLS is row-level, so
-- the new column is automatically protected.
ALTER TABLE routine_exercises
  ADD COLUMN superset_group_id UUID DEFAULT NULL;

CREATE INDEX idx_re_superset_group
  ON routine_exercises (routine_id, superset_group_id)
  WHERE superset_group_id IS NOT NULL;
