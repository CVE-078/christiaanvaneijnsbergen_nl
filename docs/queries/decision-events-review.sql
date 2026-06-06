-- Reusable inspection queries for the unified decision log (run in the Supabase
-- SQL Editor). Read-only. This is the validation gate's instrument: every adaptive
-- call the engine makes (ramp_back / deload / progression) is a first-class row in
-- decision_events, so you can see exactly what the coach decided, when, and why.
--
-- affected_area holds the routine_exercise_id for a per-lift decision (deload /
-- progression) or '' for a program-wide one (ramp_back); the join below resolves
-- it to the exercise name. magnitude is the type-specific change:
--   deload      -> { fromKg, toKg }
--   progression -> { fromKg, toKg, fromReps, toReps }
--   ramp_back   -> { volumeFactor, rirBonus, daysAway? }

-- ── 1. Every decision, newest first, with the lift and "who" resolved ─────────
select
    de.created_at,
    u.email,
    de.type,
    de.trigger,
    de.week,
    coalesce(ex.name, case when de.affected_area = '' then '(program-wide)' else de.affected_area end) as affected,
    de.magnitude,
    de.confidence
from public.decision_events de
left join public.routine_exercises re on re.id = nullif(de.affected_area, '')::uuid
left join public.exercises ex on ex.id = re.exercise_id
left join auth.users u on u.id = de.user_id
order by de.created_at desc;

-- ── 2. Just today's decisions (use after a session to see what fired) ─────────
-- select de.created_at, de.type, de.trigger, de.week,
--        coalesce(ex.name, '(program-wide)') as affected, de.magnitude
-- from public.decision_events de
-- left join public.routine_exercises re on re.id = nullif(de.affected_area, '')::uuid
-- left join public.exercises ex on ex.id = re.exercise_id
-- where de.created_at >= date_trunc('day', now())
-- order by de.created_at desc;

-- ── 3. Summary: how often each decision type has fired ────────────────────────
-- select type, trigger, count(*) as n, min(created_at) as first_seen, max(created_at) as last_seen
-- from public.decision_events
-- group by type, trigger
-- order by n desc;

-- ── 4. Ramp-backs only (the deliberate missed-week test should produce one) ───
-- select de.created_at, u.email, de.week, de.magnitude
-- from public.decision_events de
-- left join auth.users u on u.id = de.user_id
-- where de.type = 'ramp_back'
-- order by de.created_at desc;
