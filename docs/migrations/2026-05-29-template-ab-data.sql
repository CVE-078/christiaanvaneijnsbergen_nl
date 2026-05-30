-- docs/migrations/2026-05-29-template-ab-data.sql

-- ─────────────────────────────────────────────────────────────
-- Step 1: Mark all existing exercises in A/B-eligible templates as variant A
-- ─────────────────────────────────────────────────────────────
UPDATE template_exercises te
SET variant = 'A'
WHERE te.template_id IN (
    SELECT id FROM routine_templates WHERE slug IN (
        'full-body-db', 'full-body-home', 'full-body-gym',
        'upper-lower-db', 'upper-lower-home', 'upper-lower-gym',
        'push-pull-db', 'push-pull-gym',
        'ppl-db', 'ppl-home', 'ppl-gym'
    )
);

-- ─────────────────────────────────────────────────────────────
-- Step 2: Insert variant B exercises for each eligible template
-- ─────────────────────────────────────────────────────────────

-- full-body-db  B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT
    t.id,
    e.id,
    v.workout_type,
    'B',
    v.ord,
    v.sets,
    v.reps
FROM
    (SELECT id FROM routine_templates WHERE slug = 'full-body-db') t,
    (VALUES
        ('Incline Dumbbell Press',       'push', 1, '3', '8-12'),
        ('Dumbbell Overhead Press',      'push', 2, '3', '8-12'),
        ('Dumbbell Single-Arm Row',      'pull', 3, '3', '8-12'),
        ('Dumbbell Hammer Curl',         'pull', 4, '3', '10-14'),
        ('Dumbbell Bulgarian Split Squat','legs', 5, '4', '10-12 per leg'),
        ('Dumbbell Romanian Deadlift',   'legs', 6, '3', '8-12')
    ) AS v(name, workout_type, ord, sets, reps)
    JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- full-body-home  B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'full-body-home') t,
(VALUES
    ('Incline Barbell Press',    'push', 1, '3', '8-12'),
    ('Barbell Overhead Press',   'push', 2, '3', '6-10'),
    ('Dumbbell Single-Arm Row',        'pull', 3, '3', '10-14'),
    ('Dumbbell Hammer Curl',           'pull', 4, '3', '10-14'),
    ('Romanian Deadlift',              'legs', 5, '3', '8-12'),
    ('Dumbbell Bulgarian Split Squat', 'legs', 6, '4', '10-12 per leg')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- full-body-gym  B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'full-body-gym') t,
(VALUES
    ('Incline Barbell Press',  'push', 1, '3', '8-12'),
    ('Barbell Overhead Press', 'push', 2, '3', '6-10'),
    ('Seated Cable Row',       'pull', 3, '3', '10-14'),
    ('Lat Pulldown',           'pull', 4, '3', '8-12'),
    ('Romanian Deadlift',      'legs', 5, '3', '8-12'),
    ('Hack Squat',             'legs', 6, '3', '8-12')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- upper-lower-db  Upper B + Lower B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'upper-lower-db') t,
