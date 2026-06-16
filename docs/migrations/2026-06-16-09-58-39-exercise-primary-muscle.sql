-- Tier-2 muscle-coverage warnings: per-exercise programming-muscle attribution.
-- Adds a STORED primary_muscle (+ a fine secondary_muscle_groups) at the 13-muscle
-- programming taxonomy, SEPARATE from the coarse category / secondary_muscles (10
-- reporting buckets), which are left intact. The seed CASE is an INITIAL HEURISTIC
-- (mirrors deriveSeedPrimaryMuscle in muscleVolume.ts), not biomechanical truth;
-- rows are revised manually over time. For programming analysis, not anatomy truth.

alter table exercises add column if not exists primary_muscle text;
alter table exercises add column if not exists secondary_muscle_groups text[] not null default '{}';

-- Seed primary_muscle for the seeded catalogue (user_id is null). Order matters:
-- delt heads + glute-dominant hinges are resolved before the pattern fallbacks.
update exercises set primary_muscle = case
    when name = 'Dumbbell Pullover' then 'lats'
    when substitution_class = 'lateral_raise' then 'side_delts'
    when substitution_class = 'rear_delt_isolation' then 'rear_delts'
    when substitution_class in ('front_delt_isolation', 'vertical_press') then 'front_delts'
    when substitution_class = 'glute_pattern' or movement_pattern = 'glute_iso' then 'glutes'
    when movement_pattern in ('squat', 'lunge', 'quad_iso') then 'quads'
    when movement_pattern in ('hinge', 'hamstring_iso') then 'hamstrings'
    when movement_pattern = 'vertical_pull' then 'lats'
    when movement_pattern in ('horizontal_pull', 'back_iso') then 'upper_back'
    when movement_pattern in ('horizontal_push', 'chest_iso') then 'chest'
    when movement_pattern = 'vertical_push' then 'front_delts'
    when movement_pattern = 'shoulder_iso' then 'side_delts'
    when movement_pattern = 'biceps_iso' then 'biceps'
    when movement_pattern = 'triceps_iso' then 'triceps'
    when movement_pattern = 'calf' then 'calves'
    when movement_pattern = 'core' then 'core'
    else 'core'
end
where user_id is null;

-- Coarse secondary seed for compounds only (feeds the diagnostic-only effective metric;
-- non-normative). Isolations keep the '{}' default. Tunable later.
update exercises set secondary_muscle_groups = case
    when movement_pattern = 'horizontal_push' then array['front_delts', 'triceps']
    when movement_pattern = 'vertical_push' then array['triceps']
    when movement_pattern = 'horizontal_pull' then array['biceps', 'rear_delts']
    when movement_pattern = 'vertical_pull' then array['biceps']
    when substitution_class = 'glute_pattern' then array['hamstrings']
    when movement_pattern in ('squat', 'lunge') then array['glutes']
    when movement_pattern = 'hinge' then array['glutes']
    else secondary_muscle_groups
end::text[]
where user_id is null;

-- Guard: primary_muscle (when set) must be one of the 13 programming muscles.
alter table exercises drop constraint if exists exercises_primary_muscle_check;
alter table exercises add constraint exercises_primary_muscle_check check (
    primary_muscle is null or primary_muscle in (
        'chest','lats','upper_back','front_delts','side_delts','rear_delts',
        'biceps','triceps','quads','hamstrings','glutes','calves','core'
    )
);
