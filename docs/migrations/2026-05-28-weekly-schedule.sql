-- ============================================================
-- Migration: weekly-schedule
-- 2026-05-28
-- ============================================================

-- STEP 1: Expand workout_type CHECK on routine_exercises
-- Drop old constraint (auto-named by Postgres) and add new one.
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'routine_exercises'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%workout_type%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE routine_exercises DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE routine_exercises
  ADD CONSTRAINT routine_exercises_workout_type_check
  CHECK (workout_type IN (
    'push','pull','legs','chest','back','shoulders','arms',
    'upper','lower','full_body'
  ));

-- STEP 2: Expand workout_type CHECK on template_exercises
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'template_exercises'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%workout_type%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE template_exercises DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE template_exercises
  ADD CONSTRAINT template_exercises_workout_type_check
  CHECK (workout_type IN (
    'push','pull','legs','chest','back','shoulders','arms',
    'upper','lower','full_body'
  ));

-- STEP 3: Update template_exercises for full-body templates
-- All exercises in a full-body session belong to a single 'full_body' tab.
UPDATE template_exercises SET workout_type = 'full_body'
WHERE template_id IN (
  'a1000000-0000-0000-0000-000000000001',  -- full-body-db
  'a1000000-0000-0000-0000-000000000002',  -- full-body-home
  'a1000000-0000-0000-0000-000000000003'   -- full-body-gym
);

-- STEP 4: Update template_exercises for upper/lower templates
-- push+pull exercises → upper tab, legs exercises → lower tab
UPDATE template_exercises SET workout_type = 'upper'
WHERE template_id IN (
  'a1000000-0000-0000-0000-000000000004',  -- upper-lower-db
  'a1000000-0000-0000-0000-000000000005',  -- upper-lower-home
  'a1000000-0000-0000-0000-000000000006'   -- upper-lower-gym
) AND workout_type IN ('push', 'pull');

UPDATE template_exercises SET workout_type = 'lower'
WHERE template_id IN (
  'a1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000006'
) AND workout_type = 'legs';

-- STEP 5: Fix existing routine_exercises for routines already cloned from templates
-- Full body
UPDATE routine_exercises re
SET workout_type = 'full_body'
FROM workout_routines wr
WHERE re.routine_id = wr.id
  AND wr.name IN ('Full Body — Dumbbells', 'Full Body — Home Gym', 'Full Body — Gym');

-- Upper/Lower (push+pull → upper, legs → lower)
UPDATE routine_exercises re
SET workout_type = CASE
  WHEN re.workout_type IN ('push','pull') THEN 'upper'
  ELSE 'lower'
END
FROM workout_routines wr
WHERE re.routine_id = wr.id
  AND wr.name IN ('Upper/Lower — Dumbbells', 'Upper/Lower — Home Gym', 'Upper/Lower — Gym')
  AND re.workout_type IN ('push','pull','legs');

-- STEP 6: Add schedule columns to routine_templates
ALTER TABLE routine_templates
  ADD COLUMN IF NOT EXISTS schedule_pattern text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_days     integer[] NOT NULL DEFAULT '{}';

-- STEP 7: Seed schedule_pattern and default_days for all 14 templates
-- 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
UPDATE routine_templates SET
  schedule_pattern = ARRAY['full_body','full_body','full_body'],
  default_days     = ARRAY[1,3,5]
WHERE slug IN ('full-body-db','full-body-home','full-body-gym');

UPDATE routine_templates SET
  schedule_pattern = ARRAY['upper','lower','upper','lower'],
  default_days     = ARRAY[1,2,4,5]
WHERE slug IN ('upper-lower-db','upper-lower-home','upper-lower-gym');

UPDATE routine_templates SET
  schedule_pattern = ARRAY['push','pull','legs','push','pull','legs'],
  default_days     = ARRAY[1,2,3,4,5,6]
WHERE slug IN ('ppl-db','ppl-home','ppl-gym');

UPDATE routine_templates SET
  schedule_pattern = ARRAY['push','pull','push','pull'],
  default_days     = ARRAY[1,2,4,5]
WHERE slug IN ('push-pull-db','push-pull-gym');

UPDATE routine_templates SET
  schedule_pattern = ARRAY['chest','back','shoulders','arms','legs'],
  default_days     = ARRAY[1,2,3,4,5]
