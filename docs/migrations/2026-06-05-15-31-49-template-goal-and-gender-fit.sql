-- Template metadata for the Templates-tab filters: a training goal and a
-- gender-fit tag per routine template. Defaults cover the build-muscle / any
-- majority; only the exceptions are updated below.
alter table routine_templates
    add column if not exists goal text not null default 'build_muscle'
        check (goal in ('build_muscle', 'lose_fat', 'general_fitness')),
    add column if not exists gender_fit text not null default 'any'
        check (gender_fit in ('any', 'female'));

-- The three Full Body templates read as all-round / general fitness.
update routine_templates
set goal = 'general_fitness'
where id in (
    'a1000000-0000-0000-0000-000000000001', -- Full Body — Dumbbells
    'a1000000-0000-0000-0000-000000000002', -- Full Body — Home Gym
    'a1000000-0000-0000-0000-000000000003'  -- Full Body — Gym
);

-- Female-focused templates (Glute Focus, Full Body Tone). Lower Body — Gym
-- stays 'any' since it is a generic lower-body program.
update routine_templates set gender_fit = 'female' where slug in ('glute-focus-gym', 'full-body-tone-db');

-- Full Body Tone is the fat-loss / conditioning option.
update routine_templates set goal = 'lose_fat' where slug = 'full-body-tone-db';
