# Pulse Slate Redesign + New Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the Pulse app to the "Slate" dark direction with a coral accent, rework the layout shell, and add live PR detection, per-muscle weekly volume, and a plate calculator, on one branch ending in a single PR.

**Architecture:** Token-first restyle in place. Rewrite the `pulse-*` design tokens in `globals.css`, swap fonts, rework `AppShell`/`DesktopLayout` to a CSS-driven three-zone layout, restyle each screen, and add the three features as pure functions in `src/lib/pulse/utils.ts` wired into the restyled components. No database changes. Existing behavior and the 354-test suite stay green.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS v4 (inline `@theme`), SWR, Vitest + Testing Library. Package manager: bun. Visual source of truth: `docs/superpowers/designs/redesign-2026-06/slate-accents/slate-coral.html`.

**Conventions:** 4-space indentation, match surrounding style, no em dashes in code/comments. Do not run `git push` or open the PR until the final task. Commit after each task.

**Verification note (restyle tasks):** to visually confirm a screen, run the app (`bun run dev`) or the static mockup server, and compare against `slate-coral.html`. Automated check for every task: `bun run typecheck && bun run test:run && bun run lint` must pass.

---

## Task 1: Design tokens + fonts

**Files:**
- Modify: `src/app/globals.css` (the `@theme` block, Pulse tokens)
- Modify: `src/app/pulse/(protected)/layout.tsx` or the Pulse layout where fonts are set (add Hanken Grotesk + Sora via `next/font/google`)
- Modify: `src/components/pulse/PulseLayout.tsx` (apply the font class to the Pulse tree if that is where the font wrapper lives)

- [ ] **Step 1: Update the Pulse tokens in `globals.css`**

Replace the Pulse token values in the `@theme` block with:

```css
/* Pulse design tokens — Slate */
--font-pulse: 'Hanken Grotesk', sans-serif;
--font-pulse-body: 'Sora', sans-serif;
--color-pulse-accent: #ff7d66;        /* coral */
--color-pulse-accent-dim: #b0503d;    /* coral dim */
--color-pulse-bg: #0e1113;
--color-pulse-surface: #161a1d;
--color-pulse-surface-2: #1c2125;
--color-pulse-border: #262c31;
--color-pulse-dim: #aab2b7;
--color-pulse-muted: #6f787e;
--color-pulse-error: #f43f5e;
--color-pulse-success: #4ade80;
--color-pulse-text: #e7ebed;
```

- [ ] **Step 2: Load the fonts**

In the Pulse layout, add:

```ts
import { Hanken_Grotesk, Sora } from 'next/font/google';
const hanken = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-pulse' });
const sora = Sora({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-pulse-body' });
```

Apply `${hanken.variable} ${sora.variable}` to the Pulse wrapper element. Confirm the marketing site still uses Poppins (do not touch `src/app/layout.tsx`).

- [ ] **Step 3: Verify**

