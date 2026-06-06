-- Generation Phase 0 #3: session-linked logging + the unified DecisionEvent log.
-- Two parts: (1) tie each set_log to its workout session + the calendar day it
-- belongs to, so skip detection / adherence / behavior learning become trustworthy
-- without inferring dates from the abstract program week; (2) a single append/upsert
-- log of every adaptive decision the engine makes. There is no automated runner in
-- this repo; apply this manually against Supabase.

-- 1. Session + calendar attribution on set_logs.
--    session_id groups the sets logged in one workout (nullable: Train-tab logging
--    without a guided session, and all historical rows, have none; ON DELETE SET
--    NULL keeps the log if a session row is later removed).
--    workout_date is the user-local calendar day the set was logged, stamped by the
--    client at save time (not derived server-side) so an offline write that flushes
--    on a later day keeps the day it actually happened.
alter table public.set_logs
    add column if not exists session_id uuid references public.workout_sessions(id) on delete set null;
alter table public.set_logs
    add column if not exists workout_date date;

create index if not exists set_logs_session_idx on public.set_logs (session_id);
create index if not exists set_logs_user_date_idx on public.set_logs (user_id, workout_date);

-- 2. Unified decision log. Ramp-back already persists in program_adjustments (the
--    operational prescription state); this is the canonical *log* the Coach Decision
--    Timeline reads — ramp-back is dual-written here, and deload / progression land
--    here for the first time. swap is in the enum for the timeline but still sourced
--    from exercise_swaps for now.
--    affected_area: the routine_exercise_id a per-lift decision applies to, or ''
--    for a program-wide decision (ramp-back). NOT NULL with a '' sentinel so the
--    unique constraint dedupes program-wide rows (Postgres treats NULLs as distinct).
--    magnitude/payload: jsonb so each decision type carries its own shape
--    (e.g. {fromKg,toKg} for deload, {volumeFactor,rirBonus} for ramp-back).
create table if not exists public.decision_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    routine_id uuid not null references public.workout_routines(id) on delete cascade,
    type text not null check (type in ('ramp_back', 'deload', 'progression', 'swap')),
    trigger text not null,
    affected_area text not null default '',
    week integer not null,
    magnitude jsonb not null default '{}'::jsonb,
    confidence numeric,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    -- One decision per (user, routine, type, lift, week). Lets the action upsert
    -- idempotently, so re-saving sets in a session never duplicates the event.
    unique (user_id, routine_id, type, affected_area, week)
);

create index if not exists decision_events_user_routine_idx
    on public.decision_events (user_id, routine_id, week);

alter table public.decision_events enable row level security;

create policy "decision_events_select"
    on public.decision_events for select using (auth.uid() = user_id);

create policy "decision_events_insert"
    on public.decision_events for insert with check (auth.uid() = user_id);

create policy "decision_events_update"
    on public.decision_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "decision_events_delete"
    on public.decision_events for delete using (auth.uid() = user_id);
