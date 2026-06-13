# Plan page redesign, design spec

Date: 2026-06-13
Branch: `feature/plan-page-redesign` (stacked on `chore/roadmap-sync-137-138`)
Approved mockup (the contract): `docs/superpowers/designs/2026-06-13-21-17-54-plan-page-redesign-v2.html`
Exploration: block-arc variations `…-21-12-13-plan-block-arc-variations.html`, desktop layouts `…-21-13-49-plan-desktop-layouts.html`, v1 `…-21-01-46-plan-page-redesign-mockup.html`.

## 1. Goal

Rebuild the Plan screen (`src/components/pulse/views/ProgramView.tsx`) so it answers, in order: what is my program, where am I in it, what do I lift next, how is the whole block shaped, what is each session, and how do I change it. Today the page mixes program settings (length, start date) into the top hero and buries the periodization intelligence (phases, RIR, deload) in an abstract volume bar chart and a prose rationale blob.

This redesign synthesizes five already-roadmapped page-depth Plan items into one cohesive branch:
- Block / phase arc view (phase per week, deload marked, RIR steps) from `buildProgram`.
- Per-slot "why this exercise" (already partly live via `exerciseReason`).
- Estimated session duration.
- Restructure entry (change split / days), routing through the existing generation flow.
- Explain-layer "Why this plan" collapse + generation-warnings-to-notice.

It is a UI / information-architecture redesign. No change to the generation algorithm. After the review loop it carries **one small migration** (a `routines.warnings text[]` column, see the reconciliation below); new work is otherwise presentational plus one pure helper (`buildBlockArc`, `estimateSessionMinutes`) and additive `explainCopy` concepts, reusing the existing `formatProgramStatus`.

## 2. Design principle alignment

"Simple surface, ignorable intelligence." Every coaching layer (phase descriptions, RIR/deload meaning, why-this-plan, why-this-slot) is calm by default and explained on demand through the shipped `Why` affordance, never shouted. The page must match the existing Pulse "Slate" visual contract pixel-for-pixel (same page container `max-w-[600px] lg:max-w-[1000px]`, shared tokens, fonts, and primitives). Phase colours are the fixed semantic colours already in `data.ts` (`Phase.color`), independent of the user-themeable accent.

## Review reconciliation (Claude.ai + Perplexity, 2026-06-13, decisions LOCKED)

Both reviews ran and converged on the architecture. All open questions are resolved. This section is authoritative where it differs from the proposal below.

