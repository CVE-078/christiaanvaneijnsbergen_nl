-- Em-dash cleanup of seeded text content, matching the 2026-06-06 codebase sweep
-- (no em dashes in the application). Only the em dash (U+2014, "—") is touched;
-- en dashes in ranges like "45–75°" are deliberately left alone. Template names
-- use a hyphen separator to match the code (e.g. "Full Body - Dumbbells"); prose
-- (descriptions, instruction cues) uses a comma. Idempotent: re-running finds
-- nothing once applied. There is no automated runner; apply via the Supabase SQL
-- Editor. Preview first with docs/queries/exercise-instructions-review.sql.

-- 1. Template names: em-dash separator -> spaced hyphen.
update public.routine_templates
set name = replace(name, ' — ', ' - ')
where name like '%—%';

-- 2. Template descriptions: em dash -> comma (prose).
update public.routine_templates
set description = replace(description, ' — ', ', ')
where description like '%—%';

-- 3. Exercise instruction cues (TEXT[]): em dash -> comma in each element,
--    preserving cue order via WITH ORDINALITY.
update public.exercise_instructions
set cues = (
    select array_agg(replace(cue, ' — ', ', ') order by ord)
    from unnest(cues) with ordinality as t(cue, ord)
)
where exists (select 1 from unnest(cues) as c where c like '%—%');
