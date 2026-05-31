-- Add superset grouping to routine exercises
ALTER TABLE routine_exercises
  ADD COLUMN superset_group_id UUID DEFAULT NULL;

CREATE INDEX idx_re_superset_group
  ON routine_exercises (routine_id, superset_group_id)
  WHERE superset_group_id IS NOT NULL;