Run: `bun run typecheck && bun run test:run && bun run lint`
Expected: all pass (token value changes do not break tests). Start `bun run dev`, open `/pulse`, confirm the new dark base and coral accent render and the font loads.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/pulse/PulseLayout.tsx "src/app/pulse/(protected)/layout.tsx"
git -c commit.gpgsign=false commit -m "feat(pulse): Slate design tokens and fonts"
```

---

## Task 2: Three-zone layout shell (CSS-driven)

**Files:**
- Modify: `src/components/pulse/AppShell.tsx`
- Modify: `src/components/pulse/DesktopLayout.tsx`
- Modify: `src/components/pulse/BottomNav.tsx`
- Test: `src/components/pulse/__tests__/DesktopLayout.test.tsx` (update queries if markup changes)

- [ ] **Step 1: Replace the JS media-query branch with a CSS-driven split**

In `AppShell.tsx`, render both the desktop shell and the mobile shell in the DOM and toggle with Tailwind responsive utilities (`hidden lg:flex` / `lg:hidden`) instead of branching on `useMediaQuery` and returning a different tree. This removes the unmount/remount flash (audit finding). The same view content renders inside both shells.

- [ ] **Step 2: Build the desktop three-zone layout in `DesktopLayout.tsx`**

Match `slate-coral.html` desktop frame: a slim left icon rail (brand mark, nav icons for Train/Plan/Progress/Profile/Explore, sign out at the bottom), the content column, and a right context rail. The context rail shows: Today (sets done / total), Streak, Session volume, Target intensity (RIR), and the rest timer pinned in the rail. Use `var(--color-pulse-*)` tokens and the tone-shift-not-border rule.

- [ ] **Step 3: Restyle `BottomNav.tsx`** to the Slate mobile bottom nav (5 items, active item in coral).

- [ ] **Step 4: Update tests**

Adjust `DesktopLayout.test.tsx` selectors to the new markup. Keep assertions meaningful (nav items present, active state, context-rail stats render).

- [ ] **Step 5: Verify + commit**

Run: `bun run typecheck && bun run test:run && bun run lint` (all pass). Visually confirm no mobile-to-desktop flash on desktop load.

```bash
git add src/components/pulse/AppShell.tsx src/components/pulse/DesktopLayout.tsx src/components/pulse/BottomNav.tsx src/components/pulse/__tests__/DesktopLayout.test.tsx
git -c commit.gpgsign=false commit -m "feat(pulse): three-zone Slate layout shell, CSS-driven responsive split"
```

---

## Task 3: Train screen restyle

**Files:**
- Modify: `src/components/pulse/views/LogView.tsx`
- Modify: `src/components/pulse/ExerciseCard.tsx`
- Modify: `src/components/pulse/SetLogger.tsx`
- Modify: `src/components/pulse/DayTabs.tsx`
- Modify: `src/components/pulse/WorkoutTabs.tsx`
- Modify: `src/components/pulse/RestTimer.tsx`
- Tests: the matching `__tests__` files for each (update queries/snapshots as needed)

- [ ] **Step 1: Restyle the Train header + day selector**

`LogView` header: `Week 03 / 12`, `Phase 1 - Accumulation`, `target RIR 2-3`, streak. `DayTabs`: Mon-Sun, today highlighted in coral, workout-type label, logged-set indicator. Match `slate-coral.html`.

- [ ] **Step 2: Restyle `ExerciseCard` + `SetLogger`**

Set rows in the tabular `22.5 x 10 @ RIR 2` style with a done/checkmark state. Only the pending row is outlined; all other surfaces separate by tone + spacing. Keep all logging behavior identical (this is a reskin; do not change save logic). `RestTimer` and `WorkoutTabs` restyled to match.

- [ ] **Step 3: Keep tests green**

Update selectors/snapshots in `ExerciseCard.test.tsx`, `SetLogger.test.tsx`, `DayTabs.test.tsx`, `WorkoutTabs.test.tsx`, `RestTimer.test.tsx`, `LogView.test.tsx` where markup/classes changed. Do not weaken behavioral assertions.

- [ ] **Step 4: Verify + commit**

Run: `bun run typecheck && bun run test:run && bun run lint` (all pass).

```bash
git add src/components/pulse/views/LogView.tsx src/components/pulse/ExerciseCard.tsx src/components/pulse/SetLogger.tsx src/components/pulse/DayTabs.tsx src/components/pulse/WorkoutTabs.tsx src/components/pulse/RestTimer.tsx src/components/pulse/__tests__
git -c commit.gpgsign=false commit -m "feat(pulse): restyle Train screen to Slate"
```

---

## Task 4: Progress screen restyle

**Files:**
- Modify: `src/components/pulse/views/HistoryView.tsx`
- Modify: `src/components/pulse/StreakCalendar.tsx`
- Modify: `src/components/pulse/VolumeChart.tsx`
- Modify: `src/components/pulse/E1RMChart.tsx`
- Modify: `src/components/pulse/BestLifts.tsx`
- Tests: matching `__tests__` files

- [ ] **Step 1: Restyle the charts** to the calm Slate data-ink look: thin strokes, muted gridlines, accent (`--color-pulse-accent`) only on the current-week point and PR markers; `--color-pulse-accent-dim` for partial/secondary states. Match `slate-coral.html` Progress section.
- [ ] **Step 2: Keep tests green** (update selectors/snapshots).
- [ ] **Step 3: Verify + commit**

Run: `bun run typecheck && bun run test:run && bun run lint`.

```bash
git add src/components/pulse/views/HistoryView.tsx src/components/pulse/StreakCalendar.tsx src/components/pulse/VolumeChart.tsx src/components/pulse/E1RMChart.tsx src/components/pulse/BestLifts.tsx src/components/pulse/__tests__
git -c commit.gpgsign=false commit -m "feat(pulse): restyle Progress screen to Slate"
```

---

## Task 5: Plan, Profile, Explore restyle

**Files:**
- Modify: `src/components/pulse/views/ProgramView.tsx`
- Modify: `src/components/pulse/views/ProfileView.tsx`
- Modify: `src/components/pulse/views/LibraryView.tsx` and `src/components/pulse/views/library/*` (CategoryBadge, ExercisesTab, RoutinesTab)
- Modify: `src/components/pulse/OnboardingModal.tsx`, `src/components/pulse/ShareCard.tsx`
- Tests: matching `__tests__` files

- [ ] **Step 1: Reskin** each to Slate using the tokens. No structural change. Use the shared `ui.ts` class constants where appropriate (added in the audit work) and update those constants to Slate values if needed.
- [ ] **Step 2: Keep tests green** (update selectors/snapshots).
- [ ] **Step 3: Verify + commit**

Run: `bun run typecheck && bun run test:run && bun run lint`.

```bash
git add src/components/pulse/views/ProgramView.tsx src/components/pulse/views/ProfileView.tsx src/components/pulse/views/LibraryView.tsx src/components/pulse/views/library src/components/pulse/OnboardingModal.tsx src/components/pulse/ShareCard.tsx src/components/pulse/ui.ts src/components/pulse/__tests__
git -c commit.gpgsign=false commit -m "feat(pulse): restyle Plan, Profile, Explore, modals to Slate"
```

---

## Task 6: Live PR detection — pure function (TDD)

**Files:**
- Modify: `src/lib/pulse/utils.ts`
- Test: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { isSetPR } from '@/lib/pulse/utils';

describe('isSetPR', () => {
    const prMap = { 'ex-1': 100 }; // best e1rm for ex-1 is 100
    it('is true when the set e1rm meets the exercise best', () => {
        // calcE1RM(80,10) ~= 106.7 > 100
        expect(isSetPR(80, 10, 'ex-1', prMap)).toBe(true);
    });
    it('is false when below the best', () => {
        // calcE1RM(50,5) ~= 58.3 < 100
        expect(isSetPR(50, 5, 'ex-1', prMap)).toBe(false);
    });
    it('is false when there is no recorded best (>0 guard)', () => {
        expect(isSetPR(80, 10, 'ex-unknown', prMap)).toBe(false);
    });
    it('is false for non-positive weight or reps', () => {
        expect(isSetPR(0, 10, 'ex-1', prMap)).toBe(false);
        expect(isSetPR(80, 0, 'ex-1', prMap)).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t isSetPR`
Expected: FAIL (isSetPR is not exported).

- [ ] **Step 3: Implement**

In `utils.ts`, mirroring the existing `computeShareStats` PR check:

```ts
export function isSetPR(kg: number, reps: number, routineExerciseId: string, prMap: PRMap): boolean {
    if (kg <= 0 || reps <= 0) return false;
    const best = prMap[routineExerciseId] ?? 0;
    if (best <= 0) return false;
    return calcE1RM(kg, reps) >= best;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t isSetPR`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git -c commit.gpgsign=false commit -m "feat(pulse): isSetPR pure function"
```

---

## Task 7: Live PR detection — UI wiring

**Files:**
- Modify: `src/components/pulse/SetLogger.tsx` and/or `src/components/pulse/ExerciseCard.tsx`
- Modify: `src/components/pulse/WorkoutModeScreen.tsx`
- Test: `src/components/pulse/__tests__/SetLogger.test.tsx` (or ExerciseCard test)

- [ ] **Step 1: Write a failing test** asserting a coral `PR` tag renders on a set row whose weight/reps beat the exercise best (pass a `prMap` via the provider mock so `isSetPR` returns true), and does not render otherwise.

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement.** Read `prMap` from `usePulse()` (already in context). For each rendered set row, compute `isSetPR(kg, reps, routineExerciseId, prMap)`; when true, render the coral PR tag (match the mockup). On a save that newly qualifies as a PR, fire a quiet success toast via the existing `useToast()` (e.g. "New PR on Dumbbell Bench Press"). Guard against firing the toast repeatedly for an already-saved PR (only on the save transition).

- [ ] **Step 4: Run to verify it passes.** Keep other SetLogger/ExerciseCard tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/SetLogger.tsx src/components/pulse/ExerciseCard.tsx src/components/pulse/WorkoutModeScreen.tsx src/components/pulse/__tests__
git -c commit.gpgsign=false commit -m "feat(pulse): live PR badge and toast"
```

---

## Task 8: Per-muscle weekly volume — pure function (TDD)

**Files:**
- Modify: `src/lib/pulse/utils.ts`
- Test: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { computePerMuscleVolume, logKey } from '@/lib/pulse/utils';
import type { RoutineExercise } from '@/lib/pulse/types';

describe('computePerMuscleVolume', () => {
    // routineExercise -> exercise.category mapping
    const res = [
        { id: 'a', exercise: { category: 'chest' } },
        { id: 'b', exercise: { category: 'back' } },
    ] as unknown as RoutineExercise[];
    const logs = {
        [logKey(3, 'a', 0)]: { kg: 20, reps: 10, rir: 2, saved: true },
        [logKey(3, 'a', 1)]: { kg: 20, reps: 10, rir: 2, saved: true },
        [logKey(3, 'b', 0)]: { kg: 30, reps: 8, rir: 1, saved: true },
        [logKey(2, 'a', 0)]: { kg: 20, reps: 10, rir: 2, saved: true }, // other week, ignored
        [logKey(3, 'a', 2)]: { kg: 20, reps: 10, rir: 2, saved: false }, // unsaved, ignored
    };
    it('counts saved sets per category for the given week', () => {
        const out = computePerMuscleVolume(logs, res, 3);
        expect(out.chest).toBe(2);
        expect(out.back).toBe(1);
    });
    it('returns 0 for categories with no sets that week', () => {
        const out = computePerMuscleVolume(logs, res, 3);
        expect(out.legs ?? 0).toBe(0);
    });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement**

```ts
export function computePerMuscleVolume(
    logs: Logs,
    routineExercises: RoutineExercise[],
    week: number,
): Partial<Record<ExerciseCategory, number>> {
    const catById = new Map<string, ExerciseCategory>();
    for (const re of routineExercises) {
        if (re.exercise?.category) catById.set(re.id, re.exercise.category);
    }
    const out: Partial<Record<ExerciseCategory, number>> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed || parsed.week !== week) continue;
        const cat = catById.get(parsed.routineExerciseId);
        if (!cat) continue;
        out[cat] = (out[cat] ?? 0) + 1;
    }
    return out;
}
```

Add `ExerciseCategory` and `RoutineExercise` to the type imports at the top of `utils.ts` if not already present.

- [ ] **Step 4: Run to verify it passes.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git -c commit.gpgsign=false commit -m "feat(pulse): computePerMuscleVolume pure function"
```

---

## Task 9: Per-muscle weekly volume — UI

**Files:**
- Create: `src/components/pulse/MuscleVolumeBars.tsx`
- Modify: `src/components/pulse/views/HistoryView.tsx` (Progress screen) to render it
- Test: `src/components/pulse/__tests__/MuscleVolumeBars.test.tsx`

- [ ] **Step 1: Write a failing test** rendering `MuscleVolumeBars` with a `volume` map `{ chest: 2, back: 1 }` and asserting a bar per category with the set count, sorted by volume descending.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** `MuscleVolumeBars` as a presentational component taking `volume: Partial<Record<ExerciseCategory, number>>`, rendering coral horizontal bars (width proportional to the max), label + count, sorted descending. Wire it into the Progress screen, computing `computePerMuscleVolume(logs, activeRoutineExercises, activeWeek)` from `usePulse()` context.
- [ ] **Step 4: Run to verify it passes.**
- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/MuscleVolumeBars.tsx src/components/pulse/views/HistoryView.tsx src/components/pulse/__tests__/MuscleVolumeBars.test.tsx
git -c commit.gpgsign=false commit -m "feat(pulse): per-muscle weekly volume bars on Progress"
```

---

## Task 10: Plate calculator — pure function (TDD)

**Files:**
- Modify: `src/lib/pulse/constants.ts` (defaults)
- Modify: `src/lib/pulse/utils.ts`
- Test: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Add defaults to `constants.ts`**

```ts
export const BARBELL_KG = 20;
export const DUMBBELL_HANDLE_KG = 2.5;
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
```

- [ ] **Step 2: Write the failing test**

```ts
import { computePlates } from '@/lib/pulse/utils';

describe('computePlates', () => {
    it('barbell: returns per-side plates for an achievable weight', () => {
        // 60 kg on a 20 kg bar -> 20 kg per side -> [20]
        expect(computePlates(60, 'barbell')).toEqual({ perSide: [20], achievable: true, remainderKg: 0 });
    });
    it('barbell: greedy multi-plate breakdown', () => {
        // 100 kg -> 40 per side -> [25,15]
        expect(computePlates(100, 'barbell')).toEqual({ perSide: [25, 15], achievable: true, remainderKg: 0 });
    });
    it('barbell: marks unachievable remainder', () => {
        // 61 kg -> 20.5 per side -> [20] with 0.5 remainder
        const r = computePlates(61, 'barbell');
        expect(r.achievable).toBe(false);
        expect(r.remainderKg).toBeCloseTo(0.5, 5);
    });
    it('returns achievable=false below the bar/handle weight', () => {
        expect(computePlates(10, 'barbell').achievable).toBe(false);
        expect(computePlates(2, 'dumbbell').achievable).toBe(false);
    });
    it('dumbbell: uses the handle weight', () => {
        // 12.5 kg dumbbell on 2.5 handle -> 5 per side -> [5]
        expect(computePlates(12.5, 'dumbbell')).toEqual({ perSide: [5], achievable: true, remainderKg: 0 });
    });
});
```

- [ ] **Step 3: Run to verify it fails.**

- [ ] **Step 4: Implement**

```ts
import { BARBELL_KG, DUMBBELL_HANDLE_KG, PLATES_KG } from './constants';

export type PlateEquipment = 'barbell' | 'dumbbell';
export interface PlateResult { perSide: number[]; achievable: boolean; remainderKg: number; }

export function computePlates(targetKg: number, equipment: PlateEquipment): PlateResult {
    const base = equipment === 'barbell' ? BARBELL_KG : DUMBBELL_HANDLE_KG;
    if (targetKg < base) return { perSide: [], achievable: false, remainderKg: 0 };
    let perSideKg = (targetKg - base) / 2;
    const perSide: number[] = [];
    for (const plate of PLATES_KG) {
        while (perSideKg >= plate - 1e-9) {
            perSide.push(plate);
            perSideKg = Math.round((perSideKg - plate) * 100) / 100;
        }
    }
    const remainderKg = Math.round(perSideKg * 100) / 100;
    return { perSide, achievable: remainderKg === 0, remainderKg };
}
```

- [ ] **Step 5: Run to verify it passes.**

- [ ] **Step 6: Commit**

```bash
git add src/lib/pulse/constants.ts src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git -c commit.gpgsign=false commit -m "feat(pulse): computePlates pure function (barbell + dumbbell)"
```

---

## Task 11: Plate calculator — UI

**Files:**
- Create: `src/components/pulse/PlateCalculator.tsx`
- Modify: `src/components/pulse/SetLogger.tsx` (affordance)
- Test: `src/components/pulse/__tests__/PlateCalculator.test.tsx`

- [ ] **Step 1: Write a failing test** rendering `PlateCalculator` for a target weight, asserting the per-side plate chips render for the default barbell, the equipment toggle switches to dumbbell, and an unachievable remainder shows a note.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** `PlateCalculator` taking `targetKg`, with a barbell/dumbbell toggle, calling `computePlates` and rendering per-side plate chips (and a remainder note when not achievable). Add a compact affordance in `SetLogger` (icon or expandable row) that opens it for the row's target weight; hide it when the target is below the bar/handle weight.
- [ ] **Step 4: Run to verify it passes.** Keep SetLogger tests green.
- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/PlateCalculator.tsx src/components/pulse/SetLogger.tsx src/components/pulse/__tests__/PlateCalculator.test.tsx
git -c commit.gpgsign=false commit -m "feat(pulse): plate calculator in the set logger"
```

---

## Task 12: Final verification + PR

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `bun run typecheck && bun run test:run && bun run lint`
Expected: typecheck clean, all tests pass (existing 354 + the new pure-function and component tests), lint clean (no new errors).

- [ ] **Step 2: Format**

Run: `bun run format` then re-run `bun run typecheck && bun run test:run`.

- [ ] **Step 3: Manual smoke check**

Start `bun run dev`, walk Train, Progress, Plan, Profile, Explore on a desktop width and a mobile width. Confirm: no layout flash, coral accent throughout, PR badge + toast on a PR set, per-muscle bars on Progress, plate calculator opens in the set logger.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feature/pulse-slate-redesign
gh pr create --title "Pulse Slate redesign + live PR, per-muscle volume, plate calculator" --body "Implements docs/superpowers/specs/2026-06-03-pulse-slate-redesign-design.md"
```

---

## Self-review notes

- **Spec coverage:** tokens/fonts (T1), three-zone shell + CSS responsive fix (T2), Train (T3), Progress + per-muscle bars (T4, T9), Plan/Profile/Explore (T5), live PR (T6-T7), per-muscle volume (T8-T9), plate calculator (T10-T11), testing + verify (every task + T12). All spec sections map to a task.
- **No DB changes** anywhere, matching the spec.
- **Type consistency:** `isSetPR(kg, reps, routineExerciseId, prMap)`, `computePerMuscleVolume(logs, routineExercises, week)`, `computePlates(targetKg, equipment) -> PlateResult` are referenced identically in their pure-function task and their UI task.
- **Dependency note for the executor/workflow:** T1 and T2 are foundational (do first). T3-T5 restyle screens and can run in parallel after T2. T6/T8/T10 (pure functions) are independent and can run any time after T1. T7 depends on T3 + T6; T9 depends on T4 + T8; T11 depends on T3 + T10. T12 is last.
