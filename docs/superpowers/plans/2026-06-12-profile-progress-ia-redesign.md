# Profile + Progress IA Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize Profile into a 2-tab settings screen (You / Training) and Progress into a 3-tab hub (Overview / Lifts / Body), relocating body tracking to Progress and adding read-side-only per-metric measurement parity, with no migration and no server-action changes.

**Architecture:** Pure refactor plus client-side derivation. Body-tracking UI is extracted from `ProfileView` into focused components and moved to `HistoryView`'s Body tab. A shared `SegmentedTabs` (composing the existing `TabButton`) drives both views. Per-metric measurement series are derived client-side from the existing wide `body_measurements` rows; the write path is untouched.

**Tech Stack:** Next.js 15 / React 19 / TypeScript (strict) / Tailwind v4 / Vitest + Testing Library (jsdom). Path alias `@/* -> src/*`.

---

## Scope (locked: read-side parity only, option B from the verification)

**IN this branch (`feature/profile-progress-ia-redesign`):**
- Profile: 2-tab segment (You / Training). Gender moves to You and gains a third "Prefer not to say" pill calling `updateGender(null)` (verified zero action/schema change, `actions/profile.ts:126`). Training tab = the existing generation-preference cluster, denser presentation only, controls unchanged.
- Progress: 3-tab segment (Overview / Lifts / Body). Existing content reorganizes into Overview + Lifts; body tracking relocates into Body.
- Body relocation: body weight (`logBodyWeight`, unchanged) + goal weight (`updateGoalWeight`, unchanged) move to the Body tab.
- READ-side measurement parity: per-metric chart + history + latest-3, derived client-side from the existing wide `body_measurements` rows. The logging form stays exactly as today (`logBodyMeasurement` insert path, unchanged). The read path tolerates multiple same-date rows.
- Recomp verdict carries a compact evidence line (`weight -0.6 kg · waist -2.1 cm`) from the existing `RecompReadout`.

**OUT (deferred, do not build here):**
- Write-side per-metric same-date logging, the `UNIQUE(user_id, measured_at)` migration, the COALESCE upsert, any same-date merge policy.
- `deleteBodyMeasurement` action/UI (no path exists today).
- History-modal month grouping.
- Tab-state persistence (local component state only, no localStorage).

**Spec corrections applied (from verification):**
1. Chart markers: `E1RMChart` already has per-point markers (no change); `VolumeChart` is a bar chart (markers N/A). The only marker work is the inline bodyweight chart (lives in `ProfileView.tsx:25`, there is NO `BodyweightChart.tsx` file) plus the new measurement chart. Both are satisfied by one shared `MetricLineChart` with markers.
2. "No server-action changes" holds ONLY under this read-side scope. Stated as conditional, not absolute.
3. Measurement delete is out (no path exists today).

---

## File structure

**New files:**
- `src/components/pulse/SegmentedTabs.tsx`: generic controlled segment control composing `TabButton`. Used by both views.
- `src/components/pulse/MetricLineChart.tsx`: shared SVG area+line chart taking `MetricPoint[]`, with per-point dot markers. Replaces the inline `BodyweightChart`; reused for body weight and each measurement metric.
- `src/components/pulse/BodyWeightCard.tsx`: body-weight logging form + chart + latest-3 list + delete + trend chip. Lifted from `ProfileView`.
- `src/components/pulse/MeasurementsCard.tsx`: measurements, existing log form (unchanged) + per-metric picker + chart + latest-3 (read-side parity).
- `src/lib/pulse/bodyMetrics.ts`: pure `metricSeries(rows, metric)` helper + `MeasurementMetric` / `MetricPoint` types.
- Test files for each new unit (under the sibling `__tests__/` dirs).

**Modified files:**
- `src/components/pulse/views/ProfileView.tsx`: remove the body block; wrap in `SegmentedTabs` (You / Training); relocate gender to You with the new pill; denser Training option cards.
- `src/components/pulse/views/HistoryView.tsx`: wrap in `SegmentedTabs` (Overview / Lifts / Body); reorganize existing content; render the relocated body components + goal-weight row.
- `src/components/pulse/RecompCard.tsx`: add the compact evidence line.

**Component-split decision (confirmed):** Separate `BodyWeightCard` + `MeasurementsCard` (one responsibility each, independently testable), sharing `MetricLineChart` and the `metricSeries` helper. NOT a single combined `BodyTrackingSection` (it would do two things and bloat). Goal weight stays a small inline row in the Body tab markup (single value + edit, reusing `updateGoalWeight`), not its own component.

