-- ============================================================
-- Migration: routine-templates
-- 2026-05-27
-- ============================================================

-- STEP 1: Add workout_type to routine_exercises
ALTER TABLE routine_exercises
  ADD COLUMN IF NOT EXISTS workout_type text NOT NULL DEFAULT 'push'
    CHECK (workout_type IN ('push','pull','legs','chest','back','shoulders','arms'));

-- STEP 2: Backfill workout_type from OLD exercise categories (push/pull/legs)
-- Must run BEFORE category values are changed in steps 3-5.
UPDATE routine_exercises re
SET workout_type = CASE ex.category
  WHEN 'push' THEN 'push'
  WHEN 'pull' THEN 'pull'
  WHEN 'legs' THEN 'legs'
  ELSE 'push'
END
FROM exercises ex WHERE ex.id = re.exercise_id;

-- STEP 3: Drop old exercises category CHECK so we can update to new values
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_category_check;

-- STEP 4: Remap all exercises to granular muscle-group categories
UPDATE exercises SET category = 'chest' WHERE user_id IS NULL AND name IN (
  'Dumbbell Bench Press','Incline DB Press',
  'Barbell Bench Press','Incline Barbell Press','Machine Chest Press',
  'Decline Bench Press','Pec Deck','Smith Machine Bench Press'
);
UPDATE exercises SET category = 'shoulders' WHERE user_id IS NULL AND name IN (
  'DB Lateral Raise','DB Overhead Press',
  'Barbell Overhead Press','Lateral Raise','Arnold Press',
  'Front Raise','Upright Row','Machine Shoulder Press','Cable Lateral Raise'
);
UPDATE exercises SET category = 'triceps' WHERE user_id IS NULL AND name IN (
  'DB Tricep Overhead Extension','Diamond / Close-Grip Push-Up',
  'Dips','Cable Tricep Pushdown','Tricep Pushdown'
);
UPDATE exercises SET category = 'back' WHERE user_id IS NULL AND name IN (
  'DB Bent-Over Row','DB Single-Arm Row','DB Reverse Fly','DB Face Pull bent-over',
  'Deadlift','Pull-Up','Lat Pulldown','Barbell Row','Seated Cable Row',
  'T-Bar Row','Chest-Supported Row','Straight-Arm Pulldown','Rack Pull',
  'Rear Delt Fly','Face Pull','Chin-Up'
);
UPDATE exercises SET category = 'biceps' WHERE user_id IS NULL AND name IN (
  'DB Bicep Curl','DB Hammer Curl','Barbell Bicep Curl',
  'Barbell Curl','Dumbbell Curl','Hammer Curl','Preacher Curl','Cable Curl',
  'Incline Dumbbell Curl','EZ-Bar Curl','Concentration Curl','Spider Curl'
);
UPDATE exercises SET category = 'glutes' WHERE user_id IS NULL AND name IN (
  'DB Bulgarian Split Squat'
);
UPDATE exercises SET category = 'calves' WHERE user_id IS NULL AND name IN (
  'DB Calf Raise','Calf Raise Machine'
);

