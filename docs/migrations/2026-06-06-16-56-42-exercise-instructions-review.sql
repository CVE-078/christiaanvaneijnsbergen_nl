-- Exercise instructions: content review (5 missing populated + 9 corrections).
-- Content authored by the Claude.ai science review, reconciled against code-truth
-- here: every name matches a global exercise, no em dashes (ranges use hyphens),
-- and the format mirrors 2026-05-31-exercise-instructions-seed.sql. Section 1
-- inserts only (never overwrites); Section 2 overwrites the corrected rows. There
-- is no automated runner; apply via the Supabase SQL Editor. Order vs the em-dash
-- content cleanup migration does not matter (this overwrites the same cues anyway).
--
-- TWO PRODUCT CALLS, decided by the review, worth eyeballing in the UI first:
--   1. NEW MUSCLE LABEL "Lower Back". The instruction muscle columns are free-text
--      display labels (no DB constraint, rendered as plain chips), so this is safe
--      to add. Swap for "Erectors" if preferred.
--   2. DEADLIFT / RACK PULL now show posterior-chain primaries (Glutes, Hamstrings,
--      Lower Back) while their category badge stays "back" (engine-driven, unchanged).
--      Anatomically honest, with an explanatory lat-bracing cue, but it will read as
--      a badge/label mismatch to a user who skips the cue. See it rendered before
--      treating as final; the fallback is keeping the old back-aligned labels.

-- ============================================================
-- SECTION 1: New (missing) entries, insert only, never overwrite
-- ============================================================

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Chest'], ARRAY['Triceps','Core'],
ARRAY['Lie across or along a bench, hold one dumbbell over your chest with both hands',
      'Lower the weight back behind your head with a slight elbow bend, feel the stretch across your lats and chest',
      'Pull the dumbbell back over your chest using your lats, keep your hips from rising']
FROM exercises WHERE name = 'Dumbbell Pullover' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Traps'], ARRAY['Forearms'],
ARRAY['Hold a dumbbell in each hand at your sides, arms straight',
      'Shrug your shoulders straight up toward your ears, do not roll them',
      'Pause at the top, lower under control through a full range']
FROM exercises WHERE name = 'Dumbbell Shrug' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lower Chest','Triceps'], ARRAY['Front Delts'],
ARRAY['Set a decline bench, secure your legs, retract your shoulder blades',
      'Lower the dumbbells to your lower chest with elbows at 45-75 degrees',
      'Press up and slightly inward, squeeze the lower chest at the top']
FROM exercises WHERE name = 'Decline Dumbbell Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes'], ARRAY['Hamstrings','Core'],
ARRAY['Lie on your back, one foot flat on the floor, the other leg extended',
      'Drive your hips up through the planted heel by squeezing that glute',
      'Keep your hips level, do not let the raised-leg side drop, lower with control']
FROM exercises WHERE name = 'Single-Leg Glute Bridge' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Front Delts','Side Delts','Triceps'], ARRAY['Quads','Core'],
ARRAY['Hold dumbbells at shoulder height, brace your core',
      'Dip slightly at the knees, then drive up with your legs to start the press',
      'Use the leg drive to power the dumbbells overhead, lock out at the top, lower under control']
FROM exercises WHERE name = 'Dumbbell Push Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ============================================================
-- SECTION 2: Corrections to existing entries, overwrite
-- ============================================================

-- Deadlift: hinge prime movers are the posterior chain, not the lats.
-- Lats demoted to secondary with an explanatory bracing cue.
INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes','Hamstrings','Lower Back'], ARRAY['Lats','Traps','Core'],
ARRAY['Brace your core and push your hips back, keep a flat back throughout',
      'Drive through the floor and extend your hips, the bar moves because your hips do',
      'Your lats do not lift the bar, keep them tight to hold the bar close to your body',
      'Lock out by squeezing your glutes, do not lean back or overextend at the top']
FROM exercises WHERE name = 'Deadlift' AND user_id IS NULL
ON CONFLICT (exercise_id) DO UPDATE
  SET primary_muscles = EXCLUDED.primary_muscles,
      secondary_muscles = EXCLUDED.secondary_muscles,
      cues = EXCLUDED.cues;

-- Rack Pull: a high (partial) hinge. Posterior chain leads, but upper-back/trap
-- emphasis is genuinely higher here than a full deadlift, so traps stay prominent.
INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes','Lower Back','Traps'], ARRAY['Hamstrings','Lats','Core'],
ARRAY['Set the bar at knee height in a rack, brace hard before each rep',
      'Push your hips back to reach the bar, flat back, then drive your hips through to stand',
      'The short range lets you overload the top, squeeze your traps and glutes at lockout']
FROM exercises WHERE name = 'Rack Pull' AND user_id IS NULL
ON CONFLICT (exercise_id) DO UPDATE
  SET primary_muscles = EXCLUDED.primary_muscles,
      secondary_muscles = EXCLUDED.secondary_muscles,
      cues = EXCLUDED.cues;

