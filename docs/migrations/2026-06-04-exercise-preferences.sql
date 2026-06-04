-- Exercise preferences (hide / never-show). v1 stores 'hidden' only; the
-- 'preference' enum leaves room for 'favorite' later without a schema change.
-- Apply via the Supabase SQL Editor. Idempotent.

create table if not exists user_exercise_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  preference text not null check (preference in ('hidden')),
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

alter table user_exercise_preferences enable row level security;

drop policy if exists "own exercise preferences" on user_exercise_preferences;
create policy "own exercise preferences" on user_exercise_preferences
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_uep_user on user_exercise_preferences (user_id);
