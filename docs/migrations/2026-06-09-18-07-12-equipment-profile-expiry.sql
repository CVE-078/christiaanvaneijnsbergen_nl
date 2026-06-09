-- Travel mode (#322): a temporary equipment-profile overlay that auto-reverts.
-- expires_at is a calendar-day revert marker (stored noon-UTC of the return
-- day). Read-time expiry, no background job: a past expiry is inert and the
-- effective set falls back to active_equipment_profile_id (the default).
alter table equipment_profiles
  add column if not exists expires_at timestamptz;

-- One active travel overlay per user, enforced at the DB. Partial: only rows
-- carrying an expiry are constrained, so non-travel profiles are unaffected.
-- Backstops concurrent startTravel and serves as the overlay lookup index.
create unique index if not exists equipment_profiles_one_overlay_per_user
  on equipment_profiles (user_id)
  where expires_at is not null;
