# Routine Templates + Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 14 global routine templates, a 5-step onboarding modal with recommendation engine, and a Templates tab in the Library.

**Architecture:** New `routine_templates` + `template_exercises` DB tables hold global templates. `cloneTemplate` server action deep-copies a template into the user's own routine. A pure `recommendTemplate` function maps onboarding answers → template slug. `workout_type` column on `routine_exercises` replaces category-derived tab grouping, enabling arbitrary splits (Bro Split, Arnold Split). `routineExercisesByType` becomes `Partial<Record<WorkoutType, RoutineExercise[]>>` and WorkoutTabs renders dynamically.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind v4, Supabase (Postgres + RLS), SWR, Vitest + Testing Library, bun

---

## File Map

| File | Action |
|---|---|
| `docs/migrations/2026-05-27-routine-templates.sql` | Create |
| `src/lib/pulse/types.ts` | Modify |
| `src/lib/pulse/__tests__/types.test.ts` | Create |
| `src/lib/pulse/recommendation.ts` | Create |
| `src/lib/pulse/__tests__/recommendation.test.ts` | Create |
| `src/app/pulse/actions.ts` | Modify |
| `src/app/api/pulse/templates/route.ts` | Create |
| `src/app/api/pulse/profile/route.ts` | Modify |
| `src/app/api/pulse/routines/route.ts` | Modify |
| `src/app/pulse/page.tsx` | Modify |
| `src/hooks/pulse/useRoutines.ts` | Modify |
| `src/context/PulseContext.ts` | Modify |
| `src/components/pulse/PulseProvider.tsx` | Modify |
| `src/components/pulse/WorkoutTabs.tsx` | Modify |
| `src/components/pulse/views/LogView.tsx` | Modify |
| `src/components/pulse/views/LibraryView.tsx` | Modify |
| `src/components/pulse/views/TemplatesTab.tsx` | Create |
| `src/components/pulse/__tests__/TemplatesTab.test.tsx` | Create |
| `src/components/pulse/OnboardingModal.tsx` | Create |
| `src/components/pulse/__tests__/OnboardingModal.test.tsx` | Create |
| `src/components/pulse/AppShell.tsx` | Modify |
| `src/components/pulse/views/ProfileView.tsx` | Modify |

---

## Task 1: SQL Migration

**Files:** Create `docs/migrations/2026-05-27-routine-templates.sql`

> **CRITICAL order:** `routine_exercises.workout_type` backfill (step 2) must run BEFORE recategorising `exercises.category` (steps 3–5). The backfill uses old values `push/pull/legs`.

- [ ] Write the full migration file:

```sql
-- ============================================================
-- Migration: routine-templates
-- 2026-05-27
-- ============================================================

-- STEP 1: Add workout_type to routine_exercises
-- DEFAULT 'push' satisfies NOT NULL on existing rows; app always supplies it going forward.
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
-- legs exercises: DB Goblet Squat, DB Sumo Squat, DB Romanian Deadlift,
-- DB Leg Curl lying on bench, Barbell Squat, Leg Press, Leg Extension Machine,
-- Leg Curl Machine already have category 'legs' — no update needed.

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

-- STEP 6: Add new exercises category CHECK constraint
ALTER TABLE exercises ADD CONSTRAINT exercises_category_check
  CHECK (category IN ('chest','shoulders','triceps','back','biceps','legs','glutes','calves','abs','other'));

-- STEP 7: Add onboarding_completed to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- STEP 8: Create routine_templates table
CREATE TABLE IF NOT EXISTS routine_templates (
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
CREATE TABLE IF NOT EXISTS template_exercises (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id  uuid REFERENCES routine_templates(id) ON DELETE CASCADE NOT NULL,
  exercise_id  uuid REFERENCES exercises(id) NOT NULL,
  workout_type text NOT NULL CHECK (workout_type IN ('push','pull','legs','chest','back','shoulders','arms')),
  "order"      integer NOT NULL,
  sets         text NOT NULL,
  reps         text NOT NULL
);

-- STEP 10: Enable RLS
ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine_templates_select" ON routine_templates FOR SELECT TO authenticated USING (true);
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
-- Exercise name substitutions vs spec Appendix:
--   "Face Pull (cable)"        → "Face Pull"
--   "Barbell Romanian Deadlift"→ "Romanian Deadlift"
--   "Cable Row"                → "Seated Cable Row"
--   "Chest Fly Machine"        → "Pec Deck"
--   "Cable Hammer Curl"        → "Cable Curl"
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
JOIN exercises e ON e.name = t.ename AND e.user_id IS NULL;
```

- [ ] Apply in Supabase SQL Editor
- [ ] Verify counts:

```sql
SELECT COUNT(*) FROM routine_templates;         -- expect 14
SELECT COUNT(*) FROM template_exercises;        -- expect 180
SELECT COUNT(*) FROM exercises WHERE user_id IS NULL; -- expect ~100+
```

- [ ] Commit: `git add docs/migrations/2026-05-27-routine-templates.sql && git commit -m "feat(pulse): add routine-templates migration"`

---

## Task 2: TypeScript Types

**Files:** Modify `src/lib/pulse/types.ts`, Create `src/lib/pulse/__tests__/types.test.ts`

- [ ] Write failing tests first:

```ts
// src/lib/pulse/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import { defaultWorkoutType, templateMatchesEquipment } from '../types';

describe('defaultWorkoutType', () => {
  it('maps chest → chest', () => expect(defaultWorkoutType('chest')).toBe('chest'));
  it('maps shoulders → shoulders', () => expect(defaultWorkoutType('shoulders')).toBe('shoulders'));
  it('maps triceps → arms', () => expect(defaultWorkoutType('triceps')).toBe('arms'));
  it('maps back → back', () => expect(defaultWorkoutType('back')).toBe('back'));
  it('maps biceps → arms', () => expect(defaultWorkoutType('biceps')).toBe('arms'));
  it('maps legs → legs', () => expect(defaultWorkoutType('legs')).toBe('legs'));
  it('maps glutes → legs', () => expect(defaultWorkoutType('glutes')).toBe('legs'));
  it('maps calves → legs', () => expect(defaultWorkoutType('calves')).toBe('legs'));
  it('maps abs → null', () => expect(defaultWorkoutType('abs')).toBeNull());
  it('maps other → null', () => expect(defaultWorkoutType('other')).toBeNull());
});

describe('templateMatchesEquipment', () => {
  const t = { required_equipment: ['dumbbells', 'barbell'] } as any;
  it('matches when user has all required', () =>
    expect(templateMatchesEquipment(t, new Set(['dumbbells','barbell','bench']))).toBe(true));
  it('rejects when user missing one', () =>
    expect(templateMatchesEquipment(t, new Set(['dumbbells']))).toBe(false));
  it('matches exact set', () =>
    expect(templateMatchesEquipment(t, new Set(['dumbbells','barbell']))).toBe(true));
});
```

- [ ] Run: `bun run test src/lib/pulse/__tests__/types.test.ts` → FAIL (functions not exported yet)

- [ ] Replace contents of `src/lib/pulse/types.ts`. Keep all existing interfaces, add/change only what's listed:

