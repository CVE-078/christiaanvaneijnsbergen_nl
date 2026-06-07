# Finish / Debrief Screen Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the post-workout `ShareCard` with a debrief-first screen that captures a session RPE (1-10) and a note, shows a coach summary built from PRs / decisions / per-muscle volume, and offers real image export.

**Architecture:** A new migration adds two nullable columns to `workout_sessions`. Pure functions in `utils.ts` compose a `SessionSummary` (reusing `computeShareStats` and `computePerMuscleVolume`). The session PATCH route gains a debrief-save path. `ShareCard` is reworked into `FinishDebrief` (the overlay), with `RpeScale` (the rating input) and `ShareImageCard` (the export-only clean card) as new sub-components. `LogView` passes the routine-scoped `decisions` and a new `saveSessionDebrief` from `useWorkoutSession`. Export uses `html-to-image`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict), Tailwind v4, Supabase, Vitest + Testing Library, `html-to-image`.

**Spec:** `docs/superpowers/specs/2026-06-07-finish-debrief-rework-design.md`
**Mockup:** `docs/superpowers/designs/2026-06-07-12-00-00-finish-debrief.html`

---

## File Structure

- Create `docs/migrations/2026-06-07-13-00-00-session-debrief.sql` — DB columns.
- Modify `src/lib/pulse/types.ts` — `WorkoutSession` fields, new `SessionSummary`.
- Modify `src/lib/pulse/utils.ts` — `computeSessionTonnage`, `sessionDecisions`, `composeCoachRead`, `computeSessionSummary`.
- Modify `src/app/api/pulse/sessions/[id]/route.ts` — debrief-save path on PATCH.
- Modify `src/hooks/pulse/useWorkoutSession.ts` — `saveSessionDebrief`.
- Create `src/components/pulse/RpeScale.tsx` — 1-10 gauge selector.
- Create `src/components/pulse/ShareImageCard.tsx` — export-only clean card.
- Create `src/components/pulse/FinishDebrief.tsx` — the overlay (replaces `ShareCard.tsx`).
- Delete `src/components/pulse/ShareCard.tsx`.
- Modify `src/components/pulse/views/LogView.tsx` — render `FinishDebrief`, pass `decisions` + `saveSessionDebrief`.
- Tests: `src/lib/pulse/__tests__/utils.test.ts`, `src/hooks/pulse/__tests__/useWorkoutSession.test.ts` (create if absent), `src/components/pulse/__tests__/RpeScale.test.tsx`, `src/components/pulse/__tests__/FinishDebrief.test.tsx`.
- Modify `next.config.mjs` only if CSP blocks `blob:` images (Task 11).
- Add dependency `html-to-image` (Task 11).

---

## Task 1: DB migration + types

**Files:**
- Create: `docs/migrations/2026-06-07-13-00-00-session-debrief.sql`
- Modify: `src/lib/pulse/types.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Session debrief: capture how a workout felt.
-- Adds an optional session RPE (1-10) and a free-text note to workout_sessions.
-- Both nullable so completing without them stays valid. RLS already scopes
-- workout_sessions by user_id, so no policy change is needed.
alter table public.workout_sessions
    add column if not exists session_rpe smallint
        check (session_rpe is null or session_rpe between 1 and 10),
    add column if not exists session_note text
        check (session_note is null or char_length(session_note) <= 1000);
```

- [ ] **Step 2: Extend `WorkoutSession` and add `SessionSummary`**

In `src/lib/pulse/types.ts`, add to the `WorkoutSession` interface (after `completed_at`):

```typescript
    session_rpe: number | null;
    session_note: string | null;
```

Then add `SessionSummary` directly below the `ShareStats` interface (extends it, so the card keeps the existing fields):

```typescript
export interface SessionSummary extends ShareStats {
    // Total external load this session in the display unit (sum of kg*reps over
    // saved sets incl. drop sets). Pure-bodyweight sets contribute their added
    // load only (0 for unloaded).
    tonnage: number;
    // Top muscle categories worked this session, fractional sets, highest first.
    muscles: Array<{ category: ExerciseCategory; sets: number }>;
    // This session's adaptive-engine events, bucketed for the "what adapted" list.
    decisions: { progressions: DecisionEventRow[]; deloads: DecisionEventRow[]; rampBack: DecisionEventRow[] };
    // Deterministic one-line coach read (no LLM).
    coachRead: string;
}
```

