# Profile + Progress information-architecture redesign

Date: 2026-06-12
Status: design, pending implementation plan
Branch (intended): `feature/profile-progress-ia-redesign`

## Problem

The Profile page has grown into an 887-line single-column scroll doing three unrelated jobs at once: account/app settings, training-generation preferences, and body tracking. The training-preferences cluster (five stacked option lists) is the worst offender. The Progress page is independently getting crowded (Best Lifts + Recent sessions) now that real data fills it, and body data is split-brained: you *log* weight/measurements on Profile but *view* the recomp verdict on Progress.

## Goals

- Profile reads as a calm settings screen, not a wall.
- Body tracking lives in one coherent home, where you also view it.
- Progress decongests and gains room for Best Lifts + Recent sessions.
- Measurements reach parity with body weight (log + chart + history), with add-entry restored.
- Gender can be left unset.
- Charts gain per-point markers.

## Non-goals (locked scope, 2026-06-12)

Captured as sequenced follow-on specs on the roadmap, NOT built here:

- Per-exercise browse + detail view (chart-type switching, timeframes, per-exercise PRs, horizontal PR cards, equipment grouping of the Progress exercise list).
- Workout calendar + session-detail view (duration, volume, exercise breakdown).
- Expanded measurement metrics (body-fat %, shoulders, neck, biceps, forearms, hips, thighs, calves). Needs a schema migration.
- Progress photos (already roadmap Tier 3 #9, deferred for storage/privacy).
- Multi-year chart timeframes (3Y/5Y/10Y). Premature for a weeks-old dataset.

Library exercise grouping-by-equipment is handled separately in the quick-fix lane, not here.

The Progress structure below MUST be built with clean entry points so these slot in later: the Lifts tab hosts a future "Exercises" drill-in, Overview or a future tab hosts the calendar, the Body tab grows more metrics and photos.

## Information architecture

Two segmented views. The segment control is sticky under the page title and reuses the existing tab idiom (Train workout-type tabs, Library tabs).

### Profile, 2 tabs (settings only)

- **You**: identity (display name), gender, weight unit, accent colour, auto-advance rest timer, active routine, export history (CSV), account & security (change password, delete account).
- **Training**: the generation-preferences cluster, unchanged controls: training style, exercise variety, equipment preference, equipment profiles, movement restrictions, training priority.

Density treatments approved in the mockup round:
- **You tab**: low-frequency settings (display name, active routine, export, password, delete) render as compact tap-through rows (`Label ›`). Frequently-flipped settings (unit, accent, rest timer) stay inline. Gender renders as inline pills.
- **Training tab**: option cards show their description only on the *selected* option; unselected options show just the label. Same controls, denser presentation.

### Progress, 3 tabs (owns lifts + body)

- **Overview**: the glance. Strength score, recovery, recomp verdict, streak, weekly-volume status. (Reorganizes the existing TIER 1 + TIER 2 content.)
- **Lifts**: training trends with room to breathe. e1RM progression chart (with exercise selector), Weekly Volume, per-muscle volume, Best Lifts (3 shown + "Show all NN lifts"), Personal Records, Recent sessions (3 shown + "Show all NN sessions"). (Reorganizes the existing TIER 3 + Session History.)
- **Body**: relocated from Profile. Body weight (log + chart + 3 recent + history modal), Measurements (log + chart + 3 recent + history modal), Goal weight.

## Component behavior

### Gender, three-state (You tab)

Pills: **Male / Female / Prefer not to say**. "Prefer not to say" calls the existing `updateGender(null)`. No action or schema change; the action already accepts null and the onboarding step already offers this choice. This only closes the gap in the Profile editor.

### Body weight (Body tab)

Unchanged logging behavior (`logBodyWeight`), now on Progress. Layout: date + value input + Log button, a trend chip (already rounded, `↓ 0.6 kg`), the line chart, then the **latest 3** entries followed by **"Show all NN entries"** opening the history modal. The inline list no longer grows unbounded.

### Measurements (Body tab), parity with body weight

The current collapsed "+ Log" form is replaced by first-class logging matching body weight. A metric picker (Waist / Hips / Chest / Arms, the existing `body_measurements` columns) selects which metric to log, chart, and browse. Logging calls the existing `logBodyMeasurement` with the chosen column for the chosen date. The chart and the latest-3 list show the selected metric's non-null history; "Show all" opens the history modal for that metric. The cm/in toggle stays.

Implementation note for the plan: `logBodyMeasurement` currently inserts a row. Per-metric logging on the same date should upsert-merge onto that date's row (or the loader must coalesce multiple same-date rows per metric). The plan picks one; the design requires only that one date shows one value per metric.

### History modal (shared)

A bottom-sheet modal reused by body weight and each measurement metric. Contents: a larger chart of the full series, then the full entry list **grouped by month/year** with sticky month headers (e.g. "June 2026", "May 2026"), scrollable. Delete-entry stays available where it is today (body weight rows). One component, parameterized by `{ title, series, unit, entries }`.

### Chart dot-markers (universal)

Add a small filled circle at each data point on the existing line charts: `E1RMChart`, `VolumeChart`, `BodyweightChart`, and the new measurement chart. Marker uses the accent colour, sized to read at mobile density without clutter. Pure presentational change to the chart SVGs.

## Desktop adaptation

The existing `DesktopLayout` sidebar shell hosts both views unchanged. Within each view, the segmented tabs render the same. Content keeps the current `max-w-[820px]` and goes two-column where it removes dead vertical space and serves the "dense desktop" preference:
- Progress **Body**: body weight and measurements side by side.
- Progress **Lifts**: charts in a two-column grid above the single-column Best Lifts / sessions.
- Profile **Training**: option groups may pair into two columns at desktop width.

A desktop mockup can be produced before implementation if wanted; the spec defines the rules above as the default.

## Data and migrations

None. Reuses `bodyweight_logs`, `body_measurements` (existing 4 columns), `profiles.gender` (nullable), `profiles.goal_weight_kg`. Expanded metrics, which would need a migration, are out of scope.

## Component / file impact map

- `src/components/pulse/views/ProfileView.tsx`: remove the body block (weight, goal, measurements); add a 2-tab segment (You / Training); add the gender "Prefer not to say" option. Shrinks substantially.
- `src/components/pulse/views/HistoryView.tsx`: add a 3-tab segment (Overview / Lifts / Body); reorganize existing content into Overview + Lifts; render the new Body tab.
- New `src/components/pulse/BodyTrackingSection` (or split `BodyWeightCard` + `MeasurementsCard`): the body-weight and measurements logging+chart+list, extracted from ProfileView so Progress hosts them.
- New `src/components/pulse/MetricHistoryModal.tsx`: the shared chart + month-grouped history sheet.
- New small `SegmentedTabs` control (or reuse an existing tab component) shared by both views; sub-tab state is local per view (default first tab), optionally persisted via `useUIState`/localStorage.
- Charts: `E1RMChart.tsx`, `VolumeChart.tsx`, `BodyweightChart.tsx`, and the measurement chart gain point markers.
- No server-action changes. `PulseContext` already exposes the needed reads/mutations (`bodyweightLogs`, `bodyMeasurements`, `logBodyWeight`, `logBodyMeasurement`, `updateGoalWeight`, `updateGender`, `refreshMeasurements`).

## Testing

- Pure logic: a `groupEntriesByMonth(entries, tz)` helper (newest-first, month/year buckets) gets unit tests; reuse the existing date helpers.
- Component tests (Testing Library, the existing patterns):
  - ProfileView: renders You/Training tabs, switches between them, gender offers and applies "Prefer not to say" (calls `updateGender(null)`), the body block is gone.
  - HistoryView: renders Overview/Lifts/Body tabs and switches; Body tab logs weight and a measurement; the list shows 3 then "Show all" opens the modal; modal groups by month.
  - Chart marker presence (a circle per point) on at least one chart.
- Full suite + typecheck green before each commit. No server-action test harness (actions hit Supabase); coverage lives in the hook/component layer.

## Rollout

Single branch `feature/profile-progress-ia-redesign`. Reviewable as a few commits: (1) extract body-tracking components, (2) Progress 3-tab restructure + Body tab, (3) Profile 2-tab slim + gender fix, (4) history modal + month grouping, (5) chart dot-markers. Each commit keeps the suite green.

## Open questions for the plan

1. Sub-tab state: local-only (resets on navigate) vs persisted in `useUIState`. Default: local, persist if cheap.
2. Measurement same-date logging: upsert-merge vs loader-coalesce (see Measurements note).
3. Desktop: ship from the spec rules, or produce a desktop mockup first.
