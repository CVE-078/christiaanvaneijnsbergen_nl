# Pulse — Slate Redesign + New Features (Design Spec)

**Date:** 2026-06-03
**Branch:** `feature/pulse-slate-redesign` (based on the audit branch `fix/pulse-audit-findings`)
**Reference mockups:** `docs/superpowers/designs/redesign-2026-06/slate.html` and `slate-accents/slate-coral.html`

## 1. Goal

Apply a full UX redesign to the Pulse app ("Slate" direction, coral accent) and add three competitor-gap features in the same pass: live PR detection, per-muscle weekly volume, and a plate calculator. Ship as one branch and one PR.

Chosen approach: **token-first restyle in place.** Rewrite the `pulse-*` design tokens, restyle existing components, rework the layout shell, and add the new features as pure functions wired into existing components. Reuse all existing logic and tests. No throwaway rewrite, no parallel v2 component set.

Constraints:
- Dark theme only. No light mode.
- Behavior of existing features stays identical except where a new feature adds to it.
- Keep the existing 354 tests green. Add tests for new pure functions.
- No database schema changes. All three new features derive from data Pulse already stores.

## 2. Design system

Update the Pulse tokens in `src/app/globals.css` (the `@theme` block):

| Token | Value | Note |
|---|---|---|
| `--color-pulse-bg` | `#0e1113` | near-black base |
| `--color-pulse-surface` | `#161a1d` | card / panel |
| `--color-pulse-surface-2` | `#1c2125` | raised surface |
| `--color-pulse-border` | `#262c31` | hairline, used sparingly |
| `--color-pulse-text` | `#e7ebed` | primary ink |
| `--color-pulse-dim` | `#aab2b7` | secondary ink |
| `--color-pulse-muted` | `#6f787e` | faint ink |
| `--color-pulse-accent` | `#ff7d66` | coral, the single accent |
| `--color-pulse-accent-dim` | `#b0503d` | coral dim (charts, partial states) |
| `--font-pulse` | `'Hanken Grotesk'` | display |
| `--font-pulse-body` | `'Sora'` | body |

Fonts load via `next/font/google` (Hanken Grotesk, Sora) in the Pulse layout, replacing Outfit for Pulse routes. The marketing site keeps Poppins.

Visual rules from the mockup (the things that make it feel clean):
- Separate surfaces with **tone shifts and whitespace, not borders**. Borders are hairline and rare.
- Only the **active / pending "log set" row** carries an outline, so the eye lands on the next action.
- About three type sizes. One accent color. Restrained, calm motion (a single gentle staggered load-in is enough).

## 3. Layout shell

Rework `AppShell` / `DesktopLayout` / `BottomNav` to the mockup structure.

- **Desktop (>= 1024px):** three zones. A slim left icon rail (brand mark + nav icons + sign out), the content column, and a right **context rail** showing today's stats (sets done / total, streak, session volume, target RIR) and the rest timer pinned in the rail.
- **Mobile:** compact top bar (brand, week pill, streak) + bottom nav (Train, Plan, Progress, Profile, Explore).
- The mobile/desktop split is driven by **CSS breakpoints**, not a JS `useMediaQuery` branch that unmounts and remounts the shell. This also fixes the layout-flash flagged in the audit (`useMediaQuery` finding). `useMediaQuery` may remain for non-layout uses, but the shell no longer remounts on it.

## 4. Screens

### 4.1 Train (core)
Restyle `LogView`, `ExerciseCard`, `SetLogger`, `DayTabs`, `WorkoutTabs`, `RestTimer` to Slate.
- Header: `Week 03 / 12`, `Phase 1 - Accumulation`, `target RIR 2-3`, streak.
- Day selector: Mon-Sun, today highlighted, workout-type label, logged-set indicator.
- Set rows: tabular `22.5 x 10 @ RIR 2`, with a done/checkmark state; the pending row is the only outlined element.
- New here: the **plate calculator** affordance (4.5.3) and the **live PR badge + toast** (4.5.1).
- `WorkoutModeScreen` (guided full-screen mode) restyled to match, including the live PR moment.

### 4.2 Progress
Restyle `StreakCalendar`, `VolumeChart`, `E1RMChart`, `BestLifts`, and session history to the calm Slate data-ink look (thin strokes, accent only on the current week / PR markers). Add **per-muscle weekly volume** as a horizontal bar list (4.5.2).

### 4.3 Plan / Profile / Explore
Reskin `ProgramView`, `ProfileView`, and `LibraryView` (already split into `views/library/*` by the audit work) to Slate. No structural change beyond what the tokens and shell provide.

## 5. New features (all pure-function-first, no DB changes)

### 5.1 Live PR detection
- Add `isSetPR(set, exerciseId, prMap)` in `src/lib/pulse/utils.ts`, reusing the existing E1RM and `computePRMap`. A set is a PR when its E1RM exceeds the stored best for that exercise.
- UI: a coral `PR` tag on the qualifying set row in `ExerciseCard` / `SetLogger` and in `WorkoutModeScreen`. On save of a PR set, fire a quiet success toast via the existing `ToastProvider`.
- No persistence change. PR state derives from logs already loaded into the provider.

### 5.2 Per-muscle weekly volume
- Add `computePerMuscleVolume(logs, routineExercises, week)` in `utils.ts`, summing logged working sets per exercise category for the selected week (uses the existing 10-category taxonomy).
- UI: a horizontal bar list on the Progress screen, one bar per muscle category, sorted by volume, accent-filled. Sits alongside the existing VolumeChart.
- No DB change.

### 5.3 Plate calculator
- Add `computePlates(targetKg, equipment)` in `utils.ts` returning the plate breakdown.
  - **Barbell:** `targetKg = barKg + 2 * sum(platesPerSide)`. Default bar 20 kg, standard plate set (25/20/15/10/5/2.5/1.25 kg).
  - **Loadable dumbbell:** `targetKg = handleKg + 2 * sum(platesPerSide)` per dumbbell. Default handle weight and a standard small-plate set.
- Defaults live as constants in `src/lib/pulse/constants.ts`. A per-user plate inventory / bar weight setting is explicitly OUT of scope for this pass (sensible defaults only).
- UI: a compact affordance in `SetLogger` (icon or expandable row) showing the plate breakdown for the target weight, with an equipment toggle (barbell / dumbbell). Hidden when not meaningful (e.g. below the bar/handle weight).

## 6. Testing

- Keep all existing tests green. Update component tests whose queries or snapshots change due to the reskin and the layout-shell rework (DesktopLayout, AppShell, ExerciseCard, SetLogger, the Progress chart components).
- Add unit tests for the three new pure functions: `isSetPR`, `computePerMuscleVolume`, `computePlates` (happy path, edge cases, rounding, below-threshold behavior).
- Verify suite: `bun run typecheck`, `bun run test:run`, `bun run lint`.

## 7. Execution

After this spec is approved, `writing-plans` produces the implementation plan, then a workflow builds it in dependency-ordered waves on this branch:
1. Tokens + fonts + layout shell.
2. Per-screen restyle in parallel (Train, Progress, Plan, Profile, Explore) once the shell and tokens exist.
3. The three new features (pure functions, then wire into the restyled components).
4. Verify + repair loop (typecheck, tests, lint), then a single PR.

## 8. Out of scope

- Light mode.
- Per-user plate inventory / configurable bar weight UI (defaults only).
- Body-diagram heat map for volume (bars only this pass).
- Any database schema change.
- The other roadmap features (auto-progression, strength score, progress photos, etc.) tracked separately in `docs/roadmap.md`.
