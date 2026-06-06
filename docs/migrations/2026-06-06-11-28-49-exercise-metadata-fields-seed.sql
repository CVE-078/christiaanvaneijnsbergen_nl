-- Generation v2 Phase 0 #2 — exercise metadata.
-- Adds six metadata fields to `exercises` and seeds them for the 94 global
-- (user_id IS NULL) exercises. Values come from the 2026-06-06 metadata pass
-- (research/science), reconciled to Pulse's vocabulary and validated: every
-- secondary_muscle is one of the 10 categories; substitution_class is one of the
-- fixed classes (or null); fatigue 1-5; joint_stress low/med/high; difficulty
-- beginner/intermediate/advanced. Prerequisite: apply the 2026-06-06
-- movement_pattern correction first.
--
-- `difficulty` is skill-to-perform-safely (beginner-gating + restriction logic), NOT
-- training stress — that axis is `fatigue`. Keep them separate; do not conflate later.
-- Spec: docs/superpowers/plans/2026-06-06-10-34-06-gen-v2-phase0-2-metadata-prep.md

alter table exercises
  add column if not exists secondary_muscles text[] not null default '{}',
  add column if not exists unilateral boolean not null default false,
  add column if not exists fatigue smallint check (fatigue between 1 and 5),
  add column if not exists joint_stress text check (joint_stress in ('low', 'med', 'high')),
  add column if not exists difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  add column if not exists substitution_class text;