-- STEP 5: Seed new global exercises (skips any that already exist by name)
INSERT INTO exercises (name, category, default_sets, default_reps, user_id)
SELECT t.name, t.category, t.default_sets, t.default_reps, NULL
FROM (VALUES
  -- Chest
  ('Barbell Bench Press',       'chest',     '4', '6-10'),
  ('Incline Barbell Press',     'chest',     '3', '8-12'),
  ('Chest Fly',                 'chest',     '3', '12-15'),
  ('Cable Fly',                 'chest',     '3', '12-15'),
  ('Push-Up',                   'chest',     '3', '12-20'),
  ('Dips',                      'triceps',   '3', 'to failure'),
  ('Machine Chest Press',       'chest',     '3', '10-14'),
  ('Decline Bench Press',       'chest',     '3', '8-12'),
  ('Pec Deck',                  'chest',     '3', '12-15'),
  ('Smith Machine Bench Press', 'chest',     '3', '8-12'),
  -- Back
  ('Deadlift',                  'back',      '4', '4-6'),
  ('Pull-Up',                   'back',      '3', 'to failure'),
  ('Lat Pulldown',              'back',      '3', '8-12'),
  ('Barbell Row',               'back',      '4', '6-10'),
  ('Seated Cable Row',          'back',      '3', '10-14'),
  ('T-Bar Row',                 'back',      '3', '8-12'),
  ('Chest-Supported Row',       'back',      '3', '10-14'),
  ('Straight-Arm Pulldown',     'back',      '3', '12-15'),
  ('Rack Pull',                 'back',      '3', '4-6'),
  -- Shoulders
  ('Barbell Overhead Press',    'shoulders', '4', '6-10'),
  ('Lateral Raise',             'shoulders', '4', '12-16'),
  ('Rear Delt Fly',             'back',      '3', '12-16'),
  ('Face Pull',                 'back',      '3', '15-20'),
  ('Arnold Press',              'shoulders', '3', '8-12'),
  ('Front Raise',               'shoulders', '3', '12-15'),
  ('Upright Row',               'shoulders', '3', '10-14'),
  ('Machine Shoulder Press',    'shoulders', '3', '10-14'),
  -- Biceps
  ('Barbell Curl',              'biceps',    '3', '8-12'),
  ('Dumbbell Curl',             'biceps',    '3', '10-14'),
  ('Preacher Curl',             'biceps',    '3', '10-14'),
  ('Cable Curl',                'biceps',    '3', '10-14'),
  ('Incline Dumbbell Curl',     'biceps',    '3', '10-14'),
  ('EZ-Bar Curl',               'biceps',    '3', '8-12'),
  ('Concentration Curl',        'biceps',    '3', '12-15'),
  ('Spider Curl',               'biceps',    '3', '10-14'),
  ('Chin-Up',                   'back',      '3', 'to failure'),
  -- Triceps
  ('Tricep Pushdown',           'triceps',   '4', '10-14'),
  ('Close-Grip Bench Press',    'triceps',   '3', '6-10'),
  ('Skull Crusher',             'triceps',   '3', '8-12'),
  ('Cable Overhead Tricep Extension', 'triceps', '3', '10-15'),
  ('Single-Arm Tricep Pushdown','triceps',   '3', '12-15'),
  ('JM Press',                  'triceps',   '3', '6-10'),
  ('Tricep Kickback',           'triceps',   '3', '12-15'),
  -- Legs
  ('Barbell Squat',             'legs',      '4', '5-8'),
  ('Romanian Deadlift',         'legs',      '3', '8-12'),
  ('Leg Press',                 'legs',      '3', '10-15'),
  ('Walking Lunge',             'legs',      '3', '10-12'),
  ('Leg Extension',             'legs',      '3', '12-15'),
  ('Leg Curl',                  'legs',      '3', '12-15'),
  ('Hack Squat',                'legs',      '3', '8-12'),
  -- Glutes
  ('Hip Thrust',                'glutes',    '4', '10-15'),
  ('Glute Bridge',              'glutes',    '3', '12-15'),
  ('Cable Kickback',            'glutes',    '3', '12-15'),
  ('Step-Up',                   'glutes',    '3', '10-12'),
  ('Sumo Deadlift',             'glutes',    '3', '6-10'),
  ('Abduction Machine',         'glutes',    '3', '15-20'),
  -- Calves
  ('Standing Calf Raise',       'calves',    '4', '15-20'),
  ('Seated Calf Raise',         'calves',    '3', '15-20'),
  ('Leg Press Calf Raise',      'calves',    '3', '15-20'),
  ('Single-Leg Calf Raise',     'calves',    '3', '15-20'),
  ('Donkey Calf Raise',         'calves',    '3', '15-20'),
  ('Smith Machine Calf Raise',  'calves',    '3', '15-20'),
  -- Abs
  ('Crunch',                    'abs',       '3', '15-20'),
  ('Cable Crunch',              'abs',       '3', '15-20'),
  ('Hanging Leg Raise',         'abs',       '3', '10-15'),
  ('Plank',                     'abs',       '3', '30-60s'),
  ('Russian Twist',             'abs',       '3', '15-20'),
  ('Ab Wheel Rollout',          'abs',       '3', '10-15'),
  ('Reverse Crunch',            'abs',       '3', '15-20'),
  ('Mountain Climber',          'abs',       '3', '20-30'),
  ('Sit-Up',                    'abs',       '3', '15-20')
) AS t(name, category, default_sets, default_reps)
WHERE NOT EXISTS (
  SELECT 1 FROM exercises WHERE name = t.name AND user_id IS NULL
);

