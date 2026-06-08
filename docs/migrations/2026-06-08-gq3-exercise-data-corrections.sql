-- ============================================================
-- Migration: gq3-exercise-data-corrections
-- 2026-06-08
-- ============================================================
-- Two small data corrections surfaced while building GQ3
-- (role-aware exercise ranking and weekly structure validation).
--
-- 1. Smith Machine Bench Press is tagged equipment = {barbell, bench}
--    by the 2026-06-04 equipment-correction seed, but there is no
--    'smith_machine' EquipmentKey: a Smith machine is a fixed-rail
--    machine, not a barbell. As tagged it leaks into "barbell only"
--    pools (e.g. a home setup with a barbell but no machines), and the
--    generator's hasEquipment filter cannot gate it on machine access.
--    Re-tag it {machines, bench} so it only surfaces for gym setups.
--
-- 2. Front Raise currently shares substitution_class = 'lateral_raise'
--    with Dumbbell Lateral Raise / Lateral Raise / Upright Row, even
--    though it trains the front delt, not the side delt. GQ3's
--    suppression rule (deprioritize front-delt isolation after a
--    vertical press, since pressing already loads the front delts)
--    needs to target Front Raise specifically without touching the
--    legitimate lateral-raise family. Re-seed it to a new, distinct
--    'front_delt_isolation' class.
--
-- Apply via the Supabase SQL Editor AFTER 2026-06-06-11-28-49-exercise-metadata-fields-seed.sql.
-- Idempotent: pure UPDATEs scoped to global rows; re-running is safe.

UPDATE exercises SET equipment = ARRAY['machines', 'bench']
WHERE user_id IS NULL AND name = 'Smith Machine Bench Press';

UPDATE exercises SET substitution_class = 'front_delt_isolation'
WHERE user_id IS NULL AND name = 'Front Raise';

-- Verification (should return two rows):
--   Smith Machine Bench Press | {machines,bench}      | horizontal_press
--   Front Raise               | {dumbbells}           | front_delt_isolation
SELECT name, equipment, substitution_class
FROM exercises
WHERE user_id IS NULL AND name IN ('Smith Machine Bench Press', 'Front Raise');
