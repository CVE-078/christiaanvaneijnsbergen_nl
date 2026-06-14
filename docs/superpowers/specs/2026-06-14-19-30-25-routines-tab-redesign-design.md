# Library Routines tab redesign (Plan B core), design

**Date:** 2026-06-14
**Branch:** `feature/routines-tab-redesign`
**Status:** approved, ready for implementation plan
**Mockup:** `.superpowers/brainstorm/97269-1781456849/content/` (`routines-redesign.html` + `session-editor-final.html`)

## Goal

Rebuild the Library > Routines tab from today's toolbar + flat inline editor into the card-based IA the mockup defines: restyled routine cards, a "New routine" chooser sheet, a per-routine manage sheet, and a per-session exercise editor sheet. This is the **core** of Plan B. The Templates fold-in (the chooser's "Start from a template" + a template picker) is a deliberate follow-up, out of scope here.

## Context

`src/components/pulse/views/library/RoutinesTab.tsx` is currently one component: a create-name toolbar + Generate button, a plain routine list (rename / set-active / delete inline), and an inline editor for the active routine (`AddRoutineExerciseForm` + session-grouped `RoutineExerciseRow`s with arrow reorder and superset pair/unpair). `LibraryView` already deep-links `/pulse/library/routines`. All the server actions the redesign needs already exist on `usePulse`: `createRoutine`, `renameRoutine`, `deleteRoutine`, `setActiveRoutine`, `addExerciseToRoutine`, `removeExerciseFromRoutine`, `updateRoutineExercise`, `reorderRoutineExercises`, plus the `/api/pulse/supersets` POST/DELETE endpoints. **No new server action, no migration.**

## Locked decisions

1. **Decompose:** core redesign now; Templates fold-in is a separate follow-up. This build's chooser shows **Generate** and **Ad-hoc** only.
2. **Within-session reorder:** the per-session editor reorders exercises within the open session; moving an exercise between sessions is not offered (rare; remove + re-add). Reorder still submits the full ordered id list to `reorderRoutineExercises`.
3. **Session-editor row controls = variant A (icons):** a right-anchored cluster of 34px icon buttons. Order, left to right: a **conditional pair/link icon** (only when the next exercise can be paired), then the always-present **↑ ↓ ✎ 🗑**. The link sits at the left so the persistent four never shift position when it appears/disappears. The **bin is red by default** (not only on hover). Pair/unpair stays a single inline icon (no overflow menu; the routine editor has no other secondary action).
4. **Ad-hoc routines edit inline:** a generated routine has a `schedule` (named sessions to drill into); an ad-hoc routine starts empty with no schedule, so its manage sheet shows an inline editor with a **Type picker** on the add form, and exercises group by the type chosen. Scheduled routines drill into fixed-type per-session editors instead.

## Architecture

A thin orchestrator plus focused, independently testable pieces. New files under `src/components/pulse/views/library/`.

### `RoutinesTab` (orchestrator, rewritten)
- Reads `routines`, `activeRoutine`, `programPosition`, `profile` from `usePulse`.
- Renders: a count row + accent **"New routine"** button, then the list of `RoutineCard`s.
- Owns sheet state: `chooserOpen: boolean`, `manageRoutineId: string | null`, `editorSession: { routineId, type, variant } | null`.
- Holds the action handlers (create / rename / delete / set-active / add / update / remove / reorder / pair / unpair), passing them down. The superset/reorder helpers (`reorderWithinSession`, the pair-as-block logic) move out of the monolith into the session editor + a pure helper.

### `RoutineCard` (presentational)
- Props: `routine`, `isActive`, `progress?: { fraction: number; label: string }`, `onOpen()`.
- Renders: name + **Active** badge (active only) + split chips (`routineSessionChips`) + a block-progress bar **on the active card only** + a meta line (days/week · style · length, or "N exercises · no fixed schedule" for ad-hoc). Whole card is the click target -> `onOpen`.
- The active card's `progress` is derived by the orchestrator from `formatProgramStatus(programPosition, programWeeks)` (already used by ProgramView); `programPosition` in context is for the active routine, so non-active cards get no bar by construction.

### `NewRoutineChooser` (ModalSheet)
- Props: `open`, `onClose`, `onGenerate()`, `onAdHoc(name)`.
- Two choice rows: **Generate** (accent, "Rec") -> closes and triggers the existing `GenerateRoutineButton` flow; **Ad-hoc** -> reveals an inline name field -> `onAdHoc(name)`.
- A muted line notes "Start from a template" is coming (Templates follow-up). No template option wired here.