```ts
// Change WorkoutType:
export type WorkoutType = 'push' | 'pull' | 'legs' | 'chest' | 'back' | 'shoulders' | 'arms';

// Change ExerciseCategory:
export type ExerciseCategory =
  | 'chest' | 'shoulders' | 'triceps'
  | 'back' | 'biceps'
  | 'legs' | 'glutes' | 'calves'
  | 'abs' | 'other';

// Add to Profile interface:
//   onboarding_completed: boolean;

// Add to RoutineExercise interface:
//   workout_type: WorkoutType;

// Add new types and functions at the bottom of the file:
export type EquipmentKey = 'dumbbells' | 'barbell' | 'bench' | 'cables' | 'machines';

export interface RoutineTemplate {
  id: string;
  name: string;
  slug: string;
  required_equipment: EquipmentKey[];
  days_per_week: string;
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  session_time: string;
  description: string;
}

export function defaultWorkoutType(cat: ExerciseCategory): WorkoutType | null {
  const map: Record<ExerciseCategory, WorkoutType | null> = {
    chest: 'chest', shoulders: 'shoulders', triceps: 'arms',
    back: 'back', biceps: 'arms',
    legs: 'legs', glutes: 'legs', calves: 'legs',
    abs: null, other: null,
  };
  return map[cat];
}

export function templateMatchesEquipment(
  template: Pick<RoutineTemplate, 'required_equipment'>,
  userEquipment: Set<EquipmentKey>,
): boolean {
  return template.required_equipment.every((e) => userEquipment.has(e));
}
```

Full updated `src/lib/pulse/types.ts`:

```ts
export interface LogEntry {
    kg: number;
    reps: number;
    rir: number;
    saved: boolean;
}

export type Logs = Record<string, LogEntry>;

export type WorkoutType = 'push' | 'pull' | 'legs' | 'chest' | 'back' | 'shoulders' | 'arms';

export type Unit = 'kg' | 'lbs';

export interface Profile {
    display_name: string | null;
    unit: Unit;
    active_routine_id: string | null;
    onboarding_completed: boolean;
}

export interface BodyweightEntry {
    id: string;
    logged_at: string;
    weight_kg: number;
}

export interface Phase {
    weeks: number[];
    label: string;
    subtitle: string;
    rir: number[];
    color: string;
}

export interface Exercise {
    name: string;
    sets: string;
    reps: string;
    load: string;
    note: string;
}

export interface Workout {
    label: string;
    icon: string;
    color: string;
    description: string;
    exercises: Exercise[];
}

export interface VolumeEntry {
    week: number;
    sets: number;
}

export interface ScheduleDay {
    day: string;
    type: WorkoutType | 'rest';
}

export interface HistorySession {
    week: number;
    sets: Array<LogEntry & { routineExerciseId: string; setIdx: number }>;
}

export type View = 'log' | 'program' | 'history' | 'profile' | 'library';

export type PRMap = Record<string, number>;

export type ExerciseCategory =
  | 'chest' | 'shoulders' | 'triceps'
  | 'back' | 'biceps'
  | 'legs' | 'glutes' | 'calves'
  | 'abs' | 'other';

export interface DbExercise {
    id: string;
    name: string;
    category: ExerciseCategory;
    default_sets: string;
    default_reps: string;
    user_id: string | null;
}

export interface WorkoutRoutine {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
}

export interface RoutineExercise {
    id: string;
    routine_id: string;
    exercise_id: string;
    workout_type: WorkoutType;
    order: number;
    sets: string;
    reps: string;
    starting_weight_kg: number | null;
    exercise: DbExercise;
}

export interface RoutineWithExercises extends WorkoutRoutine {
    exercises: RoutineExercise[];
}

export type EquipmentKey = 'dumbbells' | 'barbell' | 'bench' | 'cables' | 'machines';

export interface RoutineTemplate {
    id: string;
    name: string;
    slug: string;
    required_equipment: EquipmentKey[];
    days_per_week: string;
    experience_level: 'beginner' | 'intermediate' | 'advanced';
    session_time: string;
    description: string;
}

export function defaultWorkoutType(cat: ExerciseCategory): WorkoutType | null {
    const map: Record<ExerciseCategory, WorkoutType | null> = {
        chest: 'chest', shoulders: 'shoulders', triceps: 'arms',
        back: 'back', biceps: 'arms',
        legs: 'legs', glutes: 'legs', calves: 'legs',
        abs: null, other: null,
    };
    return map[cat];
}

export function templateMatchesEquipment(
    template: Pick<RoutineTemplate, 'required_equipment'>,
    userEquipment: Set<EquipmentKey>,
): boolean {
    return template.required_equipment.every((e) => userEquipment.has(e));
}
```

- [ ] Run: `bun run test src/lib/pulse/__tests__/types.test.ts` → PASS
- [ ] Run: `bun run typecheck` — fix all type errors from the changed `WorkoutType` and `ExerciseCategory` (there will be many)
- [ ] Commit: `git add src/lib/pulse/types.ts src/lib/pulse/__tests__/types.test.ts && git commit -m "feat(pulse): expand WorkoutType, ExerciseCategory, add RoutineTemplate type"`

---

## Task 3: Server Actions

**Files:** Modify `src/app/pulse/actions.ts`

- [ ] Update `VALID_CATEGORIES` constant at line 174:

```ts
const VALID_CATEGORIES: ExerciseCategory[] = [
  'chest','shoulders','triceps','back','biceps','legs','glutes','calves','abs','other',
];
```

- [ ] Add `workoutType: WorkoutType` parameter to `addExerciseToRoutine`. Change the signature and insert:

```ts
export async function addExerciseToRoutine(
    routineId: string,
    exerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    workoutType: WorkoutType,
): Promise<RoutineExercise> {
```

And in the insert body add `workout_type: workoutType` to the object, and add `workout_type` to the select string:

```ts
    .insert({
        routine_id: routineId,
        exercise_id: exerciseId,
        workout_type: workoutType,
        order: nextOrder,
        sets,
        reps,
        starting_weight_kg: startingWeightKg,
    })
    .select('id, routine_id, exercise_id, workout_type, order, sets, reps, starting_weight_kg, exercise:exercises ( id, name, category, default_sets, default_reps, user_id )')
```

Also add `WorkoutType` to the import line at top of file.

- [ ] Add `cloneTemplate` server action after `reorderRoutineExercises`:

```ts
export async function cloneTemplate(slug: string): Promise<WorkoutRoutine> {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid slug');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: template } = await supabase
        .from('routine_templates')
        .select('id, name, template_exercises(exercise_id, workout_type, order, sets, reps)')
        .eq('slug', slug)
        .single();
    if (!template) throw new Error('Template not found');

    const { data: routine, error: routineErr } = await supabase
        .from('workout_routines')
        .insert({ user_id: user.id, name: template.name })
        .select('id, user_id, name, created_at')
        .single();
    if (routineErr || !routine) throw new Error('Failed to create routine');

    const exercises = (template as any).template_exercises as Array<{
        exercise_id: string; workout_type: string; order: number; sets: string; reps: string;
    }>;

    if (exercises.length > 0) {
        await supabase.from('routine_exercises').insert(
            exercises.map((te) => ({
                routine_id: routine.id,
                exercise_id: te.exercise_id,
                workout_type: te.workout_type,
                order: te.order,
                sets: te.sets,
                reps: te.reps,
                starting_weight_kg: null,
            })),
        );
    }

    await supabase.from('profiles').update({ active_routine_id: routine.id }).eq('id', user.id);
    revalidatePath('/pulse');
    return routine as WorkoutRoutine;
}
```

- [ ] Add `completeOnboarding` server action:

```ts
export async function completeOnboarding(): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
    revalidatePath('/pulse');
}
```

