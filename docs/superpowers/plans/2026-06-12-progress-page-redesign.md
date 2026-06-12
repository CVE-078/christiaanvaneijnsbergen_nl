# Progress Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Progress redesign: restyle the 3 tabs to the Profile design language and ship the designed-but-unbuilt surfaces (lean-glance Overview, shared history modal, sessions calendar, coach timeline, program status, strength breakdown, merged Best Lifts).

**Architecture:** Pure-logic-first. New display logic (month grouping, session-by-day mapping, program-status formatting, recovery word) lands as tested pure functions in `src/lib/pulse/*`. New presentational components consume existing context (`usePulse()` already exposes `programPosition`, `sessions`, `decisionEvents`-via-hook, recomp/strength/volume data). `HistoryView` is recomposed tab-by-tab. No tables, no columns, no migration, no server-action changes.

**Tech Stack:** Next.js 15 / React 19 / TypeScript (strict) / Tailwind v4 (theme tokens, no config) / Vitest + Testing Library (jsdom). Path alias `@/* -> src/*`. Tests: `bun run test:run <file>`; types: `bun run typecheck`.

**Visual contract:** `docs/superpowers/designs/2026-06-12-15-39-42-progress-redesign-mockup.html`. The restyle task (Task 6) matches it. Spec: `docs/superpowers/specs/2026-06-12-15-39-42-progress-page-redesign-design.md`.

---

## Scope

**IN this branch (`feature/progress-page-redesign`):**
- Overview recomposed into the glance: metric strip (real 0-100 strength, recovery word, program week, streak), `ProgramStatusCard`, restyled recomp verdict, `CoachActivityTimeline`, strength-breakdown modal on the strength metric.
- Lifts: chart value-readout headers, `MuscleVolumeBars` wrapped in a card, **merged Best Lifts** (set + e1RM, grouped by type; PR card removed), sessions **calendar** + recent-session rows + session-detail modal.
- Body: aligned Body weight / Measurements columns, top summary row (Goal weight 50% + Recent change), measurement metric **pills**, every "Show all" opens the shared **history modal**.
- Shared `MetricHistoryModal` (bottom-sheet mobile / centered desktop, month-grouped).
- Visual restyle pass to the Profile language.

**OUT (do not build here):** app-shell nav icon pass; write-side measurement parity (`UNIQUE`/COALESCE/`deleteBodyMeasurement`); expanded measurement metrics; progress photos. No migration.

---

## File structure

**New components:**
- `src/components/pulse/MetricHistoryModal.tsx`: shared modal (chart + month-grouped entry list). Props `{ open, onClose, title, unit, entries }`.
- `src/components/pulse/ProgramStatusCard.tsx`: Overview program-status card. Consumes `usePulse().programPosition` + active routine `program_weeks`.
- `src/components/pulse/CoachActivityTimeline.tsx`: Overview recent-`DecisionEvent` timeline (3 + "Show all"), reuses `decisionCopy`.
- `src/components/pulse/StrengthBreakdownModal.tsx`: modal wrapping the per-lift sub-score rows (reuses `StrengthScore` data).
- `src/components/pulse/SessionsCalendar.tsx`: month grid; marked days from sessions; `onSelectDay(session)`.
- `src/components/pulse/SessionDetailModal.tsx`: session header (name, date, duration, sets, PRs) + per-exercise breakdown.
- `src/components/pulse/RecentChangeCard.tsx`: weight/waist/lifts deltas (from `RecompReadout`).

**New pure logic:**
- `src/lib/pulse/bodyMetrics.ts` (exists): add `groupEntriesByMonth(entries)`.
- `src/lib/pulse/dates.ts` (exists): add `localDateKey(iso, tz)`.
- `src/lib/pulse/sessions.ts` (exists): add `sessionsByDay(sessions, tz)` + `buildMonthCells(year, month)`.
- `src/lib/pulse/utils.ts` (exists): add `recoverySummaryWord(recovery)`, `formatProgramStatus(pos, programWeeks)`.