**`SegmentedTabs` decision (confirmed):** Reuse the existing `TabButton` (`src/components/pulse/TabButton.tsx`, accessible: `role="tab"`, `aria-selected`, `aria-controls`), matching the LibraryView tablist idiom (`LibraryView.tsx:23-31`). Do NOT reuse `WorkoutTabs`/`DayTabs` (domain-specific A-D / weekday logic). `SegmentedTabs` is a thin wrapper rendering a `role="tablist"` row of `TabButton`s plus the active panel. See the flag on active-tab styling below.

---

## The client-side derivation helper

`src/lib/pulse/bodyMetrics.ts`:

```ts
import type { BodyMeasurement } from './types';

export type MeasurementMetric = 'waist_cm' | 'hips_cm' | 'chest_cm' | 'arms_cm';

export interface MetricPoint {
    date: string; // measured_at (YYYY-MM-DD)
    value: number;
}

// Read-side per-metric series from the wide body_measurements rows. Keeps only
// rows where the chosen column is non-null, maps to {date, value}, sorted
// oldest-first for charting. Tolerates multiple rows per date (each kept as its
// own point); de-duping is a write-side concern, deferred. Pure.
export function metricSeries(rows: BodyMeasurement[], metric: MeasurementMetric): MetricPoint[] {
    return rows
        .filter((r) => r[metric] != null)
        .map((r) => ({ date: r.measured_at, value: r[metric] as number }))
        .sort((a, b) => a.date.localeCompare(b.date));
}
```

Body-weight points need no helper: `BodyWeightCard` maps `bodyweightLogs` inline as `{ date: e.logged_at, value: e.weight_kg }`.

---

## Commit sequence (re-cut from the spec's 5 for this reduced scope)

### Commit 1: `SegmentedTabs` component

**Files:** Create `src/components/pulse/SegmentedTabs.tsx`; Test `src/components/pulse/__tests__/SegmentedTabs.test.tsx`.

Interface:
```ts
interface SegmentedTabsProps {
    tabs: { id: string; label: string }[];
    active: string;
    onChange: (id: string) => void;
    ariaLabel: string;
}
```
Renders a `role="tablist"` row composing `TabButton` (one per tab, `controls={`panel-${id}`}`), styled as a full-width segment (`flex`, each button `flex-1`), matching the Slate idiom.

- [ ] Write the failing test: renders one tab per entry, the active tab has `aria-selected="true"`, clicking an inactive tab calls `onChange` with its id.
- [ ] Run it; expect fail (module not found).
- [ ] Implement `SegmentedTabs` composing `TabButton`.
- [ ] Run; expect pass. Run full suite + `bun run typecheck`.
- [ ] Commit: `feat(pulse): add SegmentedTabs control`.

**Why green:** new isolated component + test, no consumers yet.

### Commit 2: Extract body-tracking components from ProfileView (pure refactor)

**Files:** Create `MetricLineChart.tsx`, `BodyWeightCard.tsx`, `MeasurementsCard.tsx`; Modify `ProfileView.tsx`.

- `MetricLineChart` = the current inline `BodyweightChart` logic (`ProfileView.tsx:25-~80`) generalized to take `points: MetricPoint[]`, `unit`, and a `format` for the axis label. Reproduce today's render exactly: area path + polyline + the single last-point circle. NO per-point markers yet (added in Commit 5), so the bodyweight chart looks identical.
- `BodyWeightCard` = the body-weight section (`ProfileView.tsx:~627-720`): trend chip, date+value inputs, Log button, `MetricLineChart` (mapping `bodyweightLogs` to points), latest list, delete. Unchanged behavior. Props: `{ bodyweightLogs, unit, logBodyWeight, deleteBodyWeight }` (or pull from `usePulse` directly, matching how ProfileView does it).
- `MeasurementsCard` = the measurements section verbatim (`ProfileView.tsx:~771-840`): latest readout + cm/in toggle + the existing collapsible "+ Log" insert form. No read-side parity yet.
- `ProfileView` renders the three in the same positions as before.

