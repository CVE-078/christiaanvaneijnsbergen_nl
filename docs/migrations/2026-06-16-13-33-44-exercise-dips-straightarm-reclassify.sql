-- Reclassify two mis-tagged exercises (review loop, 2026-06-16). Data-only; the
-- generator reads only the corrected fields. Forward-only.
-- Dips: a compound chest+triceps press, was tagged triceps_iso / isolation.
update exercises set
    movement_pattern = 'horizontal_push',
    is_compound = true,
    substitution_class = 'horizontal_press',
    primary_muscle = 'chest',
    secondary_muscle_groups = array['triceps', 'front_delts']::text[]
where user_id is null and name = 'Dips';

-- Straight-Arm Pulldown: a lat isolation, was tagged vertical_pull / compound.
update exercises set
    movement_pattern = 'back_iso',
    is_compound = false,
    substitution_class = null,
    primary_muscle = 'lats',
    secondary_muscle_groups = '{}'::text[]
where user_id is null and name = 'Straight-Arm Pulldown';
