# Dynamic periodized programs (repeating block)

Date: 2026-06-05
Status: approved (design)

## Problem

The program is a single static 12-week block baked into `data.ts` (`PHASES`, `VOLUME`,
`WEEK_NOTES`), identical for everyone, with a fixed deload at week 12. Users want to train
long-term and to choose their mesocycle length.

## Approach (approved)

A **repeating periodized block**. The user picks a block length N ∈ {8, 10, 12, 16} per routine;
the program periodizes on that period **indefinitely**: phases, the RIR curve, and the volume ramp
repeat every N weeks, it deloads at the end of every block, and weights climb each cycle via the
existing auto-progression. There is no finite end — long-term = repeating blocks.

A reactive **plateau detection + smart deload** layer sits on top (Stage 2): when a main lift
stalls, a non-destructive suggestion offers a deload or swap.

Builds on what exists: per-set auto-progression (`computeProgression`) and the phase/volume model.
This does not rebuild those — it parameterizes the block by length and adds reactive deloads.

## Stage 1 — variable-length repeating structure

### Data model
- `program_weeks int` on `workout_routines` (default 12, check in (8, 10, 12, 16)). A program
  belongs to a routine, so it lives there.
- `WorkoutRoutine` / `RoutineWithExercises` gain `program_weeks: number` (default 12). Queries +
  generation seed it; the routine setup/generate flow lets the user pick it (default 12).

### Engine (pure, in `program.ts` or `data.ts`)
- `buildProgram(weeks: 8|10|12|16): ProgramBlock` returns the per-week layout for one block:
  `{ week, phaseLabel, subtitle, rir, sets, isDeload }[]`, plus the phase list. `buildProgram(12)`
  must reproduce today's tables (4 phases × 3 weeks; RIR `[3,3,2][2,2,1][1,1,0][1,0,3]`; the volume
  ramp; deload final week). Other lengths scale the same accumulation → intensification → overreach
  → peak/deload shape proportionally; 16 also gets a mid-block deload.
- `getPhase(week, weeks = 12)` and `getRIR(week, weeks = 12)` gain an **optional block length**
  (default 12 → identical to today, so every existing caller keeps working). Internally they map
  any week into its position within the block via modulo (`((week - 1) mod N) + 1`), so week 13 in
  a 12-block = block 2 week 1.
- Volume for a week likewise comes from `buildProgram(N)` by modulo.

### Wiring (only where N matters; everything else keeps the default-12 behavior)
- The active routine's `program_weeks` flows from context. `ProgramView` (phase card, volume chart,
  week stepper), `LogView` (header RIR + week stepper), and `SetLogger` (target RIR) read phase/RIR
  /volume for the active routine's N. The volume chart and week stepper bound to N (and allow
  stepping past N into the next block).
- Routine setup/generate flow: a "Program length" step/control (8/10/12/16, default 12), persisted
  on the routine.

### Testing
- `buildProgram`: each length produces the right phase boundaries, a descending RIR curve resetting
  per block, a volume ramp that deloads at block end, and `buildProgram(12)` equals the current
  tables. `getPhase`/`getRIR` modulo-map across block boundaries (week 13 ≡ week 1 for N=12).

## Stage 2 — plateau detection + smart deload (reactive layer)

- `computePlateau(logs, routineExerciseId, week)`: a main lift is **stalled** when its best e1RM has
  not improved across the last ~3 logged weeks. Pure, unit-tested.
- Response is **suggestion-based** (never silently rewrites the plan): a "Plateau" nudge on the
  exercise / Progress — "Bench has stalled 3 weeks" — with one-tap **deload that lift** (back off
  next week's targets via the existing progression deload path) or **swap** (reuses `swapCandidates`).
- The scheduled end-of-block deload stays; plateau adds reactive deloads on top.

## Out of scope (separate follow-on)

- Adaptive missed-workout regeneration (#3) — "you missed Lower B, here's an adjusted week" — builds
  on this foundation; designed/built separately.

## Build order

Stage 1 (this spec's foundation) ships first and is self-contained (default-12 keeps everything
working); Stage 2 layers on. Each increment stays green.
