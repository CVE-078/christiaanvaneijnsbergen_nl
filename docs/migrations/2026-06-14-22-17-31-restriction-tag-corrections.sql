-- Restriction tag corrections (generation engine quality, P1.2)
-- Date: 2026-06-14
-- Apply by hand against Supabase (no automated runner in this repo).
--
-- Policy (decided 2026-06-14): CONSERVATIVE tagging + warn. The catalogue
-- deliberately keeps one genuinely-safe option per movement pattern so a
-- restricted user still gets a usable routine; when a restriction still empties
-- an essential pattern the generator now surfaces a 'missing_pattern' warning
-- (see generation.ts). This migration only fixes clear data DEFECTS, it does NOT
-- start tagging every plausibly-loading lift (that would empty whole patterns
-- under combined restrictions). Two fixes:
--
-- 1) Step-Up was the only loaded single-leg knee-flexion movement left UNtagged
--    for `knee`, while its movement siblings Dumbbell Bulgarian Split Squat and
--    Walking Lunge are both knee-tagged. That inconsistency let a knee-restricted
--    routine seat a Step-Up (observed in case 06). Tag it for `knee`. Leg Press,
--    Dumbbell Goblet Squat and Dumbbell Sumo Squat stay UNtagged on purpose: they
--    are the intended safe squat-pattern options for a knee-restricted user.
--
-- 2) Smith Machine Bench Press still carries equipment {barbell, bench} in prod
--    (a never-applied correction). It is a machine lift, not a barbell lift, so it
--    leaks into barbell-only pools and is invisible to machine-only gym users.
--    Re-tag it {machines, bench}.

-- 1) Step-Up -> knee contraindication (currently has none).
update exercises
set contraindications = array['knee']
where name = 'Step-Up'
  and user_id is null
  and not (contraindications @> array['knee']);

-- 2) Smith Machine Bench Press -> {machines, bench}.
update exercises
set equipment = array['machines', 'bench']
where name = 'Smith Machine Bench Press'
  and user_id is null;

-- Verify (expect: Step-Up contraindications = {knee}; Smith Machine Bench Press
-- equipment = {machines,bench}):
-- select name, equipment, contraindications from exercises
-- where name in ('Step-Up', 'Smith Machine Bench Press') and user_id is null;
