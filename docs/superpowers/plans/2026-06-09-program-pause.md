# Program Pause / Injury Mode Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. TDD: write the failing test, watch it fail, implement, watch it pass, commit. Run `bun run test:run src/lib/pulse/__tests__/adherence.test.ts` for the engine; `bun run test:run` + `bun run typecheck` before finishing.

**Goal:** Add a user-initiated "pause this program" action that suspends a routine's program calendar so a deliberate break (injury, illness, travel, life) reads neither `behind` nor `lapsed` and eats no missed-week adherence hit, then hands back to the existing ramp-back on resume.

**Architecture:** A pause is a **date span**, not a per-week ease, so it gets its own `program_pauses` table (one active pause per routine, `resumed_at IS NULL` = active) rather than being crammed into the week-keyed `program_adjustments` table. The pure engine in `adherence.ts` reads pauses as spans and subtracts paused days from the adherence judgments. The existing ramp-back / progression machinery is untouched: the hand-off on resume is automatic.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Supabase (Postgres + RLS), SWR, Vitest.

---

## Design decisions (the "anchor-semantics rethink" - sanity-check these)

The roadmap flagged this as needing a deliberate rethink of anchor semantics. Here is the model I chose and why.

1. **Storage: a dedicated `program_pauses` table, NOT a new `AdjustmentKind`.** The roadmap suggested reusing `program_adjustments` with a `pause` kind. I rejected that: `program_adjustments` is keyed `UNIQUE (user_id, routine_id, effective_week)` and stores a per-week prescription ease. A pause is a *date span* across many weeks, with no single `effective_week`, and forcing one collides with a real deload/manual-lighten in the same week. A spans table is the long-term-sound shape and the clean foundation for a future scheduled-end ("travel") pause via an additive `expires_at`. **Trade-off:** one more table + loader + hook + route vs a leaky reuse. At our scale, correctness wins.

2. **No `decision_events` dual-write in v1.** `decision_events` is week-keyed with a `(user, routine, type, affected_area, week)` dedupe key; a date-based pause/resume that can recur does not dedupe cleanly there. So the Coach Decision Timeline does NOT show pause/resume yet. This matches the timeline's own deferred "derived events" increment. `decisionCopy.ts` and `DecisionEventType` are untouched. Hook left open for v2.

3. **Two clocks, deliberately different:**
   - **Program time freezes during a pause.** `behindBy` excludes scheduled sessions that fell within a paused span, and `calendarWeek` subtracts paused days. So a completed pause leaves **no permanent behind-debt**, and a routine resumes where it left off.
   - **Detraining time keeps ticking.** `daysSinceLastSession` is left as the *real* gap (not pause-adjusted). So resuming from a long pause naturally trips the existing `lapsed` → ramp-back nudge. The pause protects your *adherence standing*; it does not pretend your muscles didn't detrain. This is the "hand off to ramp-back on resume" the roadmap asked for, achieved with zero change to the ramp-back accept/dismiss flow.

4. **New status `'paused'` short-circuits.** While a pause is active: `status = 'paused'`, `behindBy = 0`, `computeWeekAdherence` returns empty, and `computeRegenSuggestion` returns `null` (no nudges while paused). `weekInteger`/`progressionIndex` are completion-paced and untouched by the pause, so progression is exactly where the user left it.

5. **`progressionInfo` needs no change** - it depends only on `weekInteger` + adjustments, with no calendar/time input.

6. **`reason` column included but no v1 picker.** A nullable `reason` is in the table (future-proof for the Coach Timeline + an injury/illness/travel picker) but the v1 UI pauses without collecting it (passes `null`). Pure UI to add later.

7. **UI is minimal and open for visual review.** A "Pause program" control mirrors the existing "Go easier this week" button; while paused, a "Paused" banner with a "Resume program" button. Styling follows existing LogView patterns; final visual is open for the user to iterate.

---

## File structure

