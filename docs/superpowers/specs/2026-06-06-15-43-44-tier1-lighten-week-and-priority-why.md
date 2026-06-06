# Tier 1 quick wins: Lighten this week (#11) + priority-tilt why line (#1 remainder)

Spec for an autonomous batch of two Tier 1 items on `feature/tier1-quick-wins`. Written 2026-06-06.

## Item A: Lighten this week (#11)

**Goal.** A user-initiated "go easier this week" control that applies the existing ramp-back ease (volume factor 0.6, +1 RIR) to the current week on demand, not only reactively after a detected gap.

**Research findings (what "lighter" actually does today).**
- `progressionInfo(week, adjustments)` in `adherence.ts` filters `reentry_deload` rows. It sets `isRampBack` when one matches the week, and offsets `progressionIndex` by the count of ramp-backs before the week (a ramp-back is an *inserted* week, so progression pauses).
- The visible effect of `isRampBack`: `LogView` adds `RAMPBACK_RIR_BONUS` to the displayed target RIR, labels the week "Ramp-back", and shows a banner. `rampBackPrescription` (the 0.6 volume number) has no consumer, so "lighter" today = easier RIR + the inserted-week pause + a banner. No set-count reduction is wired anywhere.

**Key design decision: a manual lighten must NOT insert/offset the program.** A post-layoff ramp-back inserts a re-entry week (progression pauses while you rebuild). A manual "go easier this week" is a one-off: ease this week's effort, but keep progressing. So:
- `progressionInfo`: `isRampBack` becomes true for `reentry_deload` OR `manual_deload` on the week (both ease), but the `before` offset counts only `reentry_deload` (only a re-entry inserts a week). This is the crux change.

**Other decisions.**
- Reuse the same prescription (`RAMPBACK_VOLUME_FACTOR` 0.6, `RAMPBACK_RIR_BONUS` 1) per the roadmap ("applies the existing ramp-back math"). A gentler manual factor can come later.
- Overwrite behaviour on a week that already has an auto `reentry_deload`: the manual write upserts on `(user, routine, effective_week)`. Decision: the button is only shown when the week is NOT already lightened, so this collision cannot happen from the UI; the action still upserts defensively.
- **No undo in increment 1.** A stray tap only makes one week +1 RIR with progression unaffected (self-correcting next week), so it is low-stakes. The button hides once the week is lightened. Undo (a `manual_deload` delete) is a noted follow-up.
- **Coach Timeline integration.** The just-shipped timeline reads `decision_events`. So `manual_deload` dual-writes a `decision_event` (type `ramp_back`, new trigger `manual`) exactly as `reentry_deload` does, so a manual lighten shows in the timeline. Needs `DecisionTrigger` to gain `manual` (+ validator) and a `decisionCopy` branch.
- **Banner copy is kind-aware.** `LogView`'s "Ramp-back week" banner gets manual-aware text ("Lighter week / you chose to go easier; progression continues") vs the gap text.

**Files.**
- Migration: widen `program_adjustments.kind` CHECK to include `manual_deload`.
- `types.ts`: `AdjustmentKind += 'manual_deload'`; `DecisionTrigger += 'manual'`.
- `validation.ts`: allow `manual` trigger.
- `adherence.ts`: `progressionInfo` lightens on manual without offset. **(TDD)**
- `actions/adjustments.ts`: `lightenThisWeek(routineId, week)` -> `recordDecision(... 'manual_deload')`; extend payload + the dual-write for manual.
- `useProgramAdjustments.ts` + `PulseContext`: expose `lightenThisWeek` (optimistic).
- `decisionCopy.ts`: `ramp_back` + trigger `manual` branch. **(TDD)**
- `LogView.tsx`: kind-aware banner + the "Go easier this week" button when not lightened.

**Tests.** `progressionInfo` (manual lightens, no offset; reentry still offsets), `validateDecisionEvent` (manual trigger), `decisionCopy` (manual ramp_back), action (`lightenThisWeek` writes the adjustment + dual-writes the event).

## Item B: priority-tilt "why" line (#1 remainder, non-visual half)

**Goal.** Explain the priority-muscle volume tilt in plain language. The decision-surfacing half of #1 already shipped via the Coach Timeline (#10); this finishes the standing-config explanation.

**Research findings.** `HistoryView` (Progress) already tilts the per-muscle volume targets via `priorityAdjustedTargets(VOLUME_TARGETS, resolvePriority(profile.priority_muscle))` (line ~200). `resolvePriority` maps `balanced`/`null` to `null` (no tilt). So the tilt is real and ongoing, and Progress is exactly where it manifests.

**Decision.** A concise caption next to the per-muscle volume bars on Progress: e.g. "Glutes target raised, your training priority." Pure builder `priorityFocusLine(priority)` returning the sentence or null (null when no priority), rendered in `HistoryView` near the volume section. Accurate (targets are raised there), contextual, minimal visual footprint (a muted caption by existing bars). Not surfaced on the per-muscle rail item (that is the deferred visual half of #1).

**Files.** `utils.ts` (`priorityFocusLine`, **TDD**) + `HistoryView.tsx` render. **Tests:** `priorityFocusLine` per priority value + null.

## Self-review notes / risks
- `progressionInfo` change must keep all existing `reentry_deload` adherence tests green (offset behaviour unchanged for reentry; only manual is additive). Verified the `before` filter stays `reentry_deload`-only.
- Migration is required (kind CHECK), so the feature is inert until applied + merged. Flag to the user like the Phase 0 #3 migration.
- `manual` trigger is a TS-validator concern only; `decision_events.trigger` is free `text` with no DB CHECK, so no migration for it.
- Banner-copy change touches a shipped surface (`LogView`); keep the existing reentry path byte-identical, branch only for manual.
- Second-opinion code review (code-reviewer agent) over the full diff before finishing.
