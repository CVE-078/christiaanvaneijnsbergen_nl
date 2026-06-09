-- Equipment profiles: named, reusable equipment sets per user (Home / Gym /
-- Travel). Equipment is captured transiently per generation today; this makes it
-- persistent and switchable. Generation still reads the chosen set through
-- answers.equipment -> hasEquipment; profiles only seed the picker.
--
-- Travel mode (#322) is the planned extension: it will add an `expires_at`
-- column here plus an auto-revert to the saved default set. Build it on top of
-- this table, do not fork a second one.
create table if not exists equipment_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- cardinality() returns 0 for an empty array, so this rejects '{}'. (array_length
  -- returns NULL for empty, and a NULL CHECK passes, which would let '{}' through.)
  equipment text[] not null check (cardinality(equipment) >= 1),
  created_at timestamptz not null default now()
);

create index if not exists equipment_profiles_user_idx on equipment_profiles (user_id);

-- Case-insensitive name uniqueness per user, enforced at the DB so a concurrent
-- create cannot slip a duplicate past the app-level check (TOCTOU). The action
-- catches the unique-violation (23505) and rethrows the friendly message.
create unique index if not exists equipment_profiles_name_ci_user_idx
  on equipment_profiles (user_id, lower(name));

alter table equipment_profiles enable row level security;

create policy "equipment_profiles_select_own" on equipment_profiles
  for select using (auth.uid() = user_id);
create policy "equipment_profiles_insert_own" on equipment_profiles
  for insert with check (auth.uid() = user_id);
create policy "equipment_profiles_update_own" on equipment_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "equipment_profiles_delete_own" on equipment_profiles
  for delete using (auth.uid() = user_id);

-- Active-profile pointer on the user's profile. null = no active profile = the
-- pre-equipment-profiles behavior (the generation equipment step starts empty).
-- ON DELETE SET NULL so deleting the active profile cleanly clears the pointer.
alter table profiles
  add column if not exists active_equipment_profile_id uuid
  references equipment_profiles(id) on delete set null;