- **New:** `docs/migrations/<ts>-program-pauses.sql` - the table + RLS + partial unique index.
- **New:** `src/app/api/pulse/pauses/route.ts` - GET handler.
- **New:** `src/app/pulse/actions/pause.ts` - `pauseProgram` / `resumeProgram` server actions.
- **New:** `src/hooks/pulse/useProgramPauses.ts` - SWR read + optimistic pause/resume.
- **Modify:** `src/lib/pulse/types.ts` - `ProgramPause`, `AdherenceStatus`, `ProgramPosition`.
- **Modify:** `src/lib/pulse/adherence.ts` - pure helpers + thread pauses into the two compute fns + regen guard.
- **Modify:** `src/lib/pulse/queries.ts` - `loadPauses` + `PAUSES_SELECT`.
- **Modify:** `src/app/pulse/actions.ts` - re-export `./actions/pause`.
- **Modify:** `src/components/pulse/PulseProvider.tsx` - consume, filter, thread, expose, loading/errors.
- **Modify:** `src/context/PulseContext.ts` - `pauseProgram`/`resumeProgram` + `pauses` loading/errors keys.
- **Modify:** `src/components/pulse/views/LogView.tsx` - Pause/Resume control.
- **Tests:** `src/lib/pulse/__tests__/adherence.test.ts` (engine), and extend `RegenNudge` / hook tests if needed.

---

## Task 1: Types

**Files:** Modify `src/lib/pulse/types.ts`

- [ ] **Step 1:** Add `'paused'` to `AdherenceStatus` (line ~370):

```ts
export type AdherenceStatus = 'on_track' | 'behind' | 'lapsed' | 'paused';
```

- [ ] **Step 2:** Add `isPaused` + `pausedDays` to `ProgramPosition` (after `status`):

```ts
    status: AdherenceStatus;
    // True when a pause is currently active for this routine (status === 'paused').
    isPaused: boolean;
    // Days since the active pause began (inclusive), or null when not paused.
    pausedDays: number | null;
    nextEntry: ScheduleEntry | null;
```

- [ ] **Step 3:** Add the `ProgramPause` interface near `ProgramAdjustment` (after the `program_adjustments` block, ~line 333):

```ts
// ── Program pause / injury mode ─────────────────────────────────────────────
// A deliberate, user-initiated break in a routine's program calendar. A date
// span, not a per-week ease: resumed_at IS NULL means the pause is active. The
// engine reads these to freeze program time (no behind/lapsed penalty) while a
// pause runs; detraining time (daysSinceLastSession) keeps ticking so a long
// pause still hands off to the existing ramp-back on resume.
export interface ProgramPause {
    id: string;
    routine_id: string;
    paused_at: string; // ISO; when the pause began
    resumed_at: string | null; // ISO; when resumed. null = still paused.
    reason: string | null; // optional: injury/illness/travel/life. v1 always null.
    created_at: string;
}
```

- [ ] **Step 4:** `bun run typecheck` - expect errors in `adherence.ts` (the two compute fns now need `isPaused`/`pausedDays`) which Task 2 fixes. Commit after Task 2.

---

## Task 2: Engine (adherence.ts) - TDD

**Files:** Modify `src/lib/pulse/adherence.ts`, test `src/lib/pulse/__tests__/adherence.test.ts`

Add pure helpers, thread `pauses` into `computeProgramPosition` + `computeWeekAdherence`, guard `computeRegenSuggestion`.

- [ ] **Step 1: Write failing tests.** Add a `describe('program pause', ...)` block to `adherence.test.ts`. Add a `pause` builder beside `adj`:

```ts
const pause = (paused_at: string, resumed_at: string | null = null): ProgramPause => ({
    id: `p${idc++}`,
    routine_id: 'r',
    paused_at,
    resumed_at,
    reason: null,
    created_at: paused_at,
});
```

Tests (all call `computeProgramPosition` / `computeWeekAdherence` with a new `pauses` arg):