- [ ] Move the inline chart into `MetricLineChart` (parameterized); update `BodyWeightCard` to call it.
- [ ] Move body-weight + measurements + goal markup into the new components; render them from `ProfileView` unchanged.
- [ ] Run the existing `ProfileView.test.tsx`; adjust only selectors broken by component nesting (behavior identical). Run full suite + typecheck.
- [ ] Commit: `refactor(pulse): extract body-tracking components from ProfileView`.

**Confirmed no behavior change:** with write-side cut, `MeasurementsCard` keeps the existing insert form and combined readout, and `MetricLineChart` reproduces the existing chart (last-point dot only). This commit only relocates markup. The existing `bwTrend` rounding and `BodyweightChart` behavior are preserved verbatim.

### Commit 3: Progress 3-tab restructure + relocate body tracking + recomp evidence line

**Files:** Modify `HistoryView.tsx`, `ProfileView.tsx`, `RecompCard.tsx`.

- `HistoryView`: wrap content in `SegmentedTabs` with tabs Overview / Lifts / Body. Overview = the existing TIER 1 (`StrengthScoreCard`, `RecoveryCard`) + TIER 2 (`RecompCard`) + streak. Lifts = the existing TIER 3 (volume, e1RM, per-muscle, Best Lifts, PRs) + Session History. Body = render `<BodyWeightCard/>`, `<MeasurementsCard/>`, and the goal-weight row relocated from `ProfileView` (`~722-770`).
- `ProfileView`: delete the body block (weight, goal, measurements). It is now rendered only in Progress.
- `RecompCard`: add a compact evidence line composed from `readout.weightDeltaKg` and `readout.waistDeltaCm` (both already computed), e.g. `weight {±X.X kg} · waist {±X.X cm}`, beside `readout.verdict`. Pure presentational; reuse `toDisplay` / `toLengthDisplay`.

- [ ] Add `SegmentedTabs` to `HistoryView`; partition existing JSX into the three panels (no logic change to the moved content).
- [ ] Render the body components + goal row in Body; remove the body block from `ProfileView`.
- [ ] Add the evidence line to `RecompCard`.
- [ ] Update `HistoryView.test.tsx` (tabs render + switch; Body shows weight + measurements), `ProfileView.test.tsx` (body assertions removed), `RecompCard` test (evidence line). Run full suite + typecheck.
- [ ] Commit: `feat(pulse): move body tracking to Progress, add Progress tabs`.

**Why green:** moved content is unchanged; tests updated to the new locations.

### Commit 4: Profile 2-tab restructure + gender to You + denser Training

**Files:** Modify `ProfileView.tsx`.

- Wrap in `SegmentedTabs` (You / Training). You = identity (display name), gender, weight unit, accent, rest timer, active routine, export CSV, account & security. Training = training style, exercise variety, equipment preference (loading lean), `EquipmentProfilesEditor`, movement restrictions, training priority.
- Gender pill group gains a third option "Prefer not to say" calling `updateGender(null)`; it highlights when `profile.gender == null` (mirror the onboarding `genderDeclined` pattern, `RoutineSetupFlow.tsx:355-358`).
- Training option cards (training style, variety, equipment preference) show their description only on the selected option; unselected show the label only. Same controls.

- [ ] Add `SegmentedTabs`; split sections into You / Training panels.
- [ ] Add the "Prefer not to say" pill (calls `updateGender(null)`); active when gender is null.
- [ ] Apply description-on-selected to the option cards.
- [ ] Update `ProfileView.test.tsx`: You/Training tabs render + switch; gender offers "Prefer not to say" and applies null. Run full suite + typecheck.
- [ ] Commit: `feat(pulse): split Profile into You/Training tabs, optional gender`.

### Commit 5: Read-side measurement parity + chart dot-markers

**Files:** Create `src/lib/pulse/bodyMetrics.ts` + `src/lib/pulse/__tests__/bodyMetrics.test.ts`; Modify `MeasurementsCard.tsx`, `MetricLineChart.tsx`.

- `bodyMetrics.ts`: the `metricSeries` helper above.
- `MeasurementsCard`: add a metric picker (Waist / Hips / Chest / Arms). For the selected metric, render `<MetricLineChart points={metricSeries(bodyMeasurements, metric)} />`, the latest-3 of that metric, and a trend chip. Keep the existing log form unchanged.
- `MetricLineChart`: add a small accent dot at every point (a `<circle>` per `MetricPoint`), so both the body-weight and measurement charts get per-point markers. Keep the bold last-point dot.

