-- Generation metadata seed for global exercises (user_id IS NULL).
-- Apply via the Supabase SQL Editor AFTER 2026-06-03-exercise-generation-metadata.sql.
-- Idempotent: pure UPDATEs. Re-running is safe.
--
-- Strategy: derive equipment from the name prefix, set a coarse movement_pattern
-- + is_compound from the category, then upgrade compounds via name keywords.
-- Category defaults guarantee every global exercise gets a movement_pattern
-- (no NULLs). Refine specific exercises with extra UPDATEs as needed.

-- ── Equipment from name ──────────────────────────────────────────────────────
UPDATE exercises SET equipment = ARRAY['dumbbells'] WHERE user_id IS NULL AND name ILIKE 'Dumbbell %';
UPDATE exercises SET equipment = ARRAY['barbell','bench'] WHERE user_id IS NULL AND name ILIKE 'Barbell %';
UPDATE exercises SET equipment = ARRAY['cables'] WHERE user_id IS NULL AND name ILIKE 'Cable %';
UPDATE exercises SET equipment = ARRAY['machines']
    WHERE user_id IS NULL AND (name ILIKE 'Machine %' OR name ILIKE 'Lever %' OR name ILIKE 'Smith %');
-- Anything still untagged keeps the default empty array, which the generator
-- treats as bodyweight / always-available (Pull-Up, Push-Up, Plank, etc.).

-- ── Coarse movement_pattern + is_compound by category ────────────────────────
UPDATE exercises SET movement_pattern = 'chest_iso',    is_compound = false WHERE user_id IS NULL AND category = 'chest';
UPDATE exercises SET movement_pattern = 'back_iso',     is_compound = false WHERE user_id IS NULL AND category = 'back';
UPDATE exercises SET movement_pattern = 'shoulder_iso', is_compound = false WHERE user_id IS NULL AND category = 'shoulders';
UPDATE exercises SET movement_pattern = 'biceps_iso',   is_compound = false WHERE user_id IS NULL AND category = 'biceps';
UPDATE exercises SET movement_pattern = 'triceps_iso',  is_compound = false WHERE user_id IS NULL AND category = 'triceps';
UPDATE exercises SET movement_pattern = 'squat',        is_compound = true  WHERE user_id IS NULL AND category = 'legs';
UPDATE exercises SET movement_pattern = 'glute_iso',    is_compound = false WHERE user_id IS NULL AND category = 'glutes';
UPDATE exercises SET movement_pattern = 'calf',         is_compound = false WHERE user_id IS NULL AND category = 'calves';
UPDATE exercises SET movement_pattern = 'core',         is_compound = false WHERE user_id IS NULL AND category = 'abs';
UPDATE exercises SET movement_pattern = 'core',         is_compound = false WHERE user_id IS NULL AND category = 'other' AND movement_pattern IS NULL;

-- ── Keyword overrides: compound movement patterns ────────────────────────────
UPDATE exercises SET movement_pattern = 'horizontal_push', is_compound = true
    WHERE user_id IS NULL AND name ILIKE '%Bench Press%';
UPDATE exercises SET movement_pattern = 'vertical_push', is_compound = true
    WHERE user_id IS NULL AND (name ILIKE '%Shoulder Press%' OR name ILIKE '%Overhead Press%' OR name ILIKE '%Push Press%');
UPDATE exercises SET movement_pattern = 'chest_iso', is_compound = false
    WHERE user_id IS NULL AND (name ILIKE '%Fly%' OR name ILIKE '%Flye%');
UPDATE exercises SET movement_pattern = 'horizontal_pull', is_compound = true
    WHERE user_id IS NULL AND name ILIKE '%Row%';
UPDATE exercises SET movement_pattern = 'vertical_pull', is_compound = true
    WHERE user_id IS NULL AND (name ILIKE '%Pulldown%' OR name ILIKE '%Pull-Up%' OR name ILIKE '%Pull Up%' OR name ILIKE '%Chin%');
UPDATE exercises SET movement_pattern = 'hinge', is_compound = true
    WHERE user_id IS NULL AND (name ILIKE '%Deadlift%' OR name ILIKE '%Romanian%' OR name ILIKE '%Hip Thrust%' OR name ILIKE '%Good Morning%');
UPDATE exercises SET movement_pattern = 'lunge', is_compound = true
    WHERE user_id IS NULL AND (name ILIKE '%Lunge%' OR name ILIKE '%Split Squat%' OR name ILIKE '%Step-Up%' OR name ILIKE '%Step Up%');
UPDATE exercises SET movement_pattern = 'squat', is_compound = true
    WHERE user_id IS NULL AND name ILIKE '%Squat%' AND name NOT ILIKE '%Split Squat%';
UPDATE exercises SET movement_pattern = 'shoulder_iso', is_compound = false
    WHERE user_id IS NULL AND (name ILIKE '%Lateral Raise%' OR name ILIKE '%Rear Delt%' OR name ILIKE '%Face Pull%');

-- ── Verify (should return zero rows after seeding) ───────────────────────────
-- select name, category, equipment, movement_pattern, is_compound
-- from exercises where user_id is null and movement_pattern is null;