```ts
describe('program pause', () => {
    it('active pause → status paused, behindBy 0, isPaused, pausedDays counted', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-01T08:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [sess('2026-05-01T10:00:00Z', 'upper', 'A')],
            adjustments: [],
            pauses: [pause('2026-05-04T09:00:00Z')], // open, still paused
            tz: 'UTC',
            now: '2026-05-20T12:00:00Z',
        });
        expect(pos.status).toBe('paused');
        expect(pos.isPaused).toBe(true);
        expect(pos.behindBy).toBe(0);
        expect(pos.pausedDays).toBe(16); // 2026-05-04 .. 2026-05-20 inclusive
    });

    it('a completed pause leaves no behind-debt for its scheduled days', () => {
        // 4 sessions/wk schedule, anchored 2026-05-04 (a Monday). Without a pause,
        // by 2026-06-01 many sessions are "expected"; a pause over the whole gap
        // should zero out the debt for paused days.
        const withPause = computeProgramPosition({
            anchor: '2026-05-04T00:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [
                sess('2026-05-04T10:00:00Z', 'upper', 'A'),
                sess('2026-05-05T10:00:00Z', 'lower', 'A'),
            ],
            adjustments: [],
            pauses: [pause('2026-05-06T00:00:00Z', '2026-05-31T00:00:00Z')],
            tz: 'UTC',
            now: '2026-06-01T12:00:00Z',
        });
        expect(withPause.status).not.toBe('paused'); // resumed
        expect(withPause.behindBy).toBe(0); // paused days excluded from expected
    });

    it('resuming from a long pause still trips lapsed → ramp-back hand-off', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-01T08:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [sess('2026-05-02T10:00:00Z', 'upper', 'A')],
            adjustments: [],
            pauses: [pause('2026-05-03T00:00:00Z', '2026-06-10T00:00:00Z')],
            tz: 'UTC',
            now: '2026-06-11T12:00:00Z',
        });
        expect(pos.isPaused).toBe(false);
        expect(pos.daysSinceLastSession).toBeGreaterThanOrEqual(10); // real gap, unadjusted
        expect(pos.status).toBe('lapsed');
    });

    it('computeWeekAdherence is empty while paused', () => {
        const wa = computeWeekAdherence({
            schedule: SCHED,
            sessions: [],
            anchor: '2026-05-01T00:00:00Z',
            pauses: [pause('2026-05-02T00:00:00Z')],
            tz: 'UTC',
            now: '2026-05-10T12:00:00Z',
        });
        expect(wa).toEqual({ missed: [], upcoming: [], done: [] });
    });

    it('no pauses → behavior is byte-identical to before (regression guard)', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-01T08:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [sess('2026-05-01T10:00:00Z', 'upper', 'A'), sess('2026-06-04T10:00:00Z', 'lower', 'A')],
            adjustments: [],
            pauses: [],
            tz: 'UTC',
            now: '2026-06-15T12:00:00Z',
        });
        expect(pos.status).toBe('lapsed');
        expect(pos.isPaused).toBe(false);
        expect(pos.pausedDays).toBeNull();
    });
});
```

Also: import `ProgramPause` in the test file's type imports.

- [ ] **Step 2: Run, expect fail** (`pauses` not accepted; `isPaused` missing). `bun run test:run src/lib/pulse/__tests__/adherence.test.ts`

- [ ] **Step 3: Implement helpers** in `adherence.ts`. Add after `weekdayOf`/`countWeekdayInRange`:

