-- Timed-hold logging for set_logs (generation engine quality, P1.3b)
-- Date: 2026-06-15
-- Apply by hand against Supabase (no automated runner in this repo).
--
-- P1.3 made an isometric (e.g. Plank, prescription_unit='time') DISPLAY a hold
-- ("30-60s hold"). P1.3b lets it be LOGGED as a duration in seconds. A hold has no
-- weight x reps, so it stores duration_s and leaves kg/reps at 0. The existing
-- rails (verified live: set_logs_kg_check = kg>0 AND kg<=500; set_logs_reps_check =
-- reps>=1 AND reps<=100) would REJECT a kg=0/reps=0 hold, so they are rewritten to
-- be CONDITIONAL on duration_s: a normal set (duration_s IS NULL) keeps the full
-- rails; a hold (duration_s IS NOT NULL) is exempt. Normal-set logging is unchanged.
--
-- Hold entries are excluded from every weight-based aggregate app-side (e1RM, PR,
-- best set, tonnage) via isTimedEntry (utils.ts), so duration never pollutes the
-- strength math. App-side validation (validateLogEntry) enforces 1<=duration_s<=3600.

-- 1) The duration column (its own bounds; nullable = a normal weighted set).
alter table set_logs
    add column if not exists duration_s smallint
    check (duration_s is null or (duration_s >= 1 and duration_s <= 3600));

-- 2) Make the kg / reps rails conditional so a hold (duration_s set) may store
--    kg=0 / reps=0, while a normal set still requires the full ranges.
alter table set_logs drop constraint if exists set_logs_kg_check;
alter table set_logs add constraint set_logs_kg_check
    check (duration_s is not null or (kg > 0 and kg <= 500));

alter table set_logs drop constraint if exists set_logs_reps_check;
alter table set_logs add constraint set_logs_reps_check
    check (duration_s is not null or (reps >= 1 and reps <= 100));

-- Verify (expect: a normal set still rejects kg=0/reps=0; a hold with duration_s
-- accepts kg=0/reps=0; duration_s outside 1..3600 rejected):
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.set_logs'::regclass and contype = 'c' order by conname;
