# Variety Preference Generation Input, Design

**Date:** 2026-06-07
**Status:** Approved (two external reviews folded: Claude.ai on coaching, Perplexity on architecture)
**Tier / item:** Tier 2 #4, the second of three generation-input refinements (after training style, before loading lean)

## Goal

Give the user one persisted preference that controls how much the generator rotates exercises across sessions. The default keeps today's behaviour (rotate freely); the opt-in setting anchors the main compound lifts so the same squat / press / row recurs across sessions for progressive overload and skill, while accessories and isolation keep rotating.

## Why this lever, and why now

Pulse's positioning is progression over years, not weeks. The generator already maximises cross-session variety: `selectForSession` always prefers a not-yet-used exercise and only repeats a movement pattern when its candidates are genuinely exhausted (`src/lib/pulse/generation.ts:522`). So the realistic axis is not "more variety" (there is no clean headroom above today's behaviour in a deterministic engine) but the ability to dial variety **down** toward consistency, which serves overload and skill on the lifts that matter.

This is the second of the three Tier 2 #4 generation inputs. Training style shipped first (PR #85); loading lean comes after. Each is its own branch and its own single-variable diff.

## The model (Model B: anchor compounds, rotate accessories)

Two candidate models were considered:

- **Model A, avoid-set strictness.** "Low variety" just relaxes the prefer-fresh rule so the selector may reuse any exercise sooner. Mechanically simplest, but the repeats are incidental (whatever sorts first), not the main lifts, so the control is illegible and undermines the progression story.
- **Model B, anchor-the-compounds (chosen).** "Consistent" deliberately repeats the main compound lifts across sessions while rotating accessories and isolation. Maps the lever onto a real consistency-vs-stimulus tradeoff a user can reason about, and protects progressive overload on the lifts where it matters.

Both reviewers and the user confirmed Model B.

## Decisions

### 1. Two levels, not three

`VarietyPreference = 'consistent' | 'varied'`.

- `varied` (the resolved default) = today's behaviour, exactly.
- `consistent` = anchor the main compounds, rotate the rest.

Perplexity recommended three levels (`consistent / balanced / fresh`); this design overrides that and takes Claude.ai's pushback for two:

- The generator already maxes out the avoid-set, so there is no clean buildable headroom for a third "even more varied" level without introducing randomness, which the deterministic engine forbids (`Math.random` is not used anywhere in generation).
- The "default must reproduce today's output byte-identical" invariant is guaranteed by `null -> default` plus a golden regression test, not by needing a middle enum value.
- YAGNI. A third level can be added later if a real need is demonstrated.

### 2. Mechanism: a compound anchor map, gated to `consistent`

Add a routine-wide `Map<MovementPattern, exerciseId>` (the *anchor map*), consulted **only** for compound patterns and **only** when the preference is `consistent`:

- For a compound slot: if that pattern already has an anchor recorded from an earlier session, reuse that exact exercise (even though it is in the routine-wide `used` set). Otherwise pick fresh as normal and record the choice as that pattern's anchor.
- Accessories, isolation, `calf`, and `core` keep the existing fresh-preference logic untouched.
- Within-session uniqueness (`chosenIds`) is untouched: a compound pattern appears at most once per session, so anchoring across sessions never forces a within-session duplicate.

The `varied` / `null` path runs the current code unchanged. No anchor map is built, so output is **byte-identical by construction**, the identity invariant holds because the new behaviour is gated behind `consistent`, never reached by the default.

### 3. The anchor set is its own constant, broader than the powerbuilding heavy set

Introduce a new named constant (parallel to, not a reuse of, `POWERBUILDING_HEAVY_PATTERNS`):

```
COMPOUND_ANCHOR_PATTERNS = { squat, hinge, horizontal_push, vertical_push, horizontal_pull, vertical_pull }
```

Rationale: anchoring is about skill and progression on all main bilateral compounds, so rows and vertical pulls belong even though they are not in the heavy-rep-range powerbuilding set (`{ squat, hinge, horizontal_push, vertical_push }`). The two constants encode different intents (rep range vs skill anchoring) and must stay separate so a future change to one does not silently change the other.

- `lunge` is deliberately excluded (unilateral accessory, not a lift you anchor for overload).
- `calf`, `core`, and all six `*_iso` patterns rotate.

### 4. Fully orthogonal to training style