```ts
// ── Pause spans ─────────────────────────────────────────────────────────────

// The active (unresolved) pause for this set, or null. At most one by DB design.
export function activePause(pauses: ProgramPause[]): ProgramPause | null {
    return pauses.find((p) => p.resumed_at === null) ?? null;
}

// A pause as an inclusive day-number interval [startDay, endDay]. An open pause
// ends "today" (now); a resumed pause ends the day before resume (resume day is
// active again). Returns null if the pause hasn't started by `now`.
function pauseInterval(p: ProgramPause, tz: string, now: string): [number, number] | null {
    const startDay = dayIndex(p.paused_at, tz);
    const today = dayIndex(now, tz);
    const endDay = p.resumed_at === null ? today : dayIndex(p.resumed_at, tz) - 1;
    if (startDay > today) return null;
    return [startDay, Math.min(endDay, today)];
}

// Union of all pause intervals clipped to [rangeStart, rangeEnd], as disjoint,
// sorted [a,b] day-number intervals. Merging avoids double-counting overlaps.
function pausedIntervals(
    pauses: ProgramPause[],
    rangeStart: number,
    rangeEnd: number,
    tz: string,
    now: string,
): [number, number][] {
    const raw: [number, number][] = [];
    for (const p of pauses) {
        const iv = pauseInterval(p, tz, now);
        if (!iv) continue;
        const a = Math.max(iv[0], rangeStart);
        const b = Math.min(iv[1], rangeEnd);
        if (a <= b) raw.push([a, b]);
    }
    raw.sort((x, y) => x[0] - y[0]);
    const merged: [number, number][] = [];
    for (const [a, b] of raw) {
        const last = merged[merged.length - 1];
        if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
        else merged.push([a, b]);
    }
    return merged;
}

// Count of distinct paused day-numbers in [rangeStart, rangeEnd].
function pausedDayCount(pauses: ProgramPause[], rangeStart: number, rangeEnd: number, tz: string, now: string): number {
    return pausedIntervals(pauses, rangeStart, rangeEnd, tz, now).reduce((sum, [a, b]) => sum + (b - a + 1), 0);
}

// Scheduled sessions whose date fell within a paused span in [rangeStart, rangeEnd].
function pausedExpectedSessions(
    schedule: ScheduleEntry[],
    pauses: ProgramPause[],
    rangeStart: number,
    rangeEnd: number,
    tz: string,
    now: string,
): number {
    const ivs = pausedIntervals(pauses, rangeStart, rangeEnd, tz, now);
    let total = 0;
    for (const [a, b] of ivs) {
        for (const e of schedule) total += countWeekdayInRange(a, b, e.day_of_week);
    }
    return total;
}
```

- [ ] **Step 4: Thread into `computeProgramPosition`.** Add `pauses` to the args type and body:

```ts
export function computeProgramPosition(args: {
    anchor: string | null | undefined;
    programWeeks: number;
    schedule: ScheduleEntry[];
    sessions: WorkoutSession[];
    adjustments: ProgramAdjustment[];
    pauses: ProgramPause[];
    tz: string;
    now: string;
}): ProgramPosition {
    const { anchor, schedule, sessions, adjustments, pauses, tz, now } = args;
    // ... existing completed/attribute/progressionInfo lines unchanged ...

    const today = dayIndex(now, tz);
    const start = anchor ? dayIndex(anchor, tz) : today;
    const daysElapsed = Math.max(0, today - start);
    // Program time freezes during a pause: subtract paused days from elapsed.
    const pausedElapsed = pausedDayCount(pauses, start, today, tz, now);
    const calendarWeek = Math.floor(Math.max(0, daysElapsed - pausedElapsed) / 7) + 1;

    // ... daysSinceLastSession unchanged (real gap, NOT pause-adjusted) ...

    const rawExpected = schedule.reduce((sum, e) => sum + countWeekdayInRange(start, today - 1, e.day_of_week), 0);
    const pausedExpected = pausedExpectedSessions(schedule, pauses, start, today - 1, tz, now);
    const behindBy = Math.max(0, rawExpected - pausedExpected - completedCount);

    const paused = activePause(pauses) !== null;
    const pausedDays = paused ? pausedDayCount(pauses, start, today, tz, now) : null;

    let status: AdherenceStatus;
    if (paused) status = 'paused';
    else if (daysSinceLastSession !== null && daysSinceLastSession >= GAP_DAYS) status = 'lapsed';
    else if (behindBy > 0) status = 'behind';
    else status = 'on_track';

    return {
        weekInteger,
        progressionIndex,
        isRampBack,
        completedCount,
        calendarWeek,
        behindBy,
        daysSinceLastSession,
        status,
        isPaused: paused,
        pausedDays,
        nextEntry,
    };
}
```

