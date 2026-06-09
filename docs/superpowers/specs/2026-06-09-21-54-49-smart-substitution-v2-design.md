# Smart substitution v2 (#8), design

**Status:** drafted + reconciled 2026-06-09 (autonomous build while owner AFK; design calls made decisively, reviewed by an architecture lens + a training-science/UX lens, reconciled below). Roadmap Tier 3 #8. Builds on the existing swap + behavior-driven adaptation (#7).

## Goal

Make swapping smarter and self-documenting: when a user swaps, let them optionally say **why** (pain / no equipment / crowded), and surface **2-3 ranked same-stimulus alternatives** tuned to that reason. The reason also closes the loop on #7: behavior learning demotes only from genuine **preference** swaps, never from constraint swaps (a knee twinge or a busy rack is not "I dislike this lift").

Three deliverables, one cohesive feature:
1. **Reason capture** on a swap (optional, low-friction).
2. **Reason-aware ranked suggestions**, with same-stimulus dominating.
3. **#7 safety**: behavior learning excludes constraint-reason swaps.

## Reason taxonomy

`SwapReason = 'pain' | 'no_equipment' | 'crowded'`, stored in a nullable `exercise_swaps.reason`. **null = unspecified (treated as preference).** Three toggle chips; nothing selected (the default) means "closest match" and is the preference path. No explicit `'preference'` value: its absence IS preference, keeping the enum to the three real constraints and the #7 filter trivial. Capturing a reason is **optional** (one tap). "Too hard/easy" is deliberately excluded (it is a load/progression decision for the deload/progression engine, not a swap reason); "variety/boredom" is excluded because it IS the null/preference path (and should keep feeding #7).

## Ranking (the "smart" part), tiered so same-stimulus always wins

The picker already filters to the **same `movement_pattern`** (hard, unchanged). v2 adds a pure, reason-aware re-rank.

