-- Calibration round 2, Item 5: treat the binary "shoulder" restriction as MODERATE.
-- Dumbbell Overhead Press is the last free-weight overhead press still untagged for the
-- shoulder flag (Barbell Overhead Press, Arnold Press, Dumbbell Push Press, Upright Row,
-- and Dips were tagged by 2026-06-08-14-27-19-exercise-contraindications.sql). Tag it so a
-- shoulder restriction removes ALL free-weight overhead pressing.
--
-- Machine Shoulder Press stays UNtagged: neutral / machine pressing is tolerated under a
-- moderate shoulder restriction. The generator additionally de-emphasises the vertical-
-- press SLOT under a shoulder restriction (applyShoulderModeration in generation.ts), so a
-- shoulder-restricted routine leans into lateral / rear delts + horizontal pressing rather
-- than seating Machine Shoulder Press. Idempotent (guarded on the existing array).
update exercises set contraindications = array_append(contraindications, 'shoulder')
    where user_id is null
      and name = 'Dumbbell Overhead Press'
      and not ('shoulder' = any(contraindications));