Variety never reads training style and vice versa. The architectural reason (Claude.ai's framing): training style controls *how* you train a pattern (bias, rep range, load scheme via `resolveBias` / `resolveRepRange`); variety controls *which* exercise fills a given slot (selection). They operate at different layers of the slot-first pipeline. A strength-oriented user may still want high variety for boredom management; a bodybuilding-oriented user may still want staples for repeatability. Keeping them independent avoids hidden coupling and keeps each axis independently regression-testable.

### 5. Persistence mirrors `training_style` exactly

- Nullable `profiles.variety_preference` text column, check-constrained to `('consistent','varied')`. Migration dated `yyyy-mm-dd-hh-mm-ss`.
- `Profile.variety_preference: VarietyPreference | null` in `types.ts`.
- `variety_preference` added to `PROFILE_SELECT` with a guarded mapper in `queries.ts`.
- `generateAndSaveRoutine` gains a `varietyPreference?` param: resolved `param ?? profileRow?.variety_preference ?? 'varied'`, param wins, written back into the final profile upsert (same pattern training style uses).
- Passed into `generateRoutine` via `GenerationInput.varietyPreference?` (absent / `'varied'` is the no-op identity path).
- Surfaced as an optional step in `RoutineSetupFlow` (onboarding + generate flows), mirroring the training-style step.
- **Not built** (same trims as training style): no standalone Profile-screen editor, no `PulseContext` / `PulseProvider` setter (no consumer yet). Only what the generation entry point needs.

### 6. Golden-snapshot regression test, built first (hard prerequisite)

Before the feature behaviour ships, a golden test proves the default path is byte-identical to pre-feature output:

- Run the full generator over a fixed matrix: several split sizes (1 to 6 training days), a home/dumbbell-only equipment pool and a full-gym pool, and at least one configuration with repeated movement-pattern pressure across the week (where anchoring would visibly differ under `consistent`).
- Assert `variety: undefined`, `variety: 'varied'` produce identical serialized blueprints, and that those match a frozen golden fixture captured from `main`.
- This is the same safety net Balanced=identity provides for training style. It is the rollout guarantee for existing users.

## Accepted limitations (documented, not built)

- **Ramp-back does not force staples.** Claude.ai suggested that during ramp-back the engine should favour staples regardless of the user's setting. This is a non-issue at generation time: generation runs once at routine creation, while ramp-back is a runtime adherence nudge on an already-created routine, so they do not meet. Documented as a code comment and revisited only if mid-program regeneration is ever added. Not a user-facing preference.
- **No standalone Profile editor** for variety (deferred, as with training style).
- **No third "fresh variety" level** (no deterministic headroom above today's behaviour now).

## Implementation notes (edge risks both reviewers flagged)

- **Do not leak `consistent` into the avoid-set backfill.** The backfill loop in `selectForSession` must keep using the existing fresh-preference for non-anchor patterns; only the compound first-pass pick consults the anchor map. Odd accessory repetition or within-session duplicates would be a regression.
- **Auto-superset pairing.** Anchoring a compound plus its paired accessory should not recur so closely that it creates a harder-than-intended fatigue pattern. Scope the lever narrowly: repeat only the designated compound patterns, leave within-session uniqueness and accessory selection on the existing logic, and do not touch `buildSupersets`.

## Files touched

- `src/lib/pulse/types.ts`: `VarietyPreference` type; `Profile.variety_preference`.
- `src/lib/pulse/generation.ts`: `COMPOUND_ANCHOR_PATTERNS` constant; anchor-map logic in `selectForSession` (threaded `varietyPreference` + anchor map through `generateRoutine`); `GenerationInput.varietyPreference`.
- `src/lib/pulse/queries.ts`: `variety_preference` in `PROFILE_SELECT` + guarded mapper.
- `src/app/pulse/actions/routines.ts`: `varietyPreference?` param on `generateAndSaveRoutine`, resolved + written back.
- `src/hooks/pulse/useRoutines.ts` + `context/PulseContext.ts`: thread the param through the `generateRoutine` signature.
- `src/components/pulse/RoutineSetupFlow.tsx`: new optional `'variety'` step + options.
- `src/components/pulse/GenerateRoutineButton.tsx`, `OnboardingModal.tsx`, `views/TemplatesTab.tsx`: thread the value.
- `docs/migrations/<timestamp>-variety-preference.sql`: the nullable column + check constraint.
- Tests: golden-snapshot identity test (built first), `resolveBias`-style unit tests for the anchor logic, and a `RoutineSetupFlow` step test.
