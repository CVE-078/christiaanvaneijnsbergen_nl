-- Program pause / injury mode: a user-initiated break in a routine's program
-- calendar. A date span (resumed_at IS NULL = active), distinct from the
-- per-week program_adjustments eases: a pause spans many weeks and has no single
-- effective_week, so it gets its own table rather than a new AdjustmentKind.
-- The engine reads these to freeze program time (no behind/lapsed penalty, no
-- missed-week hit) while a pause runs. There is no automated runner in this
-- repo; apply this manually against Supabase.

create table if not exists public.program_pauses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    routine_id uuid not null references public.workout_routines(id) on delete cascade,
    paused_at timestamptz not null default now(),
    resumed_at timestamptz,
    reason text,
    created_at timestamptz not null default now()
);

create index if not exists program_pauses_user_routine_idx
    on public.program_pauses (user_id, routine_id);

-- At most one active (unresolved) pause per routine. Lets pauseProgram stay
-- idempotent and keeps the engine's "is paused now" check unambiguous.
create unique index if not exists program_pauses_one_active_idx
    on public.program_pauses (routine_id) where (resumed_at is null);

alter table public.program_pauses enable row level security;

create policy "program_pauses_select"
    on public.program_pauses for select using (auth.uid() = user_id);

create policy "program_pauses_insert"
    on public.program_pauses for insert with check (auth.uid() = user_id);

create policy "program_pauses_update"
    on public.program_pauses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "program_pauses_delete"
    on public.program_pauses for delete using (auth.uid() = user_id);
