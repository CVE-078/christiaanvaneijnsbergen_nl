-- ============================================================
-- Migration: exercise-equipment-correction
-- 2026-06-04
-- ============================================================
-- Explicitly set the equipment array for EVERY global exercise
-- (user_id IS NULL). Replaces the leaky prefix-only tagging in
-- 2026-06-03-exercise-generation-metadata-seed.sql, which let
-- un-prefixed barbell / machine / bar compounds (Deadlift,
-- Leg Press, Pull-Up, etc.) fall through to an empty array and
-- leak into dumbbell-only routines.
--
-- Apply via the Supabase SQL Editor AFTER the 2026-06-03 seeds.
-- Idempotent: pure UPDATEs scoped to user_id IS NULL, plus
-- WHERE NOT EXISTS inserts for the pool additions. Re-running is
-- safe and produces the same final state.
--
-- Equipment vocab: dumbbells, barbell, bench, cables, machines,
-- pull_up_bar (NEW key). Bodyweight = empty array (intentional;
-- always-available). Each exercise gets its MINIMAL real
-- requirement, preferring the dumbbell/bench-doable variant
-- where one exists.

-- ── 1. dumbbells only ────────────────────────────────────────
-- Curls / raises / extensions / kickbacks and other moves that
-- need only a pair of dumbbells (no bench required).
UPDATE exercises SET equipment = ARRAY['dumbbells']
WHERE user_id IS NULL AND name IN (
  'Dumbbell Lateral Raise',
  'Dumbbell Overhead Press',
  'Dumbbell Tricep Overhead Extension',
  'Dumbbell Bent-Over Row',
  'Dumbbell Single-Arm Row',
  'Dumbbell Reverse Fly',
  'Dumbbell Bicep Curl',
  'Dumbbell Hammer Curl',
  'Dumbbell Face Pull (Bent-Over)',
  'Dumbbell Goblet Squat',
  'Dumbbell Romanian Deadlift',
  'Dumbbell Sumo Squat',
  'Dumbbell Calf Raise',
  'Dumbbell Curl',
  'Dumbbell Squat',
  'Dumbbell Row',
  'Dumbbell Lunge',
  'Dumbbell Shoulder Press',
  'Dumbbell Chest Press',
  'Lateral Raise',
  'Rear Delt Fly',
  'Arnold Press',
  'Front Raise',
  'Upright Row',
  'Chest Fly',
  'Concentration Curl',
  'Hammer Curl',
  'Tricep Kickback',
  'Single-Leg Romanian Deadlift',
  'Reverse Lunge'
);

-- ── 2. dumbbells + bench ─────────────────────────────────────
-- Pressing / supported movements that need a bench (the
-- dumbbell+bench-doable variant of barbell/machine moves).
UPDATE exercises SET equipment = ARRAY['dumbbells','bench']
WHERE user_id IS NULL AND name IN (
  'Dumbbell Bench Press',
  'Incline Dumbbell Press',
  'Incline Dumbbell Curl',
  'Dumbbell Bulgarian Split Squat',
  'Dumbbell Leg Curl (Lying)',
  'Chest-Supported Row',
  'Skull Crusher',
  'Spider Curl',
  'Preacher Curl',
  'Hip Thrust'
);

-- ── 3. bench only ────────────────────────────────────────────
-- Bodyweight loadable on a box/bench; no dumbbells strictly
-- required, but uses the bench.
UPDATE exercises SET equipment = ARRAY['bench']
WHERE user_id IS NULL AND name IN (
  'Step-Up'
);

-- ── 4. barbell ───────────────────────────────────────────────
-- Barbell-prefixed lifts (re-assert) plus un-prefixed barbell
-- compounds. Bench-press family needs a bench too.
UPDATE exercises SET equipment = ARRAY['barbell','bench']
WHERE user_id IS NULL AND name IN (
  'Barbell Bench Press',
  'Incline Barbell Press',
  'Decline Bench Press',
  'Close-Grip Bench Press',
  'JM Press',
  'Smith Machine Bench Press',
  'Smith Machine Calf Raise'
);

