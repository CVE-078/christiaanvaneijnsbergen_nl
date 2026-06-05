-- Adaptive missed-workout regeneration: calendar anchor, user timezone, and an
-- append-only log of ramp-back decisions. There is no automated runner in this
-- repo; apply this manually against Supabase.

-- 1. Calendar anchor for each routine (program "week 1, day 1").
alter table public.workout_routines add column if not exists program_anchor timestamptz;

-- 2. User timezone (IANA), used to resolve "today"/weekday for adherence.
alter table public.profiles add column if not exists timezone text not null default 'UTC';

-- 3. Backfill each routine's anchor: first completed session, else created_at.
-- One-time schema operation run with migration (superuser) privileges, so it
-- intentionally bypasses RLS; the `is null` guard makes it idempotent.
update public.workout_routines r
set program_anchor = coalesce(
    (select min(s.completed_at) from public.workout_sessions s
        where s.routine_id = r.id and s.completed_at is not null),
    r.created_at)
where r.program_anchor is null;

-- 4. Append-only ramp-back adjustments. One row per accepted/declined re-entry.
create table if not exists public.program_adjustments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    routine_id uuid not null references public.workout_routines(id) on delete cascade,
    kind text not null check (kind in ('reentry_deload', 'reentry_dismissed')),
    effective_week integer not null,
    created_at timestamptz not null default now(),
    payload jsonb not null default '{}'::jsonb,
    -- One decision per (user, routine, week). Lets the action upsert atomically
    -- instead of a racy delete-then-insert, and keeps the engine's offset math
    -- (which counts deload rows) from double-counting duplicates.
    unique (user_id, routine_id, effective_week)
);

create index if not exists program_adjustments_user_routine_idx
    on public.program_adjustments (user_id, routine_id);

alter table public.program_adjustments enable row level security;

create policy "program_adjustments_select"
    on public.program_adjustments for select using (auth.uid() = user_id);

create policy "program_adjustments_insert"
    on public.program_adjustments for insert with check (auth.uid() = user_id);

create policy "program_adjustments_update"
    on public.program_adjustments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "program_adjustments_delete"
    on public.program_adjustments for delete using (auth.uid() = user_id);