Note: `pausedDays` here counts from `start`, but the active pause always starts at/after `start`, so `pausedDayCount(start, today)` for a single open pause = its own length. (The test expects 16 for 05-04..05-20.)

- [ ] **Step 5: Thread into `computeWeekAdherence`.** Add `pauses` to args; short-circuit when paused; skip paused scheduled days:

```ts
export function computeWeekAdherence(args: {
    schedule: ScheduleEntry[];
    sessions: WorkoutSession[];
    anchor: string | null | undefined;
    pauses: ProgramPause[];
    tz: string;
    now: string;
}): WeekAdherence {
    const { schedule, sessions, anchor, pauses, tz, now } = args;
    if (schedule.length === 0 || !anchor) return { missed: [], upcoming: [], done: [] };
    if (activePause(pauses) !== null) return { missed: [], upcoming: [], done: [] };

    // ... existing window math ...
    const pausedDaysSet = pausedIntervalsToSet(pauses, winStart, winEnd, tz, now); // see helper note

    for (const e of schedule) {
        const scheduledDate = winStart + ((e.day_of_week - winStartWd + 7) % 7);
        const i = matchByType(e);
        if (i !== -1) {
            remaining.splice(i, 1);
            done.push(e);
        } else if (pausedDaysSet.has(scheduledDate)) {
            continue; // a day the program was paused is not "missed"
        } else if (scheduledDate < today) {
            missed.push(e);
        } else {
            upcoming.push(e);
        }
    }
    return { missed, upcoming, done };
}
```

Helper: add `pausedIntervalsToSet` (or inline a `Set<number>` of paused day-numbers in the window) using `pausedIntervals(pauses, winStart, winEnd, tz, now)`:

```ts
function pausedDaySetInRange(pauses: ProgramPause[], rangeStart: number, rangeEnd: number, tz: string, now: string): Set<number> {
    const set = new Set<number>();
    for (const [a, b] of pausedIntervals(pauses, rangeStart, rangeEnd, tz, now)) {
        for (let d = a; d <= b; d++) set.add(d);
    }
    return set;
}
```

(Use `pausedDaySetInRange`; the window is ≤ 7 days so the loop is cheap.)

- [ ] **Step 6: Guard `computeRegenSuggestion`** - add an explicit early return:

```ts
export function computeRegenSuggestion(
    position: ProgramPosition,
    weekAdherence: WeekAdherence,
    adjustments: ProgramAdjustment[],
): RegenSuggestion {
    if (position.isPaused) return null;
    // ... existing body ...
}
```

- [ ] **Step 7: Import `ProgramPause`** in adherence.ts's type import block.

- [ ] **Step 8: Run engine tests** - `bun run test:run src/lib/pulse/__tests__/adherence.test.ts`. Expect PASS. Fix any existing test that calls the two fns without `pauses` (add `pauses: []`).

- [ ] **Step 9: `bun run typecheck`** - expect failures only in PulseProvider (fixed in Task 8). Engine + types clean.

- [ ] **Step 10: Commit** `feat(pulse): pause-aware adherence engine + ProgramPause type`.

---

## Task 3: Migration

**Files:** Create `docs/migrations/<full-timestamp>-program-pauses.sql`

- [ ] **Step 1:** Write the migration (mirror `program_adjustments` RLS; partial unique index for one active pause):