UPDATE exercises SET equipment = ARRAY['barbell']
WHERE user_id IS NULL AND name IN (
  'Barbell Overhead Press',
  'Barbell Row',
  'Barbell Squat',
  'Barbell Curl',
  'Barbell Bicep Curl',
  'Deadlift',
  'Sumo Deadlift',
  'Romanian Deadlift',
  'Rack Pull',
  'EZ-Bar Curl'
);

-- ── 5. machines ──────────────────────────────────────────────
-- Selectorized / plate-loaded machines and Machine/Lever/Smith
-- prefixed moves (re-assert).
UPDATE exercises SET equipment = ARRAY['machines']
WHERE user_id IS NULL AND name IN (
  'Machine Chest Press',
  'Machine Shoulder Press',
  'Pec Deck',
  'Lat Pulldown',
  'T-Bar Row',
  'Leg Press',
  'Leg Extension',
  'Leg Extension Machine',
  'Leg Curl',
  'Leg Curl Machine',
  'Hack Squat',
  'Abduction Machine',
  'Seated Calf Raise',
  'Leg Press Calf Raise',
  'Calf Raise Machine',
  'Squat'
);

-- ── 6. cables ────────────────────────────────────────────────
-- Cable-prefixed plus other cable-station movements.
UPDATE exercises SET equipment = ARRAY['cables']
WHERE user_id IS NULL AND name IN (
  'Cable Fly',
  'Cable Curl',
  'Cable Lateral Raise',
  'Cable Tricep Pushdown',
  'Cable Overhead Tricep Extension',
  'Cable Kickback',
  'Cable Crunch',
  'Tricep Pushdown',
  'Single-Arm Tricep Pushdown',
  'Face Pull',
  'Straight-Arm Pulldown',
  'Seated Cable Row'
);

-- ── 7. pull_up_bar ───────────────────────────────────────────
UPDATE exercises SET equipment = ARRAY['pull_up_bar']
WHERE user_id IS NULL AND name IN (
  'Pull-Up',
  'Chin-Up',
  'Hanging Leg Raise'
);

-- ── 8. bodyweight (empty array, intentional) ─────────────────
-- Always-available moves: no equipment gate.
UPDATE exercises SET equipment = ARRAY[]::text[]
WHERE user_id IS NULL AND name IN (
  'Push-Up',
  'Diamond / Close-Grip Push-Up',
  'Dips',
  'Glute Bridge',
  'Walking Lunge',
  'Standing Calf Raise',
  'Single-Leg Calf Raise',
  'Donkey Calf Raise',
  'Plank',
  'Crunch',
  'Reverse Crunch',
  'Sit-Up',
  'Russian Twist',
  'Mountain Climber',
  'Ab Wheel Rollout'
);

-- ── 9. A3: seed missing dumbbell/bodyweight options ──────────
-- Bring every reachable generator slot to >= 2 usable
-- dumbbell-or-bodyweight options. Flagged slots before this:
-- horizontal_push (1: Dumbbell Bench Press), vertical_push (1:
-- Dumbbell Overhead Press), back_iso (0), glute_iso (1: Glute
-- Bridge). vertical_pull is intentionally left empty for
-- dumbbell-only users.
INSERT INTO exercises (name, category, default_sets, default_reps, user_id)
SELECT t.name, t.category, t.default_sets, t.default_reps, NULL
FROM (VALUES
  ('Decline Dumbbell Press',  'chest',    '3', '8-12'),   -- horizontal_push
  ('Dumbbell Push Press',     'shoulders','3', '6-10'),   -- vertical_push
  ('Dumbbell Pullover',       'back',     '3', '10-15'),  -- back_iso
  ('Dumbbell Shrug',          'back',     '3', '12-15'),  -- back_iso
  ('Single-Leg Glute Bridge', 'glutes',   '3', '12-15')   -- glute_iso
) AS t(name, category, default_sets, default_reps)
WHERE NOT EXISTS (
  SELECT 1 FROM exercises WHERE name = t.name AND user_id IS NULL
);

-- horizontal_push: Decline Dumbbell Press (dumbbells + bench, compound).
-- Explicit pattern: name lacks the "Bench Press" keyword so it would default to chest_iso.
UPDATE exercises
   SET equipment = ARRAY['dumbbells','bench'], movement_pattern = 'horizontal_push', is_compound = true
 WHERE user_id IS NULL AND name = 'Decline Dumbbell Press';