- **Phase descriptions (Claude.ai, verified against code, the must-fix):** the 12-week volume is `[12,14,16,14,16,18,16,18,20,18,20,10]`, a ramp that climbs to 20 then deloads to 10, not the "volume falls as intensity rises" model the phase names imply. The originally drafted descriptions were factually wrong (Accumulation weeks 1-3 are the LOWEST working volume, not "higher volume"; Intensification volume CLIMBS, it does not "ease"). Locked rewrites (cover all five phase subtitles, general across the 8/10/12/16 blocks, no supercompensation overclaim):
  - Accumulation: "Building your base. Volume starts manageable and climbs week to week, with a rep or two left in the tank so you adapt and recover well."
  - Intensification: "Pushing harder. Volume keeps building and you train closer to your limit as the block ramps up."
  - Overreach: "The hardest stretch, by design. Peak volume with sets taken close to failure to drive new adaptation."
  - Peak & Deload: "One last hard push, then a lighter deload week so accumulated fatigue clears before the next block."
  - Deload (the 10-week block's standalone last phase): "A lighter week. Less volume and easier effort so fatigue clears before the next block."
- **O1 warnings (Perplexity): ADOPTED the column.** Add a `routines.warnings text[]` column storing stable warning KEYS; `generation.ts`'s two warning constants become keys; `generateAndSaveRoutine` writes the column and STOPS concatenating warning sentences into `rationale`; `ROUTINES_SELECT` selects it; `WorkoutRoutine` gains `warnings`. Copy renders from the registry; dismissal in localStorage keyed by `(routine id, warning key)`. **This adds one small migration plus a generation / actions / loader / types touch** and supersedes the earlier "no migration" line for this item. Rationale: parsing display copy out of a prose string is brittle and breaks under i18n / rephrasing.
- **O5 (both): reuse `formatProgramStatus`.** It already returns status label + tone, block-relative week label, progress, and the next-deload week. Drop the proposed `programStatusPill` and `nextDeload` helpers; the identity card consumes `formatProgramStatus`, the same mapper Progress's `ProgramStatusCard` uses (no drift).
- **O6 (both): phase / RIR / deload copy in `explainCopy`** keyed per concept; the phase-to-week mapping stays in `data.ts`.
- **Responsive sessions (both): one component, `mode` switch.** Desktop accordion is **single-open** (one session expanded at a time) to cap the per-exercise why-line density (Claude.ai); the why-line stays inline.
- **O2 restructure (Claude.ai, safety): SPLIT the operation.** A "tune" (regenerate selection, same session count) routes through in-place regen and keeps the current week. "Change split or days" changes session count, so it **starts a new block from week 1** and shows a confirm when the current block has logged history: "Changing your split or training days starts a new block from week 1." Never route a structure change through silent in-place regen.
- **O3 (Claude.ai): arc tap is inspection-only.** Read-only preview of a week's phase / volume / RIR; "Week N of M" (from `formatProgramStatus`) stays the authoritative completion-paced position. No separate week stepper. If a tapped week differs from the live week, the caption reads as a preview.
- **O4 (both): use `is_compound`** (confirmed present on the routine-embedded projection in `ROUTINES_SELECT`) in `estimateSessionMinutes`; round to the nearest 5 ("~55 min"), labeled as an estimate.
- **O8 (Claude.ai): sticky rail** scrolls independently when taller than the viewport; "This week" is the drop candidate on short viewports. Verify at a 13-inch laptop height before calling it done.
- **Block-arc tint (user decision):** ascending per-phase tint (faint, intensifying toward the peak; live/selected week full colour; deload marked). Flat 10% was dropped because it hid the four phases (Claude.ai's point), the user chose the ascending treatment from an A/B.
- **Science model (both): keep.** Periodized blocks + descending RIR + planned deload are defensible and mainstream; the exact four-label naming and weekly shape are product-design choices within accepted coaching practice. The phase NAMES are existing `data.ts` values and are not changed here.
- **Out of scope (Claude.ai science flag, noted not acted):** weeks 6-11 run RIR <=1 with two RIR-0 weeks before the first deload at week 12, which leans aggressive for a self-coached lifter. That is the program MODEL, not the Plan page, and the per-lift auto-deload is the safety net. A candidate for a separate program-tuning look, not this redesign.

## 3. Current state (inventory of `ProgramView.tsx`)

1. Header: "Plan" title + "Generate routine" button (`GenerateRoutineButton`, quick mode).
2. Program header card (accent left border): phase label/subtitle (`getPhase`), this-week note (`WEEK_NOTES`), de-blobbed rationale (facts chips + prose), inline week stepper, program length selector (`PROGRAM_LENGTHS` 8/10/12/16, `updateRoutineProgramWeeks`), program start date (date input + Today, `setProgramAnchor`).
3. `NextSessionCard`: next scheduled session + day, per-exercise sets x reps + the working weight Train will prefill (`computeSessionTargets`), "Start session ->".
4. Weekly schedule: 7-day Mo-Su strip, training days marked by type initial.
5. Weekly volume: `buildProgram(programWeeks).volume` bar chart, current in-block week highlighted, tap to jump weeks.
6. Per-session breakdown: grouped by `(sessionTypeFor, variant)`, numbered rows with name, sets x reps, `exerciseReason`, equipment chips (`EQUIPMENT_LABELS`), Swap (`ExerciseSwapPicker`, permanent), How-to-perform (`ExerciseInstructionModal`, built-in exercises only).

Data already on `usePulse()`: `activeRoutine`, `activeSchedule`, `activeWeek`/`setActiveWeek`, `programPosition` (unused for status here today), `profile`, `exercises`, `logs`, `routineExercisesByTabKey`, `resolveTabForEntry`, `setActiveTab`, `navigate`, plus the mutators above.

## 4. Approved design (the new IA)

Mobile is a single column in this order. Desktop (>=1024px) is the **L4 sticky-rail** layout: a pinned left rail (identity, next session, block arc, this week) beside a scrolling right column (sessions, settings).

1. **Program identity card** (accent left border).
2. **Next session** (the `NextSessionCard` look, lightly enriched).
3. **Training block arc** (the hero; variation A).
4. **This week** (the 7-day schedule strip).
5. **Sessions** (selector on mobile/tablet, accordion on desktop).
6. **Program settings** (collapsed): length, start date, change split or days.

A **conditional generation-warning notice** sits above the grid when the active routine carries a duress warning.

### 4.1 Program identity card

- Routine name (`activeRoutine.name`).
- Status pill from `programPosition.status` (`on_track` -> "On track" success; `behind` -> "Behind" warn; `lapsed` -> "Lapsed" warn; `paused` -> "Paused" muted). Copy + colour mapping is a small pure helper, see 6.3.
- Line: "Week {weekInteger} of {program_weeks} | Phase {n}, {subtitle}" via `getPhase(progressionIndex, weeks)`. Use `programPosition.weekInteger` (completion-paced) for the displayed week and `progressionIndex` for the phase, matching how the rest of the app reads position. Block-relative so cycle 2 reads "Week 1 of 12" (use `weekInBlock`).
- Block progress bar: `weekInBlock / program_weeks`.
- Stat row: RIR this week (`getRIR`), next-deload week + weeks-away (derived, see 6.2), days per week (schedule length).
- "Why this plan" affordance: the rationale **facts chips stay inline**; the **prose collapses** behind a "Why this plan" toggle (default collapsed). This is the explain-layer "rationale collapse" item.

### 4.2 Next session

Reuse `computeSessionTargets` and the `NextSessionCard` visual. Enrich the header with a focus line (session muscle groups) and the **estimated duration** (6.1). On mobile this is full content; in the desktop sticky rail keep it compact (cap the preview at 3 rows so the rail does not overflow the viewport, "Start session ->" still present).

### 4.3 Training block arc (variation A, approved)

Source: `buildProgram(program_weeks)` -> `{ phases, volume }`, plus `getRIR(week, weeks)` per week. Assemble a per-week array (6.4).

- One **full-width bar per week** (no fixed max-width), 3px gap, height proportional to that week's volume.
- **Phase tint at 10%**: unselected bars are `color-mix(phase-colour 10%, surface-2)`; the **selected/current week** bar is full phase colour. Default selection = current in-block week.
- The **deload week** (min volume in the block) carries a `↓` marker above its bar, shown regardless of selection.
- Week-number row beneath; current/selected week bold.
- **Caption** (bold readout, updates on tap): "Week {n} | {phase name} | {volume} sets | RIR {rir}" and, on a deload week, an extra "deload" term.
- **Phase description** (plain-language, muted, updates per phase) so a newcomer understands the phase. Use the locked, data-accurate wording from the Review reconciliation section above (the originally drafted copy was wrong about the real volume ramp and has been replaced there).
- **Glossary affordances**: "RIR" and "deload" in the caption are `Why`-glossary terms (tap -> definition). These route through `explainCopy` (6.5), not ad-hoc strings.
- Tapping a week is **local view state** (preview that week's phase/volume/RIR); it does not change `activeWeek` by default. Open question O3: should tapping also drive `setActiveWeek` so the rest of the page follows, replacing today's week stepper entirely?

The phase-description sentences are coaching copy. They are candidates for the science lens of the review loop (are the four phase characterizations accurate and not overclaiming?).

### 4.4 This week

The existing 7-day Mo-Su schedule strip. Today's column highlighted (using `profile.timezone`). Rest days muted. Session-type initials as today. No logic change.

### 4.5 Sessions (responsive)

Same data as today (`sections` grouped by `(sessionTypeFor, variant)`), same row content (number, name, sets x reps, `exerciseReason`, equipment chips, Swap, How-to-perform). Presentation differs by breakpoint:
- **Mobile + tablet (<1024px):** a horizontal **session selector** (chips, one per session) + the selected session's detail card. Default to the next/first session.
- **Desktop (>=1024px):** an **accordion**, all sessions listed, each collapsible; first open by default.

Each session header shows name + variant, estimated duration (6.1), set count, and a focus line. The same exercise-row component renders in both modes (one source of truth; only the container differs, mirroring how `SetLogger` carries a `variant`).

### 4.6 Program settings (collapsed)

A collapsed group containing:
- Program length (`PROGRAM_LENGTHS` segmented, `updateRoutineProgramWeeks`).
- Program start date (date input + Today, `setProgramAnchor`), with the existing "only re-aligns schedule, not logged progress" caption.
- **Change split or days**: a row that opens the existing regenerate-in-place flow. `TuneYourPlanPanel` already regenerates in place (generate fresh, carry over `program_anchor` + `program_weeks`, delete the old routine) and already has a "Change split" step. The Plan entry reuses that mechanism. See 6.6 + O2.

### 4.7 Generation-warning notice (conditional, dismissible)

`generation.ts` produces `RoutineBlueprint.warnings` (`LIMITED_VARIETY_WARNING`, `NO_COMPOUND_WARNING`); `actions/routines.ts:552-553` concatenates them into the persisted `rationale`. Today they read as permanent prose forever. The redesign:
- Export the two warning constants from `generation.ts` (or move to `constants.ts`) so the display layer can match them exactly (no fuzzy substring matching).
- In `ProgramView`, detect any known warning sentence inside the rationale, **strip it from the displayed "Why this plan" prose**, and render it as a **distinct dismissible notice** above the page (amber, an info icon, dismiss `✕`).
- Dismissal persists in `localStorage` keyed by `(routine id, warning)` so a dismissed warning stays dismissed for that routine but a freshly regenerated routine surfaces it again.
- No migration, no server-action change (the rationale stays the persisted source of truth; we only re-present it). Recommended for v1; the more robust `routine.warnings text[]` column is a documented follow-up (O1).

## 5. Visual contract

Match the approved mockup. Tokens: `pulse-bg/surface/surface-2/border/dim/muted/text/accent/warn/success`. Fonts: `font-pulse` (Hanken Grotesk), `font-pulse-body` (Sora) for the sets x reps micro-label, `font-pulse-display` (Big Shoulders) only where the app already uses it. Phase colours from `Phase.color` in `data.ts` (`#4ade80` / `#facc15` / `#f97316` / `#f43f5e`); they are NOT the accent and must not be derived from it. Page container unchanged: `max-w-[600px] lg:max-w-[1000px]`. Reuse shared primitives (`SectionLabel`, `PageTitle`, `PageSkeleton`/`ErrorState`, `ModalSheet`-based modals, `Why`). Collapsible affordances reuse the chevron-rotate pattern already in the app.

## 6. New code

### 6.1 `estimateSessionMinutes(exercises)` (pure, new in `utils.ts`)

No helper exists for a *planned* session's duration (`computeShareStats`-style duration logic only measures *completed* sessions from `started_at`/`ended_at`). Add:

```
estimateSessionMinutes(rows: { sets: number; is_compound?: boolean }[]): number
```

Model: per working set, work time + rest. Rest defaults by compound vs isolation (e.g. compound ~150s, isolation ~75s) plus a fixed work estimate per set (~40s). Round to a tidy number. Exact constants are a calibration detail (defensible defaults, not researched precision); tune later against logged session durations. Surfaced as "~N min". Pure and unit-tested.

Open question O4: is_compound is on `ExerciseMeta`; confirm it is present on the routine-embedded exercise projection (`ROUTINES_SELECT`) so the Plan list has it, else fall back to a flat per-set estimate.

### 6.2 Next-deload derivation (pure)

From the block: the deload week is the min-volume week in `buildProgram(weeks).volume` (the block end). Given the current in-block week, compute the next deload week number and how many weeks away. Small pure helper or inline-pure; unit-tested with the 8/10/12/16 blocks (note: 16 has a mid-block deload at week 8, so "next deload" is the nearest upcoming min-volume week, not always the block end).

### 6.3 `programStatusPill(status)` (pure)

Maps `AdherenceStatus` -> `{ label, tone }` where tone is `success | warn | muted`. One source of truth for the identity-card pill; reused anywhere the Plan needs the status word. (Progress already has `formatProgramStatus`; check for reuse/overlap before adding, O5.)

### 6.4 `buildBlockArc(weeks)` (pure)

Thin assembler over existing functions: returns `Array<{ week, volume, rir, phase, isDeload }>` for one block, where `phase` carries `{ label, subtitle, color }`. Built from `buildProgram(weeks).volume` + `getRIR(week, weeks)` + `getPhase(week, weeks)`; `isDeload = volume === min(volume)`. Pure, unit-tested. Drives both the bars and the caption.

### 6.5 `explainCopy` additions (additive)

Add glossary concepts `rir` and `phase` (and optionally `block`/`periodization`) to `ExplainConcept` + `explainCopy()`:
- `rir`: "How many more reps you could do before failure. RIR 3 leaves a few in the tank; RIR 0 is all-out."
- `phase`: "Your program runs in phases that gradually raise the effort, then a deload week to recover. The cycle repeats."
`deload` already exists (coaching concept). The phase description sentences (4.3) live in one place too; decide whether they belong in `explainCopy` keyed per phase or in `data.ts` next to `PHASES` (they are phase data, lean `data.ts` with `explainCopy` carrying only the on-tap glossary). O6.

### 6.6 Restructure entry wiring

Add a "Change split or days" control in Program settings that opens the regenerate-in-place flow. Reuse `TuneYourPlanPanel` (already: regenerate in place, carry anchor + length, delete old, "Change split" step) seeded from the active routine, or open `RoutineSetupFlow` at the split/days steps. Decide the exact entry in the plan (O2). No generator change either way.

## 7. Non-goals / explicitly deferred

- No program pause/resume control on Plan (stays on Train; avoids duplication).
- No calendar-date session pinning (fights completion-paced progression; dismissed in roadmap).
- No equipment-profile switcher on Plan (rides the restructure entry; dismissed as a separate control).
- No print/share plan summary (held).
- `ulppl-5` per-session relabel (Bug 6) is its own diff (needs a schedule `label` column); not in scope.
- The robust `routine.warnings` column (O1) and a server-side change to stop concatenating warnings into rationale are deferred; v1 parses + dismisses.

## 8. Test plan

Pure helpers (Vitest): `estimateSessionMinutes` (compound-heavy vs isolation-heavy, empty), next-deload derivation across 8/10/12/16 (including 16's mid-block deload), `buildBlockArc` shape + `isDeload` flag + RIR/phase correctness per block, `programStatusPill` mapping, the warning-strip parser (rationale with/without each warning -> stripped prose + extracted notice). Add `explainCopy` parity coverage for the new concepts.

Component (`ProgramView.test.tsx`, extend existing): identity card renders status pill from `programPosition`; "Why this plan" toggles prose; block arc renders N bars with the deload marker and updates caption on week tap; sessions render as selector (mobile) and accordion (desktop) with the same row content; settings collapsed by default; generation-warning notice appears only when a known warning is present and hides on dismiss. Reuse the existing test's routine/log fixtures (UUID `routineExerciseId`, per the test-fixtures note).

No server-action test harness (actions hit Supabase); the warnings-extraction is display-side, covered by the parser + component tests.

## 9. Open questions (RESOLVED, see the Review reconciliation section near the top)

The list below is the original set posed to the reviewers; every item is now resolved in the Review reconciliation section. Kept for traceability.


- **O1 (architecture):** warnings as parsed-from-rationale + localStorage-dismissed (no migration, v1) vs a `routine.warnings text[]` column + stop concatenating into rationale (migration, robust). Recommend v1 now, column later.
- **O2 (architecture/UX):** restructure entry, reuse `TuneYourPlanPanel` from Plan vs open `RoutineSetupFlow` at the split/days steps. Which is the cleaner reuse, and does "change days" need the day-grid step specifically?
- **O3 (UX):** does tapping a block-arc week also drive `setActiveWeek` (replacing the week stepper entirely), or stay a local preview while a separate control sets the active week? The redesign removes the standalone stepper; confirm the arc is the week control.
- **O4 (code):** is `is_compound` present on the routine-embedded exercise projection for `estimateSessionMinutes`, or do we fall back to a flat per-set estimate?
- **O5 (architecture):** reuse Progress's `formatProgramStatus` for the status pill vs a new `programStatusPill`; avoid two status mappers drifting.
- **O6 (copy/i18n):** phase descriptions in `data.ts` (phase data) vs `explainCopy` (the i18n seam). The explain-layer doctrine wants one canonical sentence per concept; decide the home so i18n extracts cleanly.
- **O7 (science/UX):** are the four phase descriptions accurate and non-overclaiming for a hypertrophy/strength block? Is the RIR glossary wording right? (Route the citable sub-questions to Perplexity.)
- **O8 (UX):** sticky-rail height, the next-session preview is capped at 3 rows so the desktop rail does not exceed the viewport; is that the right trim, or should the rail scroll independently?

## 10. Rollout

One branch, full scope. TDD: pure helpers first (red/green), then the component rebuild matching the mockup, then the warnings-notice + restructure wiring. Verify against the running app at mobile/tablet/desktop breakpoints (the mockup is the pixel contract). Roadmap START already committed; FINISH moves the synthesized page-depth items to Shipped and clears the In-progress line. Suite green + typecheck clean before review-for-merge.