- [ ] Run: `bun run typecheck` → no errors in `actions.ts`
- [ ] Commit: `git add src/app/pulse/actions.ts && git commit -m "feat(pulse): add cloneTemplate and completeOnboarding server actions"`

---

## Task 4: API Routes + Data Layer

**Files:** Create `src/app/api/pulse/templates/route.ts`, modify `src/app/api/pulse/profile/route.ts`, `src/app/api/pulse/routines/route.ts`, `src/app/pulse/page.tsx`

- [ ] Create `src/app/api/pulse/templates/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });
    const { data } = await supabase
        .from('routine_templates')
        .select('*')
        .order('experience_level');
    return NextResponse.json(data ?? []);
}
```

- [ ] In `src/app/api/pulse/profile/route.ts` — add `onboarding_completed` to select and profile construction:

```ts
// Change select string:
.select('display_name, unit, active_routine_id, onboarding_completed')

// Change profile construction:
const profile: Profile = {
    display_name: data?.display_name ?? null,
    unit: data?.unit === 'lbs' ? 'lbs' : 'kg',
    active_routine_id: data?.active_routine_id ?? null,
    onboarding_completed: data?.onboarding_completed ?? false,
};
```

- [ ] In `src/app/api/pulse/routines/route.ts` — add `workout_type` to the `routine_exercises` select string:

```ts
// Change the nested select inside routine_exercises from:
//   id, routine_id, exercise_id, order, sets, reps, starting_weight_kg,
// to:
//   id, routine_id, exercise_id, workout_type, order, sets, reps, starting_weight_kg,
```

- [ ] In `src/app/pulse/page.tsx` — make 4 changes:

```ts
// 1. Profile select — add onboarding_completed:
supabase.from('profiles').select('display_name, unit, active_routine_id, onboarding_completed').eq('id', user.id).single(),

// 2. Routines select — add workout_type to routine_exercises:
exercises:routine_exercises (
    id, routine_id, exercise_id, workout_type, order, sets, reps, starting_weight_kg,
    exercise:exercises ( id, name, category, default_sets, default_reps, user_id )
)

// 3. Profile construction — add onboarding_completed:
const profile: Profile = {
    display_name: profileRow?.display_name ?? null,
    unit: profileRow?.unit === 'lbs' ? 'lbs' : 'kg',
    active_routine_id: profileRow?.active_routine_id ?? null,
    onboarding_completed: profileRow?.onboarding_completed ?? false,
};

// 4. Routines mapping — exercises already include workout_type via the select; no extra mapping needed
//    (RoutineWithExercises shape now includes workout_type on each RoutineExercise)
```

- [ ] Run: `bun run typecheck` → no errors
- [ ] Commit: `git add src/app/api/pulse/templates/route.ts src/app/api/pulse/profile/route.ts src/app/api/pulse/routines/route.ts src/app/pulse/page.tsx && git commit -m "feat(pulse): add templates API route, include workout_type and onboarding_completed in data layer"`

---

## Task 5: useRoutines Hook

**Files:** Modify `src/hooks/pulse/useRoutines.ts`

- [ ] Add new server action imports at top of file:

```ts
import {
    // ... existing imports ...
    cloneTemplate as serverCloneTemplate,
    completeOnboarding as serverCompleteOnboarding,
} from '@/app/pulse/actions';
import type { WorkoutType } from '@/lib/pulse/types';
```

- [ ] Update `addExerciseToRoutine` callback signature and call to pass `workoutType`:

```ts
const addExerciseToRoutine = useCallback(async (
    routineId: string,
    exerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    workoutType: WorkoutType,
): Promise<RoutineExercise> => {
    const re = await serverAddExerciseToRoutine(routineId, exerciseId, sets, reps, startingWeightKg, workoutType);
    await mutateRoutines();
    return re;
}, [mutateRoutines]);
```

- [ ] Add `cloneTemplate` callback after `reorderRoutineExercises`:

```ts
const cloneTemplate = useCallback(async (slug: string): Promise<WorkoutRoutine> => {
    const routine = await serverCloneTemplate(slug);
    await mutateRoutines();
    await globalMutate(PROFILE_KEY);
    return routine;
}, [mutateRoutines, globalMutate]);
```

- [ ] Add `completeOnboarding` callback:

```ts
const completeOnboarding = useCallback(async (): Promise<void> => {
    await serverCompleteOnboarding();
    await globalMutate(PROFILE_KEY);
}, [globalMutate]);
```

- [ ] Add both to the return object of `useRoutines`.

- [ ] Run: `bun run typecheck` → no errors in `useRoutines.ts`
- [ ] Commit: `git add src/hooks/pulse/useRoutines.ts && git commit -m "feat(pulse): wire cloneTemplate and completeOnboarding into useRoutines"`

---

## Task 6: PulseContext + PulseProvider

**Files:** Modify `src/context/PulseContext.ts`, `src/components/pulse/PulseProvider.tsx`

- [ ] In `PulseContext.ts` — update the interface:

```ts
// Change routineExercisesByType type:
routineExercisesByType: Partial<Record<WorkoutType, RoutineExercise[]>>;

// Update addExerciseToRoutine signature:
addExerciseToRoutine: (
    routineId: string,
    exerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    workoutType: WorkoutType,
) => Promise<RoutineExercise>;

// Add after reorderRoutineExercises:
cloneTemplate: (slug: string) => Promise<WorkoutRoutine>;
completeOnboarding: () => Promise<void>;

// Add to UI state section:
showOnboarding: boolean;
triggerOnboarding: () => void;
dismissOnboarding: () => void;
```

