# Plan page redesign, implementation plan

Spec: `docs/superpowers/specs/2026-06-13-21-39-19-plan-page-redesign-design.md`
Mockup (contract): `docs/superpowers/designs/2026-06-13-21-17-54-plan-page-redesign-v2.html`
Branch: `feature/plan-page-redesign`

TDD throughout: pure helpers red/green first, then the presentational rebuild, then the wiring. Each numbered step is roughly one reviewable commit. Run the full suite (`bun run test:run`) + `bun run typecheck` after each logic step; only `git add` the listed paths (never a repo-wide `bun run format`).

## Resolved decisions (review loop, 2026-06-13, see the spec's Review reconciliation)
- **O1 warnings:** dedicated `routines.warnings text[]` column storing stable KEYS; render copy from the registry; dismiss in localStorage by `(routine id, key)`. Adds a migration + generation/actions/loader/types touch (step 3).
- **O5:** reuse `formatProgramStatus` (label, tone, block-relative week, progress, next-deload). No new status/deload helpers.
- **O6:** phase / RIR / deload copy in `explainCopy`; phase-to-week mapping stays in `data.ts`.
- **O2:** split tune (in-place regen, keeps week) vs "change split or days" (starts a new block from week 1, confirm when logged history exists).
- **O3:** arc tap is inspection-only; "Week N of M" stays the authoritative position; no standalone stepper.
- **O4:** `estimateSessionMinutes` uses `is_compound`; round to nearest 5, labeled an estimate.
- **Arc tint:** ascending per-phase tint (live week full colour). **Accordion:** single-open on desktop. **Phase copy:** the data-accurate rewrites in the reconciliation.

## Step 1, pure helpers (utils.ts + tests)
- `buildBlockArc(weeks)` -> `Array<{ week, volume, rir, phase:{label,subtitle,color}, isDeload }>` over `buildProgram` + `getRIR` + `getPhase`.
- `estimateSessionMinutes(rows: { sets: number; is_compound?: boolean }[])` -> minutes (compound/isolation rest model + per-set work; round to nearest 5).
- Status + next-deload: **reuse `formatProgramStatus`** (no new helper). Confirm its output covers the identity card's needs.
- Tests across 8/10/12/16 blocks + edge cases (empty session, all-isolation).
- Files: `src/lib/pulse/utils.ts`, the existing utils/program test file.
- Commit: `feat(pulse): pure helpers for plan block arc + est duration`.

## Step 2, explainCopy concepts (additive + parity test)
- Add `rir`, `phase` glossary concepts to `ExplainConcept` + `explainCopy()`. Phase-description sentences land per O6.
- Extend the explainCopy test.
- Files: `src/lib/pulse/explainCopy.ts`, its test.
- Commit: `feat(pulse): add rir + phase explain concepts`.

## Step 3, warnings column (migration + keys + write path + loader + type)
- **Migration** `docs/migrations/<ts>-routine-warnings.sql`: `alter table routines add column warnings text[] not null default '{}'`. Hand-apply (user runs it; the classifier blocks me from running a prod migration).
- `generation.ts`: the two warning constants become stable KEYS (`'limited_variety'`, `'no_compound'`); `RoutineBlueprint.warnings` carries keys.
- `actions/routines.ts`: `generateAndSaveRoutine` writes `warnings` to the column and STOPS concatenating warning sentences into `rationale` (line ~552).
- `queries.ts`: add `warnings` to `ROUTINES_SELECT`. `types.ts`: `WorkoutRoutine` gains `warnings: string[]`.
- Warning copy moves to the registry (keyed by warning key); `GenerationWarningNotice` renders from it.
- Tests: generation emits the right keys under duress; the notice renders + dismisses (component). No server-action harness (actions hit Supabase).
- Commit: `feat(pulse): store generation warnings as keyed column, not rationale prose`.

## Step 4, sub-components (presentational, mockup-faithful)
Build the pieces the rebuilt view composes, each matching the mockup:
- `PlanProgramCard` (identity + status pill + block progress + stat row + Why-this-plan collapse with inline facts chips).
- `BlockArc` (variation A bars + caption + phase description + RIR/deload `Why` glossary; tap selects a week).
- `SessionList` with a `mode: 'selector' | 'accordion'` prop and a shared `PlanExerciseRow` (number, name, sets x reps, `exerciseReason`, equipment chips, Swap, How-to). Mobile/tablet render selector, desktop renders a **single-open** accordion (opening one closes the others), via `useMediaQuery` matching `AppShell`.
- `ProgramSettings` (collapsed group: length, start date, change split or days).
- `GenerationWarningNotice` (dismissible, localStorage-keyed).
- Component tests for the non-trivial ones (BlockArc tap, SessionList both modes, Why-collapse, notice dismiss).
- Commit(s): one per component or grouped by `feat(pulse): plan <component>`.

## Step 5, rebuild ProgramView + wire data
- Recompose `ProgramView.tsx` to the new IA using the sub-components; wire `programPosition` + `formatProgramStatus` (status, week label, next-deload), `buildBlockArc`, `estimateSessionMinutes`.
- Arc tap is **inspection-only** local state (preview a week's phase/volume/RIR); "Week N of M" stays the authoritative position; no standalone stepper.
- Desktop L4 sticky rail (sticky left rail + scrolling right column) via the `useMediaQuery` split used by `AppShell`; rail scrolls independently / drops "This week" on short viewports (O8).
- Restructure: "tune" -> `TuneYourPlanPanel` in-place regen (keeps week); **"change split or days" -> a path that starts a new block from week 1 with a confirm when the current block has logged history** (O2). Do not route a structure change through silent in-place regen.
- Update `ProgramView.test.tsx`.
- Commit: `feat(pulse): rebuild plan page (block arc, sticky rail, responsive sessions)`.

## Step 6, verify + roadmap FINISH
- Full suite green + typecheck clean. Visual check at mobile/tablet/desktop against the mockup.
- Code-review pass on the diff (subagent / `/code-review`) before review-for-merge.
- Roadmap FINISH: move the synthesized page-depth Plan items to Shipped, clear In-progress, update test count + CLAUDE.md Pulse-architecture Plan paragraph. Same-branch final commit.
- Commit: `docs(roadmap): finish plan page redesign`.

## Notes
- One small migration (the `routines.warnings` column, step 3); user hand-applies it. No change to the generation algorithm (only the warnings become keyed and write to the column instead of the rationale).
- Match the format:check state policy: only format files you touch.
- Stacked branch: when `chore/roadmap-sync-137-138` squash-merges, rebase `--onto main` (grab the old head sha first); user force-pushes.
