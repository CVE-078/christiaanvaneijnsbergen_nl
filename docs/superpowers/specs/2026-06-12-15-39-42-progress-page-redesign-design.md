# Progress page redesign (visual + coach surfaces)

Date: 2026-06-12
Branch: `feature/progress-page-redesign`
Locked mockup: `docs/superpowers/designs/2026-06-12-15-39-42-progress-redesign-mockup.html` (open via a local server; it is the pixel contract)

## Problem

The Profile + Progress IA redesign (#128) landed the *structure* of Progress (3 tabs: Overview / Lifts / Body, body tracking relocated, read-side measurement parity, chart dot-markers) but **not the visual redesign or several pieces the morning design round designed**. #129 then did the mockup-fidelity restyle for **Profile only**. So Progress still wears the old visual vocabulary on the new tab skeleton, and three designed-but-unshipped pieces are missing:

- The decongested "glance" Overview (the live Overview is the old dense cards).
- The shared month-grouped **history modal** behind every "Show all" (never built; "Show all" has nowhere to go).
- Session history as light summaries rather than set-by-set cards.

This spec completes the Progress redesign: the visual pass to match the Profile design language, plus the designed surfaces, plus four existing-but-unsurfaced data views the user asked to add.

## Goals

- Progress matches the #129 Profile design language (solid segmented tabs, tight `0.1em` uppercase section labels, `rounded-2xl` calm cards, SVG icons, consistent widths, value readouts on charts).
- Overview becomes a glanceable **coach report**, not a dense dashboard.
- The history modal (spec'd in the IA redesign, never built) ships.
- Four existing app capabilities surface on Progress: program/adherence status, coach decision timeline, workout calendar + session detail, strength-score breakdown.

## Non-goals (out of scope, stay deferred)

- **App-shell nav icon pass** (`DesktopLayout` / `BottomNav`): its own queued item. Nav icons in the mockup are placeholders.
- **Write-side measurement parity** (`UNIQUE(user_id, measured_at)` migration + COALESCE upsert + `deleteBodyMeasurement`). This redesign keeps the existing read-side parity and the existing `logBodyMeasurement` insert.
- **Expanded measurement metrics** (body-fat %, shoulders, etc.): needs a migration.
- **Progress photos** (#9).
- No new tables or columns. No migration.

## Locked design

`HistoryView` keeps the 3-tab `SegmentedTabs` (solid variant) and the Week/Cycle/All window control, restyled to the Profile vocabulary. Per tab:

### Overview, the glance

1. **Metric strip** (2-up mobile, 4-up tablet/desktop), Big Shoulders Display numerals:
   - **Strength**: the real `computeStrengthScore` value (0-100, e.g. `72`, **not** a placeholder 412). Tappable, opens the **strength breakdown modal**.
   - **Recovery**: a one-word summary from `computeRecoveryFlags` ("Fresh" when no flags, else "N flags").
   - **Program**: current program week ("W6").
   - **Streak (wk)**: `streak`.
2. **Program status card** (new), from `computeProgramPosition` (`adherence.ts`): a status pill (On track / Behind / Lapsed / Paused), `Week N of program_weeks`, a progress bar, "next deload" (from `getPhase` / `shouldDeload`), and this-week volume ("19 sets, on plan"). This replaces the redundant full-width "this week" rows.
3. **Recomp verdict card**, the existing `computeRecompSignal` readout, restyled with the accent-gradient header.
4. **Coach activity timeline** (new presentation), from `useDecisionEvents` + `decisionCopy`: the 3 most recent `DecisionEvent`s as a vertical timeline (ramp-back, lighten-week, auto-deload, program started), with "Show all". Reuses the existing decision copy; the plan decides reuse-vs-compact-variant of `CoachPanel`.

The dense `StrengthScoreCard` per-lift bars and `RecoveryCard` triage list are removed from the top glance; the strength bars move into the breakdown modal, recovery detail stays available via the metric/flags.

### Lifts, training trends

1. **Two trend charts** side by side (tablet/desktop), each with a **value readout header**:
   - e1RM progression (`E1RMChart`, exercise selector) with "105 kg, +8% / 12 wk".
   - Weekly volume (`VolumeChart`) with "19 sets this week".
   Both keep the dot-markers.
2. **Volume by muscle** (`MuscleVolumeBars` + `computePerMuscleVolume`), now wrapped in a card, with the priority focus line.
3. **Best Lifts, merged** (resolves the Best-Lifts-vs-Personal-Records overlap): one card showing top set (`computeBestSets`: kg x reps) **and** e1RM (`computePRMap`), grouped by workout type (the existing `BestLifts` grouping), top lift accented. The separate Personal Records card is removed.
4. **Sessions**: a month **calendar** (sessions placed by `workout_sessions.started_at`), marked days tappable, paired with a short **recent-sessions list** (lightweight summary rows: "Lower B, Week 5, 6 exercises, +2 PRs") and "Show all". Tapping a marked day or a row opens the **session-detail modal**: header (name, date, duration from `completed_at - started_at` / `durationMin`, set count, PRs) and the per-exercise breakdown.

### Body, tracking

1. **Top summary row** (2-up tablet/desktop, equal-height cards; on mobile **Goal weight is first/top**):
   - **Goal weight** (50% on desktop): current -> goal -> to-go + progress bar (`GoalWeightCard` data).
   - **Recent change** card: weight / waist / lifts deltas over the window. Fills the goal-weight row at 50%; matches the goal card's height (content vertically centered). It is a thin presentational summary of existing recomp deltas, not a new metric.
2. **Body weight | Measurements** columns, **aligned row-for-row**: title row, a metadata row (Body weight: trend chip; Measurements: metric pills + cm/in toggle), log bar, chart, latest-3, "Show all". The pills/trend rows occupy the same vertical slot so charts/entries/"Show all" line up.
   - Body weight: unchanged `logBodyWeight` path.
   - Measurements: **pills** (Waist / Hips / Chest / Arms) select the metric to log/chart/browse (not a dropdown). Logging stays the existing `logBodyMeasurement` insert; per-metric series derived client-side (the shipped read-side parity).
3. Each "Show all" opens the **history modal**.

### History modal (new, was spec'd in #128 and never built)

A shared bottom-sheet on mobile, **centered dialog on desktop**. Contents: a larger chart of the full series, then the full entry list **grouped by month with sticky headers** ("June 2026", "May 2026"). Parameterized by `{ title, series, unit, entries }`; reused by body weight and each measurement metric. Delete-entry stays where it is today (body weight rows).

### Shell + responsive

Hosted by the existing `DesktopLayout` sidebar shell (desktop) / `BottomNav` (mobile), unchanged. Content keeps a single centered column (`max-w` ~1000px). Two-column layouts (metric strip, body columns, charts, sessions calendar+list, top summary row) collapse to one column on mobile. Modals: bottom-sheet on mobile, centered on desktop.

## New / changed components

New: `ProgramStatusCard`, `CoachActivityTimeline` (or compact `CoachPanel`), `StrengthBreakdownModal` (reuses `StrengthScoreCard` sub-score rows), `SessionsCalendar` + `SessionDetailModal`, `MetricHistoryModal` (the shared month-grouped sheet).
Changed: `HistoryView` (recompose Overview into the glance; Lifts/Body restructure + restyle), `BestLifts` (add e1RM column; the merge removes the standalone PR list), the chart wrappers (value-readout headers).

## Data sources (all existing; no migration)

`computeStrengthScore`, `computeRecoveryFlags`, `computeProgramPosition` + `getPhase`/`shouldDeload`, `computeRecompSignal`, `useDecisionEvents` + `decisionCopy`, `E1RMChart`/`computeE1RMHistory`, `VolumeChart`/`volByWeek`, `MuscleVolumeBars`/`computePerMuscleVolume`, `computeBestSets`, `computePRMap`, `computeHistoryBundle` sessions + `workout_sessions` (`started_at`/`completed_at`/`durationMin`), `logBodyWeight`, `logBodyMeasurement` + client-side `metricSeries`, `GoalWeightCard`.

## Decisions (resolved during the design round)

- **Overview = lean glance** (metric strip + program status + recomp verdict + coach activity), not the dense cards.
- **Best Lifts + Personal Records merged** into one card (they overlap: Best Lifts already ranks by e1RM and shows the real set).
- **Strength headline is the real 0-100 score.**
- **Lifts keeps** per-muscle volume and the e1RM number (full content), with **lean session summaries** instead of set-by-set cards.
- **All four additions in scope** (program status, coach timeline, workout calendar + session detail, strength breakdown).
- **Measurements via pills**, not a dropdown.
- **Goal weight 50% on desktop, top on mobile**; **Recent change** card fills the other half at equal height.
- **History modal**: bottom-sheet mobile, centered desktop.
- **Sessions calendar** sized compact on tablet/desktop and paired with the session list (no oversized grid).

## Testing

- New aggregation/formatting logic (session-by-date mapping for the calendar, program-status formatting, month-grouping for the modal) goes in pure functions in `utils.ts`/`adherence.ts` and is unit-tested.
- New components (`MetricHistoryModal`, `SessionsCalendar`, `ProgramStatusCard`, restructured `HistoryView`) get Testing Library coverage: tab switching, "Show all" opens the modal, modal month-grouping, metric-pill switching, session-detail open.
- Keep the suite green; typecheck clean.

## Risks / notes for the plan

- **Coach activity vs `CoachPanel`**: decide reuse vs a compact timeline variant rather than duplicating decision copy.
- **Calendar date attribution**: use `workout_sessions.started_at` for the calendar cell; do not re-derive from week-keyed log keys.
- **Strength breakdown**: reuse `StrengthScoreCard`'s existing sub-score rendering inside the modal; no new scoring logic.
- This is several reviewable commits (extract modal; Overview glance; Lifts restructure + Best Lifts merge; sessions calendar + detail; Body alignment + summary row; restyle pass). Each keeps the suite green.
