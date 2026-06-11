-- ============================================================
-- Migration: p0-group2-exercise-metadata-corrections
-- 2026-06-11
-- ============================================================
-- Three small metadata corrections from the P0 generation-quality
-- backlog (roadmap subsection 2), all verified against the seed
-- migrations on 2026-06-11.
--
-- 2.1 Cable Fly / Chest Fly / Pec Deck were seeded with
--     substitution_class = null (2026-06-06-11-28-49 metadata seed,
--     lines 68/69/76). The byPattern cross-session freshness term only
--     fires on non-null classes, so the generator treats the three
--     flies as unrelated and two near-identical fly variations can
--     co-occur in one routine. Seed them as one 'chest_fly' family.
--
-- 2.2 Leg Curl / Dumbbell Leg Curl (Lying) (both hinge, non-compound)
--     and Leg Extension (squat, non-compound) were also seeded with
--     substitution_class = null. Once the real hinge compounds are
--     consumed elsewhere in the week, a null-class leg curl reads as
--     "fresh" and fills a hinge slot at selection time (an isolation
--     where a compound belongs). Seed 'leg_curl' / 'leg_extension'
--     classes so the freshness and dedup layers see the families.
--     NOTE: the global row is 'Dumbbell Leg Curl (Lying)', there is no
--     plain 'Dumbbell Leg Curl'; 'Leg Curl Machine' / 'Leg Extension
--     Machine' are template-only names with no global exercise row.
--
-- 2.3 Smith Machine Calf Raise is tagged equipment = {barbell,bench}:
--     the 2026-06-04 equipment correction (lines 88-97) lumped it into
--     the bench-press barbell group by copy-paste. Its movement_pattern
--     was later corrected to calf (2026-06-06-10-51-33) but the
--     equipment never was, so the lift is invisible to gym users who
--     own machines but no barbell. Re-tag {machines} (a Smith machine
--     calf raise needs no bench).
--
-- Apply via the Supabase SQL Editor AFTER the four pending merged-
-- feature migrations (equipment-profile-expiry, exercise-swaps-from-
-- exercise, exercise-swaps-reason, program-pauses) so the exercises
-- rows are in their expected state.
-- Idempotent: pure UPDATEs scoped to global rows; 2.1/2.2 additionally
-- guard on substitution_class IS NULL so a live row that has since
-- been classified is left alone. Re-running is safe.

-- 2.1 chest-fly family
UPDATE exercises SET substitution_class = 'chest_fly'
WHERE user_id IS NULL
  AND name IN ('Cable Fly', 'Chest Fly', 'Pec Deck')
  AND substitution_class IS NULL;

-- 2.2 leg curl / leg extension families
UPDATE exercises SET substitution_class = 'leg_curl'
WHERE user_id IS NULL
  AND name IN ('Leg Curl', 'Dumbbell Leg Curl (Lying)')
  AND substitution_class IS NULL;

UPDATE exercises SET substitution_class = 'leg_extension'
WHERE user_id IS NULL
  AND name = 'Leg Extension'
  AND substitution_class IS NULL;

-- 2.3 Smith Machine Calf Raise equipment
UPDATE exercises SET equipment = ARRAY['machines']
WHERE user_id IS NULL AND name = 'Smith Machine Calf Raise';

-- Verification (should return seven rows):
--   Cable Fly                    | chest_fly      | {…}
--   Chest Fly                    | chest_fly      | {…}
--   Pec Deck                     | chest_fly      | {…}
--   Leg Curl                     | leg_curl       | {…}
--   Dumbbell Leg Curl (Lying)    | leg_curl       | {…}
--   Leg Extension                | leg_extension  | {…}
--   Smith Machine Calf Raise     | calf_raise     | {machines}
SELECT name, substitution_class, equipment
FROM exercises
WHERE user_id IS NULL
  AND name IN (
    'Cable Fly', 'Chest Fly', 'Pec Deck',
    'Leg Curl', 'Dumbbell Leg Curl (Lying)', 'Leg Extension',
    'Smith Machine Calf Raise'
  )
ORDER BY name;
