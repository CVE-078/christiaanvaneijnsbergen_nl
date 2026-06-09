-- Behavior-driven adaptation (#7): record what a swap replaced, captured at swap
-- time. routine_exercises.exercise_id is mutable (a permanent swap overwrites it),
-- so it cannot be used to recover the original after the fact. Nullable: historical
-- rows stay null (the signal builds forward) and the loader drops null-from rows.
alter table exercise_swaps
  add column if not exists from_exercise_id uuid references exercises(id) on delete set null;