### `RoutineManageSheet` (ModalSheet)
- Props: `routine`, `isActive`, `onSetActive`, `onRename`, `onDelete`, `onOpenSession(session)`, plus the exercise mutation handlers (for the ad-hoc inline editor), `onClose`.
- Header: routine name + a context subtitle. Top **action row**: Set active / Rename (inline edit) / Delete (confirm). Then it branches:
  - **Scheduled routine** (has sessions): a session preview list (one row per `(type, variant)` group, with the exercise count + a chevron). Tapping a row calls `onOpenSession`.
  - **Ad-hoc routine** (no schedule): an inline editor: the exercises grouped by type (a `RoutineExerciseRow` list per type group) + an `AddRoutineExerciseForm` **with** the Type picker. Empty routines lead with the add form + a one-line empty state.

### `RoutineSessionEditor` (ModalSheet, with `onBack`)
- Props: `routine`, `session: { type, variant }`, the session's exercises, `unit`, the mutation handlers (add / update / remove / move / pair / unpair), `onBack`, `onClose`.
- Back chevron returns to the manage sheet; ✕ closes out.
- Renders the session's `RoutineExerciseRow`s with the variant-A icon cluster + an `AddRoutineExerciseForm` with `fixedType` (no Type picker; the session is the type).
- Houses the within-session reorder + superset pair/unpair logic, scoped to this session's exercise ids.

## Reused / modified existing pieces

- **`RoutineExerciseRow`** (reused): its action area is restyled to the variant-A icon cluster (link / ↑ / ↓ / ✎ / 🗑 as 34px icon buttons, link conditional + leftmost, bin red). It already takes `onMove` / `onRemove` / `onUpdate` / `onPair` / `onUnpair` / `canMoveUp` / `canMoveDown`; the change is presentational (text buttons -> icon buttons) plus accessible labels on each icon.
- **`AddRoutineExerciseForm`** (modified): add an optional `fixedType?: WorkoutType` prop. When set, hide the Type select and add with that type (session editor). When unset, keep the Type select (ad-hoc manage editor). Default the Type select to the **last-used type** so adding several same-type exercises does not require re-picking.
- **`ModalSheet`** (reused as-is): the hardened shell. Manage-sheet actions render as a top row in the body (per mockup), not a pinned footer.

## Pure, tested helpers

In `src/lib/pulse/library.ts` (the Library tab's pure-logic module, alongside `filterExercises` / `groupExercises`), pure and unit-tested:
- `routineSessionChips(routine): string[]` - the card's chip labels, one per `(type, variant)` session group, reusing `WORKOUT_TYPE_LABELS` + variant + `sessionFocusLabel`. Ad-hoc routines (no schedule, no grouped exercises) return `['Ad-hoc']`.
- `reorderWithinSession(allExerciseIds, sessionExerciseIds, fromIndex, direction): string[]` - the new full ordered-id list from a within-session move, preserving the pair-as-block behavior, so `reorderRoutineExercises(routineId, fullOrder)` keeps working unchanged.

## Data flow

All mutations go through the existing `usePulse` actions + the supersets API; reads come from the existing routine SWR. No new endpoints, no schema change, no migration. The orchestrator wires the handlers; the sheets are otherwise presentational.

## Accessibility

- Each icon button is a real `<button>` with an `aria-label` (Pair / Move up / Move down / Edit / Remove) and a 34px hit area.
- The session editor sheet uses `onBack` (back chevron) so the manage sheet is restored; ✕ fully closes (ModalSheet already manages focus trap + restore).

## Testing strategy

- Pure helpers unit-tested (`routineSessionChips`, `reorderWithinSession`), including the superset block-move and the ad-hoc fallback.
- The ~20 RoutinesTab cases in `LibraryView.test.tsx` are rewritten to the new flow:
  - New routine chooser: open -> Ad-hoc -> name -> `createRoutine`.
  - Card -> manage sheet -> Set active / Rename / Delete (confirm).
  - Manage sheet (scheduled) -> open a session -> session editor: add (fixed type) / edit (sets/reps/weight/rest) / within-session reorder / pair / unpair / remove. The existing superset + reorder coverage moves here.
  - Manage sheet (ad-hoc) -> inline add with the Type picker -> exercise lands in the right type group.
- Icon controls are queried by their `aria-label` (Edit / Remove / etc.), keeping the assertions stable.

## Deferred (next plan)

- **Templates fold-in:** the chooser's "Start from a template" option + a template picker sheet reusing `TemplatesTab` (currently unimported) and its `RoutineSetupFlow` clone-with-tweaks flow.
- Drag-to-reorder (replacing the ↑ ↓ icons) is a possible later polish; this build keeps arrow reorder.

## Non-goals

- No change to routine generation, the program engine, or any server action.
- No cross-session exercise moves.
- No change to how the active routine is consumed by Train / Plan.
