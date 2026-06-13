-- Plan page redesign: store generation duress warnings as a keyed array on the
-- routine, instead of concatenating their sentences into the rationale prose.
-- The Plan page renders them as a distinct, dismissible notice (copy from the
-- WARNING_COPY registry, keyed by these values), so a warning reads as a notice
-- once rather than as permanent rationale boilerplate.
--
-- Keys currently emitted by the generator: 'limited_variety', 'no_compound'.
-- Existing rows default to an empty array (no warning). Hand-apply against
-- Supabase before running the app on this branch (ROUTINES_SELECT now reads the
-- column, so reads error until it exists).

alter table public.workout_routines
    add column if not exists warnings text[] not null default '{}';
