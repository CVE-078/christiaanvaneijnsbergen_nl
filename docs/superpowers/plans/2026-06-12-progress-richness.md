# Progress richness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the three remaining Progress-Overview "richness" pieces: a compact recovery readout, a strength-score trend, and a recent-milestones surface.

**Architecture:** Pure derivation functions (in `src/lib/pulse/`) carry all logic and tests; thin presentational components render them; `HistoryView` wires them into the Overview tab. No schema, server-action, or generation-engine change. One PR definition is shared by the live badge and the milestone feed: best `calcE1RM` per `routineExerciseId` (computePRMap's exact rule AND key), locked by a parity test that cross-checks the milestone value against `computePRMap` on the same logs.

**Tech Stack:** Next.js 15 / React 19 / TypeScript (strict) / Tailwind v4 / Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-12-22-01-15-progress-richness-design.md` (read it, including the "Review amendments 1-6" block).

**Build order:** three independent diffs, one commit each, full suite green before committing. Recovery (Piece 1) → Strength (Piece 2) → Milestones (Piece 3).

**Commands:** test a file `bun run test:run <path>`; full suite `bun run test:run`; types `bun run typecheck`.

---

## PIECE 1: Compact recovery readout (commit 1)

### Task 1.1: `recoveryReadout` pure function + types

**Files:**
- Modify: `src/lib/pulse/utils.ts` (add after `recoverySummaryWord`, ~line 1314)
- Test: `src/lib/pulse/__tests__/recoveryReadout.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pulse/__tests__/recoveryReadout.test.ts
import { describe, it, expect } from 'vitest';
import { recoveryReadout } from '@/lib/pulse/utils';

describe('recoveryReadout', () => {
    it('returns "No data" for an empty map', () => {
        const r = recoveryReadout({});
        expect(r.tone).toBe('none');
        expect(r.word).toBe('No data');
    });

    it('returns "Fresh" when every tracked category is optimal', () => {
        const r = recoveryReadout({ chest: { status: 'optimal' }, back: { status: 'optimal' } });
        expect(r.tone).toBe('fresh');
        expect(r.word).toBe('Fresh');
        expect(r.detail).toBe('all muscles optimal');
    });

    it('returns "Ready" when some are under and none are fatigued', () => {
        const r = recoveryReadout({ chest: { status: 'under' }, back: { status: 'optimal' } });
        expect(r.tone).toBe('ready');
        expect(r.word).toBe('Ready');
        expect(r.detail).toBe('room to build');
    });

    it('returns "Watch" with the fatigued muscles when high_fatigue present', () => {
        const r = recoveryReadout({ back: { status: 'high_fatigue' }, legs: { status: 'high_fatigue' }, chest: { status: 'under' } });
        expect(r.tone).toBe('watch');
        expect(r.word).toBe('Watch');
        expect(r.detail).toBe('back · legs');
        expect(r.muscles).toEqual(['back', 'legs']);
    });

    it('returns "Ease off" when any category is overreaching (worst state wins)', () => {
        const r = recoveryReadout({ chest: { status: 'overreaching' }, back: { status: 'high_fatigue' } });
        expect(r.tone).toBe('easeoff');
        expect(r.word).toBe('Ease off');
        expect(r.detail).toBe('high fatigue · chest');
    });

    it('caps the muscle list at two with a +N overflow', () => {
        const r = recoveryReadout({ back: { status: 'high_fatigue' }, legs: { status: 'high_fatigue' }, chest: { status: 'high_fatigue' } });
        expect(r.detail).toBe('back · legs +1');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/recoveryReadout.test.ts`
Expected: FAIL ("recoveryReadout is not a function" / import error).

- [ ] **Step 3: Implement `recoveryReadout`**

Add to `src/lib/pulse/utils.ts` directly below `recoverySummaryWord` (keep `recoverySummaryWord` as-is for other callers). `RecoveryStatus`, `ExerciseCategory`, `RecoveryDetail` are already imported types in this file.

```ts
export type RecoveryTone = 'fresh' | 'ready' | 'watch' | 'easeoff' | 'none';

export interface RecoveryReadout {
    tone: RecoveryTone;
    word: string;
    detail: string;        // render-ready sub-line (muscles already capped)
    muscles: ExerciseCategory[]; // raw categories driving an amber/red state
}

// Compact recovery readout for the Overview tile. Worst meaningful state wins:
// overreaching (ease off) > high_fatigue (watch) > all optimal (fresh) >
// otherwise (some under, none fatigued = ready, room to train). The dot color
// (chosen in the component) only goes amber/red on real fatigue, so an
// early-week "under volume" no longer reads as an alarm.
export function recoveryReadout(
    recovery: Partial<Record<ExerciseCategory, Pick<RecoveryDetail, 'status'>>>,
): RecoveryReadout {
    const entries = Object.entries(recovery) as Array<[ExerciseCategory, Pick<RecoveryDetail, 'status'>]>;
    if (entries.length === 0) {
        return { tone: 'none', word: 'No data', detail: 'log a session', muscles: [] };
    }
    const at = (s: RecoveryDetail['status']) =>
        entries.filter(([, d]) => d.status === s).map(([cat]) => cat);
    const catLine = (cats: ExerciseCategory[], prefix = ''): string => {
        const shown = cats.slice(0, 2);
        const extra = cats.length - shown.length;
        const list = extra > 0 ? `${shown.join(' · ')} +${extra}` : shown.join(' · ');
        return prefix ? `${prefix} · ${list}` : list;
    };

    const over = at('overreaching');
    if (over.length > 0) return { tone: 'easeoff', word: 'Ease off', detail: catLine(over, 'high fatigue'), muscles: over };

    const fatigued = at('high_fatigue');
    if (fatigued.length > 0) return { tone: 'watch', word: 'Watch', detail: catLine(fatigued), muscles: fatigued };

    if (entries.every(([, d]) => d.status === 'optimal')) {
        return { tone: 'fresh', word: 'Fresh', detail: 'all muscles optimal', muscles: [] };
    }
    return { tone: 'ready', word: 'Ready', detail: 'room to build', muscles: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/recoveryReadout.test.ts`
Expected: PASS (6 tests).

### Task 1.2: Add the `--color-pulse-warn` theme token

**Files:**
- Modify: `src/app/globals.css` (the `@theme` block, after `--color-pulse-text`, line ~27)

- [ ] **Step 1: Add the token**

In the `@theme` block, immediately after the `--color-pulse-text: #e7ebed;` line, add:

```css
    --color-pulse-warn: #fb923c;       /* amber, recovery "watch" + milestone streak */
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run typecheck`
Expected: PASS (no TS error; CSS token usable as `bg-pulse-warn` in Tailwind v4).

### Task 1.3: `RecoveryTile` component

**Files:**
- Create: `src/components/pulse/RecoveryTile.tsx`
- Test: `src/components/pulse/__tests__/RecoveryTile.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/pulse/__tests__/RecoveryTile.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecoveryTile from '../RecoveryTile';

describe('RecoveryTile', () => {
    it('renders the word, detail, and Recovery label', () => {
        render(<RecoveryTile readout={{ tone: 'watch', word: 'Watch', detail: 'back · legs', muscles: ['back', 'legs'] }} />);
        expect(screen.getByText('Watch')).toBeInTheDocument();
        expect(screen.getByText('back · legs')).toBeInTheDocument();
        expect(screen.getByText('Recovery')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/components/pulse/__tests__/RecoveryTile.test.tsx`
Expected: FAIL (cannot find module `../RecoveryTile`).

- [ ] **Step 3: Implement `RecoveryTile`**

```tsx
// src/components/pulse/RecoveryTile.tsx
import type { RecoveryReadout, RecoveryTone } from '@/lib/pulse/utils';

// Dot color per tone. Only watch/easeoff leave green, so the glance stays honest.
const DOT: Record<RecoveryTone, string> = {
    fresh: 'bg-pulse-success',
    ready: 'bg-pulse-success',
    watch: 'bg-pulse-warn',
    easeoff: 'bg-pulse-error',
    none: 'bg-pulse-muted',
};

export default function RecoveryTile({ readout }: { readout: RecoveryReadout }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-pulse-surface p-3.5">
            <span className="inline-flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[readout.tone]}`} aria-hidden />
                <span className="font-pulse-display text-[1.5rem] font-bold leading-none text-pulse-text">
                    {readout.word}
                </span>
            </span>
            <span className="mt-1.5 text-center font-pulse text-[0.6rem] leading-tight text-pulse-dim">
                {readout.detail}
            </span>
            <span className="mt-1.5 font-pulse text-[0.6rem] uppercase tracking-[0.09em] text-pulse-muted">
                Recovery
            </span>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/components/pulse/__tests__/RecoveryTile.test.tsx`
Expected: PASS.

### Task 1.4: Wire `RecoveryTile` into the Overview strip + commit Piece 1

**Files:**
- Modify: `src/components/pulse/views/HistoryView.tsx` (import ~line 13/38; `recoverySummary` memo line 334; recovery tile JSX lines ~484-491)

- [ ] **Step 1: Swap the derivation**

Add to the imports from `@/lib/pulse/utils` (the existing import block, alongside `recoverySummaryWord`): `recoveryReadout`.
Add a new component import near the other component imports: `import RecoveryTile from '@/components/pulse/RecoveryTile';`.

Replace the memo at line 334:

```ts
    const recoverySummary = useMemo(() => recoverySummaryWord(recovery), [recovery]);
```

with:

```ts
    const recovery_readout = useMemo(() => recoveryReadout(recovery), [recovery]);
```

(Remove `recoverySummaryWord` from the import if no longer used in this file. Check with: `grep -n "recoverySummaryWord" src/components/pulse/views/HistoryView.tsx`; if line 334 was the only use, drop it from the import list.)

- [ ] **Step 2: Replace the recovery tile JSX**

Replace this block (lines ~484-491):

```tsx
                        {/* Recovery tile */}
                        <div className="flex flex-col items-center rounded-2xl bg-pulse-surface p-3.5">
                            <span className="font-pulse-display font-bold text-[1.85rem] leading-none text-pulse-text">
                                {recoverySummary}
                            </span>
                            <span className="font-pulse text-[0.6rem] tracking-[0.09em] uppercase text-pulse-muted mt-1.5">
                                Recovery
                            </span>
                        </div>
```

with:

```tsx
                        {/* Recovery tile */}
                        <RecoveryTile readout={recovery_readout} />
```

- [ ] **Step 3: Typecheck + full suite**

Run: `bun run typecheck` then `bun run test:run`
Expected: typecheck clean; full suite green (existing total + 7 new tests from 1.1/1.3).

- [ ] **Step 4: Commit Piece 1**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/recoveryReadout.test.ts src/app/globals.css src/components/pulse/RecoveryTile.tsx src/components/pulse/__tests__/RecoveryTile.test.tsx src/components/pulse/views/HistoryView.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): compact recovery readout on the Overview tile"
```

(Use `GIT_CONFIG_GLOBAL=/dev/null` to dodge the known empty-`gpg.format` flap; repo-local gmail identity is preserved, commit is unsigned.)

---

## PIECE 2: Strength-score trend (commit 2)

### Task 2.1: `computeStrengthScoreSeries` + `strengthDeltaLabel`

**Files:**
- Modify: `src/lib/pulse/strength.ts` (append; `computeStrengthScore`, `classifyLift`, `MainLift`, `Gender` already in scope/imported)
- Test: `src/lib/pulse/__tests__/strengthSeries.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pulse/__tests__/strengthSeries.test.ts
import { describe, it, expect } from 'vitest';
import { computeStrengthScoreSeries, strengthDeltaLabel } from '@/lib/pulse/strength';

const bench = { name: 'Barbell Bench Press', history: [
    { week: 1, e1rm: 90 }, { week: 2, e1rm: 95 }, { week: 3, e1rm: 100 },
] };

describe('computeStrengthScoreSeries', () => {
    it('produces a rising, week-sorted series of non-null scores', () => {
        const s = computeStrengthScoreSeries({ gender: 'male', bodyweightKg: 80, liftsByWeek: [bench] });
        expect(s.length).toBeGreaterThanOrEqual(2);
        expect(s.map((p) => p.week)).toEqual([...s.map((p) => p.week)].sort((a, b) => a - b));
        expect(s[s.length - 1].score).toBeGreaterThanOrEqual(s[0].score);
    });

    it('returns empty when bodyweight is null', () => {
        expect(computeStrengthScoreSeries({ gender: 'male', bodyweightKg: null, liftsByWeek: [bench] })).toEqual([]);
    });

    it('returns empty when no main lifts are present', () => {
        const curl = { name: 'Bicep Curl', history: [{ week: 1, e1rm: 30 }] };
        expect(computeStrengthScoreSeries({ gender: 'male', bodyweightKg: 80, liftsByWeek: [curl] })).toEqual([]);
    });
});

describe('strengthDeltaLabel', () => {
    it('says "log lifts to see" with fewer than two points', () => {
        expect(strengthDeltaLabel([]).tone).toBe('none');
        expect(strengthDeltaLabel([{ week: 1, score: 40 }]).text).toBe('log lifts to see');
    });
    it('reports a rising delta', () => {
        const r = strengthDeltaLabel([{ week: 1, score: 40 }, { week: 4, score: 46 }]);
        expect(r.tone).toBe('up');
        expect(r.text).toBe('▲ 6 this cycle');
    });
    it('reports a falling delta', () => {
        const r = strengthDeltaLabel([{ week: 1, score: 46 }, { week: 4, score: 44 }]);
        expect(r.tone).toBe('down');
        expect(r.text).toBe('▼ 2 this cycle');
    });
    it('reports no change', () => {
        expect(strengthDeltaLabel([{ week: 1, score: 40 }, { week: 4, score: 40 }]).text).toBe('no change');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/strengthSeries.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement both functions**

Append to `src/lib/pulse/strength.ts`:

```ts
// Strength score as a weekly series. For each week present in any lift's
// history, score the cumulative best e1RM per lift as of that week. Bodyweight
// is deliberately held at the current value across the series: this isolates
// e1RM progress so the trend reads as "are my lifts going up". Bodyweight change
// is covered by the Recomp dashboard, folding it in here would conflate two
// signals (a cut/recomp would move the score from weight loss, not lifting).
export function computeStrengthScoreSeries(args: {
    gender: Gender | null;
    bodyweightKg: number | null;
    liftsByWeek: Array<{ name: string; history: Array<{ week: number; e1rm: number }> }>;
}): Array<{ week: number; score: number }> {
    const { gender, bodyweightKg, liftsByWeek } = args;
    const weeks = new Set<number>();
    for (const l of liftsByWeek) for (const h of l.history) weeks.add(h.week);
    const out: Array<{ week: number; score: number }> = [];
    for (const w of [...weeks].sort((a, b) => a - b)) {
        const lifts = liftsByWeek
            .map(({ name, history }) => {
                const upto = history.filter((h) => h.week <= w).map((h) => h.e1rm);
                return upto.length ? { name, e1rm: Math.max(...upto) } : null;
            })
            .filter((x): x is { name: string; e1rm: number } => x !== null);
        const { score } = computeStrengthScore({ gender, bodyweightKg, lifts });
        if (score !== null) out.push({ week: w, score });
    }
    return out;
}

export interface StrengthDelta {
    text: string;
    tone: 'up' | 'down' | 'flat' | 'none';
}

// Tile delta label: latest score vs the first point of the series.
export function strengthDeltaLabel(series: Array<{ week: number; score: number }>): StrengthDelta {
    if (series.length < 2) return { text: 'log lifts to see', tone: 'none' };
    const delta = series[series.length - 1].score - series[0].score;
    if (delta > 0) return { text: `▲ ${delta} this cycle`, tone: 'up' };
    if (delta < 0) return { text: `▼ ${Math.abs(delta)} this cycle`, tone: 'down' };
    return { text: 'no change', tone: 'flat' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/strengthSeries.test.ts`
Expected: PASS (7 tests).

### Task 2.2: Strength tile delta in HistoryView

**Files:**
- Modify: `src/components/pulse/views/HistoryView.tsx` (imports; `strength` memo ~line 296; strength tile JSX lines ~472-482)

- [ ] **Step 1: Add imports + memos**

Add to imports: `import { computeStrengthScore, computeStrengthScoreSeries, strengthDeltaLabel } from '@/lib/pulse/strength';` (extend the existing `computeStrengthScore` import line) and `import { classifyLift } from '@/lib/pulse/strength';` (or fold into the same import).

After the existing `strength` memo (around line 296-336), add:

```ts
    const strengthSeries = useMemo(() => {
        const liftsByWeek = allRoutineExercises
            .filter((re) => classifyLift(re.exercise.name) !== null)
            .map((re) => ({ name: re.exercise.name, history: computeE1RMHistory(windowedLogs, re.id) }))
            .filter((l) => l.history.length > 0);
        return computeStrengthScoreSeries({
            gender: profile.gender,
            // bodyweightLogs is newest-first (queries.ts orders logged_at desc),
            // so [0] is the CURRENT weight, the same convention the existing
            // strength memo and BodyWeightCard already rely on.
            bodyweightKg: bodyweightLogs[0]?.weight_kg ?? null,
            liftsByWeek,
        });
    }, [allRoutineExercises, windowedLogs, profile.gender, bodyweightLogs]);

    const strengthDelta = useMemo(() => strengthDeltaLabel(strengthSeries), [strengthSeries]);
```

(`computeE1RMHistory` is already imported in HistoryView.)

- [ ] **Step 2: Add the delta line to the strength tile**

In the strength `<button>` (lines ~472-482), insert the delta line between the score `<span>` and the `Strength ›` label `<span>`:

```tsx
                            <span className="font-pulse-display font-bold text-[1.85rem] leading-none text-pulse-accent">
                                {strength.score ?? '—'}
                            </span>
                            <span
                                className={`font-pulse text-[0.62rem] font-semibold mt-1 ${
                                    strengthDelta.tone === 'up'
                                        ? 'text-pulse-success'
                                        : strengthDelta.tone === 'down'
                                          ? 'text-pulse-dim'
                                          : 'text-pulse-muted'
                                }`}>
                                {strengthDelta.text}
                            </span>
                            <span className="font-pulse text-[0.6rem] tracking-[0.09em] uppercase text-pulse-muted mt-1.5">
                                Strength &rsaquo;
                            </span>
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

### Task 2.3: Score-trend line in `StrengthBreakdownModal`

**Files:**
- Modify: `src/components/pulse/StrengthBreakdownModal.tsx` (props + render)
- Modify: `src/components/pulse/views/HistoryView.tsx` (pass `series` ~line 520)
- Test: `src/components/pulse/__tests__/StrengthBreakdownModal.test.tsx` (extend)

- [ ] **Step 1: Write the failing test (extend existing file)**

Add this test inside the existing `describe('StrengthBreakdownModal', ...)`:

```tsx
    it('renders a score trend header when a multi-point series is passed', () => {
        render(
            <StrengthBreakdownModal
                open
                strength={strength}
                series={[{ week: 1, score: 40 }, { week: 4, score: 46 }]}
                onClose={() => {}}
            />,
        );
        expect(screen.getByText(/score trend/i)).toBeInTheDocument();
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/components/pulse/__tests__/StrengthBreakdownModal.test.tsx`
Expected: FAIL (no "Score trend" text; `series` prop unknown).

- [ ] **Step 3: Add the `series` prop + inline trend**

In `StrengthBreakdownModal.tsx`, extend `Props`:

```tsx
interface Props {
    open: boolean;
    strength: StrengthScore;
    series?: Array<{ week: number; score: number }>;
    onClose: () => void;
}
```

Destructure `series` and render a small inline SVG line above the per-lift rows (after the score line, before the `<div className="flex-1 overflow-y-auto px-6 pb-2">`). Add this block:

```tsx
            {series && series.length >= 2 && (() => {
                const scores = series.map((p) => p.score);
                const min = Math.min(...scores);
                const max = Math.max(...scores);
                const span = max - min || 1;
                const pts = series
                    .map((p, i) => {
                        const x = (i / (series.length - 1)) * 100;
                        const y = 28 - ((p.score - min) / span) * 24 - 2;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ');
                return (
                    <div className="px-6 pb-3">
                        <div className="mb-1.5 font-pulse text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-pulse-muted">
                            Score trend
                        </div>
                        <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-10 w-full">
                            <polyline
                                points={pts}
                                fill="none"
                                stroke="var(--color-pulse-accent)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                );
            })()}
```

- [ ] **Step 4: Pass `series` from HistoryView**

At the `StrengthBreakdownModal` usage (~line 520), add the prop:

```tsx
                    <StrengthBreakdownModal
                        open={strengthModalOpen}
                        strength={strength}
                        series={strengthSeries}
                        onClose={() => setStrengthModalOpen(false)}
                    />
```

- [ ] **Step 5: Run the modal test + full suite**

Run: `bun run test:run src/components/pulse/__tests__/StrengthBreakdownModal.test.tsx` then `bun run typecheck` then `bun run test:run`
Expected: modal tests PASS (incl. new one); typecheck clean; full suite green.

- [ ] **Step 6: Commit Piece 2**

```bash
git add src/lib/pulse/strength.ts src/lib/pulse/__tests__/strengthSeries.test.ts src/components/pulse/StrengthBreakdownModal.tsx src/components/pulse/__tests__/StrengthBreakdownModal.test.tsx src/components/pulse/views/HistoryView.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): strength-score trend on the Overview tile and breakdown modal"
```

---

## PIECE 3: Recent milestones surface (commit 3)

### Task 3.1: `completedWeekBoundaries` in adherence.ts

**Files:**
- Modify: `src/lib/pulse/adherence.ts` (add a new export; reuses the existing private `matchSlot`, leaves `attributeSessions` untouched)
- Test: `src/lib/pulse/__tests__/adherence.test.ts` (extend)

- [ ] **Step 1: Write the failing test (extend existing file)**

```ts
// add to src/lib/pulse/__tests__/adherence.test.ts
import { completedWeekBoundaries } from '@/lib/pulse/adherence';
import type { ScheduleEntry, WorkoutSession } from '@/lib/pulse/types';

function sess(id: string, type: string, completedAt: string): WorkoutSession {
    return {
        id, user_id: 'u', routine_id: 'r', workout_type: type, variant: null,
        started_at: completedAt, completed_at: completedAt, session_rpe: null, session_note: null,
    };
}

describe('completedWeekBoundaries', () => {
    const schedule: ScheduleEntry[] = [
        { day_of_week: 1, workout_type: 'upper' }, { day_of_week: 4, workout_type: 'lower' },
    ];
    it('emits one boundary per completed cycle, dated at the closing session', () => {
        const sessions = [
            sess('a', 'upper', '2026-05-01T10:00:00Z'),
            sess('b', 'lower', '2026-05-04T10:00:00Z'), // completes week 1
            sess('c', 'upper', '2026-05-08T10:00:00Z'),
            sess('d', 'lower', '2026-05-11T10:00:00Z'), // completes week 2
        ];
        const b = completedWeekBoundaries(schedule, sessions);
        expect(b.map((x) => x.week)).toEqual([1, 2]);
        expect(b[0].session.id).toBe('b');
        expect(b[1].session.id).toBe('d');
    });
    it('returns empty for an empty schedule', () => {
        expect(completedWeekBoundaries([], [sess('a', 'upper', '2026-05-01T10:00:00Z')])).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/adherence.test.ts`
Expected: FAIL (`completedWeekBoundaries` not exported).

- [ ] **Step 3: Implement (reuse `matchSlot`)**

Add to `src/lib/pulse/adherence.ts` (anywhere after `matchSlot` is defined, e.g. right after `attributeSessions`):

```ts
// Week-completion events for the milestone feed. Replays the same matchSlot /
// cycle-reset walk as attributeSessions (one definition of "week completed"),
// emitting the absolute program week and the session that closed each cycle.
export function completedWeekBoundaries(
    schedule: ScheduleEntry[],
    sessions: WorkoutSession[],
): Array<{ week: number; session: WorkoutSession }> {
    if (schedule.length === 0) return [];
    const completed = sessions
        .filter((s) => s.completed_at)
        .slice()
        .sort((a, b) => (a.completed_at as string).localeCompare(b.completed_at as string));
    const out: Array<{ week: number; session: WorkoutSession }> = [];
    let week = 1;
    let remaining = schedule.slice();
    for (const s of completed) {
        const i = matchSlot(remaining, s);
        if (i === -1) continue;
        remaining.splice(i, 1);
        if (remaining.length === 0) {
            out.push({ week, session: s });
            week++;
            remaining = schedule.slice();
        }
    }
    return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/adherence.test.ts`
Expected: PASS.

### Task 3.2: `milestones.ts` model + `computeMilestones`

**Files:**
- Create: `src/lib/pulse/milestones.ts`
- Test: `src/lib/pulse/__tests__/milestones.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pulse/__tests__/milestones.test.ts
import { describe, it, expect } from 'vitest';
import { computeMilestones } from '@/lib/pulse/milestones';
import { computePRMap, toDisplay } from '@/lib/pulse/utils';
import { assembleWorkouts, type Workout } from '@/lib/pulse/workouts';
import type { Logs, WorkoutSession, ScheduleEntry } from '@/lib/pulse/types';

// Valid v4 UUIDs: parseLogKey enforces UUID_RE (version nibble 4, variant 8/9/a/b),
// so log keys with non-v4 ids are silently rejected (known fixture gotcha).
const RE = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const RE2 = 'b2c3d4e5-f6a1-4890-abcd-ef1234567890';

function session(id: string, at: string): WorkoutSession {
    return { id, user_id: 'u', routine_id: 'r', workout_type: 'upper', variant: null, started_at: at, completed_at: at, session_rpe: null, session_note: null };
}
const entry = (kg: number, reps: number, sid: string | null) => ({ kg, reps, rir: 2, saved: true, session_id: sid });
const nameFor = () => 'Barbell Bench Press';

// Hand-built workout for tests that need no logs (sort, session_count).
function workout(id: string, date: string, kg: number, reps: number): Workout {
    return {
        id, date, workoutType: 'upper', variant: null, durationMin: 60, setCount: 1,
        exercises: [{ routineExerciseId: RE, name: 'Barbell Bench Press', sets: [{ kg, reps, rir: 2 }], setCount: 1, maxKg: kg, avgKg: kg }],
    };
}

describe('computeMilestones', () => {
    it('derives PRs from the same logs as computePRMap: baseline skipped, value matches the canonical best', () => {
        // Real pipeline: logs -> assembleWorkouts -> computeMilestones, then
        // cross-check the milestone value against computePRMap on the SAME logs.
        const logs: Logs = { [`1-${RE}-0`]: entry(90, 5, 's1'), [`2-${RE}-0`]: entry(100, 5, 's2') };
        const sessions = [session('s1', '2026-05-01T10:00:00Z'), session('s2', '2026-05-08T10:00:00Z')];
        const workouts = assembleWorkouts(sessions, logs, nameFor);
        const m = computeMilestones({ workouts, logs, sessions, schedule: [], programWeeks: 12, unit: 'kg' });
        const prs = m.filter((x) => x.kind === 'pr');
        expect(prs).toHaveLength(1); // w1 is the baseline, only w2 is a new PR
        expect(prs[0].title).toContain('Barbell Bench Press');
        // Parity lock: the milestone's e1RM is exactly the badge's canonical best.
        const canonical = Math.round(toDisplay(computePRMap(logs)[RE], 'kg'));
        expect(prs[0].detail).toContain(`${canonical} kg e1RM`);
    });

    it('does not emit a false PR when a lift reappears under a new routineExerciseId (routine regenerate)', () => {
        // RE2 lifts heavier than RE's best, but a fresh reId is a fresh baseline,
        // exactly like the badge (computePRMap / isSetPR never compare across reIds).
        const logs: Logs = {
            [`1-${RE}-0`]: entry(90, 5, 's1'),
            [`2-${RE}-0`]: entry(100, 5, 's2'),
            [`3-${RE2}-0`]: entry(110, 5, 's3'),
        };
        const sessions = [session('s1', '2026-05-01T10:00:00Z'), session('s2', '2026-05-08T10:00:00Z'), session('s3', '2026-05-15T10:00:00Z')];
        const workouts = assembleWorkouts(sessions, logs, nameFor);
        const m = computeMilestones({ workouts, logs, sessions, schedule: [], programWeeks: 12, unit: 'kg' });
        expect(m.filter((x) => x.kind === 'pr')).toHaveLength(1); // only RE's w2 PR
    });

    it('sorts newest-first by date', () => {
        const workouts = [workout('w1', '2026-05-01T10:00:00Z', 90, 5), workout('w2', '2026-05-08T10:00:00Z', 100, 5)];
        const m = computeMilestones({ workouts, logs: {}, sessions: [], schedule: [], programWeeks: 12, unit: 'kg' });
        expect(new Date(m[0].dateIso).getTime()).toBeGreaterThanOrEqual(new Date(m[m.length - 1].dateIso).getTime());
    });

    it('disambiguates week_completed titles across the block wrap', () => {
        // 1-day schedule so each session completes a week; 13 sessions -> absolute week 13.
        const schedule: ScheduleEntry[] = [{ day_of_week: 1, workout_type: 'upper' }];
        const sessions = Array.from({ length: 13 }, (_, i) =>
            session(`s${i}`, `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`));
        const m = computeMilestones({ workouts: [], logs: {}, sessions, schedule, programWeeks: 12, unit: 'kg' });
        const titles = m.filter((x) => x.kind === 'week_completed').map((x) => x.title);
        expect(titles).toContain('Completed Week 1');           // absolute week 1, cycle 1: no suffix
        expect(titles).toContain('Completed Week 1 · Cycle 2'); // absolute week 13: wrapped AND disambiguated
        expect(titles.every((t) => !/Week 13/.test(t))).toBe(true);
    });

    it('emits a session_count milestone at 10 sessions', () => {
        const workouts = Array.from({ length: 10 }, (_, i) => workout(`w${i}`, `2026-05-${String(i + 1).padStart(2, '0')}T10:00:00Z`, 50, 5));
        const m = computeMilestones({ workouts, logs: {}, sessions: [], schedule: [], programWeeks: 12, unit: 'kg' });
        expect(m.some((x) => x.kind === 'session_count' && x.title === '10 sessions logged')).toBe(true);
    });

    it('emits one streak milestone per new record and nothing for a rebuild below it', () => {
        // Weeks 1,2,3 set records at runs 2 and 3. Weeks 5,6 rebuild a 2-week run
        // BELOW the record: a per-week emitter would wrongly add a second
        // "2-week streak" here, so the exact toEqual locks emit-once-per-record.
        const logs: Logs = {
            [`1-${RE}-0`]: entry(50, 5, 's1'),
            [`2-${RE}-0`]: entry(50, 5, 's2'),
            [`3-${RE}-0`]: entry(50, 5, 's3'),
            [`5-${RE}-0`]: entry(50, 5, 's5'),
            [`6-${RE}-0`]: entry(50, 5, 's6'),
        };
        const sessions = [
            session('s1', '2026-05-01T10:00:00Z'), session('s2', '2026-05-08T10:00:00Z'),
            session('s3', '2026-05-15T10:00:00Z'), session('s5', '2026-05-29T10:00:00Z'),
            session('s6', '2026-06-05T10:00:00Z'),
        ];
        const m = computeMilestones({ workouts: [], logs, sessions, schedule: [], programWeeks: 12, unit: 'kg' });
        const titles = m.filter((x) => x.kind === 'streak').map((x) => x.title);
        expect(titles).toEqual(['3-week streak', '2-week streak']); // newest-first, exactly these
    });

    it('omits a streak record it cannot date instead of epoch-dating it', () => {
        // No session_id on the logs (pre-Phase-0 rows): the record cannot be dated,
        // so it is omitted from the feed rather than sorted to 1970.
        const logs: Logs = { [`1-${RE}-0`]: entry(50, 5, null), [`2-${RE}-0`]: entry(50, 5, null) };
        const m = computeMilestones({ workouts: [], logs, sessions: [], schedule: [], programWeeks: 12, unit: 'kg' });
        expect(m.filter((x) => x.kind === 'streak')).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/milestones.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `milestones.ts`**

```ts
// src/lib/pulse/milestones.ts
//
// Derived "recent milestones" feed for the Progress Overview. Pure, read-only,
// recomputed in full on every load (no persistence), so existing users and the
// seeded test accounts get a backfilled feed of past wins.
//
// ONE PR definition, same rule AND same key as the live badge:
//   - computePRMap (utils.ts:555) keys by routineExerciseId and keeps the best
//     calcE1RM(kg, reps) over every saved set's top-level kg/reps (drops and rir
//     ignored, strict >, no threshold). It exposes current bests only, no dated
//     history.
//   - isSetPR (utils.ts:941) reads that map by routineExerciseId; the badge
//     consumers (ExerciseCard, WorkoutModeScreen) call it with re.id.
// This module derives the DATED version of that exact rule by walking
// session-linked workouts oldest-first; a parity test cross-checks the milestone
// value against computePRMap on the same logs. A routine regenerate gives a
// lift a fresh routineExerciseId, which is a fresh baseline here, exactly as in
// the badge (neither path compares across reIds), so no false "New PR" fires.
// No noise threshold, matching the badge; discrete plate/rep increments make
// sub-1% PRs rare, and a threshold, if ever wanted, must land in both paths.
//
// Dating limitation: set_logs carry no date column client-side (LOGS_SELECT in
// queries.ts), so session_id -> workout_sessions.started_at is the only date
// source. PRs and streak records that cannot be dated are omitted from this
// feed (never epoch-dated); the live badge still flags undated PRs.
import { calcE1RM, parseLogKey, toDisplay, weekInBlock, getPhase } from './utils';
import { completedWeekBoundaries } from './adherence';
import type { Workout } from './workouts';
import type { Logs, WorkoutSession, ScheduleEntry, Unit } from './types';

export type MilestoneKind = 'pr' | 'streak' | 'week_completed' | 'session_count';

export interface Milestone {
    id: string;
    kind: MilestoneKind;
    title: string;
    detail: string;
    dateIso: string;
}

export function computeMilestones(input: {
    workouts: Workout[];
    logs: Logs;
    sessions: WorkoutSession[];
    schedule: ScheduleEntry[];
    programWeeks: number;
    unit: Unit;
}): Milestone[] {
    const { workouts, logs, sessions, schedule, programWeeks, unit } = input;
    const out: Milestone[] = [];
    const byDate = [...workouts].sort((a, b) => a.date.localeCompare(b.date)); // oldest-first

    // 1. PR: running best calcE1RM per routineExerciseId, computePRMap's exact
    // rule and key (strict > over the prior best), replayed in date order.
    const best: Record<string, number> = {};
    for (const w of byDate) {
        for (const ex of w.exercises) {
            const e = Math.max(...ex.sets.map((s) => calcE1RM(s.kg, s.reps)));
            const prior = best[ex.routineExerciseId];
            if (prior === undefined) {
                best[ex.routineExerciseId] = e; // baseline, not a "new" PR
                continue;
            }
            if (e > prior) {
                const pct = Math.round(((e - prior) / prior) * 100);
                out.push({
                    id: `pr:${ex.routineExerciseId}:${w.id}`,
                    kind: 'pr',
                    title: `New PR · ${ex.name}`,
                    detail: `${Math.round(toDisplay(e, unit))} ${unit} e1RM${pct > 0 ? ` · +${pct}% over your last best` : ''}`,
                    dateIso: w.date,
                });
                best[ex.routineExerciseId] = e;
            }
        }
    }

    // 2. session_count: every 10th workout by date.
    byDate.forEach((w, i) => {
        const n = i + 1;
        if (n % 10 === 0) {
            out.push({ id: `count:${n}`, kind: 'session_count', title: `${n} sessions logged`, detail: 'since you started', dateIso: w.date });
        }
    });

    // 3. week_completed: reuse the canonical attributeSessions matching. Weeks
    // wrap the block (week 13 of a 12-week program is block-week 1), and past
    // the first cycle the title carries the cycle number so two milestones never
    // read identically ("Completed Week 1" vs "Completed Week 1 · Cycle 2").
    // "Cycle" is the user-facing word already used by the Progress window toggle.
    for (const { week, session } of completedWeekBoundaries(schedule, sessions)) {
        const wib = weekInBlock(week, programWeeks);
        const cycle = Math.floor((week - 1) / programWeeks) + 1;
        out.push({
            id: `week:${week}`,
            kind: 'week_completed',
            title: cycle > 1 ? `Completed Week ${wib} · Cycle ${cycle}` : `Completed Week ${wib}`,
            detail: getPhase(week, programWeeks).label,
            dateIso: session.started_at,
        });
    }

    // 4. streak: computeStreak's program-week bucketing (the set of logged weeks
    // from the log-key week segment, ALL saved logs, linked or not, so the run
    // math matches computeStreak exactly); emit once per new all-time record.
    const weekDate = new Map<number, string>(); // program week -> latest session start
    const sessionStart = new Map(sessions.map((s) => [s.id, s.started_at]));
    const loggedWeeks = new Set<number>();
    for (const [key, v] of Object.entries(logs)) {
        if (!v?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        loggedWeeks.add(parsed.week);
        const start = v.session_id ? sessionStart.get(v.session_id) : undefined;
        if (start) {
            const cur = weekDate.get(parsed.week);
            if (!cur || start > cur) weekDate.set(parsed.week, start);
        }
    }
    const sortedWeeks = [...loggedWeeks].sort((a, b) => a - b);
    let run = 0;
    let prevWeek: number | null = null;
    let record = 1; // a "streak" needs >= 2 consecutive weeks to be notable
    for (const w of sortedWeeks) {
        run = prevWeek !== null && w === prevWeek + 1 ? run + 1 : 1;
        prevWeek = w;
        if (run >= 2 && run > record) {
            record = run; // the record advances even when the week is undated,
            // so a later dated week never re-emits a stale, smaller record
            const date = weekDate.get(w);
            if (!date) continue; // undated (no session-linked logs): omit, never epoch-date
            out.push({
                id: `streak:${run}`,
                kind: 'streak',
                title: `${run}-week streak`,
                detail: 'your longest run yet',
                dateIso: date,
            });
        }
    }

    // Newest-first.
    return out.sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}
```

Note: `getPhase(week, weeks)` returns a `Phase` whose human label is `.label` (verified: `Phase` is `{ weeks, label, subtitle, rir, color }`), and it already wraps the block internally via `weekInBlock`, so passing the absolute week is correct.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/milestones.test.ts`
Expected: PASS (7 tests).

### Task 3.3: `MilestonesCard` component + "show all" modal

**Files:**
- Create: `src/components/pulse/MilestonesCard.tsx`
- Test: `src/components/pulse/__tests__/MilestonesCard.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/pulse/__tests__/MilestonesCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MilestonesCard from '../MilestonesCard';
import type { Milestone } from '@/lib/pulse/milestones';

function mk(i: number): Milestone {
    return { id: `count:${i}`, kind: 'session_count', title: `${i} sessions logged`, detail: 'since you started', dateIso: `2026-05-${String(i).padStart(2, '0')}T10:00:00Z` };
}

describe('MilestonesCard', () => {
    it('renders nothing when there are no milestones', () => {
        const { container } = render(<MilestonesCard milestones={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
    it('shows up to four rows and a "Show all" button past the cap', () => {
        render(<MilestonesCard milestones={[1, 2, 3, 4, 5].map(mk)} />);
        expect(screen.getByText('5 sessions logged')).toBeInTheDocument(); // newest first
        expect(screen.getByRole('button', { name: /show all 5 milestones/i })).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:run src/components/pulse/__tests__/MilestonesCard.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `MilestonesCard`**

Reuses the shared `ModalSheet` (count subtitle) for "Show all", matching the AllWorkouts/AllLifts pattern. The card assumes `milestones` is already newest-first (computeMilestones sorts).

```tsx
// src/components/pulse/MilestonesCard.tsx
'use client';
import { useState } from 'react';
import ModalSheet from './ModalSheet';
import { formatLogDate } from '@/lib/pulse/dates';
import type { Milestone, MilestoneKind } from '@/lib/pulse/milestones';

// Icon per kind (presentation lives here, not in the model).
function Icon({ kind }: { kind: MilestoneKind }) {
    const common = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    if (kind === 'pr') return (<svg {...common}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>);
    if (kind === 'streak') return (<svg {...common}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/></svg>);
    if (kind === 'week_completed') return (<svg {...common} strokeWidth={2.2}><path d="M20 6 9 17l-5-5"/></svg>);
    return (<svg {...common}><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>);
}

const ICON_WRAP: Record<MilestoneKind, string> = {
    pr: 'bg-pulse-accent/15 text-pulse-accent',
    streak: 'bg-pulse-warn/15 text-pulse-warn',
    week_completed: 'bg-pulse-success/15 text-pulse-success',
    session_count: 'bg-pulse-surface-2 text-pulse-dim',
};

function Row({ m, today }: { m: Milestone; today: string }) {
    return (
        <div className="flex items-center gap-3 border-b border-pulse-border py-3 last:border-b-0">
            <span className={`grid h-[33px] w-[33px] shrink-0 place-items-center rounded-[10px] ${ICON_WRAP[m.kind]}`}>
                <Icon kind={m.kind} />
            </span>
            <div className="min-w-0 flex-1">
                <div className="font-pulse text-[0.9rem] font-medium text-pulse-text">{m.title}</div>
                <div className="mt-[2px] font-pulse text-[0.74rem] text-pulse-muted">{m.detail}</div>
            </div>
            <span className="shrink-0 font-pulse text-[0.72rem] text-pulse-muted">{formatLogDate(m.dateIso.split('T')[0], today)}</span>
        </div>
    );
}

export default function MilestonesCard({ milestones }: { milestones: Milestone[] }) {
    const [allOpen, setAllOpen] = useState(false);
    if (milestones.length === 0) return null;
    const today = new Date().toISOString().split('T')[0];
    const top = milestones.slice(0, 4);

    return (
        <div className="rounded-2xl bg-pulse-surface px-4 py-1.5">
            {top.map((m) => (<Row key={m.id} m={m} today={today} />))}
            {milestones.length > 4 && (
                <button
                    type="button"
                    onClick={() => setAllOpen(true)}
                    className="mt-1.5 mb-1 flex w-full items-center justify-center gap-[7px] rounded-xl bg-pulse-surface-2 px-4 py-[11px] font-pulse text-[0.8rem] font-medium text-pulse-accent border-none cursor-pointer">
                    Show all {milestones.length} milestones
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="6 9 12 15 18 9"/></svg>
                </button>
            )}
            <ModalSheet
                open={allOpen}
                onClose={() => setAllOpen(false)}
                title="Milestones"
                subtitle={`${milestones.length} ${milestones.length === 1 ? 'milestone' : 'milestones'}`}>
                <div className="flex-1 overflow-y-auto px-6 pb-1">
                    {milestones.map((m) => (<Row key={m.id} m={m} today={today} />))}
                </div>
            </ModalSheet>
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:run src/components/pulse/__tests__/MilestonesCard.test.tsx`
Expected: PASS.

### Task 3.4: Wire milestones into the Overview + commit Piece 3

**Files:**
- Modify: `src/components/pulse/views/HistoryView.tsx` (imports; a `milestones` memo; render the card in the Overview panel under the metric strip, above the Program section ~line 514)

- [ ] **Step 1: Imports + memo**

Add imports:

```tsx
import MilestonesCard from '@/components/pulse/MilestonesCard';
import { computeMilestones } from '@/lib/pulse/milestones';
```

Add a memo near the other Overview-data memos (after `workouts` is defined, ~line 378):

```ts
    const milestones = useMemo(
        () =>
            computeMilestones({
                workouts,
                logs,
                sessions: workoutSessions,
                schedule: activeRoutine?.schedule ?? [],
                programWeeks: activeRoutine?.program_weeks ?? 12,
                unit,
            }),
        [workouts, logs, workoutSessions, activeRoutine, unit],
    );
```

- [ ] **Step 2: Render the card in the Overview panel**

In the Overview panel, immediately after the metric-strip `</div>` and before the Program `<div className="mb-4">` (~line 514), add:

```tsx
                    {/* Recent milestones */}
                    {milestones.length > 0 && (
                        <div className="mb-4">
                            <SectionHeader>Recent milestones</SectionHeader>
                            <MilestonesCard milestones={milestones} />
                        </div>
                    )}
```

(`SectionHeader` is already defined in this file.)

- [ ] **Step 3: Typecheck + full suite**

Run: `bun run typecheck` then `bun run test:run`
Expected: typecheck clean; full suite green (existing total + new tests across Piece 3).

- [ ] **Step 4: Verify in the running app (optional but recommended)**

Per the user's workflow: with `bun run dev` running, drive the logged-in Chrome to `http://localhost:3000/pulse/progress` (Overview tab) and confirm the recovery word, strength delta, and milestones card render with the seeded test-account data.

- [ ] **Step 5: Commit Piece 3**

```bash
git add src/lib/pulse/adherence.ts src/lib/pulse/__tests__/adherence.test.ts src/lib/pulse/milestones.ts src/lib/pulse/__tests__/milestones.test.ts src/components/pulse/MilestonesCard.tsx src/components/pulse/__tests__/MilestonesCard.test.tsx src/components/pulse/views/HistoryView.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(pulse): recent milestones surface on the Progress Overview"
```

---

## Post-implementation

- [ ] Update `docs/roadmap.md` (move progress-richness from In progress toward Shipped once merged) and `CLAUDE.md` (Views section: Overview now carries recovery readout, strength trend, milestones; new `milestones.ts` lib module + `RecoveryTile`/`MilestonesCard` components) per the roadmap workflow. Commit as `docs(roadmap): ...` on the same branch.
- [ ] Confirm the final test count and note it in the roadmap Status block.