**Modified:**
- `src/components/pulse/views/HistoryView.tsx`: recompose Overview / Lifts / Body.
- `src/components/pulse/BestLifts.tsx`: add e1RM column.
- `src/components/pulse/BodyWeightCard.tsx`, `MeasurementsCard.tsx`: wire "Show all" to `MetricHistoryModal`; align row structure.

**Style note:** reuse existing tokens (`pulse-surface`, `pulse-accent`, etc.) and the `font-pulse-display` (Big Shoulders) for metric numerals. Match the mockup's solid `SegmentedTabs`, `rounded-2xl` cards, `0.1em` uppercase labels, SVG icons. Tailwind opacity utilities (`bg-pulse-accent/10`) for accent tints; never hardcode hex.

---

## Task 1: Month-grouping helper + MetricHistoryModal

**Files:**
- Modify: `src/lib/pulse/bodyMetrics.ts`
- Test: `src/lib/pulse/__tests__/bodyMetrics.test.ts` (exists, extend)
- Create: `src/components/pulse/MetricHistoryModal.tsx`
- Test: `src/components/pulse/__tests__/MetricHistoryModal.test.tsx`

- [ ] **Step 1: Failing test for `groupEntriesByMonth`**

```ts
import { groupEntriesByMonth } from '@/lib/pulse/bodyMetrics';

it('groups entries by month, newest month first, entries newest first', () => {
  const groups = groupEntriesByMonth([
    { date: '2026-05-04', value: 82.0 },
    { date: '2026-06-11', value: 80.2 },
    { date: '2026-06-01', value: 80.6 },
  ]);
  expect(groups.map((g) => g.label)).toEqual(['June 2026', 'May 2026']);
  expect(groups[0].entries.map((e) => e.value)).toEqual([80.2, 80.6]);
});
```

- [ ] **Step 2: Run, expect FAIL**, `bun run test:run src/lib/pulse/__tests__/bodyMetrics.test.ts` (FAIL: `groupEntriesByMonth` not exported).

- [ ] **Step 3: Implement** in `bodyMetrics.ts`:

```ts
export interface MetricEntry { date: string; value: number }
export interface MonthGroup { key: string; label: string; entries: MetricEntry[] }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function groupEntriesByMonth(entries: MetricEntry[]): MonthGroup[] {
  const byKey = new Map<string, MetricEntry[]>();
  for (const e of entries) {
    const key = e.date.slice(0, 7); // YYYY-MM
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(e);
  }
  return [...byKey.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, es]) => {
      const [y, m] = key.split('-');
      return {
        key,
        label: `${MONTHS[Number(m) - 1]} ${y}`,
        entries: [...es].sort((a, b) => (a.date < b.date ? 1 : -1)),
      };
    });
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Failing test for `MetricHistoryModal`**

```tsx
import { render, screen } from '@testing-library/react';
import MetricHistoryModal from '@/components/pulse/MetricHistoryModal';

it('renders title and month-grouped entries when open', () => {
  render(<MetricHistoryModal open title="Body weight" unit="kg" onClose={() => {}}
    entries={[{ date: '2026-06-11', value: 80.2 }, { date: '2026-05-04', value: 82.0 }]} />);
  expect(screen.getByText('Body weight')).toBeInTheDocument();
  expect(screen.getByText('June 2026')).toBeInTheDocument();
  expect(screen.getByText('May 2026')).toBeInTheDocument();
});