- [ ] Write `bodyMetrics.test.ts`: empty rows -> `[]`; filters null-metric rows; maps `{date,value}`; sorts oldest-first; keeps two rows with the same date as two points.
- [ ] Run; expect fail. Implement `metricSeries`. Run; expect pass.
- [ ] Add the metric picker + per-metric chart/latest-3 to `MeasurementsCard`; add per-point markers to `MetricLineChart`.
- [ ] Write/extend component tests: `MeasurementsCard` shows the selected metric's series and tolerates same-date duplicates; `MetricLineChart` renders one marker circle per point. Run full suite + typecheck.
- [ ] Commit: `feat(pulse): per-metric measurement read-side parity + chart markers`.

---

## Test plan

**Pure helpers (unit, fast):**
- `bodyMetrics.metricSeries`: empty, null-filtering, mapping, oldest-first sort, multiple same-date rows preserved.

**Component tests (Testing Library, existing mock patterns; mock `usePulse` and `useToast` as `ExerciseCard.test.tsx` does):**
- `SegmentedTabs`: tab render, `aria-selected` on active, `onChange` on click.
- `ProfileView`: You/Training tabs render + switch; gender offers "Prefer not to say" and calls `updateGender(null)`; the body block is absent (moved).
- `HistoryView`: Overview/Lifts/Body tabs render + switch; Body logs body weight and shows a measurement metric's chart + latest-3; recomp evidence line shows the weight/waist deltas.
- `MeasurementsCard`: per-metric derivation renders the selected metric and tolerates same-date duplicate rows.
- `MetricLineChart`: one marker circle per data point (assert circle count).

**No server-action test harness** (actions hit Supabase). Coverage lives in the hook/component/helper layers. **No server-action changes are made in this branch**, which holds only because measurement work is read-side (write-side parity, deferred, is what would require an action change).

**Gate:** full `bun run test:run` + `bun run typecheck` green before every commit.

---

## Deferred follow-on (do not lose)

**Write-side measurement spec (its own spec + plan):** independent per-metric same-date logging with "one value per metric per date". Requires: a `UNIQUE(user_id, measured_at)` migration on `body_measurements` (with a one-time dedupe/merge of existing same-date rows first), a rewrite of `logBodyMeasurement` from `.insert` to an upsert with per-column `COALESCE(EXCLUDED.x, existing.x)`, a same-date merge policy, and a new `deleteBodyMeasurement` action + UI (none exists today). This is the only way to honor "one value per metric per date"; it is out of this branch by decision.

**Other deferred (already on the roadmap or noted):** history-modal month grouping; tab-state persistence; and the larger Progress follow-ons captured separately (per-exercise detail view, workout calendar + session detail, expanded measurement metrics, progress photos #9, Library exercise grouping).

---

## Risks / things still worth flagging

1. **Commit 3 is the heaviest** (Progress restructure + body relocation + recomp line + two test files). If it gets unwieldy during execution, split into 3a (Progress tabs + content reorg) and 3b (relocate body + remove from Profile + recomp line). Body must never be orphaned, so the "remove from Profile" and "add to Progress Body" steps stay in the same sub-commit.
2. **Active-tab styling divergence (needs your call).** The mockups showed a filled-accent segment pill; the app's existing `TabButton` idiom (used in Library) is a soft accent-tint. The plan reuses `TabButton` for consistency, so tabs will look soft-tinted, not filled. If you want the filled-pill look from the mockup, that is a one-line style override in `SegmentedTabs`. Default: match the existing idiom.
3. **Measurements UX shift.** Today's section shows a combined latest readout across all four metrics; the new Body tab is per-metric (pick one, see its chart/history). This matches the mockup and the parity goal, but it is a real change to how measurements read at a glance. Confirm intended.
4. **`MetricLineChart` 30-point cap.** The inline `BodyweightChart` slices to the last 30 entries; the generalized chart keeps that for both weight and measurements. Fine for now; note it so it is intentional, not surprising.
5. **`ProfileView` is 887 lines.** Commit 2 shrinks it (body extracted) and Commit 4 restructures it; both are large but mechanical edits, not new logic. Reviewer should diff for accidental behavior drift in the moved sections.
6. **Scope is right-sized for one branch.** Nothing in the IN list needs a migration or an action change, so the branch stays a pure refactor + client-side read parity. The one thing that would have broken that (write-side per-metric logging) is correctly deferred.
```
