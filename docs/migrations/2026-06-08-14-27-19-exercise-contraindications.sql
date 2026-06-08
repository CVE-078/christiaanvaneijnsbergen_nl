-- Per-exercise contraindication tags (Tier 2 #5). Read-only catalog data;
-- inherits the existing exercises read policy (column add, no policy change).
--
-- Tags which joint areas each exercise significantly stresses. Used by the
-- generator to exclude exercises that load a restricted joint. The invariant:
-- at least one safe squat/hinge leg option and one safe push option remain
-- untagged for every normal equipment set.
--
-- Scope: user_id is null (global/seeded exercises only). Idempotent: array_append
-- on an already-tagged row is a no-op because the CHECK on contraindications is
-- not unique, but in practice this migration is applied once. Re-running is safe
-- (duplicate values in the array do no harm; the generator uses = any()).
alter table exercises
    add column if not exists contraindications text[] not null default '{}';

-- ── knee ─────────────────────────────────────────────────────────────────────
-- Heavy axial load and/or deep knee flexion: high patellofemoral stress, risk
-- of shear on an already restricted knee.
-- Tagged: Barbell Squat, Hack Squat, Dumbbell Bulgarian Split Squat,
--         Walking Lunge, Leg Extension.
-- NOT tagged (safe knee alternatives left in pool): Dumbbell Goblet Squat,
--   Dumbbell Sumo Squat, Leg Press, Step-Up, Hip Thrust, Leg Curl,
--   Dumbbell Leg Curl (Lying), Romanian Deadlift, Dumbbell Romanian Deadlift,
--   Sumo Deadlift, Deadlift.
update exercises set contraindications = array_append(contraindications, 'knee')
    where user_id is null and name in (
        'Barbell Squat',
        'Hack Squat',
        'Dumbbell Bulgarian Split Squat',
        'Walking Lunge',
        'Leg Extension'
    );

-- ── lower_back ───────────────────────────────────────────────────────────────
-- High spinal compressive/shear load: contraindicated for herniated disc,
-- chronic lower-back issues, or post-surgery restrictions.
-- Tagged: Deadlift, Sumo Deadlift, Romanian Deadlift, Dumbbell Romanian Deadlift,
--         Rack Pull, Barbell Row, T-Bar Row, Dumbbell Bent-Over Row.
-- NOT tagged (safe lower-back alternatives left in pool): Hip Thrust, Leg Press,
--   Leg Curl, Dumbbell Leg Curl (Lying), Barbell Squat, Dumbbell Goblet Squat,
--   Chest-Supported Row, Seated Cable Row, Lat Pulldown, Pull-Up, Chin-Up.
update exercises set contraindications = array_append(contraindications, 'lower_back')
    where user_id is null and name in (
        'Deadlift',
        'Sumo Deadlift',
        'Romanian Deadlift',
        'Dumbbell Romanian Deadlift',
        'Rack Pull',
        'Barbell Row',
        'T-Bar Row',
        'Dumbbell Bent-Over Row'
    );

-- ── shoulder ─────────────────────────────────────────────────────────────────
-- Overhead pressing and high impingement-risk movements: internal rotation
-- under load, subacromial stress, AC joint stress.
-- Tagged: Barbell Overhead Press, Arnold Press, Dumbbell Push Press, Upright Row,
--         Dips.
-- NOT tagged (safe shoulder alternatives left in pool): Machine Shoulder Press,
--   Dumbbell Overhead Press, Lateral Raise, Dumbbell Lateral Raise, Face Pull,
--   Dumbbell Face Pull (Bent-Over), Barbell Bench Press, Dumbbell Bench Press,
--   Machine Chest Press, Incline Barbell Press, Incline Dumbbell Press.
update exercises set contraindications = array_append(contraindications, 'shoulder')
    where user_id is null and name in (
        'Barbell Overhead Press',
        'Arnold Press',
        'Dumbbell Push Press',
        'Upright Row',
        'Dips'
    );

-- ── wrist ────────────────────────────────────────────────────────────────────
-- Fixed pronated grip under heavy load: wrist extension stress, TFCC load.
-- Primarily straight-bar pressing and pull movements with a fixed wrist position.
-- Tagged: Barbell Bench Press, Close-Grip Bench Press, Push-Up, Barbell Curl.
-- NOT tagged (safe wrist alternatives left in pool): Dumbbell Bench Press,
--   Incline Dumbbell Press, Machine Chest Press, Smith Machine Bench Press,
--   Dumbbell Overhead Press, Machine Shoulder Press, Cable Fly, Pec Deck,
--   Dumbbell Curl, Dumbbell Hammer Curl, EZ-Bar Curl, Cable Curl,
--   Preacher Curl.
update exercises set contraindications = array_append(contraindications, 'wrist')
    where user_id is null and name in (
        'Barbell Bench Press',
        'Close-Grip Bench Press',
        'Push-Up',
        'Barbell Curl'
    );

-- ── Verify after applying ────────────────────────────────────────────────────
-- Flag counts (expect: knee=5, lower_back=8, shoulder=5, wrist=4):
-- select unnest(contraindications) as flag, count(*) from exercises where user_id is null group by 1 order by 1;

-- Safe squat/hinge options that survive the knee flag (expect several rows):
-- select name, movement_pattern from exercises
--   where user_id is null and movement_pattern in ('squat','hinge') and not ('knee' = any(contraindications));

-- Safe push options that survive the shoulder flag (expect several rows):
-- select name, movement_pattern from exercises
--   where user_id is null and movement_pattern in ('horizontal_push','vertical_push') and not ('shoulder' = any(contraindications));