it('renders nothing when closed', () => {
  const { container } = render(<MetricHistoryModal open={false} title="x" unit="kg" entries={[]} onClose={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 6: Run, expect FAIL.**

- [ ] **Step 7: Implement `MetricHistoryModal.tsx`.** Contract: returns `null` when `!open`. Backdrop click + an X button call `onClose`. Renders `MetricLineChart` (existing) of the full series, then `groupEntriesByMonth(entries)` with a sticky month header per group and a `date / value unit` row per entry. Classes per the mockup `.modal`/`.sheet`/`.monthhdr`/`.li`: bottom-sheet on mobile (`items-end`), centered on desktop (`lg:items-center`), `bg-pulse-surface`, sticky `month` header. Reuse `toDisplay` for the value.

- [ ] **Step 8: Run, expect PASS.** Then `bun run typecheck`.

- [ ] **Step 9: Commit**, `git add src/lib/pulse/bodyMetrics.ts src/lib/pulse/__tests__/bodyMetrics.test.ts src/components/pulse/MetricHistoryModal.tsx src/components/pulse/__tests__/MetricHistoryModal.test.tsx && git commit -m "feat(pulse): shared month-grouped metric history modal"`

---

## Task 2: Wire history modal into Body cards + align columns

**Files:** Modify `src/components/pulse/BodyWeightCard.tsx`, `src/components/pulse/MeasurementsCard.tsx`; Test: their `__tests__`.

- [ ] **Step 1: Failing test** (BodyWeightCard): clicking "Show all NN entries" opens the modal.

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
// render BodyWeightCard within the existing test harness/provider used by sibling tests
it('opens the history modal from Show all', () => {
  // ...render with >3 bodyweight logs via the existing mock provider...
  fireEvent.click(screen.getByRole('button', { name: /show all/i }));
  expect(screen.getByText(/June 2026|May 2026/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** In `BodyWeightCard`: add `const [showAll, setShowAll] = useState(false)`; the "Show all" button sets it true; render `<MetricHistoryModal open={showAll} onClose={() => setShowAll(false)} title="Body weight" unit={unit} entries={entries} />` where `entries` are the bodyweight logs mapped to `{date, value}`. Keep the latest-3 inline list. Same wiring in `MeasurementsCard` per selected metric (title = metric label, entries = `metricSeries(rows, metric)`).

- [ ] **Step 4: Run, expect PASS** (both card tests).

- [ ] **Step 5: Align row structure.** Give both cards the same vertical rhythm so columns line up: header row (title + trend chip OR title + cm/in toggle), a fixed-height metadata row (Body weight: trend chip; Measurements: metric pills), then log bar / chart / latest-3 / Show all. Use the mockup `.row2` slot. No test (visual); verified in Task 6.

- [ ] **Step 6: Commit**, `git commit -m "feat(pulse): body cards open history modal, aligned columns"`

---

## Task 3: Merge Best Lifts (set + e1RM), remove PR card

**Files:** Modify `src/components/pulse/BestLifts.tsx`; Test: `src/components/pulse/__tests__/BestLifts.test.tsx`; Modify `src/components/pulse/views/HistoryView.tsx` (remove the Personal Records card).

- [ ] **Step 1: Failing test**, BestLifts row shows both the top set and the e1RM.

```tsx
it('shows top set and e1RM per lift', () => {
  // render BestLifts with one routine exercise + bestSets[reId] = { kg: 90, reps: 6, e1rm: 105, ... }
  expect(screen.getByText(/90/)).toBeInTheDocument();      // top set kg
  expect(screen.getByText(/× 6/)).toBeInTheDocument();      // reps
  expect(screen.getByText(/105/)).toBeInTheDocument();      // e1RM
});
```

- [ ] **Step 2: Run, expect FAIL** (e1RM not currently shown).

- [ ] **Step 3: Implement.** In `BestLifts.tsx`, the per-lift row keeps the name + `kg × reps` (existing) and adds the e1RM value `toDisplay(best.e1rm, unit)` as a right-aligned secondary, accent on the group's top entry (existing `idx === 0` accent moves to the e1RM). Grouping by workout type stays.

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Remove the Personal Records card** from `HistoryView` Lifts (the `prRecords` block, `HistoryView.tsx:408-431`). Delete the now-unused `prRecords` memo (`:270-277`) if nothing else uses it (`prMap` is still used by `sessionCards` PR flags, keep that).

- [ ] **Step 6: Run** the HistoryView test (if present) + `bun run typecheck`, expect PASS / clean.

- [ ] **Step 7: Commit**, `git commit -m "feat(pulse): merge Best Lifts and Personal Records"`

---

## Task 4: Sessions calendar + session-detail modal

**Files:**
- Modify: `src/lib/pulse/dates.ts` (add `localDateKey`), `src/lib/pulse/sessions.ts` (add `sessionsByDay`, `buildMonthCells`)
- Test: `src/lib/pulse/__tests__/sessions.test.ts`
- Create: `src/components/pulse/SessionsCalendar.tsx`, `src/components/pulse/SessionDetailModal.tsx`
- Test: their `__tests__`
- Modify: `src/components/pulse/views/HistoryView.tsx` (Lifts sessions block)

- [ ] **Step 1: Failing test for `localDateKey` + `sessionsByDay`**

```ts
import { sessionsByDay } from '@/lib/pulse/sessions';
it('keys completed sessions by their tz-local date', () => {
  const map = sessionsByDay([
    { id: 's1', completed_at: '2026-06-09T19:30:00Z', started_at: '2026-06-09T18:45:00Z' } as any,
    { id: 's2', completed_at: null, started_at: '2026-06-10T10:00:00Z' } as any, // not completed -> excluded
  ], 'Europe/Amsterdam');
  expect(map.get('2026-06-09')?.[0].id).toBe('s1');
  expect(map.get('2026-06-10')).toBeUndefined();
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** `localDateKey(iso, tz)` in `dates.ts`: `new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))` (returns `YYYY-MM-DD`). `sessionsByDay(sessions, tz)` in `sessions.ts`: `Map<string, WorkoutSession[]>` keyed by `localDateKey(s.completed_at, tz)` for sessions with `completed_at`. `buildMonthCells(year, monthIndex0)`: array of `{ dateKey, day }` for each day of the month plus leading blanks to the Monday-start weekday (reuse the convention from the existing streak/calendar code if present).

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Failing test for `SessionsCalendar`**, renders day numbers; a session day is marked and calls `onSelectDay`.

```tsx
it('marks session days and fires onSelectDay', () => {
  const onSelect = vi.fn();
  render(<SessionsCalendar year={2026} month={5} sessions={[{ id:'s1', completed_at:'2026-06-09T19:30:00Z', started_at:'2026-06-09T18:45:00Z' } as any]} tz="Europe/Amsterdam" onSelectDay={onSelect} />);
  fireEvent.click(screen.getByText('9'));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
});
```

- [ ] **Step 6: Run, expect FAIL.** Then implement `SessionsCalendar.tsx` using `buildMonthCells` + `sessionsByDay`; marked cells get the accent tint + dot and an onClick; empty cells are inert. Classes per mockup `.cal`. Run, expect PASS.

- [ ] **Step 7: Failing test for `SessionDetailModal`**, renders header (name, duration) + a breakdown row.

```tsx
it('renders session header and per-exercise breakdown', () => {
  render(<SessionDetailModal open session={{ id:'s1', started_at:'2026-06-09T18:45:00Z', completed_at:'2026-06-09T19:31:00Z', workout_type:'legs' } as any}
    rows={[{ name:'Back Squat', detail:'110 kg × 5, 5, 5' }]} onClose={() => {}} />);
  expect(screen.getByText(/46 min/)).toBeInTheDocument(); // derived duration
  expect(screen.getByText('Back Squat')).toBeInTheDocument();
});
```

- [ ] **Step 8: Run, expect FAIL.** Implement `SessionDetailModal.tsx`: duration = `Math.round((Date.parse(completed_at) - Date.parse(started_at))/60000)` min; reuse the same modal shell (bottom-sheet mobile / centered desktop) as `MetricHistoryModal` (extract a small `<Sheet>` wrapper if convenient, otherwise mirror the classes). `rows` are derived by the caller from that session's set logs. Run, expect PASS.

- [ ] **Step 9: Wire into `HistoryView` Lifts.** Replace the set-by-set `SessionCard` list with: a `SessionsCalendar` (current month, `usePulse().sessions`, `profile.timezone`) paired with a short recent-session summary list (name · week · exercise count · PR badge), both opening `SessionDetailModal`. Keep "Show all NN sessions". Build each session's `rows` from the existing `sessionCards`/log data.

- [ ] **Step 10: Run** all touched tests + `bun run typecheck`. **Commit**, `git commit -m "feat(pulse): sessions calendar and session-detail modal"`

---

## Task 5: Overview glance (metric strip, program status, coach timeline, strength modal)

**Files:**
- Modify: `src/lib/pulse/utils.ts` (add `recoverySummaryWord`, `formatProgramStatus`); Test: `src/lib/pulse/__tests__/utils.test.ts`
- Create: `ProgramStatusCard.tsx`, `CoachActivityTimeline.tsx`, `StrengthBreakdownModal.tsx` (+ tests)
- Modify: `HistoryView.tsx` (Overview panel)

- [ ] **Step 1: Failing test for the two helpers**

```ts
import { recoverySummaryWord, formatProgramStatus } from '@/lib/pulse/utils';
it('summarizes recovery as a single word', () => {
  expect(recoverySummaryWord({})).toBe('Fresh');
  expect(recoverySummaryWord({ chest: { status: 'high_fatigue' } as any })).toBe('1 flag');
});
it('formats program status', () => {
  const s = formatProgramStatus({ status: 'on_track', calendarWeek: 6, weekInteger: 6 } as any, 12);
  expect(s.statusLabel).toBe('On track');
  expect(s.weekLabel).toBe('Week 6 of 12');
  expect(s.progress).toBeCloseTo(0.5);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement.** `recoverySummaryWord(recovery)`: count entries whose `status !== 'optimal'`; `0 -> 'Fresh'`, else `'${n} flag${n>1?'s':''}'`. `formatProgramStatus(pos, programWeeks)`: map `pos.status` to a label (`on_track->'On track'`, `behind->'Behind'`, `lapsed->'Lapsed'`, `paused->'Paused'`), `weekLabel = 'Week ${pos.weekInteger} of ${programWeeks}'`, `progress = min(1, pos.weekInteger / programWeeks)`, and `nextDeloadWeek` = the next `w >= pos.weekInteger` with `getPhase(w, programWeeks) === 'deload'` (else `programWeeks`). Return `{ statusLabel, statusTone, weekLabel, progress, nextDeloadWeek }`.

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: `ProgramStatusCard` test + impl**, renders status pill + week label + next-deload from `formatProgramStatus`. Consumes `usePulse().programPosition` (returns `null` -> render nothing) and the active routine `program_weeks`. This-week volume line reuses the existing weekly-sets value.

- [ ] **Step 6: `CoachActivityTimeline` test + impl**, given the recent `DecisionEvent`s (from the existing decision-events hook, the same source `CoachPanel` uses) and an exercise-name resolver, render the 3 most recent via `decisionCopy(event, name)` as timeline rows with "Show all". Reuse `decisionCopy`; do not duplicate copy.

- [ ] **Step 7: `StrengthBreakdownModal` test + impl**, given a `StrengthScore`, render the per-lift sub-score rows (lift label, bar, sub-score) + level, inside the shared sheet. Extract the sub-score row markup from `StrengthScoreCard` into a small shared piece or mirror it; no new scoring logic.

- [ ] **Step 8: Recompose `HistoryView` Overview.** Replace the current Overview panel (`HistoryView.tsx:330-353`: StrengthScoreCard + RecoveryCard + RecompCard + StreakCalendar) with: the **metric strip** (Strength = `strength.score`, tappable -> `StrengthBreakdownModal`; Recovery = `recoverySummaryWord(recovery)`; Program = `W${programPosition?.weekInteger}`; Streak = `streak`), then `ProgramStatusCard`, then the restyled `RecompCard` (verdict-led), then `CoachActivityTimeline`. Remove the standalone StreakCalendar from Overview (streak is now the metric + program card).

- [ ] **Step 9: Run** all touched tests + `bun run typecheck`. **Commit**, `git commit -m "feat(pulse): overview glance with program status and coach timeline"`

---

## Task 6: Body summary row, chart readouts, volume-by-muscle card, restyle pass

**Files:** Modify `HistoryView.tsx`; Create `RecentChangeCard.tsx` (+ test).

- [ ] **Step 1: `RecentChangeCard` test + impl**, given a `RecompReadout`, render weight / waist / lifts deltas (`weightDeltaKg`, `waistDeltaCm`, `strengthDeltaPct`), `—` when null. Presentational only.

- [ ] **Step 2: Body top summary row.** In `HistoryView` Body: add a 2-up top row (`lg:grid-cols-2`, `items-stretch`) with Goal weight (existing `GoalWeightCard` data, 50%) and `RecentChangeCard`; both cards `flex-1` so they match height; on mobile Goal weight renders first. Body weight + Measurements columns follow below.

- [ ] **Step 3: Chart value-readout headers (Lifts).** Add a value line above each chart: e1RM = current `e1rmHistory` last value + delta vs first (`computeE1RMHistory` data already present); Weekly volume = current week total sets. Wrap `MuscleVolumeBars` in a `rounded-2xl bg-pulse-surface p-5` card.

- [ ] **Step 4: Restyle pass to the mockup.** Across the Progress view: confirm solid `SegmentedTabs` variant, `0.1em` uppercase section labels (`SectionHeader`), `rounded-2xl` cards, `font-pulse-display` numerals on the metric strip, SVG chevrons on every "Show all" (replace any `↓`/`↑` glyphs), content `max-w` ~1000px, window control as a pill group. Match `docs/superpowers/designs/2026-06-12-15-39-42-progress-redesign-mockup.html` at mobile + desktop. No em dashes in any copy.

- [ ] **Step 5: Full verification.** Run the whole suite + typecheck:

Run: `bun run test:run && bun run typecheck`
Expected: all pass, clean. (Spec calls for the suite to stay green; current baseline is 1148 tests plus the new ones added here.)

- [ ] **Step 6: Manual check.** `bun run dev`, drive `/pulse/progress` at desktop and mobile widths: tab switching, 412->strength modal (shows real /100), program status, coach timeline, calendar day -> session modal, body "Show all" -> month-grouped modal (centered on desktop), goal/recent-change equal height. Compare against the mockup.

- [ ] **Step 7: Commit**, `git commit -m "feat(pulse): body summary row, chart readouts, progress restyle pass"`

---

## Roadmap sync (final step, same branch)

- [ ] Move "Progress page redesign" to **Shipped** in `docs/roadmap.md` (dated bullet under Reference & archive), clear the `In progress:` line, update the test count, and note in `CLAUDE.md` the new Progress structure (lean Overview + program status + coach timeline; sessions calendar; shared `MetricHistoryModal`; merged Best Lifts). Commit, `git commit -m "docs(roadmap): ship progress page redesign"`.

---

## Self-review (against the spec)

- **Coverage:** Overview glance (T5), program status (T5), coach timeline (T5), strength breakdown (T5), Best Lifts merge (T3), chart readouts (T6), volume-by-muscle card (T6), sessions calendar + detail (T4), history modal (T1) + wiring (T2), body alignment + goal-50%/recent-change (T2, T6), measurement pills (T2/existing), restyle (T6). All spec sections map to a task.
- **No new server actions / migration:** confirmed; all data via existing context (`programPosition`, `sessions`, decision events, recomp/strength/volume) and existing log actions.
- **Types:** `MetricEntry`/`MonthGroup` (T1) reused by `MetricHistoryModal` (T1) and body cards (T2); `formatProgramStatus` return (T5) consumed by `ProgramStatusCard` (T5); `sessionsByDay`/`localDateKey` (T4) consumed by `SessionsCalendar` (T4). Names consistent across tasks.
- **Out-of-scope guard:** no write-side measurement parity, no icon pass, no expanded metrics, no progress photos.
