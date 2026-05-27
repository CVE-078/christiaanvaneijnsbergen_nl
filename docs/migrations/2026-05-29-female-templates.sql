-- ============================================================
-- Migration: female-focused templates
-- 2026-05-29
-- ============================================================

-- STEP 1: Insert 3 female-focused routine templates
INSERT INTO routine_templates (id, name, slug, required_equipment, days_per_week, experience_level, session_time, description, schedule_pattern, default_days)
VALUES
  (
    'a1000000-0000-0000-0000-000000000015',
    'Glute Focus — Gym',
    'glute-focus-gym',
    ARRAY['cables','machines'],
    '4',
    'intermediate',
    '45–60 min',
    'Upper/lower split emphasising glutes and hamstrings on lower days.',
    ARRAY['lower','upper','lower','upper'],
    ARRAY[1,2,4,5]
  ),
  (
    'a1000000-0000-0000-0000-000000000016',
    'Lower Body — Gym',
    'lower-body-gym',
    ARRAY['barbell','machines'],
    '3',
    'beginner',
    '45–60 min',
    'Three full lower-body sessions per week. Great starting point for building leg and glute strength.',
    ARRAY['lower','lower','lower'],
    ARRAY[1,3,5]
  ),
  (
    'a1000000-0000-0000-0000-000000000017',
    'Full Body Tone — Dumbbells',
    'full-body-tone-db',
    ARRAY['dumbbells'],
    '3',
    'beginner',
    '30–45 min',
    'Three full-body dumbbell sessions. Higher reps, compound movements, no equipment beyond a pair of dumbbells.',
    ARRAY['full_body','full_body','full_body'],
    ARRAY[1,3,5]
  )
ON CONFLICT (id) DO NOTHING;

-- STEP 2: Template exercises for Glute Focus — Gym (015)
-- Lower day A: glute/hamstring focus
INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'lower', 1, '4', '10-12'
FROM exercises WHERE name = 'Hip Thrust' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'lower', 2, '3', '8-10'
FROM exercises WHERE name = 'Romanian Deadlift' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'lower', 3, '3', '10-12'
FROM exercises WHERE name = 'Leg Press' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'lower', 4, '3', '12-15'
FROM exercises WHERE name = 'Leg Curl' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'lower', 5, '3', '15-20'
FROM exercises WHERE name = 'Glute Bridge' AND user_id IS NULL LIMIT 1;

-- Upper day: balanced pull + push
INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'upper', 1, '3', '10-12'
FROM exercises WHERE name = 'Lat Pulldown' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'upper', 2, '3', '10-12'
FROM exercises WHERE name = 'Seated Cable Row' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'upper', 3, '3', '10-12'
FROM exercises WHERE name = 'Dumbbell Shoulder Press' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'upper', 4, '3', '15-20'
FROM exercises WHERE name = 'Lateral Raise' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000015', id, 'upper', 5, '3', '10-12'
FROM exercises WHERE name = 'Dumbbell Chest Press' AND user_id IS NULL LIMIT 1;

-- STEP 3: Template exercises for Lower Body — Gym (016)
INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 1, '3', '8-10'
FROM exercises WHERE name = 'Squat' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 2, '3', '10-12'
FROM exercises WHERE name = 'Hip Thrust' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 3, '3', '10-12'
FROM exercises WHERE name = 'Romanian Deadlift' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 4, '3', '12-15'
FROM exercises WHERE name = 'Leg Press' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 5, '3', '12-15'
FROM exercises WHERE name = 'Walking Lunge' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000016', id, 'lower', 6, '3', '12-15'
FROM exercises WHERE name = 'Leg Curl' AND user_id IS NULL LIMIT 1;

-- STEP 4: Template exercises for Full Body Tone — Dumbbells (017)
INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 1, '3', '12-15'
FROM exercises WHERE name = 'Dumbbell Squat' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 2, '3', '10-12'
FROM exercises WHERE name = 'Dumbbell Romanian Deadlift' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 3, '3', '12-15'
FROM exercises WHERE name = 'Dumbbell Row' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 4, '3', '12-15'
FROM exercises WHERE name = 'Dumbbell Chest Press' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 5, '3', '15-20'
FROM exercises WHERE name = 'Lateral Raise' AND user_id IS NULL LIMIT 1;

INSERT INTO template_exercises (template_id, exercise_id, workout_type, "order", sets, reps)
SELECT 'a1000000-0000-0000-0000-000000000017', id, 'full_body', 6, '3', '15-20'
FROM exercises WHERE name = 'Dumbbell Lunge' AND user_id IS NULL LIMIT 1;

-- STEP 5: Update routine_templates CHECK to allow 17 templates
-- (no constraint change needed — id is uuid, no sequence to update)

-- Verify
SELECT slug, schedule_pattern, default_days FROM routine_templates ORDER BY slug;
SELECT t.slug, count(te.template_id) as exercise_count
FROM routine_templates t
LEFT JOIN template_exercises te ON te.template_id = t.id
GROUP BY t.slug ORDER BY t.slug;