Also add `RoutineTemplate` to the imports at the top (it's needed by components that read context).

- [ ] In `PulseProvider.tsx`:

Add `useState` to the React import.

Add `cloneTemplate`, `completeOnboarding` to the destructuring from `useRoutines`:

```ts
const {
    exercises, routines, activeRoutine,
    createRoutine, deleteRoutine, setActiveRoutine,
    addExerciseToRoutine, removeExerciseFromRoutine,
    updateRoutineExercise, reorderRoutineExercises,
    cloneTemplate, completeOnboarding,
    createExercise, updateExercise, deleteExercise,
} = useRoutines(initialExercises, initialRoutines, profile.active_routine_id);
```

Replace the `routineExercisesByType` memo:

```ts
const routineExercisesByType = useMemo((): Partial<Record<WorkoutType, RoutineExercise[]>> => {
    if (!activeRoutine) return {};
    const sorted = [...activeRoutine.exercises].sort((a, b) => a.order - b.order);
    const result: Partial<Record<WorkoutType, RoutineExercise[]>> = {};
    for (const re of sorted) {
        const type = re.workout_type;
        (result[type] ??= []).push(re);
    }
    return result;
}, [activeRoutine]);
```

Add onboarding override state (after existing useState-using hooks):

```ts
const [onboardingOverride, setOnboardingOverride] = useState<boolean | null>(null);
const showOnboarding = onboardingOverride ??
    (!profile.onboarding_completed && routines.length === 0);
const triggerOnboarding = useCallback(() => setOnboardingOverride(true), []);
const dismissOnboarding = useCallback(() => setOnboardingOverride(false), []);
```

Add the new values to `contextValue` memo (both the value and the dependency array):
`cloneTemplate, completeOnboarding, showOnboarding, triggerOnboarding, dismissOnboarding`

- [ ] Run: `bun run typecheck` → no errors
- [ ] Commit: `git add src/context/PulseContext.ts src/components/pulse/PulseProvider.tsx && git commit -m "feat(pulse): dynamic routineExercisesByType, onboarding state in PulseProvider"`

---

## Task 7: WorkoutTabs + LogView

**Files:** Modify `src/components/pulse/WorkoutTabs.tsx`, `src/components/pulse/views/LogView.tsx`

- [ ] Replace `src/components/pulse/WorkoutTabs.tsx` with dynamic tab rendering:

```ts
'use client';
import { useEffect } from 'react';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import type { WorkoutType } from '@/lib/pulse/types';

const LABELS: Record<WorkoutType, string> = {
    push: 'Push', pull: 'Pull', legs: 'Legs',
    chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
};
const ORDER: WorkoutType[] = ['push','pull','legs','chest','back','shoulders','arms'];

export default function WorkoutTabs() {
    const { activeTab, setActiveTab, routineExercisesByType, logs, activeWeek } = usePulse();
    const tabs = ORDER.filter((t) => routineExercisesByType[t] !== undefined);

    useEffect(() => {
        if (tabs.length > 0 && !tabs.includes(activeTab as WorkoutType)) {
            setActiveTab(tabs[0]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabs.join(',')]);

    function handleKeyDown(e: React.KeyboardEvent, idx: number) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            setActiveTab(tabs[(idx + 1) % tabs.length]);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length]);
        }
    }

    return (
        <div role="tablist" className="flex items-center gap-1.5 p-4 pb-3">
            {tabs.map((type, idx) => {
                const active = activeTab === type;
                const exercises = routineExercisesByType[type] ?? [];
                const done = exercises.filter((re) => {
                    const maxSets = parseMaxSets(re.sets);
                    return Array.from({ length: maxSets }, (_, s) => logKey(activeWeek, re.id, s)).every(
                        (k) => logs[k]?.saved,
                    );
                }).length;
                const total = exercises.length;
                return (
                    <button
                        key={type}
                        role="tab"
                        id={`tab-${type}`}
                        aria-selected={active}
                        aria-controls={`panel-${type}`}
                        onClick={() => setActiveTab(type)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        className={`flex items-center gap-2 py-2 px-4 rounded-full border cursor-pointer transition-all duration-150 ${
                            active
                                ? 'bg-pulse-accent/10 border-pulse-accent/25 text-pulse-accent'
                                : 'bg-transparent border-pulse-border text-pulse-dim hover:text-pulse-text'
                        }`}>
                        <span className="font-pulse text-sm font-semibold">{LABELS[type]}</span>
                        {total > 0 && (
                            <span className={`font-pulse text-xs rounded-full px-1.5 py-0.5 ${
                                active ? 'bg-pulse-accent/15 text-pulse-accent' : 'bg-pulse-surface-2 text-pulse-dim'
                            }`}>
                                {done}/{total}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] In `src/components/pulse/views/LogView.tsx` line 26 — guard the array access:

```ts
// Change:
const routineExercises = routineExercisesByType[activeTab];
// To:
const routineExercises = routineExercisesByType[activeTab] ?? [];
```

- [ ] Run existing WorkoutTabs tests: `bun run test src/components/pulse/__tests__/WorkoutTabs.test.tsx`
  - Update the mock context: change `routineExercisesByType` from `Record<WorkoutType, RoutineExercise[]>` to `Partial<Record<WorkoutType, RoutineExercise[]>>`
  - Update tests that check for exactly 3 tabs — now tabs are dynamic based on which keys are present
  - Expected: all tests PASS

- [ ] Run: `bun run typecheck` → no errors
- [ ] Commit: `git add src/components/pulse/WorkoutTabs.tsx src/components/pulse/views/LogView.tsx src/components/pulse/__tests__/WorkoutTabs.test.tsx && git commit -m "feat(pulse): dynamic WorkoutTabs, guard undefined in LogView"`

---

## Task 8: LibraryView — Categories + Workout Type Selector

**Files:** Modify `src/components/pulse/views/LibraryView.tsx`

- [ ] Update `CATEGORIES` constant at the top of the file:

```ts
const CATEGORIES: ExerciseCategory[] = [
    'chest','shoulders','triceps','back','biceps','legs','glutes','calves','abs','other',
];
```

- [ ] Replace `CATEGORY_COLOR` map:

```ts
const CATEGORY_COLOR: Record<ExerciseCategory, string> = {
    chest: 'text-rose-400',
    shoulders: 'text-orange-400',
    triceps: 'text-amber-400',
    back: 'text-sky-400',
    biceps: 'text-indigo-400',
    legs: 'text-violet-400',
    glutes: 'text-pink-400',
    calves: 'text-teal-400',
    abs: 'text-lime-400',
    other: 'text-pulse-dim',
};
```

- [ ] In `RoutinesTab`, find the "Add exercise" form state and add `workout_type` state and auto-suggestion. Look for the state variables near the top of `RoutinesTab` and add:

```ts
const [addWorkoutType, setAddWorkoutType] = useState<WorkoutType>('push');
```

Add an effect after the exercise-selection state to suggest a default workout type:

```ts
const selectedEx = exercises.find((e) => e.id === pickExerciseId);
useEffect(() => {
    if (selectedEx) {
        const suggested = defaultWorkoutType(selectedEx.category as ExerciseCategory);
        if (suggested) setAddWorkoutType(suggested);
    }
}, [pickExerciseId]);
```

Add a `<select>` for workout type in the add-exercise form (after the exercise `<select>`):

```tsx
<select
    aria-label="Workout type"
    value={addWorkoutType}
    onChange={(e) => setAddWorkoutType(e.target.value as WorkoutType)}
    className={INPUT}>
    {(['push','pull','legs','chest','back','shoulders','arms'] as WorkoutType[]).map((wt) => (
        <option key={wt} value={wt}>{wt.charAt(0).toUpperCase() + wt.slice(1)}</option>
    ))}
</select>
```

Pass `addWorkoutType` as the final argument when calling `addExerciseToRoutine`.

- [ ] Add `'templates'` to the tab type union and render `<TemplatesTab />`:

```ts
// Find the tab type definition (e.g. type LibraryTab = 'exercises' | 'routines')
// Change to:
type LibraryTab = 'exercises' | 'routines' | 'templates';
```

In the tab button row, add a Templates button using the same style as existing tabs.

In the tab content area, add:
```tsx
{activeLibraryTab === 'templates' && <TemplatesTab />}
```

Import `TemplatesTab` at the top:
```ts
import TemplatesTab from './TemplatesTab';
```

Also import `defaultWorkoutType` from `@/lib/pulse/types` and add `WorkoutType` to existing type imports.

- [ ] Run: `bun run typecheck` → no errors in `LibraryView.tsx`
- [ ] Commit: `git add src/components/pulse/views/LibraryView.tsx && git commit -m "feat(pulse): update exercise categories, add workout_type selector and Templates tab to LibraryView"`

---

## Task 9: TemplatesTab Component + Tests

**Files:** Create `src/components/pulse/views/TemplatesTab.tsx`, `src/components/pulse/__tests__/TemplatesTab.test.tsx`

- [ ] Write failing tests first — `src/components/pulse/__tests__/TemplatesTab.test.tsx`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TemplatesTab from '../views/TemplatesTab';
import type { RoutineTemplate } from '@/lib/pulse/types';

vi.mock('swr', () => ({
    default: vi.fn(),
}));
vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import useSWR from 'swr';
import { usePulse } from '@/context/PulseContext';

const mockCloneTemplate = vi.fn().mockResolvedValue({});
const mockNavigate = vi.fn();

const templates: RoutineTemplate[] = [
    {
        id: '1', name: 'Full Body — Dumbbells', slug: 'full-body-db',
        required_equipment: ['dumbbells'], days_per_week: '2-3',
        experience_level: 'beginner', session_time: '30-45 min',
        description: 'One session works everything.',
    },
    {
        id: '2', name: 'PPL — Gym', slug: 'ppl-gym',
        required_equipment: ['barbell','bench','cables','machines'], days_per_week: '3-6',
        experience_level: 'intermediate', session_time: '60-90 min',
        description: 'Classic PPL with full gym access.',
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    (useSWR as any).mockReturnValue({ data: templates });
    (usePulse as any).mockReturnValue({
        cloneTemplate: mockCloneTemplate,
        navigate: mockNavigate,
        routines: [],
    });
});

describe('TemplatesTab', () => {
    it('renders all templates when filter is All', () => {
        render(<TemplatesTab />);
        expect(screen.getByText('Full Body — Dumbbells')).toBeInTheDocument();
        expect(screen.getByText('PPL — Gym')).toBeInTheDocument();
    });

    it('filters to dumbbells-only templates', () => {
        render(<TemplatesTab />);
        fireEvent.click(screen.getByText('Dumbbells'));
        expect(screen.getByText('Full Body — Dumbbells')).toBeInTheDocument();
        expect(screen.queryByText('PPL — Gym')).not.toBeInTheDocument();
    });

    it('clones template and navigates when no active routine', async () => {
        render(<TemplatesTab />);
        const buttons = screen.getAllByText('Use this');
        fireEvent.click(buttons[0]);
        await waitFor(() => expect(mockCloneTemplate).toHaveBeenCalledWith('full-body-db'));
        expect(mockNavigate).toHaveBeenCalledWith('log');
    });

    it('shows confirm dialog when user already has a routine', async () => {
        (usePulse as any).mockReturnValue({
            cloneTemplate: mockCloneTemplate,
            navigate: mockNavigate,
            routines: [{ id: 'r1', name: 'My Routine' }],
        });
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        render(<TemplatesTab />);
        fireEvent.click(screen.getAllByText('Use this')[0]);
        expect(confirmSpy).toHaveBeenCalled();
        expect(mockCloneTemplate).not.toHaveBeenCalled();
    });
});
```

- [ ] Run: `bun run test src/components/pulse/__tests__/TemplatesTab.test.tsx` → FAIL (component doesn't exist)

- [ ] Create `src/components/pulse/views/TemplatesTab.tsx`:

```tsx
'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { usePulse } from '@/context/PulseContext';
import { templateMatchesEquipment } from '@/lib/pulse/types';
import type { RoutineTemplate, EquipmentKey } from '@/lib/pulse/types';

type EquipmentFilter = 'all' | 'dumbbells' | 'home' | 'gym';

const FILTER_EQUIPMENT: Record<Exclude<EquipmentFilter,'all'>, Set<EquipmentKey>> = {
    dumbbells: new Set(['dumbbells']),
    home: new Set(['dumbbells','barbell','bench']),
    gym: new Set(['barbell','bench','cables','machines']),
};

const FILTER_LABELS: Record<EquipmentFilter, string> = {
    all: 'All', dumbbells: 'Dumbbells', home: 'Home Gym', gym: 'Full Gym',
};

const LEVEL_CLASS: Record<RoutineTemplate['experience_level'], string> = {
    beginner: 'text-emerald-400',
    intermediate: 'text-amber-400',
    advanced: 'text-red-400',
};

export default function TemplatesTab() {
    const { cloneTemplate, navigate, routines } = usePulse();
    const { data: templates = [] } = useSWR<RoutineTemplate[]>(
        '/api/pulse/templates',
        (url: string) => fetch(url).then((r) => r.json()),
    );
    const [filter, setFilter] = useState<EquipmentFilter>('all');
    const [loading, setLoading] = useState<string | null>(null);

    const visible = filter === 'all'
        ? templates
        : templates.filter((t) => templateMatchesEquipment(t, FILTER_EQUIPMENT[filter]));

    async function handleUse(t: RoutineTemplate) {
        if (
            routines.length > 0 &&
            !window.confirm(`This will replace your active routine with "${t.name}". Continue?`)
        ) return;
        setLoading(t.slug);
        await cloneTemplate(t.slug);
        navigate('log');
        setLoading(null);
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-2 flex-wrap">
                {(['all','dumbbells','home','gym'] as EquipmentFilter[]).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`font-pulse text-xs tracking-[0.04em] capitalize rounded-full px-3 py-1.5 border cursor-pointer ${
                            filter === f
                                ? 'bg-pulse-accent text-black border-pulse-accent font-semibold'
                                : 'bg-transparent text-pulse-dim border-pulse-border'
                        }`}>
                        {FILTER_LABELS[f]}
                    </button>
                ))}
            </div>
            {visible.map((t) => (
                <div key={t.slug} className="bg-pulse-surface border border-pulse-border rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                        <span className="font-pulse text-sm font-semibold text-white">{t.name}</span>
                        <button
                            onClick={() => handleUse(t)}
                            disabled={loading === t.slug}
                            className="font-pulse text-xs font-semibold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/20 rounded-lg px-3 py-1.5 shrink-0 cursor-pointer disabled:opacity-50">
                            {loading === t.slug ? '…' : 'Use this'}
                        </button>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                        <span className={`font-pulse text-[0.625rem] tracking-[0.08em] uppercase ${LEVEL_CLASS[t.experience_level]}`}>
                            {t.experience_level}
                        </span>
                        <span className="font-pulse text-[0.625rem] text-pulse-dim">
                            {t.days_per_week}×/week · {t.session_time}
                        </span>
                    </div>
                    <p className="font-pulse text-xs text-pulse-muted">{t.description}</p>
                </div>
            ))}
        </div>
    );
}
```

- [ ] Run: `bun run test src/components/pulse/__tests__/TemplatesTab.test.tsx` → PASS
- [ ] Commit: `git add src/components/pulse/views/TemplatesTab.tsx src/components/pulse/__tests__/TemplatesTab.test.tsx && git commit -m "feat(pulse): add TemplatesTab component with tests"`

---

## Task 10: Recommendation Engine

**Files:** Create `src/lib/pulse/recommendation.ts`, `src/lib/pulse/__tests__/recommendation.test.ts`

- [ ] Write failing tests first — `src/lib/pulse/__tests__/recommendation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { recommendTemplate, getEquipmentTier } from '../recommendation';
import type { OnboardingAnswers } from '../recommendation';

describe('getEquipmentTier', () => {
    it('returns gym when cables present', () =>
        expect(getEquipmentTier(new Set(['cables']))).toBe('gym'));
    it('returns gym when machines present', () =>
        expect(getEquipmentTier(new Set(['machines','barbell']))).toBe('gym'));
    it('returns home when barbell but no cables/machines', () =>
        expect(getEquipmentTier(new Set(['dumbbells','barbell','bench']))).toBe('home'));
    it('returns db when only dumbbells', () =>
        expect(getEquipmentTier(new Set(['dumbbells']))).toBe('db'));
    it('returns db for bench + dumbbells', () =>
        expect(getEquipmentTier(new Set(['dumbbells','bench']))).toBe('db'));
});

describe('recommendTemplate', () => {
    it('beginner any days → full-body-db (dumbbell tier)', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['dumbbells']),
            experience: 'beginner', goal: 'build_muscle', days: '5-6',
        };
        expect(recommendTemplate(answers)).toBe('full-body-db');
    });
    it('intermediate 2-3 days gym → full-body-gym', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['barbell','bench','cables','machines']),
            experience: 'intermediate', goal: 'build_muscle', days: '2-3',
        };
        expect(recommendTemplate(answers)).toBe('full-body-gym');
    });
    it('intermediate 4 days gym → upper-lower-gym', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['barbell','bench','cables','machines']),
            experience: 'intermediate', goal: 'build_muscle', days: '4',
        };
        expect(recommendTemplate(answers)).toBe('upper-lower-gym');
    });
    it('intermediate 5-6 days home → ppl-home', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['dumbbells','barbell','bench']),
            experience: 'intermediate', goal: 'lose_fat', days: '5-6',
        };
        expect(recommendTemplate(answers)).toBe('ppl-home');
    });
    it('advanced 4 days db → upper-lower-db', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['dumbbells','bench']),
            experience: 'advanced', goal: 'build_muscle', days: '4',
        };
        expect(recommendTemplate(answers)).toBe('upper-lower-db');
    });
    it('general_fitness → null', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['dumbbells']),
            experience: 'intermediate', goal: 'general_fitness', days: '4',
        };
        expect(recommendTemplate(answers)).toBeNull();
    });
});
```

- [ ] Run: `bun run test src/lib/pulse/__tests__/recommendation.test.ts` → FAIL

- [ ] Create `src/lib/pulse/recommendation.ts`:

```ts
import type { EquipmentKey } from './types';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type DaysPerWeek = '2-3' | '4' | '5-6';
export type Goal = 'build_muscle' | 'lose_fat' | 'general_fitness';

export interface OnboardingAnswers {
    equipment: Set<EquipmentKey>;
    experience: ExperienceLevel;
    goal: Goal;
    days: DaysPerWeek;
}

export function getEquipmentTier(equipment: Set<EquipmentKey>): 'db' | 'home' | 'gym' {
    if (equipment.has('cables') || equipment.has('machines')) return 'gym';
    if (equipment.has('barbell')) return 'home';
    return 'db';
}

export function recommendTemplate(answers: OnboardingAnswers): string | null {
    const { experience, goal, days, equipment } = answers;
    if (goal === 'general_fitness') return null;
    const tier = getEquipmentTier(equipment);
    let structure: string;
    if (experience === 'beginner' || days === '2-3') {
        structure = 'full-body';
    } else if (days === '4') {
        structure = 'upper-lower';
    } else {
        structure = 'ppl';
    }
    return `${structure}-${tier}`;
}
```

- [ ] Run: `bun run test src/lib/pulse/__tests__/recommendation.test.ts` → PASS
- [ ] Commit: `git add src/lib/pulse/recommendation.ts src/lib/pulse/__tests__/recommendation.test.ts && git commit -m "feat(pulse): add recommendation engine with unit tests"`

---

## Task 11: OnboardingModal + Tests

**Files:** Create `src/components/pulse/OnboardingModal.tsx`, `src/components/pulse/__tests__/OnboardingModal.test.tsx`

- [ ] Write failing tests first — `src/components/pulse/__tests__/OnboardingModal.test.tsx`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingModal from '../OnboardingModal';

vi.mock('swr', () => ({ default: vi.fn() }));
vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));