-- Remap user-created exercises from old push/pull categories before CHECK is added
UPDATE exercises SET category = 'other'
WHERE user_id IS NOT NULL AND category IN ('push', 'pull');

-- STEP 6: Add new exercises category CHECK constraint
ALTER TABLE exercises ADD CONSTRAINT exercises_category_check
  CHECK (category IN ('chest','shoulders','triceps','back','biceps','legs','glutes','calves','abs','other'));

-- STEP 7: Add onboarding_completed to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- STEP 8: Create routine_templates table
DROP TABLE IF EXISTS template_exercises CASCADE;
DROP TABLE IF EXISTS routine_templates CASCADE;
CREATE TABLE routine_templates (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name               text NOT NULL,
  slug               text NOT NULL UNIQUE,
  required_equipment text[] NOT NULL,
  days_per_week      text NOT NULL,
  experience_level   text NOT NULL CHECK (experience_level IN ('beginner','intermediate','advanced')),
  session_time       text NOT NULL,
  description        text NOT NULL
);

-- STEP 9: Create template_exercises table
CREATE TABLE template_exercises (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id  uuid REFERENCES routine_templates(id) ON DELETE CASCADE NOT NULL,
  exercise_id  uuid REFERENCES exercises(id) NOT NULL,
  workout_type text NOT NULL CHECK (workout_type IN ('push','pull','legs','chest','back','shoulders','arms')),
  "order"      integer NOT NULL,
  sets         text NOT NULL,
  reps         text NOT NULL,
  UNIQUE (template_id, "order")
);

-- STEP 10: Enable RLS
ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "routine_templates_select" ON routine_templates;
CREATE POLICY "routine_templates_select" ON routine_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "template_exercises_select" ON template_exercises;
CREATE POLICY "template_exercises_select" ON template_exercises FOR SELECT TO authenticated USING (true);