-- Plank: anti-extension core hold; glutes assist but do not co-lead.
INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Core'], ARRAY['Glutes','Shoulders','Traps'],
ARRAY['Straight line from head to heels, no sagging or piking',
      'Squeeze your glutes and brace your core hard, as if bracing for a punch',
      'Breathe steadily, do not hold your breath during long holds']
FROM exercises WHERE name = 'Plank' AND user_id IS NULL
ON CONFLICT (exercise_id) DO UPDATE
  SET primary_muscles = EXCLUDED.primary_muscles,
      secondary_muscles = EXCLUDED.secondary_muscles,
      cues = EXCLUDED.cues;

-- Romanian Deadlift: add Lower Back to secondary (erectors are a real contributor).
INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Hamstrings','Glutes'], ARRAY['Lower Back','Lats','Core'],
ARRAY['Hinge at the hips, push your hips back, not down',
      'Maintain a flat back, the bar stays close to your legs throughout',
      'You should feel a deep hamstring stretch at the bottom',
      'Drive your hips forward to return to standing']
FROM exercises WHERE name = 'Romanian Deadlift' AND user_id IS NULL
ON CONFLICT (exercise_id) DO UPDATE
  SET primary_muscles = EXCLUDED.primary_muscles,
      secondary_muscles = EXCLUDED.secondary_muscles,
      cues = EXCLUDED.cues;

-- Dumbbell Romanian Deadlift: same erector addition for consistency.
INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Hamstrings','Glutes'], ARRAY['Lower Back','Core'],
ARRAY['Same hinge pattern as the barbell Romanian Deadlift',
      'Flat back throughout, push your hips back, dumbbells stay close to your legs',
      'Feel the hamstring stretch at the bottom, drive your hips forward to stand']
FROM exercises WHERE name = 'Dumbbell Romanian Deadlift' AND user_id IS NULL
ON CONFLICT (exercise_id) DO UPDATE
  SET primary_muscles = EXCLUDED.primary_muscles,
      secondary_muscles = EXCLUDED.secondary_muscles,
      cues = EXCLUDED.cues;

-- Cable Overhead Tricep Extension: chest does not assist elbow extension. Remove Chest.
INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Front Delts'],
ARRAY['Set the cable above head height with a rope or bar attachment',
      'Step away from the stack, arms extended, then hinge forward slightly',
      'Extend your arms forward, keep your upper arms still beside your head']
FROM exercises WHERE name = 'Cable Overhead Tricep Extension' AND user_id IS NULL
ON CONFLICT (exercise_id) DO UPDATE
  SET primary_muscles = EXCLUDED.primary_muscles,
      secondary_muscles = EXCLUDED.secondary_muscles,
      cues = EXCLUDED.cues;

-- Tricep Pushdown: remove Chest (does not extend the elbow).
INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Front Delts'],
ARRAY['Set the cable at chin height, rope or bar attachment',
      'Keep your elbows pinned to your sides, only your forearms move',
      'Push down to full lockout, squeeze hard, then let the weight rise slowly']
FROM exercises WHERE name = 'Tricep Pushdown' AND user_id IS NULL
ON CONFLICT (exercise_id) DO UPDATE
  SET primary_muscles = EXCLUDED.primary_muscles,
      secondary_muscles = EXCLUDED.secondary_muscles,
      cues = EXCLUDED.cues;

-- Single-Arm Tricep Pushdown: remove Chest.
INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Front Delts'],
ARRAY['Same as the standard pushdown but with one arm, allowing a fuller range of motion',
      'Keep your elbow pinned to your side, extend to full lockout',
      'Use lighter weight than the two-arm version']
FROM exercises WHERE name = 'Single-Arm Tricep Pushdown' AND user_id IS NULL
ON CONFLICT (exercise_id) DO UPDATE
  SET primary_muscles = EXCLUDED.primary_muscles,
      secondary_muscles = EXCLUDED.secondary_muscles,
      cues = EXCLUDED.cues;

-- Tricep Kickback: remove Chest.
INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Front Delts'],
ARRAY['Lean forward at the hips, upper arm parallel to the floor',
      'Extend your forearm back to lockout, squeeze the tricep at full extension',
      'Hold the contracted position briefly, then return with control']
FROM exercises WHERE name = 'Tricep Kickback' AND user_id IS NULL
ON CONFLICT (exercise_id) DO UPDATE
  SET primary_muscles = EXCLUDED.primary_muscles,
      secondary_muscles = EXCLUDED.secondary_muscles,
      cues = EXCLUDED.cues;

-- ============================================================
-- SECTION 3 (OPTIONAL): dash consistency
-- The corrected rows above use plain hyphens for ranges, but the untouched rows
-- still hold en dashes (e.g. "45–75°"). Uncomment to normalize every cue's en dash
-- to a hyphen table-wide, so the whole table is dash-consistent. Order-preserving.
-- ============================================================
-- update public.exercise_instructions
-- set cues = (select array_agg(replace(cue, '–', '-') order by ord)
--             from unnest(cues) with ordinality as t(cue, ord))
-- where exists (select 1 from unnest(cues) as c where c like '%–%');
