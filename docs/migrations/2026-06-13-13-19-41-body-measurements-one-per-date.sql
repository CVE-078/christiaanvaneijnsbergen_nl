-- Body measurements: one row per (user_id, measured_at).
--
-- Until now logBodyMeasurement was a plain INSERT, so logging more than one metric
-- for the same date (e.g. waist now, hips later) created multiple rows for that date.
-- The new write path upserts one row per date (COALESCE-merging metrics), which needs
-- a UNIQUE(user_id, measured_at). This migration first collapses any existing same-date
-- duplicates into a single row, then adds the constraint.
--
-- Apply once, manually (no automated runner in this repo). Not idempotent: step 3 fails
-- if the constraint already exists.

-- 1. Merge duplicate same-date rows into a surviving row per (user, date), taking the
--    non-null value for each metric (max() ignores NULLs; on the rare case of two
--    non-null values for the same metric+date it keeps the larger, an accepted one-time
--    tie-break). The survivor is the lowest id per group; id is a uuid, which has no
--    min()/max() aggregate, so pick it with (array_agg(id order by id))[1].
with agg as (
    select user_id,
           measured_at,
           max(waist_cm)              as waist_cm,
           max(hips_cm)               as hips_cm,
           max(chest_cm)              as chest_cm,
           max(arms_cm)               as arms_cm,
           (array_agg(id order by id))[1] as keep_id
    from body_measurements
    group by user_id, measured_at
)
update body_measurements bm
set waist_cm = agg.waist_cm,
    hips_cm  = agg.hips_cm,
    chest_cm = agg.chest_cm,
    arms_cm  = agg.arms_cm
from agg
where bm.id = agg.keep_id;

-- 2. Delete the now-redundant duplicates (everything that is not the survivor).
delete from body_measurements bm
using (
    select user_id, measured_at, (array_agg(id order by id))[1] as keep_id
    from body_measurements
    group by user_id, measured_at
) agg
where bm.user_id = agg.user_id
  and bm.measured_at = agg.measured_at
  and bm.id <> agg.keep_id;

-- 3. Enforce one row per (user, date) going forward (enables the COALESCE upsert).
alter table body_measurements
    add constraint body_measurements_user_measured_at_key unique (user_id, measured_at);

-- 4. The new write path is an UPSERT (on-conflict UPDATE). body_measurements had
--    only SELECT/INSERT/DELETE policies (2026-05-29-profile-enhancements.sql), so the
--    on-conflict UPDATE would be denied by RLS. Add the missing UPDATE policy.
drop policy if exists "body_measurements_update" on body_measurements;
create policy "body_measurements_update" on body_measurements
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