-- STEP 11: Seed 14 routine_templates (explicit stable UUIDs)
INSERT INTO routine_templates (id, name, slug, required_equipment, days_per_week, experience_level, session_time, description)
VALUES
  ('a1000000-0000-0000-0000-000000000001','Full Body — Dumbbells',   'full-body-db',      '{"dumbbells"}',                        '2-3','beginner',    '30-45 min','One session works everything. Great for building the habit.'),
  ('a1000000-0000-0000-0000-000000000002','Full Body — Home Gym',    'full-body-home',    '{"dumbbells","barbell","bench"}',       '2-3','beginner',    '45-60 min','Full body with a barbell for heavier compound work.'),
  ('a1000000-0000-0000-0000-000000000003','Full Body — Gym',         'full-body-gym',     '{"barbell","bench","cables","machines"}','2-3','beginner',   '45-60 min','Barbells, cables, and machines. Fastest beginner progress.'),
  ('a1000000-0000-0000-0000-000000000004','Upper/Lower — Dumbbells', 'upper-lower-db',    '{"dumbbells","bench"}',                 '4',  'intermediate','45-60 min','Upper/lower split with dumbbells only.'),
  ('a1000000-0000-0000-0000-000000000005','Upper/Lower — Home Gym',  'upper-lower-home',  '{"dumbbells","barbell","bench"}',       '4',  'intermediate','45-60 min','Upper/lower split with barbell compounds at home.'),
  ('a1000000-0000-0000-0000-000000000006','Upper/Lower — Gym',       'upper-lower-gym',   '{"barbell","bench","cables","machines"}','4', 'intermediate','45-60 min','Upper/lower split with full gym access.'),
  ('a1000000-0000-0000-0000-000000000007','PPL — Dumbbells',         'ppl-db',            '{"dumbbells","bench"}',                '3-6', 'intermediate','45-60 min','Push, pull, legs. Run 3×/week or repeat for 6×/week.'),
  ('a1000000-0000-0000-0000-000000000008','PPL — Home Gym',          'ppl-home',          '{"dumbbells","barbell","bench"}',      '3-6', 'intermediate','60-90 min','Classic PPL with a barbell. 3× or 6×/week.'),
  ('a1000000-0000-0000-0000-000000000009','PPL — Gym',               'ppl-gym',           '{"barbell","bench","cables","machines"}','3-6','intermediate','60-90 min','Classic PPL with full gym access.'),
  ('a1000000-0000-0000-0000-000000000010','Push/Pull — Dumbbells',   'push-pull-db',      '{"dumbbells","bench"}',                 '4',  'intermediate','45-60 min','Push and pull days, no dedicated legs session.'),
  ('a1000000-0000-0000-0000-000000000011','Push/Pull — Gym',         'push-pull-gym',     '{"barbell","bench","cables","machines"}','4', 'intermediate','45-60 min','Push/pull with full gym.'),
  ('a1000000-0000-0000-0000-000000000012','Bro Split — Gym',         'bro-split-gym',     '{"barbell","bench","cables","machines"}','5', 'intermediate','60-90 min','One muscle group per day: Chest / Back / Shoulders / Arms / Legs.'),
  ('a1000000-0000-0000-0000-000000000013','Arnold Split — Gym',      'arnold-split-gym',  '{"barbell","bench","cables","machines"}','6', 'advanced',    '60-90 min','Arnold''s classic: Chest+Back / Shoulders+Arms / Legs, repeated twice.'),
  ('a1000000-0000-0000-0000-000000000014','Arnold Split — Home Gym', 'arnold-split-home', '{"dumbbells","barbell","bench"}',       '6',  'advanced',    '60-90 min','Arnold split with home gym barbells.')
ON CONFLICT (slug) DO NOTHING;