WHERE slug = 'bro-split-gym';

UPDATE routine_templates SET
  schedule_pattern = ARRAY['chest','back','shoulders','arms','legs','chest'],
  default_days     = ARRAY[1,2,3,4,5,6]
WHERE slug IN ('arnold-split-gym','arnold-split-home');

-- STEP 8: Create routine_schedule table
CREATE TABLE IF NOT EXISTS routine_schedule (
  routine_id   uuid REFERENCES workout_routines(id) ON DELETE CASCADE NOT NULL,
  day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  workout_type text    NOT NULL CHECK (workout_type IN (
    'push','pull','legs','chest','back','shoulders','arms',
    'upper','lower','full_body'
  )),
  PRIMARY KEY (routine_id, day_of_week)
);

ALTER TABLE routine_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routine_schedule_select" ON routine_schedule;
CREATE POLICY "routine_schedule_select" ON routine_schedule
  FOR SELECT TO authenticated
  USING (routine_id IN (SELECT id FROM workout_routines WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "routine_schedule_insert" ON routine_schedule;
CREATE POLICY "routine_schedule_insert" ON routine_schedule
  FOR INSERT TO authenticated
  WITH CHECK (routine_id IN (SELECT id FROM workout_routines WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "routine_schedule_delete" ON routine_schedule;
CREATE POLICY "routine_schedule_delete" ON routine_schedule
  FOR DELETE TO authenticated
  USING (routine_id IN (SELECT id FROM workout_routines WHERE user_id = auth.uid()));

-- STEP 9: Back-fill routine_schedule for routines already cloned from templates
INSERT INTO routine_schedule (routine_id, day_of_week, workout_type)
SELECT wr.id, s.dow, s.wt FROM workout_routines wr
CROSS JOIN (VALUES (1,'full_body'),(3,'full_body'),(5,'full_body')) AS s(dow,wt)
WHERE wr.name IN ('Full Body — Dumbbells','Full Body — Home Gym','Full Body — Gym')
ON CONFLICT DO NOTHING;

INSERT INTO routine_schedule (routine_id, day_of_week, workout_type)
SELECT wr.id, s.dow, s.wt FROM workout_routines wr
CROSS JOIN (VALUES (1,'upper'),(2,'lower'),(4,'upper'),(5,'lower')) AS s(dow,wt)
WHERE wr.name IN ('Upper/Lower — Dumbbells','Upper/Lower — Home Gym','Upper/Lower — Gym')
ON CONFLICT DO NOTHING;

INSERT INTO routine_schedule (routine_id, day_of_week, workout_type)
SELECT wr.id, s.dow, s.wt FROM workout_routines wr
CROSS JOIN (VALUES (1,'push'),(2,'pull'),(3,'legs'),(4,'push'),(5,'pull'),(6,'legs')) AS s(dow,wt)
WHERE wr.name IN ('PPL — Dumbbells','PPL — Home Gym','PPL — Gym')
ON CONFLICT DO NOTHING;

INSERT INTO routine_schedule (routine_id, day_of_week, workout_type)
SELECT wr.id, s.dow, s.wt FROM workout_routines wr
CROSS JOIN (VALUES (1,'push'),(2,'pull'),(4,'push'),(5,'pull')) AS s(dow,wt)
WHERE wr.name IN ('Push/Pull — Dumbbells','Push/Pull — Gym')
ON CONFLICT DO NOTHING;

INSERT INTO routine_schedule (routine_id, day_of_week, workout_type)
SELECT wr.id, s.dow, s.wt FROM workout_routines wr
CROSS JOIN (VALUES (1,'chest'),(2,'back'),(3,'shoulders'),(4,'arms'),(5,'legs')) AS s(dow,wt)
WHERE wr.name = 'Bro Split — Gym'
ON CONFLICT DO NOTHING;

INSERT INTO routine_schedule (routine_id, day_of_week, workout_type)
SELECT wr.id, s.dow, s.wt FROM workout_routines wr
CROSS JOIN (VALUES (1,'chest'),(2,'back'),(3,'shoulders'),(4,'arms'),(5,'legs'),(6,'chest')) AS s(dow,wt)
WHERE wr.name IN ('Arnold Split — Gym','Arnold Split — Home Gym')
ON CONFLICT DO NOTHING;
