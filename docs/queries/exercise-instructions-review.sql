-- Reusable inspection queries for exercise instructions (run in the Supabase SQL
-- Editor). Read-only. The exercise_instructions table is seeded, never written by
-- the app, so this is how you spot gaps to populate and content to adjust.

-- ── 1. Coverage review: every global exercise + its instruction status ────────
-- Exercises with NO instructions row sort to the top (has_instructions = false),
-- so the gaps to populate are first. Then by category and name.
select
    e.category,
    e.name,
    e.movement_pattern,
    (ei.exercise_id is not null)               as has_instructions,
    coalesce(array_length(ei.cues, 1), 0)      as cue_count,
    ei.primary_muscles,
    ei.secondary_muscles,
    ei.cues
from public.exercises e
left join public.exercise_instructions ei on ei.exercise_id = e.id
where e.user_id is null               -- global library only (not user-created)
order by has_instructions asc, e.category, e.name;

-- ── 2. Just the gaps: global exercises missing instructions ───────────────────
-- select e.category, e.name
-- from public.exercises e
-- left join public.exercise_instructions ei on ei.exercise_id = e.id
-- where e.user_id is null and ei.exercise_id is null
-- order by e.category, e.name;

-- ── 3. Em-dash discovery: seeded text still containing an em dash (U+2014) ─────
-- Run before the 2026-06-06-16-32-34-em-dash-content-cleanup.sql migration to
-- preview what changes, and after to confirm zero rows.
-- select 'template.name'        as field, t.id::text as ref, t.name        as value
-- from public.routine_templates t where t.name like '%—%'
-- union all
-- select 'template.description', t.id::text, t.description
-- from public.routine_templates t where t.description like '%—%'
-- union all
-- select 'instruction.cue', ei.exercise_id::text, cue
-- from public.exercise_instructions ei, unnest(ei.cues) as cue
-- where cue like '%—%';