(VALUES
    ('Incline Dumbbell Press',         'push', 1, '4', '8-12'),
    ('Dumbbell Overhead Press',        'push', 2, '3', '8-12'),
    ('Dumbbell Lateral Raise',         'push', 3, '3', '12-16'),
    ('Dumbbell Single-Arm Row',        'pull', 4, '4', '8-12'),
    ('Dumbbell Hammer Curl',           'pull', 5, '3', '10-14'),
    ('Dumbbell Reverse Fly',           'pull', 6, '3', '12-16'),
    ('Dumbbell Bulgarian Split Squat', 'legs', 7, '4', '10-12 per leg'),
    ('Dumbbell Romanian Deadlift',     'legs', 8, '3', '8-12'),
    ('Dumbbell Sumo Squat',            'legs', 9, '3', '10-14'),
    ('Dumbbell Calf Raise',            'legs', 10, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- upper-lower-home  Upper B + Lower B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'upper-lower-home') t,
(VALUES
    ('Incline Barbell Press',         'push', 1, '4', '8-12'),
    ('Barbell Overhead Press',        'push', 2, '3', '6-10'),
    ('Dumbbell Lateral Raise',        'push', 3, '3', '12-16'),
    ('Dumbbell Single-Arm Row',       'pull', 4, '4', '10-14'),
    ('Dumbbell Hammer Curl',          'pull', 5, '3', '10-14'),
    ('Dumbbell Reverse Fly',          'pull', 6, '3', '12-16'),
    ('Romanian Deadlift',             'legs', 7, '3', '8-12'),
    ('Dumbbell Bulgarian Split Squat','legs', 8, '3', '10-12 per leg'),
    ('Dumbbell Sumo Squat',           'legs', 9, '3', '10-14'),
    ('Dumbbell Calf Raise',           'legs', 10, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- upper-lower-gym  Upper B + Lower B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'upper-lower-gym') t,
(VALUES
    ('Incline Barbell Press',  'push', 1,  '4', '8-12'),
    ('Barbell Overhead Press', 'push', 2,  '3', '6-10'),
    ('Cable Lateral Raise',    'push', 3,  '3', '12-16'),
    ('Seated Cable Row',       'pull', 4,  '4', '10-14'),
    ('Lat Pulldown',           'pull', 5,  '3', '8-12'),
    ('Face Pull',              'pull', 6,  '3', '15-20'),
    ('Romanian Deadlift',      'legs', 7,  '3', '8-12'),
    ('Hack Squat',             'legs', 8,  '3', '8-12'),
    ('Leg Press',              'legs', 9,  '3', '10-15'),
    ('Leg Extension Machine',  'legs', 10, '3', '12-15'),
    ('Calf Raise Machine',     'legs', 11, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- push-pull-db  Push B + Pull B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'push-pull-db') t,
(VALUES
    ('Incline Dumbbell Press',             'push', 1, '4', '8-12'),
    ('Dumbbell Overhead Press',            'push', 2, '3', '8-12'),
    ('Dumbbell Lateral Raise',             'push', 3, '3', '12-16'),
    ('Dumbbell Tricep Overhead Extension', 'push', 4, '3', '10-15'),
    ('Dumbbell Single-Arm Row',            'pull', 5, '4', '10-14'),
    ('Dumbbell Reverse Fly',               'pull', 6, '3', '12-16'),
    ('Dumbbell Hammer Curl',               'pull', 7, '3', '10-14'),
    ('Dumbbell Bicep Curl',                'pull', 8, '3', '10-14')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- push-pull-gym  Push B + Pull B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'push-pull-gym') t,
(VALUES
    ('Incline Barbell Press',    'push', 1, '4', '6-10'),
    ('Barbell Overhead Press',   'push', 2, '3', '6-10'),
    ('Cable Lateral Raise',      'push', 3, '3', '12-16'),
    ('Close-Grip Bench Press',   'push', 4, '3', '8-12'),
    ('Seated Cable Row',         'pull', 5, '4', '10-14'),
    ('Lat Pulldown',             'pull', 6, '3', '8-12'),
    ('Barbell Row',              'pull', 7, '3', '6-10'),
    ('EZ-Bar Curl',              'pull', 8, '3', '8-12')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- ppl-db  Push B / Pull B / Legs B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'ppl-db') t,
(VALUES
    ('Incline Dumbbell Press',             'push', 1,  '4', '8-12'),
    ('Dumbbell Bent-Over Row',             'push', 2,  '3', '10-14'),
    ('Dumbbell Overhead Press',            'push', 3,  '3', '8-12'),
    ('Dumbbell Lateral Raise',             'push', 4,  '3', '12-16'),
    ('Dumbbell Tricep Overhead Extension', 'push', 5,  '3', '10-15'),
    ('Dumbbell Single-Arm Row',            'pull', 6,  '4', '10-14'),
    ('Dumbbell Bent-Over Row',             'pull', 7,  '3', '8-12'),
    ('Dumbbell Reverse Fly',               'pull', 8,  '3', '12-16'),
    ('Dumbbell Hammer Curl',               'pull', 9,  '3', '10-14'),
    ('Dumbbell Bicep Curl',                'pull', 10, '3', '10-14'),
    ('Dumbbell Bulgarian Split Squat',     'legs', 11, '4', '10-12 per leg'),
    ('Dumbbell Goblet Squat',              'legs', 12, '3', '10-15'),
    ('Dumbbell Romanian Deadlift',         'legs', 13, '3', '8-12'),
    ('Dumbbell Sumo Squat',                'legs', 14, '3', '10-14'),
    ('Dumbbell Calf Raise',                'legs', 15, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- ppl-home  Push B / Pull B / Legs B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'ppl-home') t,
(VALUES
    ('Incline Barbell Press',             'push', 1,  '4', '8-12'),
    ('Barbell Bench Press',               'push', 2,  '3', '6-10'),
    ('Barbell Overhead Press',            'push', 3,  '3', '6-10'),
    ('Dumbbell Lateral Raise',            'push', 4,  '3', '12-16'),
    ('Dumbbell Tricep Overhead Extension','push', 5,  '3', '10-15'),
    ('Dumbbell Single-Arm Row',           'pull', 6,  '4', '10-14'),
    ('Barbell Row',                       'pull', 7,  '3', '6-10'),
    ('Dumbbell Reverse Fly',              'pull', 8,  '3', '12-16'),
    ('Dumbbell Hammer Curl',              'pull', 9,  '3', '10-14'),
    ('Dumbbell Bicep Curl',               'pull', 10, '3', '10-14'),
    ('Romanian Deadlift',                 'legs', 11, '3', '8-12'),
    ('Barbell Squat',                     'legs', 12, '4', '5-8'),
    ('Dumbbell Bulgarian Split Squat',    'legs', 13, '3', '10-12 per leg'),
    ('Dumbbell Sumo Squat',               'legs', 14, '3', '10-14'),
    ('Dumbbell Calf Raise',               'legs', 15, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- ppl-gym  Push B / Pull B / Legs B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'ppl-gym') t,
(VALUES
    ('Incline Barbell Press',    'push', 1,  '4', '8-12'),
    ('Barbell Bench Press',      'push', 2,  '3', '6-10'),
    ('Barbell Overhead Press',   'push', 3,  '3', '6-10'),
    ('Cable Lateral Raise',      'push', 4,  '3', '12-16'),
    ('Close-Grip Bench Press',   'push', 5,  '3', '8-12'),
    ('Pec Deck',                 'push', 6,  '3', '12-15'),
    ('Seated Cable Row',         'pull', 7,  '4', '10-14'),
    ('Barbell Row',              'pull', 8,  '3', '6-10'),
    ('Lat Pulldown',             'pull', 9,  '3', '8-12'),
    ('Face Pull',                'pull', 10, '3', '15-20'),
    ('EZ-Bar Curl',              'pull', 11, '3', '8-12'),
    ('Barbell Bicep Curl',       'pull', 12, '3', '8-12'),
    ('Romanian Deadlift',        'legs', 13, '3', '8-12'),
    ('Barbell Squat',            'legs', 14, '4', '5-8'),
    ('Hack Squat',               'legs', 15, '3', '8-12'),
    ('Leg Curl Machine',         'legs', 16, '3', '12-15'),
    ('Leg Extension Machine',    'legs', 17, '3', '12-15'),
    ('Calf Raise Machine',       'legs', 18, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;
