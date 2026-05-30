-- Rename global "DB " exercises to "Dumbbell " spelling.
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
UPDATE exercises
SET name = CASE name
    WHEN 'DB Lateral Raise'              THEN 'Dumbbell Lateral Raise'
    WHEN 'DB Overhead Press'             THEN 'Dumbbell Overhead Press'
    WHEN 'DB Tricep Overhead Extension'  THEN 'Dumbbell Tricep Overhead Extension'
    WHEN 'DB Bent-Over Row'              THEN 'Dumbbell Bent-Over Row'
    WHEN 'DB Single-Arm Row'             THEN 'Dumbbell Single-Arm Row'
    WHEN 'DB Reverse Fly'                THEN 'Dumbbell Reverse Fly'
    WHEN 'DB Bicep Curl'                 THEN 'Dumbbell Bicep Curl'
    WHEN 'DB Hammer Curl'                THEN 'Dumbbell Hammer Curl'
    WHEN 'DB Face Pull bent-over'        THEN 'Dumbbell Face Pull (Bent-Over)'
    WHEN 'DB Goblet Squat'               THEN 'Dumbbell Goblet Squat'
    WHEN 'DB Romanian Deadlift'          THEN 'Dumbbell Romanian Deadlift'
    WHEN 'DB Bulgarian Split Squat'      THEN 'Dumbbell Bulgarian Split Squat'
    WHEN 'DB Sumo Squat'                 THEN 'Dumbbell Sumo Squat'
    WHEN 'DB Leg Curl lying on bench'    THEN 'Dumbbell Leg Curl (Lying)'
    WHEN 'DB Calf Raise'                 THEN 'Dumbbell Calf Raise'
    WHEN 'Incline DB Press'              THEN 'Incline Dumbbell Press'
    ELSE name
END
WHERE user_id IS NULL
  AND (name LIKE 'DB %' OR name LIKE 'Incline DB %');