-- STEP 12: Seed template_exercises via name-based JOIN
INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT t.tid, e.id, t.wt, t.ord, t.sets, t.reps
FROM (VALUES
  -- full-body-db (001)
  ('a1000000-0000-0000-0000-000000000001'::uuid,'Dumbbell Bench Press',    'push', 1,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000001'::uuid,'DB Overhead Press',       'push', 2,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000001'::uuid,'DB Bent-Over Row',        'pull', 3,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000001'::uuid,'DB Bicep Curl',           'pull', 4,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000001'::uuid,'DB Goblet Squat',         'legs', 5,'4','10-15'),
  ('a1000000-0000-0000-0000-000000000001'::uuid,'DB Romanian Deadlift',    'legs', 6,'3','8-12'),
  -- full-body-home (002)
  ('a1000000-0000-0000-0000-000000000002'::uuid,'Barbell Bench Press',     'push', 1,'3','6-10'),
  ('a1000000-0000-0000-0000-000000000002'::uuid,'Barbell Overhead Press',  'push', 2,'3','6-10'),
  ('a1000000-0000-0000-0000-000000000002'::uuid,'Barbell Row',             'pull', 3,'3','6-10'),
  ('a1000000-0000-0000-0000-000000000002'::uuid,'DB Bicep Curl',           'pull', 4,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000002'::uuid,'Barbell Squat',           'legs', 5,'4','5-8'),
  ('a1000000-0000-0000-0000-000000000002'::uuid,'Romanian Deadlift',       'legs', 6,'3','8-12'),
  -- full-body-gym (003)
  ('a1000000-0000-0000-0000-000000000003'::uuid,'Barbell Bench Press',     'push', 1,'3','6-10'),
  ('a1000000-0000-0000-0000-000000000003'::uuid,'Barbell Overhead Press',  'push', 2,'3','6-10'),
  ('a1000000-0000-0000-0000-000000000003'::uuid,'Barbell Row',             'pull', 3,'3','6-10'),
  ('a1000000-0000-0000-0000-000000000003'::uuid,'Lat Pulldown',            'pull', 4,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000003'::uuid,'Barbell Squat',           'legs', 5,'4','5-8'),
  ('a1000000-0000-0000-0000-000000000003'::uuid,'Leg Press',               'legs', 6,'3','10-15'),
  -- upper-lower-db (004)
  ('a1000000-0000-0000-0000-000000000004'::uuid,'Dumbbell Bench Press',    'push', 1,'4','8-12'),
  ('a1000000-0000-0000-0000-000000000004'::uuid,'DB Overhead Press',       'push', 2,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000004'::uuid,'DB Lateral Raise',        'push', 3,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000004'::uuid,'DB Bent-Over Row',        'pull', 4,'4','8-12'),
  ('a1000000-0000-0000-0000-000000000004'::uuid,'DB Bicep Curl',           'pull', 5,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000004'::uuid,'DB Reverse Fly',          'pull', 6,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000004'::uuid,'DB Goblet Squat',         'legs', 7,'4','10-15'),
  ('a1000000-0000-0000-0000-000000000004'::uuid,'DB Romanian Deadlift',    'legs', 8,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000004'::uuid,'DB Bulgarian Split Squat','legs', 9,'3','10-12 per leg'),
  ('a1000000-0000-0000-0000-000000000004'::uuid,'DB Calf Raise',           'legs',10,'3','15-20'),
  -- upper-lower-home (005)
  ('a1000000-0000-0000-0000-000000000005'::uuid,'Barbell Bench Press',     'push', 1,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000005'::uuid,'Barbell Overhead Press',  'push', 2,'3','6-10'),
  ('a1000000-0000-0000-0000-000000000005'::uuid,'DB Lateral Raise',        'push', 3,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000005'::uuid,'Barbell Row',             'pull', 4,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000005'::uuid,'DB Bicep Curl',           'pull', 5,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000005'::uuid,'DB Reverse Fly',          'pull', 6,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000005'::uuid,'Barbell Squat',           'legs', 7,'4','5-8'),
  ('a1000000-0000-0000-0000-000000000005'::uuid,'Romanian Deadlift',       'legs', 8,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000005'::uuid,'DB Bulgarian Split Squat','legs', 9,'3','10-12 per leg'),
  ('a1000000-0000-0000-0000-000000000005'::uuid,'DB Calf Raise',           'legs',10,'3','15-20'),
  -- upper-lower-gym (006)
  ('a1000000-0000-0000-0000-000000000006'::uuid,'Barbell Bench Press',     'push', 1,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000006'::uuid,'Barbell Overhead Press',  'push', 2,'3','6-10'),
  ('a1000000-0000-0000-0000-000000000006'::uuid,'Cable Lateral Raise',     'push', 3,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000006'::uuid,'Barbell Row',             'pull', 4,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000006'::uuid,'Lat Pulldown',            'pull', 5,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000006'::uuid,'Face Pull',               'pull', 6,'3','15-20'),
  ('a1000000-0000-0000-0000-000000000006'::uuid,'Barbell Squat',           'legs', 7,'4','5-8'),
  ('a1000000-0000-0000-0000-000000000006'::uuid,'Leg Press',               'legs', 8,'3','10-15'),
  ('a1000000-0000-0000-0000-000000000006'::uuid,'Romanian Deadlift',       'legs', 9,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000006'::uuid,'Leg Curl Machine',        'legs',10,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000006'::uuid,'Calf Raise Machine',      'legs',11,'3','15-20'),
  -- ppl-db (007)
  ('a1000000-0000-0000-0000-000000000007'::uuid,'Dumbbell Bench Press',         'push', 1,'4','8-12'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'Incline DB Press',             'push', 2,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Overhead Press',            'push', 3,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Lateral Raise',             'push', 4,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Tricep Overhead Extension', 'push', 5,'3','10-15'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Bent-Over Row',             'pull', 6,'4','8-12'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Single-Arm Row',            'pull', 7,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Reverse Fly',               'pull', 8,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Bicep Curl',                'pull', 9,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Hammer Curl',               'pull',10,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Goblet Squat',              'legs',11,'4','10-15'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Bulgarian Split Squat',     'legs',12,'3','10-12 per leg'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Romanian Deadlift',         'legs',13,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Leg Curl lying on bench',   'legs',14,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000007'::uuid,'DB Calf Raise',                'legs',15,'3','15-20'),
  -- ppl-home (008)
  ('a1000000-0000-0000-0000-000000000008'::uuid,'Barbell Bench Press',          'push', 1,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'Incline Barbell Press',        'push', 2,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'Barbell Overhead Press',       'push', 3,'3','6-10'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'DB Lateral Raise',             'push', 4,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'DB Tricep Overhead Extension', 'push', 5,'3','10-15'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'Barbell Row',                  'pull', 6,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'DB Single-Arm Row',            'pull', 7,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'DB Reverse Fly',               'pull', 8,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'DB Bicep Curl',                'pull', 9,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'DB Hammer Curl',               'pull',10,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'Barbell Squat',                'legs',11,'4','5-8'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'Romanian Deadlift',            'legs',12,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'DB Bulgarian Split Squat',     'legs',13,'3','10-12 per leg'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'DB Leg Curl lying on bench',   'legs',14,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000008'::uuid,'DB Calf Raise',                'legs',15,'3','15-20'),
  -- ppl-gym (009)
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Barbell Bench Press',          'push', 1,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Incline Barbell Press',        'push', 2,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Barbell Overhead Press',       'push', 3,'3','6-10'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Cable Lateral Raise',          'push', 4,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Cable Tricep Pushdown',        'push', 5,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Pec Deck',                     'push', 6,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Barbell Row',                  'pull', 7,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Lat Pulldown',                 'pull', 8,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Seated Cable Row',             'pull', 9,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Face Pull',                    'pull',10,'3','15-20'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Barbell Bicep Curl',           'pull',11,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Cable Curl',                   'pull',12,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Barbell Squat',                'legs',13,'4','5-8'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Leg Press',                    'legs',14,'3','10-15'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Romanian Deadlift',            'legs',15,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Leg Curl Machine',             'legs',16,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Leg Extension Machine',        'legs',17,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000009'::uuid,'Calf Raise Machine',           'legs',18,'3','15-20'),
  -- push-pull-db (010)
  ('a1000000-0000-0000-0000-000000000010'::uuid,'Dumbbell Bench Press',         'push', 1,'4','8-12'),
  ('a1000000-0000-0000-0000-000000000010'::uuid,'DB Overhead Press',            'push', 2,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000010'::uuid,'DB Lateral Raise',             'push', 3,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000010'::uuid,'DB Tricep Overhead Extension', 'push', 4,'3','10-15'),
  ('a1000000-0000-0000-0000-000000000010'::uuid,'DB Bent-Over Row',             'pull', 5,'4','8-12'),
  ('a1000000-0000-0000-0000-000000000010'::uuid,'DB Single-Arm Row',            'pull', 6,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000010'::uuid,'DB Bicep Curl',                'pull', 7,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000010'::uuid,'DB Hammer Curl',               'pull', 8,'3','10-14'),
  -- push-pull-gym (011)
  ('a1000000-0000-0000-0000-000000000011'::uuid,'Barbell Bench Press',          'push', 1,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000011'::uuid,'Barbell Overhead Press',       'push', 2,'3','6-10'),
  ('a1000000-0000-0000-0000-000000000011'::uuid,'Cable Lateral Raise',          'push', 3,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000011'::uuid,'Cable Tricep Pushdown',        'push', 4,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000011'::uuid,'Barbell Row',                  'pull', 5,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000011'::uuid,'Lat Pulldown',                 'pull', 6,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000011'::uuid,'Seated Cable Row',             'pull', 7,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000011'::uuid,'Barbell Curl',                 'pull', 8,'3','8-12'),
  -- bro-split-gym (012)
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Barbell Bench Press',     'chest',      1,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Incline Barbell Press',   'chest',      2,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Cable Fly',               'chest',      3,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Machine Chest Press',     'chest',      4,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Pec Deck',                'chest',      5,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Deadlift',                'back',       6,'4','4-6'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Barbell Row',             'back',       7,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Lat Pulldown',            'back',       8,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Seated Cable Row',        'back',       9,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Pull-Up',                 'back',      10,'3','to failure'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Barbell Overhead Press',  'shoulders', 11,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Lateral Raise',           'shoulders', 12,'4','12-16'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Rear Delt Fly',           'shoulders', 13,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Face Pull',               'shoulders', 14,'3','15-20'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Arnold Press',            'shoulders', 15,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Barbell Curl',            'arms',      16,'4','8-12'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Tricep Pushdown',         'arms',      17,'4','10-14'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Skull Crusher',           'arms',      18,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Cable Curl',              'arms',      19,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Dips',                    'arms',      20,'3','to failure'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Barbell Squat',           'legs',      21,'4','5-8'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Leg Press',               'legs',      22,'3','10-15'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Romanian Deadlift',       'legs',      23,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Leg Curl Machine',        'legs',      24,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Leg Extension Machine',   'legs',      25,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000012'::uuid,'Calf Raise Machine',      'legs',      26,'4','15-20'),
  -- arnold-split-gym (013)
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Barbell Bench Press',     'chest',      1,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Incline Barbell Press',   'chest',      2,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Cable Fly',               'chest',      3,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Pec Deck',                'chest',      4,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Deadlift',                'back',       5,'4','4-6'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Barbell Row',             'back',       6,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Lat Pulldown',            'back',       7,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Seated Cable Row',        'back',       8,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Barbell Overhead Press',  'shoulders',  9,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Arnold Press',            'shoulders', 10,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Lateral Raise',           'shoulders', 11,'4','12-16'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Face Pull',               'shoulders', 12,'3','15-20'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Barbell Curl',            'arms',      13,'4','8-12'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Tricep Pushdown',         'arms',      14,'4','10-14'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Skull Crusher',           'arms',      15,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'EZ-Bar Curl',             'arms',      16,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Barbell Squat',           'legs',      17,'4','5-8'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Leg Press',               'legs',      18,'3','10-15'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Romanian Deadlift',       'legs',      19,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Leg Curl Machine',        'legs',      20,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000013'::uuid,'Calf Raise Machine',      'legs',      21,'4','15-20'),
  -- arnold-split-home (014)
  ('a1000000-0000-0000-0000-000000000014'::uuid,'Barbell Bench Press',      'chest',      1,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'Incline Barbell Press',    'chest',      2,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'Dumbbell Bench Press',     'chest',      3,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'Chest Fly',                'chest',      4,'3','12-15'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'Deadlift',                 'back',       5,'4','4-6'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'Barbell Row',              'back',       6,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'DB Single-Arm Row',        'back',       7,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'DB Reverse Fly',           'back',       8,'3','12-16'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'Barbell Overhead Press',   'shoulders',  9,'4','6-10'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'DB Overhead Press',        'shoulders', 10,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'DB Lateral Raise',         'shoulders', 11,'4','12-16'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'DB Face Pull bent-over',   'shoulders', 12,'3','15-20'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'Barbell Curl',             'arms',      13,'4','8-12'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'DB Tricep Overhead Extension','arms',   14,'3','10-15'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'DB Bicep Curl',            'arms',      15,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'DB Hammer Curl',           'arms',      16,'3','10-14'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'Barbell Squat',            'legs',      17,'4','5-8'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'Romanian Deadlift',        'legs',      18,'3','8-12'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'DB Bulgarian Split Squat', 'legs',      19,'3','10-12 per leg'),
  ('a1000000-0000-0000-0000-000000000014'::uuid,'DB Calf Raise',            'legs',      20,'3','15-20')
) AS t(tid, ename, wt, ord, sets, reps)
JOIN exercises e ON e.name = t.ename AND e.user_id IS NULL
ON CONFLICT (template_id, "order") DO NOTHING;