-- seed
update exercises set secondary_muscles = array['back', 'shoulders']::text[], unilateral = false, fatigue = 3, joint_stress = 'med', difficulty = 'advanced', substitution_class = 'core_stability' where user_id is null and name = 'Ab Wheel Rollout';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'core_flexion' where user_id is null and name = 'Cable Crunch';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'core_flexion' where user_id is null and name = 'Crunch';
update exercises set secondary_muscles = array['legs', 'back']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'intermediate', substitution_class = 'core_flexion' where user_id is null and name = 'Hanging Leg Raise';
update exercises set secondary_muscles = array['legs', 'shoulders']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'core_stability' where user_id is null and name = 'Mountain Climber';
update exercises set secondary_muscles = array['shoulders']::text[], unilateral = false, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'core_stability' where user_id is null and name = 'Plank';
update exercises set secondary_muscles = array['legs']::text[], unilateral = false, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'core_flexion' where user_id is null and name = 'Reverse Crunch';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = null where user_id is null and name = 'Russian Twist';
update exercises set secondary_muscles = array['legs']::text[], unilateral = false, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'core_flexion' where user_id is null and name = 'Sit-Up';
update exercises set secondary_muscles = array['biceps', 'shoulders']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'horizontal_pull' where user_id is null and name = 'Barbell Row';
update exercises set secondary_muscles = array['biceps', 'shoulders']::text[], unilateral = false, fatigue = 3, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'horizontal_pull' where user_id is null and name = 'Chest-Supported Row';
update exercises set secondary_muscles = array['biceps', 'shoulders']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'vertical_pull' where user_id is null and name = 'Chin-Up';
update exercises set secondary_muscles = array['legs', 'glutes']::text[], unilateral = false, fatigue = 5, joint_stress = 'high', difficulty = 'advanced', substitution_class = 'hinge_pattern' where user_id is null and name = 'Deadlift';
update exercises set secondary_muscles = array['biceps', 'shoulders']::text[], unilateral = false, fatigue = 3, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'horizontal_pull' where user_id is null and name = 'Dumbbell Bent-Over Row';
update exercises set secondary_muscles = array['shoulders']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'rear_delt_isolation' where user_id is null and name = 'Dumbbell Face Pull (Bent-Over)';
update exercises set secondary_muscles = array['chest', 'triceps']::text[], unilateral = false, fatigue = 2, joint_stress = 'med', difficulty = 'intermediate', substitution_class = null where user_id is null and name = 'Dumbbell Pullover';
update exercises set secondary_muscles = array['shoulders']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'rear_delt_isolation' where user_id is null and name = 'Dumbbell Reverse Fly';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = null where user_id is null and name = 'Dumbbell Shrug';
update exercises set secondary_muscles = array['biceps', 'shoulders']::text[], unilateral = true, fatigue = 3, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'horizontal_pull' where user_id is null and name = 'Dumbbell Single-Arm Row';
update exercises set secondary_muscles = array['shoulders']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'rear_delt_isolation' where user_id is null and name = 'Face Pull';
update exercises set secondary_muscles = array['biceps', 'shoulders']::text[], unilateral = false, fatigue = 3, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'vertical_pull' where user_id is null and name = 'Lat Pulldown';
update exercises set secondary_muscles = array['biceps', 'shoulders']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'vertical_pull' where user_id is null and name = 'Pull-Up';
update exercises set secondary_muscles = array['legs', 'glutes']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'hinge_pattern' where user_id is null and name = 'Rack Pull';
update exercises set secondary_muscles = array['shoulders']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'rear_delt_isolation' where user_id is null and name = 'Rear Delt Fly';
update exercises set secondary_muscles = array['biceps', 'shoulders']::text[], unilateral = false, fatigue = 3, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'horizontal_pull' where user_id is null and name = 'Seated Cable Row';
update exercises set secondary_muscles = array['triceps']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = null where user_id is null and name = 'Straight-Arm Pulldown';
update exercises set secondary_muscles = array['biceps', 'shoulders']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'horizontal_pull' where user_id is null and name = 'T-Bar Row';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'biceps_isolation' where user_id is null and name = 'Barbell Curl';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'biceps_isolation' where user_id is null and name = 'Cable Curl';
update exercises set secondary_muscles = '{}'::text[], unilateral = true, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'biceps_isolation' where user_id is null and name = 'Concentration Curl';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'biceps_isolation' where user_id is null and name = 'Dumbbell Bicep Curl';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'biceps_isolation' where user_id is null and name = 'Dumbbell Curl';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'biceps_isolation' where user_id is null and name = 'Dumbbell Hammer Curl';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'biceps_isolation' where user_id is null and name = 'EZ-Bar Curl';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'biceps_isolation' where user_id is null and name = 'Incline Dumbbell Curl';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'biceps_isolation' where user_id is null and name = 'Preacher Curl';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'biceps_isolation' where user_id is null and name = 'Spider Curl';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'calf_raise' where user_id is null and name = 'Donkey Calf Raise';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'calf_raise' where user_id is null and name = 'Dumbbell Calf Raise';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'calf_raise' where user_id is null and name = 'Leg Press Calf Raise';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'calf_raise' where user_id is null and name = 'Seated Calf Raise';
update exercises set secondary_muscles = '{}'::text[], unilateral = true, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'calf_raise' where user_id is null and name = 'Single-Leg Calf Raise';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'calf_raise' where user_id is null and name = 'Smith Machine Calf Raise';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'calf_raise' where user_id is null and name = 'Standing Calf Raise';
update exercises set secondary_muscles = array['triceps', 'shoulders']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'horizontal_press' where user_id is null and name = 'Barbell Bench Press';
update exercises set secondary_muscles = array['shoulders']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = null where user_id is null and name = 'Cable Fly';
update exercises set secondary_muscles = array['shoulders']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = null where user_id is null and name = 'Chest Fly';
update exercises set secondary_muscles = array['triceps', 'shoulders']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'horizontal_press' where user_id is null and name = 'Decline Bench Press';
update exercises set secondary_muscles = array['triceps', 'shoulders']::text[], unilateral = false, fatigue = 3, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'horizontal_press' where user_id is null and name = 'Decline Dumbbell Press';
update exercises set secondary_muscles = array['triceps', 'shoulders']::text[], unilateral = false, fatigue = 3, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'horizontal_press' where user_id is null and name = 'Dumbbell Bench Press';
update exercises set secondary_muscles = array['shoulders', 'triceps']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'horizontal_press' where user_id is null and name = 'Incline Barbell Press';
update exercises set secondary_muscles = array['shoulders', 'triceps']::text[], unilateral = false, fatigue = 3, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'horizontal_press' where user_id is null and name = 'Incline Dumbbell Press';
update exercises set secondary_muscles = array['triceps', 'shoulders']::text[], unilateral = false, fatigue = 3, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'horizontal_press' where user_id is null and name = 'Machine Chest Press';
update exercises set secondary_muscles = array['shoulders']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = null where user_id is null and name = 'Pec Deck';
update exercises set secondary_muscles = array['triceps', 'shoulders']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'horizontal_press' where user_id is null and name = 'Push-Up';
update exercises set secondary_muscles = array['triceps', 'shoulders']::text[], unilateral = false, fatigue = 3, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'horizontal_press' where user_id is null and name = 'Smith Machine Bench Press';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = null where user_id is null and name = 'Abduction Machine';
update exercises set secondary_muscles = '{}'::text[], unilateral = true, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'glute_pattern' where user_id is null and name = 'Cable Kickback';
update exercises set secondary_muscles = array['legs']::text[], unilateral = true, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'unilateral_leg' where user_id is null and name = 'Dumbbell Bulgarian Split Squat';
update exercises set secondary_muscles = array['legs']::text[], unilateral = false, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'glute_pattern' where user_id is null and name = 'Glute Bridge';
update exercises set secondary_muscles = array['legs']::text[], unilateral = false, fatigue = 3, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'glute_pattern' where user_id is null and name = 'Hip Thrust';
update exercises set secondary_muscles = array['legs']::text[], unilateral = true, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'glute_pattern' where user_id is null and name = 'Single-Leg Glute Bridge';
update exercises set secondary_muscles = array['legs']::text[], unilateral = true, fatigue = 3, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'unilateral_leg' where user_id is null and name = 'Step-Up';
update exercises set secondary_muscles = array['legs', 'back']::text[], unilateral = false, fatigue = 5, joint_stress = 'high', difficulty = 'advanced', substitution_class = 'hinge_pattern' where user_id is null and name = 'Sumo Deadlift';
update exercises set secondary_muscles = array['glutes', 'calves']::text[], unilateral = false, fatigue = 5, joint_stress = 'high', difficulty = 'intermediate', substitution_class = 'squat_pattern' where user_id is null and name = 'Barbell Squat';
update exercises set secondary_muscles = array['glutes']::text[], unilateral = false, fatigue = 3, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'squat_pattern' where user_id is null and name = 'Dumbbell Goblet Squat';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = null where user_id is null and name = 'Dumbbell Leg Curl (Lying)';
update exercises set secondary_muscles = array['glutes', 'back']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'hinge_pattern' where user_id is null and name = 'Dumbbell Romanian Deadlift';
update exercises set secondary_muscles = array['glutes']::text[], unilateral = false, fatigue = 3, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'squat_pattern' where user_id is null and name = 'Dumbbell Sumo Squat';
update exercises set secondary_muscles = array['glutes']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'beginner', substitution_class = 'squat_pattern' where user_id is null and name = 'Hack Squat';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = null where user_id is null and name = 'Leg Curl';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = null where user_id is null and name = 'Leg Extension';
update exercises set secondary_muscles = array['glutes']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'beginner', substitution_class = 'squat_pattern' where user_id is null and name = 'Leg Press';
update exercises set secondary_muscles = array['glutes', 'back']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'hinge_pattern' where user_id is null and name = 'Romanian Deadlift';
update exercises set secondary_muscles = array['glutes']::text[], unilateral = true, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'unilateral_leg' where user_id is null and name = 'Walking Lunge';
update exercises set secondary_muscles = array['triceps']::text[], unilateral = false, fatigue = 3, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'vertical_press' where user_id is null and name = 'Arnold Press';
update exercises set secondary_muscles = array['triceps', 'chest']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'vertical_press' where user_id is null and name = 'Barbell Overhead Press';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'lateral_raise' where user_id is null and name = 'Dumbbell Lateral Raise';
update exercises set secondary_muscles = array['triceps', 'chest']::text[], unilateral = false, fatigue = 3, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'vertical_press' where user_id is null and name = 'Dumbbell Overhead Press';
update exercises set secondary_muscles = array['triceps', 'legs']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'vertical_press' where user_id is null and name = 'Dumbbell Push Press';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'lateral_raise' where user_id is null and name = 'Front Raise';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'lateral_raise' where user_id is null and name = 'Lateral Raise';
update exercises set secondary_muscles = array['triceps']::text[], unilateral = false, fatigue = 3, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'vertical_press' where user_id is null and name = 'Machine Shoulder Press';
update exercises set secondary_muscles = array['back', 'biceps']::text[], unilateral = false, fatigue = 2, joint_stress = 'med', difficulty = 'beginner', substitution_class = 'lateral_raise' where user_id is null and name = 'Upright Row';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'triceps_isolation' where user_id is null and name = 'Cable Overhead Tricep Extension';
update exercises set secondary_muscles = array['chest', 'shoulders']::text[], unilateral = false, fatigue = 4, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'horizontal_press' where user_id is null and name = 'Close-Grip Bench Press';
update exercises set secondary_muscles = array['chest', 'shoulders']::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'triceps_isolation' where user_id is null and name = 'Diamond / Close-Grip Push-Up';
update exercises set secondary_muscles = array['chest', 'shoulders']::text[], unilateral = false, fatigue = 3, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'triceps_isolation' where user_id is null and name = 'Dips';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'triceps_isolation' where user_id is null and name = 'Dumbbell Tricep Overhead Extension';
update exercises set secondary_muscles = array['chest']::text[], unilateral = false, fatigue = 3, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'triceps_isolation' where user_id is null and name = 'JM Press';
update exercises set secondary_muscles = '{}'::text[], unilateral = true, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'triceps_isolation' where user_id is null and name = 'Single-Arm Tricep Pushdown';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'med', difficulty = 'intermediate', substitution_class = 'triceps_isolation' where user_id is null and name = 'Skull Crusher';
update exercises set secondary_muscles = '{}'::text[], unilateral = true, fatigue = 1, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'triceps_isolation' where user_id is null and name = 'Tricep Kickback';
update exercises set secondary_muscles = '{}'::text[], unilateral = false, fatigue = 2, joint_stress = 'low', difficulty = 'beginner', substitution_class = 'triceps_isolation' where user_id is null and name = 'Tricep Pushdown';

-- Fail loudly if any global exercise went unseeded: a seed name that did not
-- match a row leaves that exercise's fatigue null. This catches silent name drift.
do $$
begin
  if (select count(*) from exercises where user_id is null and fatigue is null) > 0 then
    raise exception 'metadata seed incomplete: % global exercise(s) left unseeded',
      (select count(*) from exercises where user_id is null and fatigue is null);
  end if;
end $$;

-- Verify (expect 94 and 94):
-- select count(*) from exercises where user_id is null;
-- select count(*) from exercises where user_id is null and fatigue is not null;

