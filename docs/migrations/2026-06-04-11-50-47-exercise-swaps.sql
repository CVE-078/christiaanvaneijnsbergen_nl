-- Mid-workout exercise swap: per (routine_exercise, week) substitute exercise.
-- Week-scoped so history stays correct; the app is slot-centric and only the
-- displayed exercise changes for that week.
create table if not exists exercise_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_exercise_id uuid not null references routine_exercises(id) on delete cascade,
  week int not null check (week between 1 and 12),
  exercise_id uuid not null references exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, routine_exercise_id, week)
);

create index if not exists exercise_swaps_user_idx on exercise_swaps (user_id);

alter table exercise_swaps enable row level security;

create policy "exercise_swaps_select_own" on exercise_swaps
  for select using (auth.uid() = user_id);
create policy "exercise_swaps_insert_own" on exercise_swaps
  for insert with check (auth.uid() = user_id);
create policy "exercise_swaps_update_own" on exercise_swaps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercise_swaps_delete_own" on exercise_swaps
  for delete using (auth.uid() = user_id);
