-- Exercise prescription unit (generation engine quality, P1.3)
-- Date: 2026-06-14
-- Apply by hand against Supabase (no automated runner in this repo).
--
-- Adds a `prescription_unit` to exercises so the Plan display can render the
-- right prescription instead of forcing a rep range onto every exercise:
--   - 'reps'     (default) a normal rep range.
--   - 'time'     a timed hold; `default_reps` holds the hold range (e.g. Plank
--                "30-60s"), so an isometric never reads as a rep count.
--   - 'per_side' the reps are per limb (unilateral work), shown as "N-M reps/side".
--
-- Display-only: the generator still stores a numeric rep range in
-- routine_exercises.reps (so the rep-based logger is unchanged); formatPrescription
-- (utils.ts) turns it into the right label using this column. Forward-only:
-- existing routines render correctly because the display joins to the exercise row.

alter table exercises
    add column if not exists prescription_unit text not null default 'reps'
    check (prescription_unit in ('reps', 'time', 'per_side'));

-- Isometric holds: Plank is the only timed exercise in the catalogue today; its
-- default_reps is already a hold range ("30-60s"). Tag it 'time'.
update exercises
set prescription_unit = 'time'
where name = 'Plank'
  and user_id is null;

-- Unilateral (single-limb) work: the prescription is per side. Derive from the
-- existing `unilateral` flag so every single-limb lift (Bulgarian Split Squat,
-- Walking Lunge, Step-Up, Single-Leg Calf Raise, single-arm cable work, etc.)
-- reads "N-M reps/side". Never override the Plank hold above.
update exercises
set prescription_unit = 'per_side'
where unilateral = true
  and prescription_unit = 'reps'
  and user_id is null;

-- Verify (expect Plank -> time; unilateral lifts -> per_side; everything else reps):
-- select name, unilateral, prescription_unit from exercises
-- where user_id is null and prescription_unit <> 'reps' order by prescription_unit, name;