```sql
-- Program pause / injury mode: a user-initiated break in a routine's program
-- calendar. A date span (resumed_at IS NULL = active), distinct from the
-- per-week program_adjustments eases. No automated runner; apply manually.

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

-- At most one active (unresolved) pause per routine.
create unique index if not exists program_pauses_one_active_idx
    on public.program_pauses (routine_id) where (resumed_at is null);

alter table public.program_pauses enable row level security;

create policy "program_pauses_select" on public.program_pauses for select using (auth.uid() = user_id);
create policy "program_pauses_insert" on public.program_pauses for insert with check (auth.uid() = user_id);
create policy "program_pauses_update" on public.program_pauses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "program_pauses_delete" on public.program_pauses for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Commit** `feat(pulse): program_pauses table migration`. (User applies manually against Supabase.)

---

## Task 4: Query loader

**Files:** Modify `src/lib/pulse/queries.ts`

- [ ] **Step 1:** Add the select constant beside the others (~line 47): `const PAUSES_SELECT = 'id, routine_id, paused_at, resumed_at, reason, created_at';`
- [ ] **Step 2:** Add `loadPauses` mirroring `loadAdjustments`:

```ts
export async function loadPauses(supabase: SupabaseServerClient, userId: string): Promise<ProgramPause[]> {
    const { data, error } = await supabase
        .from('program_pauses')
        .select(PAUSES_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
        id: r.id,
        routine_id: r.routine_id,
        paused_at: r.paused_at,
        resumed_at: r.resumed_at ?? null,
        reason: r.reason ?? null,
        created_at: r.created_at,
    }));
}
```

- [ ] **Step 3:** Import `ProgramPause` in queries.ts's type imports. `bun run typecheck`. Commit with Task 5/6.

---

## Task 5: API route

**Files:** Create `src/app/api/pulse/pauses/route.ts` (mirror `adjustments/route.ts`)

- [ ] **Step 1:**

```ts
import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadPauses } from '@/lib/pulse/queries';
import type { ProgramPause } from '@/lib/pulse/types';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;
    let pauses: ProgramPause[] = [];
    try {
        pauses = await loadPauses(supabase, user.id);
    } catch {
        pauses = [];
    }
    return NextResponse.json(pauses);
}
```

(Confirm the exact import path/name of `getUserOrUnauthorized` against `adjustments/route.ts`.)

---

## Task 6: Server actions

**Files:** Create `src/app/pulse/actions/pause.ts`; modify `src/app/pulse/actions.ts`

- [ ] **Step 1:** Write `pause.ts` (mirror `adjustments.ts` auth + ownership):

```ts
'use server';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { UUID_RE } from '@/lib/pulse/utils';
import { assertOwnsRoutine } from './_shared';

// Pause a routine's program. Idempotent: a second pause while one is active is a
// no-op (the partial unique index allows only one unresolved pause per routine).
export async function pauseProgram(routineId: string, reason?: string | null): Promise<void> {
    if (!UUID_RE.test(routineId)) throw new Error('Invalid routine id');
    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutine(supabase, routineId, user.id);

    // Only insert if no active pause exists (avoid the unique-index error path).
    const { data: existing } = await supabase
        .from('program_pauses')
        .select('id')
        .eq('routine_id', routineId)
        .is('resumed_at', null)
        .maybeSingle();
    if (existing) return;

    const { error } = await supabase
        .from('program_pauses')
        .insert({ user_id: user.id, routine_id: routineId, reason: reason ?? null });
    if (error) throw new Error('Failed to pause program');
}