**Metadata enrichment (prerequisite):** the swap UI loads `DbExercise`, which lacks role metadata. Add **`substitution_class`** and **`contraindications`** to `EXERCISES_SELECT` + `DbExercise` (both real `exercises` columns already used by the generation pool; additive + optional, backward-compatible). `substitution_class` is the canonical "same stimulus family" signal; `contraindications` (the per-exercise joint flags seeded by movement-restrictions #5) is what makes the pain path *actually* safe instead of a guess. (`fatigue` is NOT enriched; nothing in v1 needs it. Leave the generation action's own standalone exercises select at `routines.ts:469` alone, do not try to unify the two selects in this PR.)

**`rankSubstitutes(original, candidates, reason)`** (new pure fn in `utils.ts`, beside `swapCandidates`). It assumes `candidates` are **already same-pattern-filtered** (it does not filter), and returns them reordered by an **explicit tiered total-order comparator** (so the result is deterministic and "class wins" is structural, not a weight-tuning accident):

1. **Tier 1, same `substitution_class` as the original** (match sorts first). This **dominates every reason**: a same-stimulus candidate always outranks a different-stimulus one, so no reason can ever float a worse-stimulus lift to the top (e.g. a band press can never beat a dumbbell press for a crowded barbell bench). When the original's `substitution_class` is null, this tier is inert and ranking falls through to Tier 2 (graceful degradation for an un-tagged pool).
2. **Tier 2, the reason term** (breaks ties within the same Tier-1 group):
   - **null / preference:** equipment overlap with the original, **descending** (closest like-for-like). This is today's default order, under the Tier-1 boost.
   - **`no_equipment` / `crowded`:** equipment overlap **ascending** (prefer candidates that share the fewest equipment keys with the original, so you can train the pattern without that gear / that busy station). The two reasons rank identically.
   - **`pain`:** **contraindication-flag count ascending** (prefer candidates carrying the fewest joint-stress flags, i.e. the catalog's gentlest option for this movement). This uses the real seeded `contraindications` data, never a machine/isolation guess; it cannot surface a lift the catalog marks as joint-risky above one it does not.
3. **Tier 3, `name` ascending** (deterministic final tiebreak, owned by `rankSubstitutes` itself, not relying on input order / sort stability).

The picker surfaces the **top 3** as "Suggested" and keeps the full (also-reranked) list searchable below. `rankSubstitutes` is pure and fully unit-testable; `swapCandidates` is unchanged (its existing test stays green); the composition `rankSubstitutes(original, swapCandidates(original, exercises, opts), reason)` happens at the call site.

**Cross-pattern same-stimulus** (e.g. lat pulldown <-> cable row, both "back" but different patterns) is intentionally **out of v1**: the hard `movement_pattern` gate stays, since relaxing it risks far worse swaps. The eventual home is "expand candidates to the same `substitution_class` across patterns," which first needs the sub-class families audited for cross-pattern correctness. Named here so the gap is not mistaken for an oversight.

## Explainability (serves the "what changed, why" moat)

The suggested items carry an in-the-moment **"why" caption**, reusing the existing `exerciseReason(ex)` helper (`"Horizontal push · compound · chest, triceps"`) plus a short reason-context line over the suggestions: preference -> "Closest match", no_equipment/crowded -> "Same movement, different gear", pain -> "Same movement, gentler on the joints". Cheap, reuses shipped code, and gives the owner something to eyeball during validation. (Surfacing a swap's *stored historical* reason back in the UI stays deferred; the in-the-moment why does not.)

## Architecture / data flow

`exercise_swaps.reason` (new column) <- `setExerciseSwap(reId, week, exerciseId, reason?)` <- `useSwaps.setSwap(week, reId, exerciseId, reason?)` <- `ExerciseSwapPicker` (reason chips + `rankSubstitutes`). Read side for #7: `loadSwapHistory` selects `reason`; `analyzeSwapBehavior` skips constraint-reason rows.

### Data model
- **Migration** `docs/migrations/<ts>-exercise-swaps-reason.sql`:
  ```sql
  alter table exercise_swaps
    add column if not exists reason text check (reason in ('pain', 'no_equipment', 'crowded'));
  ```
  Nullable, no default (null passes the CHECK). RLS already covers the table.
- **Type** `SwapReason` in `types.ts`; `DbExercise` gains `substitution_class?: string | null` and `contraindications?: RestrictionFlag[]`.

### Server action (`actions/swaps.ts`)
`setExerciseSwap(routineExerciseId, week, exerciseId, reason?: SwapReason)`: validate `reason` is one of the three or absent; write `reason: reason ?? null` in the upsert (so an **un-tagged re-swap clears any prior reason**, latest intent wins, consistent with the existing `created_at` refresh). Ownership / from-capture unchanged.

### Hook + context
`useSwaps.setSwap(week, routineExerciseId, exerciseId, reason?)` threads `reason` (optimistic update unchanged; the `Swaps` map still stores only the substitute id, reason is write-only for v1). `PulseContextValue.setSwap` gains a trailing optional `reason?: SwapReason` (existing 3-arg callers compile unchanged).

### UI (`ExerciseSwapPicker`)
- A `captureReason?: boolean` prop (default **false**). When true, the picker shows a reason chip row (**Pain · No equipment · Crowded**, toggle-to-deselect, default none) and persists the chosen reason. **LogView passes `true`** (temporary week swap, persisted, feeds #7). **ProgramView passes `false`/omits** (permanent plan edit): no chips, so a user never tags "pain" expecting it to be remembered when it would not be; the permanent-swap path still benefits from the better default (Tier-1) ranking. This designs out the "I said pain and it forgot" trap rather than documenting it.
- The candidate list is `rankSubstitutes(original, swapCandidates(...), reason)`; the **top 3** get a subtle "Suggested" accent + the why-caption, the rest follow under an "All alternatives" divider. Search still filters the full list.
- `onSelect(exerciseId, reason)`; the current reason is passed up (LogView -> `setSwap`; ProgramView ignores it, `reason` is always null there since chips are off).
- Styling stays within the picker's existing Pulse tokens; dense, minimal, no new color literals.

### Behavior learning (#7) integration
- `SwapHistoryRow` gains `reason?: string | null`; `loadSwapHistory` selects `reason` (**update the pinned select assertion + row mapping in `queries.test.ts`**, which currently asserts `'from_exercise_id, created_at'`).
- The filter lives in the **pure `analyzeSwapBehavior`** (decided, not in SQL: the loader has no test harness, the pure fn does, and it keeps the demote logic in one place). It skips rows whose `reason` is one of the three constraints **before counting**; `null`/absent rows still count (untagged = preference, backward-compatible with every pre-#8 row). Determinism preserved (a `continue` before the tally; output still sorted).

## Edge cases
- **No reason chosen:** preference ranking (Tier-1 sub-class then equipment overlap), reason persisted null, counts toward #7. Same as today plus the better default order.
- **Pool with all-null `substitution_class`:** Tier 1 inert; ranking falls to the reason term + name. No crash.
- **Invalid reason to the action:** rejected by validation + the DB CHECK.
- **Re-swap without a reason:** clears the prior reason to null.
- **ProgramView permanent swap:** no chips, reason null, better default ranking, not fed to #7 (matches #7 scope).
- **Constraint-reason swap then #7 generation:** excluded from `demote` (a single constraint row in a 3-count set keeps the exercise off the demote list, proving the filter runs before the count).

## Out of scope (v1), with named follow-ons (data captured now)
- **Contraindication-aware pain across the user's profile restrictions / a joint picker** (v1 pain uses the catalog flag count, pattern-local, no joint asked).
- **Routing constraint reasons to other systems:** repeated `no_equipment` swaps are real signal that the user lacks that gear, the natural home is **equipment profiles (#6)**, and the `reason` column shipped here is the substrate. Repeated `pain` could feed **movement restrictions**. Both are explicit follow-ons, NOT v1 (v1 only persists the tag + feeds #7's demote-exclusion).
- **Cross-pattern same-stimulus candidates** (pulldown/row), see Ranking.
- **Surfacing a swap's stored reason back in the UI** (the `Swaps` map stays id-only; reason write-only).
- **Promote / anchor-pattern learning in #7** (that is #7 v1.6; this spec adds only the preference filter that *enables* it).
- **Extracting `swapCandidates` + `rankSubstitutes` into `src/lib/pulse/substitution.ts`**: a clean cohesion move (and it would resolve the `exerciseReason` vs swap-`reason` name proximity in `utils.ts`), but it is orthogonal refactor churn that should not be tangled into this feature diff. Kept in `utils.ts` for v1; use crisp `SwapReason` typing so the new `reason` never reads as the unrelated `exerciseReason` caption. Extraction is a documented follow-on.
- CSP / i18n untouched (no new origin; plain English, no em dashes).

## Testing
- **Pure (`utils.test.ts`):** `rankSubstitutes` per reason: **a same-`substitution_class` candidate always outranks a different-class one regardless of equipment/flags (the key "class wins" guarantee)**; within-class, preference = equipment-overlap desc, no_equipment/crowded = overlap asc, pain = fewest-contraindication-flags asc; `name` tiebreak holds regardless of input order; empty / all-null-`substitution_class` pool degrades gracefully. `swapCandidates`' existing test unchanged.
- **Pure (`behavior.test.ts`):** a constraint-reason row is excluded from `demote`; a null-reason row still counts; **a 3-row set where one row is a constraint does NOT reach `minCount=3`** (filter runs before the count); mixed rows count only preference/null.
- **Loader (`queries.test.ts`):** `loadSwapHistory` selects `from_exercise_id, created_at, reason` and maps `reason` (update the existing assertion).
- **Component (`ExerciseSwapPicker.test.tsx`):** with `captureReason`, chips render + toggle; choosing a constraint reason re-ranks the suggested top; the "Suggested" group shows the top ranked with the why-caption; `onSelect` carries the current reason; without `captureReason` no chips render; existing picker tests stay green.
- No server-action test harness (swap action hits Supabase); covered via the pure fns + hook/component tests. Full suite + typecheck green.

## Decisions log (made decisively while AFK), with the alternatives weighed
1. **Pain = contraindication-aware (fewest catalog joint flags), NOT machine/isolation.** Alt (original draft): machine/cable + isolation, no joint info. Rejected by the science lens as potentially pain-worsening; the safe `contraindications` data already ships, same enrichment cost. [Science C1]
2. **`substitution_class` is a hard Tier-1 sort dominating every reason.** Alt: a summed score with sub-class as "a strong boost." Rejected: tiered total-order makes "same stimulus wins" structural + testable, preventing a worse-stimulus float on the constraint reasons. [Science I2, Arch M5]
3. **Enrich `DbExercise` with `substitution_class` AND `contraindications`.** Both are existing columns, additive/optional. `fatigue` left out (unused in v1). [Arch I3, Science C1]
4. **Reason chips gated to LogView via `captureReason` (default false).** Designs out the ProgramView "tagged pain, it forgot" trap; permanent swaps still get the better default ranking. [Arch I5]
5. **#7 filter in the pure `analyzeSwapBehavior`, null counts.** Backward-compatible, testable, single-location. [Arch I2, I4]
6. **In-the-moment "why" caption (reuse `exerciseReason`), stored reason stays write-only.** Serves the explainability moat cheaply; full read-back deferred. [Science I4]
7. **Reason = 3 constraints, nullable (null = preference); optional.** Low friction; trivial #7 filter. [both]
8. **Keep `swapCandidates` + `rankSubstitutes` in `utils.ts` for v1; substitution.ts extraction is a documented follow-on.** Avoid tangling an orthogonal refactor into the feature diff. [Arch I7, I8]
9. **Hard `movement_pattern` gate retained; cross-pattern same-stimulus deferred.** [Science M3]
10. **`no_equipment`/`crowded` kept as separate stored reasons but ranked identically** (distinct tags are useful for the equipment-profile follow-on even though v1 ranks them the same). [Science I3]
