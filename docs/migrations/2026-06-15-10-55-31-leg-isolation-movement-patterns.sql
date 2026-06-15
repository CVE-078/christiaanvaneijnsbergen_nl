-- Quad/hamstring isolation movement patterns (generation engine quality)
-- Date: 2026-06-15
-- Apply by hand against Supabase (no automated runner in this repo).
--
-- The generator gained real quad_iso / hamstring_iso movement patterns (types.ts
-- MOVEMENT_PATTERNS + muscleMap PATTERN_MUSCLE_MAP). Leg Extension was tagged
-- 'squat' and Leg Curl / Dumbbell Leg Curl (Lying) were tagged 'hinge' as
-- NON-COMPOUND proxies (no quad/ham isolation pattern existed). Re-tag them to the
-- real patterns so their volume attributes to legs correctly and the lower-day
-- emphases can request a dedicated knee-extension / knee-flexion slot.
--
-- movement_pattern is plain text (no CHECK), so this is a pure data UPDATE,
-- idempotent, scoped to global rows. is_compound stays false; substitution_class
-- (leg_extension / leg_curl) is left intact (still valid same-stimulus families).

update exercises set movement_pattern = 'quad_iso'
where user_id is null and name = 'Leg Extension' and is_compound = false;

update exercises set movement_pattern = 'hamstring_iso'
where user_id is null and name in ('Leg Curl', 'Dumbbell Leg Curl (Lying)') and is_compound = false;

-- Verify (expect exactly these three re-tagged; zero non-compound squat/hinge rows left):
-- select name, movement_pattern, is_compound from exercises
--   where user_id is null and name in ('Leg Extension','Leg Curl','Dumbbell Leg Curl (Lying)') order by name;
-- select count(*) from exercises
--   where user_id is null and movement_pattern in ('squat','hinge') and is_compound = false;  -- expect 0
