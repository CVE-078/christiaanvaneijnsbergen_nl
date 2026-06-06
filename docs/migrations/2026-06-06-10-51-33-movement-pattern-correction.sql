-- Correct mis-tagged movement_pattern / is_compound on global (seeded) exercises.
--
-- The 2026-06-03 generation-metadata seed assigned movement_pattern with blunt
-- ILIKE keyword rules, last-write-wins, which mis-tagged ~12 exercises. Because
-- generation selection and the MovementPattern -> muscle bridge both key off
-- movement_pattern, these are corrected before Phase 0 #2 so bad input can't
-- corrupt generation, volume attribution, or the metadata seed.
--
-- Pattern choices validated against training-science review (2026-06-06). The
-- nine "clean" corrections are unambiguous; the three isolation/partial cases are
-- the least-wrong fit within Pulse's fixed 15 patterns (the quad/ham + leg-iso
-- gap is parked in the roadmap, not expanded here).
--
-- Review note: all rows scope to user_id IS NULL (globals only) and set the
-- TARGET value directly, so this is safe to re-run. If you previously ran only
-- the "clean" block from the prep doc, re-running this file is the way to apply
-- the three judgment cases too. Verify with the SELECT at the bottom.

-- ── Clean corrections ────────────────────────────────────────────────────────

-- Chest/incline presses + push-up seeded as vertical_pull or chest_iso/non-compound
update exercises set movement_pattern = 'horizontal_push', is_compound = true
where user_id is null
  and name in ('Machine Chest Press', 'Smith Machine Bench Press', 'Incline Barbell Press', 'Incline Dumbbell Press', 'Push-Up');

-- Machine shoulder press caught by the %Pull% rule
update exercises set movement_pattern = 'vertical_push'
where user_id is null and name = 'Machine Shoulder Press';

-- Smith machine calf raise tagged vertical_pull + compound
update exercises set movement_pattern = 'calf', is_compound = false
where user_id is null and name = 'Smith Machine Calf Raise';

-- Hip abduction machine tagged vertical_pull + compound
update exercises set movement_pattern = 'glute_iso', is_compound = false
where user_id is null and name = 'Abduction Machine';

-- Rear-delt fly tagged chest_iso by the %Fly% rule
update exercises set movement_pattern = 'shoulder_iso'
where user_id is null and name = 'Dumbbell Reverse Fly';

-- ── Leg isolations the seed tagged as squat compounds ───────────────────────
-- No quad/ham isolation pattern exists in the 15; these are the least-wrong fit.

-- Leg curl is knee-flexion (posterior). hinge credits the posterior chain
-- (legs/glutes/back) far better than squat's quad-dominant split.
update exercises set movement_pattern = 'hinge', is_compound = false
where user_id is null and name = 'Leg Curl';

-- Leg extension is knee-extension (quads). squat is already quad-dominant, so the
-- pattern stays; only the bogus is_compound is fixed.
update exercises set is_compound = false
where user_id is null and name = 'Leg Extension';

-- Rack pull is a heavy partial deadlift. hinge is the closest of the 15 (chosen
-- 2026-06-06). If you'd rather under-credit legs than over-credit them, change
-- this to movement_pattern = 'back_iso', is_compound = false.
update exercises set movement_pattern = 'hinge', is_compound = true
where user_id is null and name = 'Rack Pull';

-- ── Verify (expect one row each; eyeball the corrected values) ───────────────
-- select name, category, movement_pattern, is_compound from exercises
-- where user_id is null and name in (
--   'Machine Chest Press','Smith Machine Bench Press','Incline Barbell Press',
--   'Incline Dumbbell Press','Push-Up','Machine Shoulder Press','Smith Machine Calf Raise',
--   'Abduction Machine','Dumbbell Reverse Fly','Leg Curl','Leg Extension','Rack Pull')
-- order by name;