`ExerciseCategory` and `DecisionEventRow` are already declared in this file; no new imports needed here.

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS (the new `WorkoutSession` fields may surface errors only where sessions are constructed in tests; if any test factory builds a `WorkoutSession` literal, add `session_rpe: null, session_note: null` there. Search: `grep -rn "started_at:" src --include=*.test.tsx --include=*.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add docs/migrations/2026-06-07-13-00-00-session-debrief.sql src/lib/pulse/types.ts
git commit -m "feat(pulse): add session_rpe and session_note to the session model"
```

> Apply the migration in the Supabase SQL editor before the feature is used live (no migration runner in this repo).

---

## Task 2: Debrief-save path on the session PATCH route

**Files:**
- Modify: `src/app/api/pulse/sessions/[id]/route.ts`

The current PATCH always sets `completed_at` (guarded by `is('completed_at', null)`). Debrief saves happen *after* completion, so a second guarded PATCH would 404. Split into two paths by the request body: an empty body = completion (unchanged), a `{ rpe?, note? }` body = debrief update (no completed_at guard).

- [ ] **Step 1: Replace the route with both paths**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    // An empty body means "complete this session" (the original behavior). A body
    // with rpe/note means "save the debrief" on an already-completed session.
    const body = (await req.json().catch(() => ({}))) as { rpe?: number | null; note?: string | null };
    const isDebrief = 'rpe' in body || 'note' in body;

    if (isDebrief) {
        const update: { session_rpe?: number | null; session_note?: string | null } = {};
        if ('rpe' in body) {
            const rpe = body.rpe;
            if (rpe !== null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) {
                return NextResponse.json({ error: 'rpe must be an integer 1-10 or null' }, { status: 400 });
            }
            update.session_rpe = rpe ?? null;
        }
        if ('note' in body) {
            const note = body.note;
            if (note !== null && typeof note !== 'string') {
                return NextResponse.json({ error: 'note must be a string or null' }, { status: 400 });
            }
            const trimmed = typeof note === 'string' ? note.trim().slice(0, 1000) : null;
            update.session_note = trimmed && trimmed.length > 0 ? trimmed : null;
        }
        const { data, error } = await supabase
            .from('workout_sessions')
            .update(update)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();
        if (error || !data) return NextResponse.json(null, { status: 404 });
        return NextResponse.json(data);
    }

    // Completion path (unchanged).
    const { data, error } = await supabase
        .from('workout_sessions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .select()
        .single();

    if (error || !data) return NextResponse.json(null, { status: 404 });

    // Anchor the program calendar to the first completed session of the routine
    // (clock starts when training actually begins). Best-effort; never blocks
    // the completion response. The `is null` guard makes this a one-time set.
    if (data.routine_id && data.completed_at) {
        await supabase
            .from('workout_routines')
            .update({ program_anchor: data.completed_at })
            .eq('id', data.routine_id)
            .eq('user_id', user.id)
            .is('program_anchor', null);
    }

    return NextResponse.json(data);
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pulse/sessions/[id]/route.ts
git commit -m "feat(pulse): accept a debrief (rpe/note) save on the session PATCH route"
```

---

## Task 3: `saveSessionDebrief` in `useWorkoutSession`

**Files:**
- Modify: `src/hooks/pulse/useWorkoutSession.ts`
- Test: `src/hooks/pulse/__tests__/useWorkoutSession.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/hooks/pulse/__tests__/useWorkoutSession.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkoutSession } from '../useWorkoutSession';

describe('useWorkoutSession.saveSessionDebrief', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    });
    afterEach(() => vi.unstubAllGlobals());

    it('PATCHes the session with the rpe and note body', async () => {
        const { result } = renderHook(() => useWorkoutSession());
        await act(async () => {
            await result.current.saveSessionDebrief('sess-1', { rpe: 7, note: 'felt good' });
        });
        expect(fetch).toHaveBeenCalledWith(
            '/api/pulse/sessions/sess-1',
            expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ rpe: 7, note: 'felt good' }),
            }),
        );
    });

    it('throws when the response is not ok', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        const { result } = renderHook(() => useWorkoutSession());
        await expect(result.current.saveSessionDebrief('sess-1', { rpe: 5, note: null })).rejects.toThrow();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/hooks/pulse/__tests__/useWorkoutSession.test.ts`
Expected: FAIL ("result.current.saveSessionDebrief is not a function").

- [ ] **Step 3: Add `saveSessionDebrief`**

In `src/hooks/pulse/useWorkoutSession.ts`, add this callback after `completeSession` and include it in the returned object:

```typescript
    const saveSessionDebrief = useCallback(
        async (sessionId: string, debrief: { rpe: number | null; note: string | null }): Promise<void> => {
            const res = await fetch(`/api/pulse/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rpe: debrief.rpe, note: debrief.note }),
            });
            if (!res.ok) throw new Error('Failed to save session debrief');
        },
        [],
    );
```

Update the return statement to:

```typescript
    return { session, startSession, completeSession, saveSessionDebrief, clearSession };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/hooks/pulse/__tests__/useWorkoutSession.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/pulse/useWorkoutSession.ts src/hooks/pulse/__tests__/useWorkoutSession.test.ts
git commit -m "feat(pulse): add saveSessionDebrief to useWorkoutSession"
```

---

## Task 4: `computeSessionTonnage`

**Files:**
- Modify: `src/lib/pulse/utils.ts`
- Test: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing test** (append to `utils.test.ts`; import `computeSessionTonnage` from `'../utils'` in the existing import block)

```typescript
describe('computeSessionTonnage', () => {
    const ex = (id: string) => ({ id, exercise: { name: id } }) as any;
    it('sums kg*reps over saved sets for the session exercises in the week', () => {
        const logs = {
            '1-a-0': { kg: 100, reps: 5, rir: 2, saved: true },
            '1-a-1': { kg: 100, reps: 5, rir: 2, saved: true },
            '1-b-0': { kg: 50, reps: 10, rir: 2, saved: true },
            '2-a-0': { kg: 999, reps: 9, rir: 2, saved: true }, // other week, excluded
            '1-c-0': { kg: 80, reps: 8, rir: 2, saved: true }, // not in session, excluded
        } as any;
        // (100*5)+(100*5)+(50*10) = 1500
        expect(computeSessionTonnage([ex('a'), ex('b')], logs, 1, 'kg')).toBe(1500);
    });
    it('includes drop sets and ignores unsaved sets', () => {
        const logs = {
            '1-a-0': { kg: 100, reps: 5, rir: 2, saved: true, drops: [{ kg: 80, reps: 5 }] },
            '1-a-1': { kg: 100, reps: 5, rir: 2, saved: false },
        } as any;
        // 100*5 + 80*5 = 900
        expect(computeSessionTonnage([ex('a')], logs, 1, 'kg')).toBe(900);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t computeSessionTonnage`
Expected: FAIL ("computeSessionTonnage is not a function").

- [ ] **Step 3: Implement** (add to `utils.ts`, near `computeShareStats`; `parseLogKey` and `toDisplay` are already in this file)

```typescript
// Total external load for a session: kg*reps over every saved set (incl. drop
// sets) of the session's exercises in the given week, returned in the display
// unit. Pure-bodyweight sets (kg 0) contribute their added load only.
export function computeSessionTonnage(
    exercises: RoutineExercise[],
    logs: Logs,
    week: number,
    unit: Unit,
): number {
    const ids = new Set(exercises.map((e) => e.id));
    let kg = 0;
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed || parsed.week !== week) continue;
        if (!ids.has(parsed.routineExerciseId)) continue;
        kg += val.kg * val.reps;
        if (val.drops) for (const d of val.drops) kg += d.kg * d.reps;
    }
    return toDisplay(kg, unit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t computeSessionTonnage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(pulse): add computeSessionTonnage"
```

---

## Task 5: `sessionDecisions`

**Files:**
- Modify: `src/lib/pulse/utils.ts`
- Test: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
describe('sessionDecisions', () => {
    const d = (over: Partial<any>) =>
        ({ type: 'progression', trigger: 'targets_hit', affectedArea: 'a', week: 1, magnitude: {}, confidence: null, id: 'x', routine_id: 'r', created_at: '' , ...over }) as any;
    it('buckets by type, scoped to the week and the session exercises', () => {
        const decisions = [
            d({ type: 'progression', affectedArea: 'a', week: 1 }),
            d({ type: 'deload', affectedArea: 'b', week: 1 }),
            d({ type: 'progression', affectedArea: 'c', week: 1 }), // not in session
            d({ type: 'progression', affectedArea: 'a', week: 2 }), // other week
            d({ type: 'ramp_back', affectedArea: '', week: 1 }), // program-wide, matched on week
        ];
        const out = sessionDecisions(decisions, 1, new Set(['a', 'b']));
        expect(out.progressions.map((x) => x.affectedArea)).toEqual(['a']);
        expect(out.deloads.map((x) => x.affectedArea)).toEqual(['b']);
        expect(out.rampBack).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t sessionDecisions`
Expected: FAIL.

- [ ] **Step 3: Implement** (add `DecisionEventRow` to the type imports at the top of `utils.ts`)

```typescript
// Adaptive-engine events attributable to this session: same program week, and
// either targeting one of the session's exercises or program-wide (ramp-back,
// affectedArea ''). Decisions are stored per routine+week+exercise, not by
// session id, so week + exercise membership is the correct attribution.
export function sessionDecisions(
    decisions: DecisionEventRow[],
    week: number,
    exerciseIds: Set<string>,
): { progressions: DecisionEventRow[]; deloads: DecisionEventRow[]; rampBack: DecisionEventRow[] } {
    const inScope = decisions.filter(
        (dec) => dec.week === week && (dec.affectedArea === '' || exerciseIds.has(dec.affectedArea)),
    );
    return {
        progressions: inScope.filter((dec) => dec.type === 'progression'),
        deloads: inScope.filter((dec) => dec.type === 'deload'),
        rampBack: inScope.filter((dec) => dec.type === 'ramp_back'),
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t sessionDecisions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(pulse): add sessionDecisions bucketing"
```

---

## Task 6: `composeCoachRead`

**Files:**
- Modify: `src/lib/pulse/utils.ts`
- Test: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
describe('composeCoachRead', () => {
    it('ramp-back wins over everything', () => {
        expect(composeCoachRead({ prCount: 2, progressionCount: 3, deloadCount: 1, rampBack: true })).toMatch(/ramp-back/i);
    });
    it('celebrates PRs and progressions with the deload clause', () => {
        const s = composeCoachRead({ prCount: 1, progressionCount: 3, deloadCount: 1, rampBack: false });
        expect(s).toMatch(/new PR/i);
        expect(s).toMatch(/progressed 3 lifts/i);
        expect(s).toMatch(/backed off/i);
    });
    it('frames a deload-only session as a smart call', () => {
        expect(composeCoachRead({ prCount: 0, progressionCount: 0, deloadCount: 1, rampBack: false })).toMatch(/smart/i);
    });
    it('falls back to steady on-plan when nothing happened', () => {
        expect(composeCoachRead({ prCount: 0, progressionCount: 0, deloadCount: 0, rampBack: false })).toMatch(/steady/i);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t composeCoachRead`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// Deterministic, rule-based coach read for the debrief (no LLM). Ordered rules:
// ramp-back > wins (PRs/progressions, with a deload clause) > deload-only > steady.
export function composeCoachRead(input: {
    prCount: number;
    progressionCount: number;
    deloadCount: number;
    rampBack: boolean;
}): string {
    const { prCount, progressionCount, deloadCount, rampBack } = input;
    if (rampBack) {
        return 'Easier ramp-back session by design, welcome back. Keep it controlled and rebuild from here.';
    }
    const wins: string[] = [];
    if (prCount > 0) wins.push(prCount === 1 ? 'set a new PR' : `set ${prCount} new PRs`);
    if (progressionCount > 0) {
        wins.push(`progressed ${progressionCount} ${progressionCount === 1 ? 'lift' : 'lifts'}`);
    }
    const deloadClause =
        deloadCount > 0
            ? `, ${deloadCount === 1 ? 'one lift' : `${deloadCount} lifts`} backed off on purpose to reset`
            : '';
    if (wins.length > 0) {
        return `Strong session. You ${wins.join(' and ')}${deloadClause}.`;
    }
    if (deloadCount > 0) {
        return `Smart session. ${deloadCount === 1 ? 'One lift' : `${deloadCount} lifts`} backed off on purpose to break a stall, exactly the right call.`;
    }
    return 'Steady session, right on plan. Nothing needed adjusting, hold the line and keep showing up.';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t composeCoachRead`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(pulse): add composeCoachRead"
```

---

## Task 7: `computeSessionSummary` (composer)

**Files:**
- Modify: `src/lib/pulse/utils.ts`
- Test: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
describe('computeSessionSummary', () => {
    const session = { id: 's', user_id: 'u', routine_id: 'r', workout_type: 'push', variant: 'A', started_at: '2026-05-30T10:00:00Z', completed_at: null, session_rpe: null, session_note: null } as any;
    const exFull = (id: string, cat: string) => ({ id, sets: '3', reps: '8-12', exercise: { name: id, category: cat } }) as any;
    it('composes stats, tonnage, muscles, decisions and a coach read', () => {
        const exercises = [exFull('a', 'chest')];
        const logs = { '1-a-0': { kg: 100, reps: 10, rir: 2, saved: true } } as any;
        const prMap = {} as any;
        const decisions = [
            { type: 'progression', trigger: 'targets_hit', affectedArea: 'a', week: 1, magnitude: {}, confidence: null, id: 'd1', routine_id: 'r', created_at: '' },
        ] as any;
        const out = computeSessionSummary(session, '2026-05-30T11:00:00Z', exercises, logs, prMap, 1, 'kg', decisions);
        expect(out.workoutLabel).toMatch(/Variant A/);
        expect(out.tonnage).toBe(1000);
        expect(out.muscles[0].category).toBe('chest');
        expect(out.decisions.progressions).toHaveLength(1);
        expect(out.coachRead).toMatch(/progressed 1 lift/i);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t computeSessionSummary`
Expected: FAIL.

- [ ] **Step 3: Implement** (add `SessionSummary` to the type imports; `computePerMuscleVolume` and `roundSets` already exist in this file)

```typescript
// One composite the debrief screen consumes: the share stats plus session
// tonnage, top muscles worked, bucketed adaptive decisions, and a coach read.
export function computeSessionSummary(
    session: WorkoutSession,
    completedAt: string,
    exercises: RoutineExercise[],
    logs: Logs,
    prMap: PRMap,
    week: number,
    unit: Unit,
    decisions: DecisionEventRow[],
): SessionSummary {
    const stats = computeShareStats(session, completedAt, exercises, logs, prMap, week, unit);
    const tonnage = computeSessionTonnage(exercises, logs, week, unit);
    const volume = computePerMuscleVolume(logs, exercises, week);
    const muscles = (Object.entries(volume) as [ExerciseCategory, number][])
        .map(([category, sets]) => ({ category, sets: roundSets(sets) }))
        .filter((m) => m.sets > 0)
        .sort((a, b) => b.sets - a.sets)
        .slice(0, 4);
    const ids = new Set(exercises.map((e) => e.id));
    const decisionBuckets = sessionDecisions(decisions, week, ids);
    const coachRead = composeCoachRead({
        prCount: stats.prCount,
        progressionCount: decisionBuckets.progressions.length,
        deloadCount: decisionBuckets.deloads.length,
        rampBack: decisionBuckets.rampBack.length > 0,
    });
    return { ...stats, tonnage, muscles, decisions: decisionBuckets, coachRead };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t computeSessionSummary`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(pulse): add computeSessionSummary composer"
```

---

## Task 8: `RpeScale` component

**Files:**
- Create: `src/components/pulse/RpeScale.tsx`
- Test: `src/components/pulse/__tests__/RpeScale.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RpeScale from '../RpeScale';

describe('RpeScale', () => {
    it('renders 1-10 and shows the prompt when nothing is picked', () => {
        render(<RpeScale value={null} onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Rate effort 1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Rate effort 10' })).toBeInTheDocument();
        expect(screen.getByText(/tap to rate/i)).toBeInTheDocument();
    });
    it('calls onChange with the tapped value', async () => {
        const onChange = vi.fn();
        render(<RpeScale value={null} onChange={onChange} />);
        await userEvent.click(screen.getByRole('button', { name: 'Rate effort 7' }));
        expect(onChange).toHaveBeenCalledWith(7);
    });
    it('shows the read line and marks the selected value when set', () => {
        render(<RpeScale value={7} onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Rate effort 7' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText(/RPE 7/)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/components/pulse/__tests__/RpeScale.test.tsx`
Expected: FAIL ("Cannot find module '../RpeScale'").

- [ ] **Step 3: Implement**

```tsx
'use client';

const ANCHORS: Record<number, string> = {
    1: 'very easy',
    2: 'easy',
    3: 'easy',
    4: 'moderate',
    5: 'moderate',
    6: 'getting hard',
    7: 'hard but a couple reps left in the tank',
    8: 'hard, close to the limit',
    9: 'almost maxed out',
    10: 'all-out, nothing left',
};

export default function RpeScale({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
    return (
        <div className="rounded-2xl border border-pulse-border bg-pulse-surface px-4 pb-3.5 pt-4">
            <div className="font-pulse text-[0.9375rem] font-bold text-pulse-text">How hard was that?</div>
            <div className="mt-3 grid grid-cols-10 gap-[5px]">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                    const selected = value === n;
                    const filled = value !== null && n < value;
                    return (
                        <button
                            key={n}
                            type="button"
                            aria-label={`Rate effort ${n}`}
                            aria-pressed={selected}
                            onClick={() => onChange(n)}
                            className={`grid aspect-square cursor-pointer place-items-center rounded-[9px] border font-pulse-display text-[0.9375rem] font-bold transition-colors ${
                                selected
                                    ? 'border-pulse-accent bg-pulse-accent text-pulse-bg'
                                    : filled
                                      ? 'border-transparent bg-pulse-accent/15 text-pulse-dim'
                                      : 'border-transparent bg-pulse-surface-2 text-pulse-muted hover:text-pulse-dim'
                            }`}>
                            {n}
                        </button>
                    );
                })}
            </div>
            <div className="mt-2.5 flex justify-between font-pulse-body text-[0.5625rem] uppercase tracking-[0.1em] text-pulse-muted">
                <span>Easy</span>
                <span>Hard</span>
                <span>Max</span>
            </div>
            {value === null ? (
                <p className="mt-2.5 font-pulse-body text-[0.6875rem] text-pulse-muted">
                    Tap to rate overall effort (optional)
                </p>
            ) : (
                <p className="mt-2.5 font-pulse-body text-[0.6875rem] text-pulse-accent">
                    RPE {value} · {ANCHORS[value]}.
                </p>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/components/pulse/__tests__/RpeScale.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/RpeScale.tsx src/components/pulse/__tests__/RpeScale.test.tsx
git commit -m "feat(pulse): add the RpeScale session-rating selector"
```

---

## Task 9: `ShareImageCard` (export-only clean card)

**Files:**
- Create: `src/components/pulse/ShareImageCard.tsx`

A presentational, forwardRef card with the celebratory stats only (no notes/RPE), used as the rasterization target. Kept simple so `html-to-image` renders it reliably.

- [ ] **Step 1: Implement**

```tsx
'use client';
import { forwardRef } from 'react';
import type { SessionSummary, Unit } from '@/lib/pulse/types';

interface Props {
    summary: SessionSummary;
    week: number;
    unit: Unit;
}

// Clean, screenshot/export-only card. No inputs or private notes. Rendered
// off-screen by FinishDebrief and rasterized with html-to-image.
const ShareImageCard = forwardRef<HTMLDivElement, Props>(function ShareImageCard({ summary, week, unit }, ref) {
    return (
        <div ref={ref} className="w-[360px] bg-pulse-bg p-6">
            <div className="font-pulse-display text-base font-extrabold tracking-[-0.02em] text-pulse-text">
                Pulse<span className="text-pulse-accent">.</span>
            </div>
            <div className="mt-4 font-pulse-display text-[2rem] font-extrabold uppercase leading-[0.95] tracking-[-0.01em] text-pulse-text">
                {summary.workoutLabel}
            </div>
            <div className="mt-1.5 font-pulse-body text-[0.6875rem] text-pulse-muted">
                {summary.date} · {summary.durationMin} min · Week {week}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                    { v: `${summary.totalSets}`, k: 'Sets' },
                    { v: `${summary.tonnage}`, k: `Volume ${unit}` },
                    { v: `${summary.prCount}`, k: summary.prCount === 1 ? 'PR' : 'PRs' },
                ].map((s) => (
                    <div key={s.k} className="rounded-xl border border-pulse-border bg-pulse-surface px-3 py-3">
                        <div className="font-pulse-display text-2xl font-extrabold leading-none text-pulse-text">
                            {s.v}
                        </div>
                        <div className="mt-1.5 font-pulse-body text-[0.5625rem] uppercase tracking-[0.14em] text-pulse-muted">
                            {s.k}
                        </div>
                    </div>
                ))}
            </div>
            {summary.topLifts.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                    {summary.topLifts.map((lift) => (
                        <div key={lift.name} className="flex items-center gap-2">
                            <span className="flex-1 truncate font-pulse text-[0.8125rem] text-pulse-text">
                                {lift.name}
                            </span>
                            <span className="shrink-0 font-pulse text-[0.8125rem] font-medium text-pulse-text">
                                {lift.displayWeight} {unit} × {lift.reps}
                            </span>
                            {lift.isPR && (
                                <span className="shrink-0 font-pulse text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-pulse-accent">
                                    PR
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

export default ShareImageCard;
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/pulse/ShareImageCard.tsx
git commit -m "feat(pulse): add the export-only ShareImageCard"
```

---

## Task 10: `FinishDebrief` overlay + wire into `LogView`

**Files:**
- Create: `src/components/pulse/FinishDebrief.tsx`
- Delete: `src/components/pulse/ShareCard.tsx`
- Modify: `src/components/pulse/views/LogView.tsx`
- Test: `src/components/pulse/__tests__/FinishDebrief.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinishDebrief from '../FinishDebrief';
import type { WorkoutSession } from '@/lib/pulse/types';

const session = {
    id: 's1', user_id: 'u', routine_id: 'r', workout_type: 'push', variant: 'A',
    started_at: '2026-05-30T10:00:00Z', completed_at: '2026-05-30T11:00:00Z',
    session_rpe: null, session_note: null,
} as WorkoutSession;

const baseProps = {
    session,
    completedAt: '2026-05-30T11:00:00Z',
    exercises: [{ id: 'a', sets: '3', reps: '8-12', exercise: { name: 'Bench', category: 'chest' } }] as any,
    logs: { '1-a-0': { kg: 100, reps: 10, rir: 2, saved: true } } as any,
    prMap: {} as any,
    week: 1,
    unit: 'kg' as const,
    decisions: [] as any,
};

describe('FinishDebrief', () => {
    it('renders the coach read and a steady panel for a quiet session', () => {
        render(<FinishDebrief {...baseProps} saveSessionDebrief={vi.fn()} onDismiss={vi.fn()} />);
        expect(screen.getByText(/steady session/i)).toBeInTheDocument();
    });

    it('saves the picked RPE then dismisses on Done', async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const onDismiss = vi.fn();
        render(<FinishDebrief {...baseProps} saveSessionDebrief={save} onDismiss={onDismiss} />);
        await userEvent.click(screen.getByRole('button', { name: 'Rate effort 7' }));
        await userEvent.click(screen.getByRole('button', { name: /^done$/i }));
        expect(save).toHaveBeenCalledWith('s1', { rpe: 7, note: null });
        expect(onDismiss).toHaveBeenCalled();
    });

    it('dismisses without saving when nothing was entered', async () => {
        const save = vi.fn();
        const onDismiss = vi.fn();
        render(<FinishDebrief {...baseProps} saveSessionDebrief={save} onDismiss={onDismiss} />);
        await userEvent.click(screen.getByRole('button', { name: /^done$/i }));
        expect(save).not.toHaveBeenCalled();
        expect(onDismiss).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/components/pulse/__tests__/FinishDebrief.test.tsx`
Expected: FAIL ("Cannot find module '../FinishDebrief'").

- [ ] **Step 3: Implement `FinishDebrief`**

```tsx
'use client';
import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { computeSessionSummary } from '@/lib/pulse/utils';
import { BTN_PRIMARY_BLOCK } from './ui';
import RpeScale from './RpeScale';
import ShareImageCard from './ShareImageCard';
import type { WorkoutSession, RoutineExercise, Logs, PRMap, Unit, DecisionEventRow } from '@/lib/pulse/types';

interface Props {
    session: WorkoutSession;
    completedAt: string;
    exercises: RoutineExercise[];
    logs: Logs;
    prMap: PRMap;
    week: number;
    unit: Unit;
    decisions: DecisionEventRow[];
    saveSessionDebrief: (sessionId: string, debrief: { rpe: number | null; note: string | null }) => Promise<void>;
    onDismiss: () => void;
}

export default function FinishDebrief({
    session,
    completedAt,
    exercises,
    logs,
    prMap,
    week,
    unit,
    decisions,
    saveSessionDebrief,
    onDismiss,
}: Props) {
    const summary = computeSessionSummary(session, completedAt, exercises, logs, prMap, week, unit, decisions);
    const [rpe, setRpe] = useState<number | null>(null);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const shareRef = useRef<HTMLDivElement>(null);

    async function handleDone() {
        const trimmed = note.trim();
        if (rpe !== null || trimmed.length > 0) {
            setSaving(true);
            try {
                await saveSessionDebrief(session.id, { rpe, note: trimmed.length > 0 ? trimmed : null });
            } catch {
                // Best-effort: the session is already complete; don't block dismissal.
            }
            setSaving(false);
        }
        onDismiss();
    }

    async function handleShare() {
        if (!shareRef.current) return;
        try {
            const dataUrl = await toPng(shareRef.current, { pixelRatio: 2, backgroundColor: '#0e1113' });
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], 'pulse-session.png', { type: 'image/png' });
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file] });
            } else {
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = 'pulse-session.png';
                a.click();
            }
        } catch {
            // User-cancelled share or unsupported; no-op.
        }
    }

    const hasDecisions =
        summary.decisions.progressions.length > 0 ||
        summary.decisions.deloads.length > 0 ||
        summary.decisions.rampBack.length > 0;
    const showAdaptList = summary.prCount > 0 || hasDecisions;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-pulse-bg">
            {/* Off-screen export target */}
            <div className="pointer-events-none fixed left-[-9999px] top-0" aria-hidden>
                <ShareImageCard ref={shareRef} summary={summary} week={week} unit={unit} />
            </div>

            <div className="mx-auto w-full max-w-[440px] px-5 pb-10 pt-7">
                <div className="font-pulse-display text-base font-extrabold tracking-[-0.02em] text-pulse-text">
                    Pulse<span className="text-pulse-accent">.</span>
                </div>
                <div className="mt-3.5 font-pulse-body text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-pulse-success">
                    Session complete
                </div>
                <h2 className="mt-1 font-pulse-display text-[2rem] font-extrabold uppercase leading-[0.95] tracking-[-0.01em] text-pulse-text">
                    {summary.workoutLabel}
                </h2>
                <p className="mt-1.5 font-pulse-body text-[0.6875rem] text-pulse-muted">
                    {summary.date} · {summary.durationMin} min
                </p>

                {/* RPE */}
                <div className="mt-4">
                    <RpeScale value={rpe} onChange={setRpe} />
                </div>

                {/* Notes */}
                <div className="mt-4">
                    <div className="mb-2 font-pulse-body text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-pulse-muted">
                        Notes
                    </div>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={1000}
                        rows={2}
                        placeholder="Anything worth remembering? (optional)"
                        aria-label="Session notes"
                        className="w-full resize-none rounded-2xl border border-pulse-border bg-pulse-surface px-3.5 py-3 font-pulse-body text-[0.8125rem] text-pulse-dim outline-none transition-colors placeholder:text-pulse-muted focus:border-pulse-accent/50"
                    />
                </div>

                {/* Coach summary */}
                <div className="mt-4">
                    <div className="mb-2 font-pulse-body text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-pulse-muted">
                        Coach summary
                    </div>
                    <p className="font-pulse text-[0.9375rem] font-semibold leading-[1.45] text-pulse-text">
                        {summary.coachRead}
                    </p>

                    <div className="mt-3.5 grid grid-cols-3 gap-2">
                        {[
                            { v: `${summary.durationMin}`, suffix: ' min', k: 'Duration' },
                            { v: `${summary.totalSets}`, suffix: '', k: 'Sets' },
                            { v: `${summary.tonnage}`, suffix: ` ${unit}`, k: 'Volume' },
                        ].map((s) => (
                            <div key={s.k} className="rounded-xl border border-pulse-border bg-pulse-surface px-3 py-3">
                                <div className="font-pulse-display text-2xl font-extrabold leading-none text-pulse-text">
                                    {s.v}
                                    <span className="font-pulse text-[0.6875rem] font-semibold text-pulse-dim">
                                        {s.suffix}
                                    </span>
                                </div>
                                <div className="mt-1.5 font-pulse-body text-[0.5625rem] uppercase tracking-[0.14em] text-pulse-muted">
                                    {s.k}
                                </div>
                            </div>
                        ))}
                    </div>

                    {showAdaptList ? (
                        <div className="mt-3.5 flex flex-col gap-1.5">
                            {summary.prCount > 0 && (
                                <div className="rounded-xl border border-pulse-border bg-pulse-surface px-3.5 py-2.5 font-pulse text-[0.8125rem] font-semibold text-pulse-text">
                                    {summary.prCount} {summary.prCount === 1 ? 'new PR' : 'new PRs'} this session
                                </div>
                            )}
                            {summary.decisions.progressions.length > 0 && (
                                <div className="rounded-xl border border-pulse-border bg-pulse-surface px-3.5 py-2.5 font-pulse text-[0.8125rem] font-semibold text-pulse-text">
                                    ↑ Progressed {summary.decisions.progressions.length}{' '}
                                    {summary.decisions.progressions.length === 1 ? 'lift' : 'lifts'}
                                </div>
                            )}
                            {summary.decisions.deloads.length > 0 && (
                                <div className="rounded-xl border border-pulse-border bg-pulse-surface px-3.5 py-2.5 font-pulse text-[0.8125rem] font-semibold text-pulse-dim">
                                    ↓ Auto-deload on {summary.decisions.deloads.length}{' '}
                                    {summary.decisions.deloads.length === 1 ? 'lift' : 'lifts'}
                                </div>
                            )}
                            {summary.decisions.rampBack.length > 0 && (
                                <div className="rounded-xl border border-pulse-border bg-pulse-surface px-3.5 py-2.5 font-pulse text-[0.8125rem] font-semibold text-pulse-accent">
                                    Ramp-back week, eased on purpose
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="mt-3.5 rounded-xl border border-pulse-border bg-pulse-surface px-3.5 py-3 font-pulse-body text-[0.75rem] text-pulse-muted">
                            No PRs and nothing flagged this session, weights held and every set hit its target. That is
                            exactly what an on-plan week looks like.
                        </div>
                    )}

                    {summary.muscles.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {summary.muscles.map((m) => (
                                <span
                                    key={m.category}
                                    className="rounded-lg bg-pulse-surface-2 px-2.5 py-1 font-pulse text-[0.6875rem] font-semibold text-pulse-dim">
                                    {m.category.charAt(0).toUpperCase() + m.category.slice(1)}{' '}
                                    <b className="font-bold text-pulse-accent">{m.sets}</b>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="mt-5 flex flex-col gap-2.5">
                    <button onClick={handleDone} disabled={saving} className={BTN_PRIMARY_BLOCK}>
                        {saving ? 'Saving…' : 'Done'}
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-pulse-border bg-transparent py-3 font-pulse text-[0.875rem] font-semibold text-pulse-dim transition-colors hover:text-pulse-text">
                        Save image to share
                    </button>
                </div>
            </div>
        </div>
    );
}
```

> Note: muscle chips capitalize the category string inline, matching `RailMuscleVolume` (`r.category.charAt(0).toUpperCase() + r.category.slice(1)`). There is no shared category-label map.

- [ ] **Step 4: Wire into `LogView`**

In `src/components/pulse/views/LogView.tsx`:
1. Replace the `ShareCard` import with `import FinishDebrief from '../FinishDebrief';`.
2. Add `decisions` and `saveSessionDebrief` to the existing hook destructures: add `decisions` to the `usePulse()` destructure, and `saveSessionDebrief` to the `useWorkoutSession()` destructure on line 70 (`const { session, startSession, completeSession, saveSessionDebrief, clearSession } = useWorkoutSession();`).
3. Replace the `ShareCard` render (lines 291-302) with this (same `logs`/`prMap`/`week=activeWeek`/`unit` expressions as today, plus the two new props):

```tsx
{shareSession && (
    <FinishDebrief
        session={shareSession.session}
        completedAt={shareSession.completedAt}
        exercises={shareSession.exercises}
        logs={logs}
        prMap={prMap}
        week={activeWeek}
        unit={unit}
        decisions={decisions}
        saveSessionDebrief={saveSessionDebrief}
        onDismiss={() => setShareSession(null)}
    />
)}
```

- [ ] **Step 5: Delete the old component**

```bash
git rm src/components/pulse/ShareCard.tsx
```

- [ ] **Step 6: Run tests + typecheck**

Run: `bun run test:run src/components/pulse/__tests__/FinishDebrief.test.tsx`
Expected: PASS (3 tests).
Run: `bun run typecheck`
Expected: PASS. (If a `ShareCard` test file exists, delete or migrate it; search `grep -rln ShareCard src`.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(pulse): replace ShareCard with the FinishDebrief screen"
```

---

## Task 11: Image-export dependency + CSP

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `next.config.mjs` (only if CSP blocks the export)

- [ ] **Step 1: Add the dependency**

Run: `bun add html-to-image`
Expected: `html-to-image` appears in `package.json` dependencies and `bun.lock` updates.

- [ ] **Step 2: Typecheck (the import in FinishDebrief now resolves)**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Verify the CSP allows the export**

Read `next.config.mjs` and find the `/pulse/*` CSP. Confirm `img-src` permits `data:` and `blob:` (the export builds a `data:` URL and the download fallback uses it directly). If `blob:` is needed and missing, add it to `img-src`. `html-to-image` inlines same-origin `next/font` assets, so no `connect-src` change is expected.

Document any change in the commit message. If no change is needed, note that in the commit body is unnecessary — just proceed.

- [ ] **Step 4: Full suite**

Run: `bun run test:run`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock next.config.mjs
git commit -m "feat(pulse): wire html-to-image export for the finish screen"
```

---

## Task 12: Format, roadmap sync, final verification

**Files:**
- Modify: `docs/roadmap.md`, `CLAUDE.md` (test count if it references one)

- [ ] **Step 1: Format touched files**

Run: `bunx prettier --write src/components/pulse/FinishDebrief.tsx src/components/pulse/RpeScale.tsx src/components/pulse/ShareImageCard.tsx src/components/pulse/views/LogView.tsx src/lib/pulse/utils.ts src/hooks/pulse/useWorkoutSession.ts`
Expected: files formatted.

- [ ] **Step 2: Roadmap**

In `docs/roadmap.md`, in the live-test findings section D, strike/mark the "Finish / share screen rework" bullet as shipped with a one-line summary (RPE + notes capture, coach summary from decisions/PRs/volume, real PNG export). Update the Status block's test count and add the in-review/branch line per the roadmap workflow. Note the two follow-ups (History display of RPE/notes; RPE×duration as a session-load signal) stay open.

- [ ] **Step 3: Final verification**

Run: `bun run typecheck && bun run lint && bun run test:run`
Expected: typecheck clean, lint clean (pre-existing warnings only), all tests pass.

- [ ] **Step 4: Commit**

```bash
git add docs/roadmap.md CLAUDE.md
git commit -m "docs(roadmap): ship the finish/debrief rework"
```

---

## Self-Review Notes

- **Spec coverage:** migration + types (T1), PATCH save (T2), hook (T3), tonnage (T4), decisions (T5), coach read (T6), summary composer (T7), RpeScale (T8), ShareImageCard (T9), FinishDebrief + LogView wiring + ShareCard deletion (T10), html-to-image + CSP (T11), format + roadmap (T12). All spec sections map to a task.
- **Optional rating / dismiss-without-it:** covered in T10 `handleDone` (no save when both empty) and tested.
- **Quiet vs rich states:** the steady panel vs the adapt list in T10, tested.
- **Best-effort save:** `handleDone` swallows save errors and still dismisses, matching `completeSession`.
- **Type consistency:** `SessionSummary extends ShareStats`; `computeSessionSummary` returns it; `FinishDebrief`/`ShareImageCard` consume the same shape. `saveSessionDebrief(sessionId, { rpe, note })` signature is identical across the hook, the test, and `FinishDebrief`.
- **Verified during planning:** there is no shared category-label map, so muscle chips capitalize the category inline (matching `RailMuscleVolume`); the `LogView` render passes `week={activeWeek}`, `logs`, `prMap`, `unit` exactly as the old `ShareCard` did.
```