-- vertical_push: Dumbbell Push Press (dumbbells, compound). "push press" keyword would
-- already route this to vertical_push, but set it explicitly to be order-independent.
UPDATE exercises
   SET equipment = ARRAY['dumbbells'], movement_pattern = 'vertical_push', is_compound = true
 WHERE user_id IS NULL AND name = 'Dumbbell Push Press';

-- back_iso: Dumbbell Pullover (dumbbells + bench) and Dumbbell Shrug (dumbbells), both isolation.
UPDATE exercises
   SET equipment = ARRAY['dumbbells','bench'], movement_pattern = 'back_iso', is_compound = false
 WHERE user_id IS NULL AND name = 'Dumbbell Pullover';

UPDATE exercises
   SET equipment = ARRAY['dumbbells'], movement_pattern = 'back_iso', is_compound = false
 WHERE user_id IS NULL AND name = 'Dumbbell Shrug';

-- glute_iso: Single-Leg Glute Bridge (bodyweight, isolation). Empty equipment is intentional.
UPDATE exercises
   SET equipment = ARRAY[]::text[], movement_pattern = 'glute_iso', is_compound = false
 WHERE user_id IS NULL AND name = 'Single-Leg Glute Bridge';

-- ── 9b. Movement-pattern corrections ─────────────────────────
-- The 2026-06-03 seed derives movement_pattern from category, which
-- mis-tags a few exercises. Fix the ones that pollute generator slots.
-- A lying leg curl is a hamstring isolation, not a squat compound.
UPDATE exercises
   SET movement_pattern = 'hinge', is_compound = false
 WHERE user_id IS NULL AND name = 'Dumbbell Leg Curl (Lying)';
-- Upright Row is a delt movement, not a horizontal pull (the %Row% keyword mis-catches it).
UPDATE exercises
   SET movement_pattern = 'shoulder_iso', is_compound = false
 WHERE user_id IS NULL AND name = 'Upright Row';

-- ── 10. Verification ─────────────────────────────────────────
-- Should return ZERO rows: any known barbell / machine / bar
-- exercise that still has an empty (or NULL) equipment array
-- means a leak remains.
SELECT name, category, equipment
FROM exercises
WHERE user_id IS NULL
  AND (equipment IS NULL OR cardinality(equipment) = 0)
  AND name IN (
    -- barbell
    'Barbell Bench Press','Incline Barbell Press','Decline Bench Press',
    'Close-Grip Bench Press','JM Press','Smith Machine Bench Press',
    'Smith Machine Calf Raise','Barbell Overhead Press','Barbell Row',
    'Barbell Squat','Barbell Curl','Barbell Bicep Curl','Deadlift',
    'Sumo Deadlift','Romanian Deadlift','Rack Pull','EZ-Bar Curl',
    -- machines
    'Machine Chest Press','Machine Shoulder Press','Pec Deck','Lat Pulldown',
    'T-Bar Row','Leg Press','Leg Extension','Leg Extension Machine',
    'Leg Curl','Leg Curl Machine','Hack Squat','Abduction Machine',
    'Seated Calf Raise','Leg Press Calf Raise','Calf Raise Machine','Squat',
    -- pull_up_bar
    'Pull-Up','Chin-Up','Hanging Leg Raise'
  )
ORDER BY name;

-- Audit (should return zero rows): every reachable dumbbell/bodyweight slot now
-- has >= 2 usable options. vertical_pull is expected to remain 0 and is excluded.
-- SELECT movement_pattern, count(*)
--   FROM exercises
--  WHERE user_id IS NULL
--    AND (equipment = ARRAY[]::text[] OR equipment <@ ARRAY['dumbbells','bench'])
--    AND movement_pattern IN ('horizontal_push','vertical_push','horizontal_pull','squat',
--        'hinge','lunge','calf','core','chest_iso','back_iso','shoulder_iso',
--        'biceps_iso','triceps_iso','glute_iso')
--  GROUP BY movement_pattern HAVING count(*) < 2;