import useSWR from 'swr';
import { usePulse } from '@/context/PulseContext';
import type { RoutineTemplate } from '@/lib/pulse/types';

const mockCloneTemplate = vi.fn().mockResolvedValue({});
const mockCompleteOnboarding = vi.fn().mockResolvedValue(undefined);
const mockDismissOnboarding = vi.fn();
const mockNavigate = vi.fn();

const mockTemplates: RoutineTemplate[] = [
    {
        id: '1', name: 'Full Body — Dumbbells', slug: 'full-body-db',
        required_equipment: ['dumbbells'], days_per_week: '2-3',
        experience_level: 'beginner', session_time: '30-45 min',
        description: 'One session works everything.',
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    (useSWR as any).mockReturnValue({ data: mockTemplates });
    (usePulse as any).mockReturnValue({
        cloneTemplate: mockCloneTemplate,
        completeOnboarding: mockCompleteOnboarding,
        dismissOnboarding: mockDismissOnboarding,
        navigate: mockNavigate,
        routines: [],
    });
});

function selectEquipment() {
    fireEvent.click(screen.getByText('Dumbbells'));
}

function advanceToStep2() {
    selectEquipment();
    fireEvent.click(screen.getByText('Next'));
}

describe('OnboardingModal', () => {
    it('renders step 1 with equipment options', () => {
        render(<OnboardingModal />);
        expect(screen.getByText('What equipment do you have access to?')).toBeInTheDocument();
        expect(screen.getByText('Dumbbells')).toBeInTheDocument();
    });

    it('Next is disabled on step 1 until equipment is selected', () => {
        render(<OnboardingModal />);
        expect(screen.getByText('Next')).toBeDisabled();
        selectEquipment();
        expect(screen.getByText('Next')).not.toBeDisabled();
    });

    it('Skip calls dismissOnboarding without cloning', () => {
        render(<OnboardingModal />);
        fireEvent.click(screen.getByText('Skip for now'));
        expect(mockDismissOnboarding).toHaveBeenCalledOnce();
        expect(mockCloneTemplate).not.toHaveBeenCalled();
    });

    it('navigates to step 2 and can go back', () => {
        render(<OnboardingModal />);
        advanceToStep2();
        expect(screen.getByText("What's your training experience?")).toBeInTheDocument();
        fireEvent.click(screen.getByText('←'));
        expect(screen.getByText('What equipment do you have access to?')).toBeInTheDocument();
    });

    it('completes all steps and shows beginner recommendation', async () => {
        render(<OnboardingModal />);
        // Step 1
        selectEquipment();
        fireEvent.click(screen.getByText('Next'));
        // Step 2
        fireEvent.click(screen.getByText('Beginner'));
        fireEvent.click(screen.getByText('Next'));
        // Step 3
        fireEvent.click(screen.getByText('Build muscle'));
        fireEvent.click(screen.getByText('Next'));
        // Step 4
        fireEvent.click(screen.getByText('5–6 days'));
        fireEvent.click(screen.getByText('Next'));
        // Step 5
        fireEvent.click(screen.getByText('45–60 min'));
        fireEvent.click(screen.getByText('See my recommendation'));
        // Result: beginner → full-body-db
        await waitFor(() =>
            expect(screen.getByText(/Recommended for you/i)).toBeInTheDocument()
        );
    });

    it('"Browse all templates" navigates to library and dismisses modal', async () => {
        render(<OnboardingModal />);
        advanceToStep2();
        fireEvent.click(screen.getByText('Beginner'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Build muscle'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('5–6 days'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('45–60 min'));
        fireEvent.click(screen.getByText('See my recommendation'));
        await screen.findByText(/Recommended for you/i);
        fireEvent.click(screen.getByText('Not quite right? Browse all templates'));
        expect(mockNavigate).toHaveBeenCalledWith('library');
        expect(mockDismissOnboarding).toHaveBeenCalled();
    });

    it('"Start with this routine" clones and completes onboarding', async () => {
        render(<OnboardingModal />);
        advanceToStep2();
        fireEvent.click(screen.getByText('Beginner'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Build muscle'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('5–6 days'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('45–60 min'));
        fireEvent.click(screen.getByText('See my recommendation'));
        await screen.findByText(/Recommended for you/i);
        fireEvent.click(screen.getByText('Start with this routine'));
        await waitFor(() => expect(mockCloneTemplate).toHaveBeenCalledWith('full-body-db'));
        await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalled());
    });
});
```

- [ ] Run: `bun run test src/components/pulse/__tests__/OnboardingModal.test.tsx` → FAIL

- [ ] Create `src/components/pulse/OnboardingModal.tsx`:

```tsx
'use client';
import { useState, useTransition } from 'react';
import useSWR from 'swr';
import { usePulse } from '@/context/PulseContext';
import { templateMatchesEquipment } from '@/lib/pulse/types';
import { recommendTemplate } from '@/lib/pulse/recommendation';
import type { EquipmentKey, RoutineTemplate } from '@/lib/pulse/types';
import type { OnboardingAnswers, DaysPerWeek, ExperienceLevel, Goal } from '@/lib/pulse/recommendation';

type Step = 1 | 2 | 3 | 4 | 5 | 'result';

const WRAP = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4';
const CARD = 'bg-pulse-surface border border-pulse-border rounded-2xl w-full max-w-[420px] flex flex-col gap-5 p-6';
const Q = 'font-pulse text-base font-semibold text-white';
const BTN_PRIMARY = 'font-pulse text-sm font-semibold bg-pulse-accent text-black rounded-lg px-5 py-2.5 cursor-pointer border-none disabled:opacity-50 w-full';

function ProgressBar({ current }: { current: number }) {
    return (
        <div className="h-1 bg-pulse-border rounded-full overflow-hidden">
            <div className="h-full bg-pulse-accent rounded-full transition-all" style={{ width: `${current * 20}%` }} />
        </div>
    );
}

function Header({ stepNum, onBack }: { stepNum: number; onBack?: () => void }) {
    return (
        <div className="flex items-center gap-3">
            {onBack
                ? <button onClick={onBack} className="text-pulse-dim cursor-pointer bg-transparent border-none p-0 font-pulse text-sm">←</button>
                : <div className="w-5" />
            }
            <div className="flex-1"><ProgressBar current={stepNum} /></div>
            <span className="font-pulse text-xs text-pulse-muted shrink-0">{stepNum}/5</span>
        </div>
    );
}

function OptionRow({ label, desc, active, onClick }: {
    label: string; desc?: string; active: boolean; onClick: () => void;
}) {
    return (
        <button onClick={onClick} className={`text-left flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors w-full ${
            active ? 'border-pulse-accent bg-pulse-accent/10' : 'border-pulse-border bg-pulse-bg'
        }`}>
            <span className="font-pulse text-sm font-semibold text-white flex-1">{label}</span>
            {desc && <span className="font-pulse text-xs text-pulse-dim">{desc}</span>}
        </button>
    );
}

export default function OnboardingModal() {
    const { cloneTemplate, completeOnboarding, dismissOnboarding, navigate } = usePulse();
    const [, startTransition] = useTransition();
    const [step, setStep] = useState<Step>(1);
    const [equipment, setEquipment] = useState<Set<EquipmentKey>>(new Set());
    const [experience, setExperience] = useState<ExperienceLevel | null>(null);
    const [goal, setGoal] = useState<Goal | null>(null);
    const [days, setDays] = useState<DaysPerWeek | null>(null);
    const [sessionTime, setSessionTime] = useState<string | null>(null);
    const [recommendedSlug, setRecommendedSlug] = useState<string | null | undefined>(undefined);
    const [pickedSlug, setPickedSlug] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { data: templates = [] } = useSWR<RoutineTemplate[]>(
        '/api/pulse/templates',
        (url: string) => fetch(url).then((r) => r.json()),
    );

    function toggleEquipment(key: EquipmentKey) {
        setEquipment((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }

    function goToResult() {
        const slug = recommendTemplate({
            equipment, experience: experience!, goal: goal!, days: days!,
        } as OnboardingAnswers);
        setRecommendedSlug(slug);
        setStep('result');
    }

    function handleStart(slug: string) {
        setLoading(true);
        startTransition(async () => {
            await cloneTemplate(slug);
            await completeOnboarding();
            dismissOnboarding();
            navigate('log');
            setLoading(false);
        });
    }

    const EQUIPMENT_OPTIONS: { key: EquipmentKey; label: string }[] = [
        { key: 'dumbbells', label: 'Dumbbells' },
        { key: 'barbell',   label: 'Barbell & plates' },
        { key: 'bench',     label: 'Weight bench' },
        { key: 'cables',    label: 'Cable machine' },
        { key: 'machines',  label: 'Gym machines (leg press, lat pulldown, etc.)' },
    ];

    if (step === 1) return (
        <div className={WRAP}>
            <div className={CARD}>
                <Header stepNum={1} />
                <p className={Q}>What equipment do you have access to?</p>
                <div className="flex flex-col gap-2">
                    {EQUIPMENT_OPTIONS.map(({ key, label }) => (
                        <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                            equipment.has(key) ? 'border-pulse-accent bg-pulse-accent/10' : 'border-pulse-border bg-pulse-bg'
                        }`}>
                            <input type="checkbox" checked={equipment.has(key)} onChange={() => toggleEquipment(key)} className="sr-only" />
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${equipment.has(key) ? 'border-pulse-accent bg-pulse-accent' : 'border-pulse-dim'}`}>
                                {equipment.has(key) && <span className="text-black text-[10px] font-bold leading-none">✓</span>}
                            </div>
                            <span className="font-pulse text-sm text-white">{label}</span>
                        </label>
                    ))}
                </div>
                <div className="flex flex-col gap-2">
                    <button onClick={() => setStep(2)} disabled={equipment.size === 0} className={BTN_PRIMARY}>Next</button>
                    <button onClick={dismissOnboarding} className="font-pulse text-xs text-pulse-dim text-center bg-transparent border-none cursor-pointer">
                        Skip for now
                    </button>
                </div>
            </div>
        </div>
    );

    if (step === 2) return (
        <div className={WRAP}>
            <div className={CARD}>
                <Header stepNum={2} onBack={() => setStep(1)} />
                <p className={Q}>What&apos;s your training experience?</p>
                <div className="flex flex-col gap-2">
                    <OptionRow label="Beginner" desc="< 1 year lifting" active={experience === 'beginner'} onClick={() => setExperience('beginner')} />
                    <OptionRow label="Intermediate" desc="1–3 years" active={experience === 'intermediate'} onClick={() => setExperience('intermediate')} />
                    <OptionRow label="Advanced" desc="3+ years" active={experience === 'advanced'} onClick={() => setExperience('advanced')} />
                </div>
                <button onClick={() => setStep(3)} disabled={!experience} className={BTN_PRIMARY}>Next</button>
            </div>
        </div>
    );

    if (step === 3) return (
        <div className={WRAP}>
            <div className={CARD}>
                <Header stepNum={3} onBack={() => setStep(2)} />
                <p className={Q}>What&apos;s your primary goal?</p>
                <div className="flex flex-col gap-2">
                    <OptionRow label="Build muscle" desc="Maximise size and strength" active={goal === 'build_muscle'} onClick={() => setGoal('build_muscle')} />
                    <OptionRow label="Lose fat" desc="Preserve muscle while cutting" active={goal === 'lose_fat'} onClick={() => setGoal('lose_fat')} />
                    <OptionRow label="General fitness" desc="Move well and feel good" active={goal === 'general_fitness'} onClick={() => setGoal('general_fitness')} />
                </div>
                <button onClick={() => setStep(4)} disabled={!goal} className={BTN_PRIMARY}>Next</button>
            </div>
        </div>
    );

    if (step === 4) return (
        <div className={WRAP}>
            <div className={CARD}>
                <Header stepNum={4} onBack={() => setStep(3)} />
                <p className={Q}>How many days per week can you train?</p>
                <div className="flex flex-col gap-2">
                    <OptionRow label="2–3 days" active={days === '2-3'} onClick={() => setDays('2-3')} />
                    <OptionRow label="4 days" active={days === '4'} onClick={() => setDays('4')} />
                    <OptionRow label="5–6 days" active={days === '5-6'} onClick={() => setDays('5-6')} />
                </div>
                <button onClick={() => setStep(5)} disabled={!days} className={BTN_PRIMARY}>Next</button>
            </div>
        </div>
    );

    if (step === 5) return (
        <div className={WRAP}>
            <div className={CARD}>
                <Header stepNum={5} onBack={() => setStep(4)} />
                <p className={Q}>How long are your sessions?</p>
                <div className="flex flex-col gap-2">
                    <OptionRow label="~30 min" desc="Short and focused" active={sessionTime === '~30 min'} onClick={() => setSessionTime('~30 min')} />
                    <OptionRow label="45–60 min" desc="A solid training session" active={sessionTime === '45-60 min'} onClick={() => setSessionTime('45-60 min')} />
                    <OptionRow label="90+ min" desc="Full volume, no rush" active={sessionTime === '90+ min'} onClick={() => setSessionTime('90+ min')} />
                </div>
                <button onClick={goToResult} disabled={!sessionTime} className={BTN_PRIMARY}>See my recommendation</button>
            </div>
        </div>
    );

    // Result screen
    if (step === 'result') {
        // Single recommendation (build_muscle or lose_fat)
        if (recommendedSlug !== null) {
            const tpl = templates.find((t) => t.slug === recommendedSlug);
            return (
                <div className={WRAP}>
                    <div className={CARD}>
                        <div className="font-pulse text-[0.625rem] tracking-[0.1em] uppercase text-pulse-muted">Recommended for you</div>
                        <div>
                            <div className="font-pulse text-base font-semibold text-white">{tpl?.name ?? recommendedSlug}</div>
                            <div className="font-pulse text-xs text-pulse-dim mt-1">
                                Based on your answers: {experience},{' '}
                                {goal?.replace('_', ' ')},{' '}
                                {days} days, {sessionTime}
                            </div>
                            {tpl && (
                                <div className="flex gap-2 mt-2 flex-wrap">
                                    <span className="font-pulse text-[0.625rem] text-pulse-dim">{tpl.days_per_week}×/week · {tpl.session_time}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => handleStart(recommendedSlug!)}
                                disabled={loading}
                                className={BTN_PRIMARY}>
                                {loading ? 'Setting up…' : 'Start with this routine'}
                            </button>
                            <button
                                onClick={() => { navigate('library'); dismissOnboarding(); }}
                                className="font-pulse text-xs text-pulse-accent text-center bg-transparent border-none cursor-pointer">
                                Not quite right? Browse all templates
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // General fitness — show filtered template picker
        const filteredTemplates = templates.filter((t) => templateMatchesEquipment(t, equipment));
        const LEVEL_CLASS = { beginner: 'text-emerald-400', intermediate: 'text-amber-400', advanced: 'text-red-400' };
        return (
            <div className={WRAP}>
                <div className={`${CARD} max-h-[80vh] overflow-y-auto`}>
                    <p className={Q}>Choose a routine that fits you</p>
                    <div className="flex flex-col gap-3">
                        {filteredTemplates.map((t) => (
                            <button
                                key={t.slug}
                                onClick={() => setPickedSlug(t.slug)}
                                className={`text-left p-3 rounded-xl border cursor-pointer transition-colors ${
                                    pickedSlug === t.slug ? 'border-pulse-accent bg-pulse-accent/10' : 'border-pulse-border bg-pulse-bg'
                                }`}>
                                <div className="font-pulse text-sm font-semibold text-white">{t.name}</div>
                                <div className="flex gap-2 mt-1">
                                    <span className={`font-pulse text-[0.625rem] tracking-[0.08em] uppercase ${LEVEL_CLASS[t.experience_level]}`}>{t.experience_level}</span>
                                    <span className="font-pulse text-[0.625rem] text-pulse-dim">{t.days_per_week}×/week · {t.session_time}</span>
                                </div>
                                <p className="font-pulse text-xs text-pulse-muted mt-1">{t.description}</p>
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => pickedSlug && handleStart(pickedSlug)}
                        disabled={!pickedSlug || loading}
                        className={BTN_PRIMARY}>
                        {loading ? 'Setting up…' : 'Start with this routine'}
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
```

- [ ] Run: `bun run test src/components/pulse/__tests__/OnboardingModal.test.tsx` → PASS
- [ ] Run: `bun run typecheck` → no errors
- [ ] Commit: `git add src/components/pulse/OnboardingModal.tsx src/components/pulse/__tests__/OnboardingModal.test.tsx && git commit -m "feat(pulse): add OnboardingModal with 5-step flow, recommendation screen, and tests"`

---

## Task 12: AppShell + ProfileView

**Files:** Modify `src/components/pulse/AppShell.tsx`, `src/components/pulse/views/ProfileView.tsx`

- [ ] In `src/components/pulse/AppShell.tsx`:

Add import at the top:
```ts
import OnboardingModal from './OnboardingModal';
```

Add to the destructured values from `usePulse`:
```ts
const { activeWeek, streak, view, navigate, handleExport, saveError, timerTrigger, showOnboarding } = usePulse();
```

Render the modal just before `<BottomNav>`:
```tsx
{showOnboarding && <OnboardingModal />}
<BottomNav view={view} onNavigate={navigate} />
```

In `DesktopLayout` — check whether `DesktopLayout` also renders a full shell. If it does, add `showOnboarding && <OnboardingModal />` there too. Read `src/components/pulse/DesktopLayout.tsx` first to confirm.

- [ ] In `src/components/pulse/views/ProfileView.tsx` — add "Retake quiz" button:

Find the routines section (where active routine is displayed). Add after the active routine display:

```tsx
const { triggerOnboarding } = usePulse();

// In the JSX, near the active routine section:
<button
    onClick={triggerOnboarding}
    className="font-pulse text-xs text-pulse-accent bg-transparent border-none cursor-pointer underline">
    Retake quiz
</button>
```

- [ ] Manual smoke test (run `bun run dev` and open browser):
  - Log in with a fresh account (no routines) → `/pulse` opens → OnboardingModal appears
  - Complete all 5 steps → routine is created and activated → modal closes → Log view shows the new routine
  - Open Profile → tap "Retake quiz" → modal opens → tap Skip → modal closes
  - Visit Library → Templates tab → filter pills work → "Use this" clones routine

- [ ] Run full test suite: `bun run test` → all PASS
- [ ] Run: `bun run typecheck && bun run lint` → no errors
- [ ] Commit: `git add src/components/pulse/AppShell.tsx src/components/pulse/views/ProfileView.tsx && git commit -m "feat(pulse): mount OnboardingModal in AppShell, add Retake quiz to ProfileView"`