// Resume: close the active pause (set resumed_at = now). No-op if none active.
export async function resumeProgram(routineId: string): Promise<void> {
    if (!UUID_RE.test(routineId)) throw new Error('Invalid routine id');
    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutine(supabase, routineId, user.id);

    const { error } = await supabase
        .from('program_pauses')
        .update({ resumed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('routine_id', routineId)
        .is('resumed_at', null);
    if (error) throw new Error('Failed to resume program');
}
```

- [ ] **Step 2:** Add `export * from './actions/pause';` to `src/app/pulse/actions.ts`.
- [ ] **Step 3:** `bun run typecheck`. Commit `feat(pulse): pause/resume actions + loader + route`.

---

## Task 7: Hook

**Files:** Create `src/hooks/pulse/useProgramPauses.ts`

- [ ] **Step 1:** (optimistic mirror of `useProgramAdjustments`; `now` via `new Date().toISOString()`)

```ts
import useSWR from 'swr';
import { useCallback } from 'react';
import { pauseProgram as serverPause, resumeProgram as serverResume } from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import type { ProgramPause } from '@/lib/pulse/types';

const PAUSES_KEY = '/api/pulse/pauses';
const EMPTY: ProgramPause[] = [];

export function useProgramPauses() {
    const { data, mutate, isLoading, error } = useSWR<ProgramPause[]>(PAUSES_KEY, fetcher, SWR_READ_OPTS);
    const pauses = data ?? EMPTY;

    const pauseProgram = useCallback(
        async (routineId: string): Promise<void> => {
            const optimistic: ProgramPause = {
                id: `optimistic-pause-${routineId}`,
                routine_id: routineId,
                paused_at: new Date().toISOString(),
                resumed_at: null,
                reason: null,
                created_at: new Date().toISOString(),
            };
            // no double pause
            if (pauses.some((p) => p.routine_id === routineId && p.resumed_at === null)) return;
            mutate([...pauses, optimistic], false);
            await serverPause(routineId);
            mutate();
        },
        [pauses, mutate],
    );

    const resumeProgram = useCallback(
        async (routineId: string): Promise<void> => {
            const nowIso = new Date().toISOString();
            mutate(
                pauses.map((p) =>
                    p.routine_id === routineId && p.resumed_at === null ? { ...p, resumed_at: nowIso } : p,
                ),
                false,
            );
            await serverResume(routineId);
            mutate();
        },
        [pauses, mutate],
    );

    return { pauses, pauseProgram, resumeProgram, loading: isLoading, error };
}
```

---

## Task 8: Provider wiring

**Files:** Modify `src/components/pulse/PulseProvider.tsx`

- [ ] **Step 1:** Import + consume the hook (beside `useProgramAdjustments`):

```ts
import { useProgramPauses } from '@/hooks/pulse/useProgramPauses';
// ...
const { pauses, pauseProgram, resumeProgram, loading: loadingPauses, error: pausesError } = useProgramPauses();
```

- [ ] **Step 2:** Add `routinePauses` filter beside `routineAdjustments`:

```ts
const routinePauses = useMemo(
    () => (activeRoutine ? pauses.filter((p) => p.routine_id === activeRoutine.id) : []),
    [pauses, activeRoutine],
);
```

- [ ] **Step 3:** Pass `pauses: routinePauses` into both `computeProgramPosition` and `computeWeekAdherence`; add `routinePauses` to both memo dependency arrays.

- [ ] **Step 4:** Add `pauses: loadingPauses` to the `loading` memo (+ dep), `pauses: !!pausesError` to `errors` (+ dep).

- [ ] **Step 5:** Add `pauseProgram`, `resumeProgram` to the `regenValue` memo (+ deps).

- [ ] **Step 6:** `bun run typecheck` - expect a PulseContext error until Task 9.

---

## Task 9: Context interface

**Files:** Modify `src/context/PulseContext.ts`

- [ ] **Step 1:** Import `ProgramPause` (if exposing `pauses`; we expose actions + the derived `programPosition.isPaused`, so `pauses` array is optional - expose it for symmetry). Add to the regen section:

```ts
    // Program pause / injury mode. isPaused/pausedDays live on programPosition.
    pauseProgram: (routineId: string) => Promise<void>;
    resumeProgram: (routineId: string) => Promise<void>;
```

- [ ] **Step 2:** Add `pauses: boolean;` to both the `loading` and `errors` object types.
- [ ] **Step 3:** `bun run typecheck` clean.
- [ ] **Step 4: Commit** `feat(pulse): wire pauses through provider + context + hook`.

---

## Task 10: UI control (LogView)

**Files:** Modify `src/components/pulse/views/LogView.tsx`

- [ ] **Step 1:** Pull `programPosition`, `pauseProgram`, `resumeProgram` from `usePulse()`. Derive `isPaused = programPosition?.isPaused ?? false`.

- [ ] **Step 2:** When `isPaused`, render a "Paused" banner with a Resume button (mirror the ramp-back banner styling); otherwise, beside "Go easier this week", add a subtle "Pause program" button:

```tsx
{isPaused ? (
    <div className="mt-3 rounded-2xl border border-pulse-accent/30 bg-pulse-surface px-4 py-3">
        <p className="font-pulse text-[0.8125rem] font-semibold text-pulse-accent">Program paused</p>
        <p className="mt-1 font-pulse text-[0.78125rem] text-pulse-dim">
            {programPosition?.pausedDays != null
                ? `Paused for ${programPosition.pausedDays} ${programPosition.pausedDays === 1 ? 'day' : 'days'}. Your program is frozen, nothing counts as missed.`
                : 'Your program is frozen, nothing counts as missed.'}
        </p>
        {activeRoutine && (
            <button
                type="button"
                onClick={() => resumeProgram(activeRoutine.id)}
                className="mt-2.5 cursor-pointer rounded-lg border-none bg-pulse-accent px-3.5 py-1.5 font-pulse text-xs font-semibold text-pulse-bg">
                Resume program
            </button>
        )}
    </div>
) : (
    activeRoutine && routineExercises.length > 0 && (
        <button
            type="button"
            onClick={() => pauseProgram(activeRoutine.id)}
            className="mt-3 ml-2 cursor-pointer rounded-xl border border-pulse-border bg-transparent px-3.5 py-2 font-pulse text-[0.78125rem] font-medium text-pulse-dim transition-colors hover:border-pulse-accent/40 hover:text-pulse-text">
            Pause program
        </button>
    )
)}
```

Placement: directly after the existing "Go easier this week" block (lines ~453-474). When paused, that block's `isRampBack`/"Go easier" controls should be hidden - guard them with `!isPaused` so the screen shows only the Paused banner.

- [ ] **Step 3:** `bun run typecheck` + `bun run lint`. Manually reason about RegenNudge: while paused, `regenSuggestion` is null, so it renders nothing - confirm no extra guard needed.

- [ ] **Step 4: Commit** `feat(pulse): pause/resume control on Train`.

---

## Task 11: Verify + finish

- [ ] **Step 1:** `bun run test:run` (full suite) - all green. Fix any fixture that calls the two engine fns without `pauses: []` (search `computeProgramPosition(` / `computeWeekAdherence(` across tests).
- [ ] **Step 2:** `bun run typecheck` clean; `bun run lint` clean; `bun run format` the touched files.
- [ ] **Step 3:** Code review the full diff (code-reviewer subagent or `/code-review`).
- [ ] **Step 4:** Roadmap FINISH ritual: move #14 to Shipped (dated bullet), clear `In progress:` to `(none)`, set the In-review line to this branch, update the test count, sync the "Pulse architecture" / domain-model notes in `CLAUDE.md` (new `program_pauses` table, `useProgramPauses`, the pause engine semantics). Commit `docs(roadmap): ship program pause / injury mode`.

---

## Self-review notes

- **Spec coverage:** suspend calendar (calendarWeek + behindBy pause-aware ✓), no behind/lapsed during pause (status 'paused' ✓), no missed-week hit (pausedExpectedSessions ✓), hand off to ramp-back on resume (daysSinceLastSession left real ✓). All covered.
- **Type consistency:** `pauses` arg added to BOTH compute fns; `ProgramPause` used identically in types/queries/hook/route/engine; `isPaused`/`pausedDays` added to `ProgramPosition` and consumed in LogView.
- **No silent caps:** none.
- **Regression guard:** the "no pauses → byte-identical" test + the existing suite (search for callers missing `pauses: []`).
