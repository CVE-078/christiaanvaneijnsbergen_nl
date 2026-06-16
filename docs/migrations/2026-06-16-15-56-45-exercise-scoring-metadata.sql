-- Context-sensitive exercise scoring (spec 2026-06-16-14-57-31). Additive columns +
-- a one-time seed. Forward-only. Generator-only fields (not read by the app loaders).
alter table exercises
    add column if not exists quality numeric(3,2),
    add column if not exists rep_min smallint,
    add column if not exists rep_max smallint,
    add column if not exists attributes text[] not null default '{}'::text[];

-- quality: migrate the ISOLATION_QUALITY map into the column (verbatim values).
update exercises set quality = 1.00 where user_id is null and name in ('Cable Curl','Tricep Pushdown','Lateral Raise','Dumbbell Lateral Raise','Cable Fly');
update exercises set quality = 0.95 where user_id is null and name in ('Incline Dumbbell Curl','Preacher Curl','Cable Overhead Tricep Extension','Dumbbell Tricep Overhead Extension','Dips','Face Pull','Dumbbell Face Pull (Bent-Over)','Rear Delt Fly');
update exercises set quality = 0.90 where user_id is null and name in ('Dumbbell Curl','Dumbbell Bicep Curl','Dumbbell Hammer Curl','Skull Crusher','Dumbbell Reverse Fly','Chest Fly');
update exercises set quality = 0.85 where user_id is null and name in ('Spider Curl','Upright Row');
update exercises set quality = 0.80 where user_id is null and name in ('Diamond / Close-Grip Push-Up','Dumbbell Shrug');
update exercises set quality = 0.75 where user_id is null and name = 'Arnold Press';
update exercises set quality = 0.70 where user_id is null and name = 'Concentration Curl';
update exercises set quality = 0.60 where user_id is null and name = 'Front Raise';
update exercises set quality = 0.55 where user_id is null and name = 'Tricep Kickback';

-- back_iso peer re-ranking (spec section 5): Straight-Arm Pulldown is the better lat
-- isolation, was never scored (re-tagged back_iso by the #153 calibration); Pullover is
-- overvalued relative to it. Add Straight-Arm high, lower Pullover to its true value.
update exercises set quality = 0.95 where user_id is null and name = 'Straight-Arm Pulldown';
update exercises set quality = 0.72 where user_id is null and name = 'Dumbbell Pullover';

-- rep windows + the explosive attribute (spec section 4). Leave true barbell/machine
-- compounds NULL (squat/press/leg-press handle their own ranges via bias/goal).
-- Names verified against the live catalogue (94 user-null exercises, 2026-06-16). The only
-- explosive lift present is Dumbbell Push Press (vertical_push, compound, NOT a
-- CANONICAL_ANCHOR, so the [3,5] window + gross-mismatch layer keep it off hypertrophy days).
-- No Olympic lifts exist (no clean/snatch/jerk), so no clean seeds. The unilateral leg set
-- is Step-Up / Walking Lunge / Dumbbell Bulgarian Split Squat (all pattern 'lunge'). There is
-- no Cable Lateral Raise.
update exercises set rep_min = 3, rep_max = 5, attributes = array['explosive']::text[] where user_id is null and name = 'Dumbbell Push Press';
update exercises set rep_min = 8, rep_max = 15 where user_id is null and name = 'Step-Up';
update exercises set rep_min = 6, rep_max = 15 where user_id is null and name = 'Dumbbell Bulgarian Split Squat';
update exercises set rep_min = 8, rep_max = 20 where user_id is null and name = 'Walking Lunge';
update exercises set rep_min = 10, rep_max = 25 where user_id is null and name in ('Lateral Raise','Dumbbell Lateral Raise','Rear Delt Fly','Dumbbell Reverse Fly');
update exercises set rep_min = 10, rep_max = 20 where user_id is null and name in ('Face Pull','Dumbbell Face Pull (Bent-Over)');
update exercises set rep_min = 8, rep_max = 20 where user_id is null and name in ('Cable Fly','Chest Fly','Pec Deck');

-- attributes for the bodybuilding style affinity (spec section 3). incline + lengthened_bias.
update exercises set attributes = array['incline']::text[] where user_id is null and name in ('Incline Dumbbell Press','Incline Barbell Press','Incline Dumbbell Curl');
update exercises set attributes = array['lengthened_bias']::text[] where user_id is null and name in ('Cable Fly','Incline Dumbbell Curl','Cable Overhead Tricep Extension','Romanian Deadlift','Seated Cable Row');
