# Plan page redesign, implementation plan

Spec: `docs/superpowers/specs/2026-06-13-21-39-19-plan-page-redesign-design.md`
Mockup (contract): `docs/superpowers/designs/2026-06-13-21-17-54-plan-page-redesign-v2.html`
Branch: `feature/plan-page-redesign`

TDD throughout: pure helpers red/green first, then the presentational rebuild, then the wiring. Each numbered step is roughly one reviewable commit. Run the full suite (`bun run test:run`) + `bun run typecheck` after each logic step; only `git add` the listed paths (never a repo-wide `bun run format`).

## Pre-req decisions (resolve from the review loop before step 5+)
- O1 warnings: parse-from-rationale + localStorage dismiss (v1, no migration). Default unless the loop says otherwise.
- O2 restructure: reuse `TuneYourPlanPanel` regenerate-in-place from Plan.
- O3 arc taps drive `setActiveWeek` (arc replaces the standalone week stepper).
- O5 reuse vs new status mapper (check `formatProgramStatus`).
- O6 phase-description home (`data.ts` vs `explainCopy`).

## Step 1, pure helpers (utils.ts + tests)
- `buildBlockArc(weeks)` -> `Array<{ week, volume, rir, phase:{label,subtitle,color}, isDeload }>` over `buildProgram` + `getRIR` + `getPhase`.
- `nextDeload(weekInBlock, weeks)` -> `{ week, weeksAway }` (min-volume week; handle 16's mid-block deload).
- `estimateSessionMinutes(rows)` -> minutes (compound/isolation rest model + per-set work; tidy round).
- `programStatusPill(status)` -> `{ label, tone }` (or reuse/extend `formatProgramStatus`, per O5).
- Tests for each across 8/10/12/16 blocks + edge cases (empty session, all-isolation).
- Files: `src/lib/pulse/utils.ts`, `src/lib/pulse/__tests__/utils.test.ts` (or the existing arc/program test file).
- Commit: `feat(pulse): pure helpers for plan block arc, est duration, status pill`.

## Step 2, explainCopy concepts (additive + parity test)
- Add `rir`, `phase` glossary concepts to `ExplainConcept` + `explainCopy()`. Phase-description sentences land per O6.
- Extend the explainCopy test.
- Files: `src/lib/pulse/explainCopy.ts`, its test.
- Commit: `feat(pulse): add rir + phase explain concepts`.

## Step 3, warning constants exported + strip parser (pure + test)
- Export `LIMITED_VARIETY_WARNING` / `NO_COMPOUND_WARNING` from `generation.ts` (or relocate to `constants.ts`).
- Pure `splitRationaleWarnings(rationale)` -> `{ prose, warnings: string[] }` that pulls the known warning sentences out of the prose (extends the existing de-blob logic in ProgramView, lifted to a tested pure fn).
- Tests: rationale with neither / one / both warnings.
- Files: `src/lib/pulse/generation.ts` (export), a pure helper + test.
- Commit: `feat(pulse): extract generation warnings from rationale prose`.

## Step 4, sub-components (presentational, mockup-faithful)
Build the pieces the rebuilt view composes, each matching the mockup:
- `PlanProgramCard` (identity + status pill + block progress + stat row + Why-this-plan collapse with inline facts chips).
- `BlockArc` (variation A bars + caption + phase description + RIR/deload `Why` glossary; tap selects a week).
- `SessionList` with a `mode: 'selector' | 'accordion'` prop and a shared `PlanExerciseRow` (number, name, sets x reps, `exerciseReason`, equipment chips, Swap, How-to). Mobile/tablet render selector, desktop renders accordion (container query / `useMediaQuery` matching `AppShell`).
- `ProgramSettings` (collapsed group: length, start date, change split or days).
- `GenerationWarningNotice` (dismissible, localStorage-keyed).
- Component tests for the non-trivial ones (BlockArc tap, SessionList both modes, Why-collapse, notice dismiss).
- Commit(s): one per component or grouped by `feat(pulse): plan <component>`.

## Step 5, rebuild ProgramView + wire data
- Recompose `ProgramView.tsx` to the new IA using the sub-components; wire `programPosition` (status, weekInteger, progressionIndex), `buildBlockArc`, `estimateSessionMinutes`, `nextDeload`.
- Arc tap -> `setActiveWeek` (O3); remove the standalone stepper.
- Desktop L4 sticky rail layout (sticky left rail + scrolling right column) via the container-query / media-query split already used by `AppShell`.
- Restructure entry -> `TuneYourPlanPanel` regenerate-in-place (O2), seeded from the active routine + threaded callbacks like the existing consumers.
- Update `ProgramView.test.tsx`.
- Commit: `feat(pulse): rebuild plan page (block arc, sticky rail, responsive sessions)`.

## Step 6, verify + roadmap FINISH
- Full suite green + typecheck clean. Visual check at mobile/tablet/desktop against the mockup.
- Code-review pass on the diff (subagent / `/code-review`) before review-for-merge.
- Roadmap FINISH: move the synthesized page-depth Plan items to Shipped, clear In-progress, update test count + CLAUDE.md Pulse-architecture Plan paragraph. Same-branch final commit.
- Commit: `docs(roadmap): finish plan page redesign`.

## Notes
- No migration. No generator logic change. The only server-touching change is exporting warning constants (pure).
- Match the format:check state policy: only format files you touch.
- Stacked branch: when `chore/roadmap-sync-137-138` squash-merges, rebase `--onto main` (grab the old head sha first); user force-pushes.
