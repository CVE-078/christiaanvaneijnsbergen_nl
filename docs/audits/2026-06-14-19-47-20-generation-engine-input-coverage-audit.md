# Pulse routine generation engine, input & coverage audit (2026-06-14)

**Supersedes** `docs/audits/2026-06-11-14-55-28-generation-engine-input-coverage-audit.md`. Re-run against the current tree after the `#138` compound-first selection guard, the `#141` per-session focus labels, and the `suggestedStyleKey` intent-aware suggestion all landed. The 2026-06-11 findings remain substantially correct; this version folds in those three deltas, re-anchors the line numbers (the file grew ~140 lines), and re-verifies the residual gaps.

**Method:** full read of `src/lib/pulse/generation.ts` (1787 lines), `src/app/pulse/actions/routines.ts`, `src/lib/pulse/types.ts`, `src/lib/pulse/__tests__/generation.test.ts` (200 `it`/`test` cases across 68 `describe` blocks), plus `recommendation.ts`, `behavior.ts`, and `weeklyFrequency.ts` for the input types. Documentation and gap analysis only, no code changed here. Line numbers are a 2026-06-14 snapshot; treat them as navigational, not durable. Where a behavior depends on seed data not in these files (the exercise catalog, the `contraindications` column), that is stated rather than guessed.

**Pipeline, end to end:** `generateAndSaveRoutine` (action) gathers and hardens inputs, loads the global exercise pool minus hidden exercises, derives a behavior signal from swap history, resolves profile-stored preferences (param wins over stored value, then writes back), then calls `generateRoutine`. `generateRoutine` orders the training days, computes volume, filters the pool (equipment + contraindications), and for each session runs `tiltEmphasis -> resolveBias -> selectForSession (+ minimum-compound floor) -> orderByRole (exercise role model) -> set/rep assignment -> optional supersets`, and now also stamps a per-session `label` via `focusLabelForEmphasis(session.emphasis)` (`generation.ts:1604`) that the action persists to `routine_schedule.label` (`routines.ts:585`).

---

## SECTION 0: What changed since the 2026-06-11 audit

| Delta | Mechanism | Effect on this audit |
|---|---|---|
| **`#138` compound-first selection guard** (commit `42d3b48`) | An `is_compound` term added to the `byPattern` selection sort in `selectForSession` (`generation.ts:1036-1038`), positioned **after** the canonical-anchor rank (`:1024`) and **before** the fatigue tiebreak (`:1043`), i.e. the order is now `anchor > compound > fatigue`. | The selection-sort chain is now **8 layers**, not 7 (Section 4). It is a **defensive artifact**, live only for the two compound/isolation MIXED patterns `squat` (Leg Extension) and `hinge` (Leg Curl); a no-op for the other 13 segregated patterns. Tested end-to-end (Section 7). |
| **`#141` per-session focus labels** (commit `b765df2`) | `focusLabelForEmphasis(emphasis)` (`generation.ts:1503`) maps quad emphases (`lower_quad` / `lower_lean`) -> "Lower (Quads)", posterior (`lower_post`) -> "Lower (Hamstrings & Glutes)", null otherwise; written into each `schedule` row at generation. | Output labeling, not an input variable. Mentioned in the pipeline prose; not added to the input inventory. Tested. |
| **`suggestedStyleKey`** (intent-aware suggestion) | `suggestedStyleKey(count, trainingStyle)` (`generation.ts:514`) surfaces `phul-4` as a "Suggested" pick for a powerbuilding lifter at 4 days, consumed by `TuneYourPlanPanel`. It does **not** change the auto-applied default (`recommendStyle` is still count-only). | Partially closes the prior audit's follow-up "intent-aware recommendStyle". Noted in Section 2 + follow-ups. |

No other commit since 2026-06-11 touched `generation.ts` or `routines.ts` (`#140` plan redesign and `#142` library did not).

### Carried forward from the 2026-06-10 -> 2026-06-11 cycle (still true)
The role model replaced the tier sort (squat/hinge no longer front-adjacent); `POWERBUILDING_HEAVY_PATTERNS` includes both pulls (powerbuilding pull day trains heavy); the minimum-compound floor + Item-2 guard warn-and-degrade instead of silently shipping all-isolation days under restrictions; `ppl-x2-6` runs differentiated A/B; `fb-emphasis-3` is gone; `answers.days` is an exact `WeeklyFrequency` matched to the day grid; `lower_lean` is hypertrophy bias; PHUL (`phul-4`) is in `STYLES[4]`; the squat-on-posterior contract (`isOffContractLowerCompound`, `:810`) holds. **Still present** (unchanged): the 30-min squat/hinge antagonist superset, the `pplul-5` near-identical leg days, and (action-level only) no length cap on `trainingDays`.

---

## SECTION 1: Complete input variable inventory

17 variables. Sources, effects, and interactions are unchanged from 2026-06-11; line numbers re-anchored.

| # | Variable / type | Enters via | Directly affects (current line) | Test coverage |
|---|---|---|---|---|
| 1 | `answers.equipment` `Set<EquipmentKey>` | Setup-flow equipment step (pre-filled from active / travel equipment profile) | `hasEquipment` pool filter (`:713`, applied in `generateRoutine` `:1577`) | **Fully tested** (equipment filter, Smith Machine gating, thin-pool fallback, floor + finisher deflection) |
| 2 | `answers.experience` `beginner\|intermediate\|advanced` | Onboarding | `volumeFor` -> exercises-per-session + base sets (`:560`) | **Fully tested** (time scaling, volume floor) |
| 3 | `answers.goal` `build_muscle\|lose_fat\|general_fitness` | Onboarding | `repRange` / `resolveRepRange` (`lose_fat` shifts both columns up a notch, `repRange` `:569`) | **Partial**: `lose_fat` on balanced/strength; `lose_fat x powerbuilding/bodybuilding` and `general_fitness` still unasserted |
| 4 | `answers.days` `WeeklyFrequency` (`2\|3\|4\|5\|6`) | Setup-flow days step (frequency + Mon-Sun grid) | **Nothing in the engine**; only `buildRationale` (`:1758`, reads it `:1767`) | `weeklyFrequency` guard unit-tested; days-vs-length coherence enforced in the UI, not in `generation.test.ts` |
| 5 | `answers.gender` `Gender\|null` | Onboarding | **Not read by `generateRoutine`.** Action seeds `priority` from `profileRow.gender` via `genderDefault` (`routines.ts:475`) | `genderDefault` unit-tested; the action seeding path untested at generation level |
| 6 | `trainingDays` `number[]` (0-6) | Setup-flow day grid | `orderTrainingDays` (`:1561`); caps sessions (`i >= days.length` skips) | **Fully tested** (`orderTrainingDays`, anchor-aware schedule); count/length mismatch edges untested |
| 7 | `sessionTime` `~30 min\|45-60 min\|90+ min` | Setup flow | `volumeFor` counts + `isSuperset` (30 min only) | **Fully tested** (time scaling, supersets) |
| 8 | `style` (`ProgramStyle` from `styleKey`) | Style picker / `recommendStyle` default | Each session's `focus`, `emphasis`, `variant` | **Fully tested** (every style -> schedule length, emphasis-key existence, variant letters; PHUL goldens; byte-identity guards for the other four 4-day styles) |
| 9 | `priority` `PriorityMuscle\|null` | Profile `priority_muscle` (or gender-seeded) | `tiltEmphasis` reorders existing slots front-to-back (`:296`) | **Partial**: `tiltEmphasis` unit-tested for all; only **glutes** verified end-to-end |
| 10 | `trainingStyle` `balanced\|strength\|bodybuilding\|powerbuilding` | Profile `training_style` / setup flow | `resolveBias` (`:612`) -> reps + strength set-bump; `resolveRepRange` powerbuilding per-pattern override (`:663`) | **Partial**: balanced/strength/powerbuilding tested; **bodybuilding still never asserted end-to-end** |
| 11 | `varietyPreference` `consistent\|varied` | Profile `variety_preference` / setup flow | Anchor map in `selectForSession` (`COMPOUND_ANCHOR_PATTERNS` gate `:650`) | **Fully tested** (identity, determinism, anchoring, accessory rotation, no within-session dup; PHUL shares bench/squat across power+volume days) |
| 12 | `loadingLean` `barbell\|dumbbell\|machine\|cable\|null` | Profile `loading_lean` / setup flow | `byPattern` preferred-equipment float (`:1002`; `LOADING_TO_EQUIPMENT` `:840`) | **Partial**: barbell float + fresh-beats-used + null identity + cable fallback; machine/dumbbell and `x consistent`/`x restrictions` unasserted |
| 13 | `restrictions` `RestrictionFlag[]` | Profile `movement_restrictions` / setup flow / Profile editor | `isContraindicated` hard pool filter (`:720`) | **Partial**: identity, single knee, single-flag-leg, knee+shoulder, the minimum-compound guard; same-region combos (knee+lower_back) untested (Section 5) |
| 14 | `behavior` `BehaviorSignal {demote: string[]}` | Action: `loadSwapHistory` -> `analyzeSwapBehavior` (`routines.ts:517`) | `byPattern` demote layer, sinks demoted ids **on non-anchor patterns only** (`:997-1001`) | **Fully tested** (golden, non-anchor sink, anchor no-op, only-candidate) |
| 15 | `anchorDow` `number` | `startAnchor` weekday (or today) in the action (`routines.ts:444`) | `orderTrainingDays` rotation | **Fully tested** |
| 16 | `makeGroupId` `() => string` | Action passes `crypto.randomUUID` | Superset group ids (30 min) | Indirectly tested |
| 17 | Hidden exercises | Action `loadHiddenExerciseIds` filters the pool (`routines.ts:491`) | Shrinks the pool (like an extra equipment filter) | **Untested** in `generation.test.ts` (action-level concern) |

Structural observations (unchanged): `answers.gender` is still a dead input to the engine (priority is profile-seeded in the action); `answers.days` is engine-inert (rationale only) but no longer a coherence risk in the standard flow. Training style, priority, variety, loading lean, and restrictions are all dual-source (param vs stored profile), param-wins, resolved in the action (`routines.ts:475-486`); that precedence is still untested (no action-level harness, per project convention).

---

## SECTION 2: Split selection matrix

`recommendStyle(count)` (`generation.ts:493`) still returns `STYLES[count][0]`, count-only, ignoring goal / training style / experience. **New since 2026-06-11:** `suggestedStyleKey(count, trainingStyle)` (`:514`) exists and surfaces `phul-4` for a powerbuilding lifter at 4 days, but it only feeds a "Suggested" affordance in `TuneYourPlanPanel`; the auto-applied default is unchanged. The setup flow shows a picker only when a count has more than one style; the user chooses manually for 3, 4, 5 days and has no choice for 2 and 6.

The per-count breakdown is unchanged from 2026-06-11:
- **2 days** `fb-2` (only): full body, sound; inherent low weekly volume.
- **3 days** `fb-3` (default), `ppl-3`, `ulf-3`: all defensible; frequency varies 3x vs 1x, default correct.
- **4 days** five styles: `ul-classic-4` (default), `ul-aesthetic-4`, `phul-4` (index 2, the powerbuilding gap-filler, the only 4-day style with a strength day and the only lower day carrying squat + hinge together), `ppl-fb-4`, `fb-hmhp-4`. Default sound.
- **5 days** `ulppl-5` (default, best-constructed, quad/posterior split), `pplul-5` (**still the concern**: `legs` and `lower_general` are byte-identical slot lists, two near-identical leg days, no quad/posterior split), `fb-ul-hybrid-5` (coherent).
- **6 days** `ppl-x2-6` (only): now differentiated A/B (`push_heavy`/`pull_heavy`/`lower_quad` vs `push_volume`/`pull_volume`/`lower_post`); residual: the A block is two consecutive strength days (accepted in the Item 5 review).

Day-count edges: count = 1 resolves to `fb-2` then drops session B (a single full-body day); count = 7+ resolves to `STYLES[6]` and a 7th day gets no session. Both are unreachable from the standard flow (`WeeklyFrequency` is 2-6) but reachable if the action is called directly (no length cap). Untested.

---

## SECTION 3: Training style interaction effects

`BIAS_REMAP` (`generation.ts:603`, via `resolveBias` `:612`) is the whole mechanism: training style never changes slot composition or exercise choice, only the session bias (and so rep ranges + the strength set-bump). Verified line-by-line against the code; unchanged from 2026-06-11.

- **balanced**: identity column (byte-identical to no style, golden-tested).
- **strength**: everything heavier -> strength; pump -> hypertrophy. Most sessions become 3-6 with a first-compound +1 set.
- **bodybuilding**: everything heavier -> hypertrophy; pump stays pump; no set-bump.
- **powerbuilding**: every bias -> strength (set-bump fires on the first compound of every session), but `resolveRepRange` (`:663`) overrides reps per pattern.

### Rep-range tables (verified against `repRange` `:569-591`)

Base `repRange` (build_muscle goal, before any `lose_fat` shift):

| bias | compound | isolation |
|---|---|---|
| strength | 3-6 | 10-15 |
| hypertrophy | 8-12 | 12-15 |
| balanced | 8-12 | 10-15 |
| pump | 12-15 | 15-20 |

Resolved ranges by training style (compound / isolation), keyed on the session's original bias:

| Style | strength | balanced | hypertrophy | pump |
|---|---|---|---|---|
| **balanced** | 3-6 / 10-15 | 8-12 / 10-15 | 8-12 / 12-15 | 12-15 / 15-20 |
| **strength** | 3-6 / 10-15 | 3-6 / 10-15 | 3-6 / 10-15 | 8-12 / 12-15 |
| **bodybuilding** | 8-12 / 12-15 | 8-12 / 12-15 | 8-12 / 12-15 | 12-15 / 15-20 |
| **powerbuilding** | per-pattern | per-pattern | per-pattern | per-pattern |

Powerbuilding ignores session bias and keys on pattern: heavy patterns (all six: `squat, hinge, horizontal_push, vertical_push, horizontal_pull, vertical_pull`) compound **3-6**; everything else (`lunge, all *_iso, calf, core`) **8-12 / 12-15**. `lose_fat` shifts each resolved range up one notch, except a strength-bias compound stays heavy-ish (`6-10`).

### Interactions (unchanged)
- Powerbuilding x PPL pull day: **fixed** (both pulls in `POWERBUILDING_HEAVY_PATTERNS` `:631`).
- Strength x high-frequency splits (6-day PPL, `fb-hmhp-4`): remaps all sessions to strength with no fatigue cap. Code-acknowledged limitation.
- PHUL x non-balanced style: collapses the day-level power/volume contrast (documented, surfaced in `bestFor` + rationale; `balanced` preserves it).
- priority muscle x training style: orthogonal (`tiltEmphasis` reorders slots; `resolveBias`/`resolveRepRange` set reps), compose cleanly; untested in combination.
- bodybuilding x any split: coherent but **untested end-to-end**.

---

## SECTION 4: Exercise variety x consistent anchor, and the full selection sort

### Anchor map (unchanged)
Per-generation `Map<string,string>`, never persisted; consulted only when `variety === 'consistent'` and the slot pattern is in `COMPOUND_ANCHOR_PATTERNS` = `{squat, hinge, horizontal_push, vertical_push, horizontal_pull, vertical_pull}` (`:650`). Key is `` `${focus}:${slot}` `` (focus + movement pattern). Same-focus sessions share anchors (PHUL deliberately shares bench/squat across its power + volume day); different-focus sessions get distinct keys; accessories always rotate; `varied` (default + null) never anchors and is golden-tested byte-identical to base. The slotIndex anchor-key gap is **still latent and dormant** (no emphasis lists the same anchor pattern twice; PHUL re-checked, holds).

### The `byPattern` selection sort, now 8 layers (CHANGED, delta #1)
This is the substantive update. `byPattern` (`generation.ts:988-1047`) sorts each pattern's candidates by, in order:

1. **Behavior demote** (non-anchor patterns only) `:997-1001` -- sinks repeatedly-swapped-away exercises; never on the six anchor patterns.
2. **Loading-lean preferred-equipment float** `:1002-1006` -- preferred modality first; no-op when `loadingLean` is null or the modality is absent from the pool.
3. **Substitution-class freshness** `:1007-1011` -- soft-sinks a `substitution_class` already used elsewhere in the routine (e.g. a 2nd Romanian Deadlift variant).
4. **Front-delt-isolation suppression** `:1012-1014` -- soft-sinks Front Raise once a vertical press is seated this session.
5. **Canonical-anchor rank** `:1022-1024` -- named primary compounds win, authoritative over fatigue (RDL anchors hinge over Deadlift; Barbell Bench over Close-Grip).
6. **Compound-first (`is_compound`)** `:1036-1038` -- **NEW (`#138`)**: a compound beats an isolation for the same slot, regardless of fatigue. **Defensive artifact**, live only for `squat` (Leg Extension) and `hinge` (Leg Curl), the two patterns that mix compound + isolation because no `quad_iso` / `hamstring_iso` pattern exists; a no-op for the other 13.
7. **Role-aware fatigue tiebreak** `:1043-1045` -- anchor patterns prefer higher fatigue (mechanical stimulus), accessories prefer lower; untagged sit at the neutral midpoint.
8. **Alphabetical by id** `:1046`.

The prior audit described 7 layers (no compound-first); the order is now `... canonical > compound > fatigue ...`. Note this is the **selection-side** chain; the post-selection role-model comparators (`compareLowerRole` / `compareUpperRole`) operate only over already-bucketed compounds and do **not** apply compound-first.

### Residual too-aggressive case (unchanged)
`pplul-5` redundant leg days: `legs` slots equal `lower_general` slots, so the two leg days train the same six patterns; under `consistent` they pick different squats (distinct focus keys) but the same movement structure. The 6-day `ppl-x2-6` redundancy is resolved; `pplul-5` is not.

---

## SECTION 5: Movement restrictions coverage

Mechanism (`isContraindicated`, `:720`): a hard pool filter run alongside `hasEquipment` (`:1576-1578`); an exercise is removed if its per-exercise `contraindications: RestrictionFlag[]` intersects the user's flagged set. Never relaxed. No pattern-level mapping in code; exclusion is data-driven by the `contraindications` seed (`2026-06-08-...-exercise-contraindications.sql`), tagged with a safe-leg / safe-push survival invariant **per single flag**, not per combination.

What backstops an emptied session (unchanged):
- **Minimum-compound floor** (`COMPOUND_FLOOR` `:751`, `FLOOR_FALLBACK_PATTERNS` `:759`, `FLOOR_REGION` `:767`): lower / legs / full_body need 2 compounds, upper / push / pull need 1. Seats same-region compounds before backfill, under every cap, never crossing regions, honoring the quad/posterior contract via `isOffContractLowerCompound` (`:810`).
- **Item-2 zero-compound guard** (`:1637-1663`): seats one safe compound (lower/legs never receives an upper compound) or appends a non-blocking notice; an unsatisfiable floor appends `LIMITED_VARIETY_WARNING` (`:787`).

Net: restriction holes now **warn and degrade gracefully** rather than silently shipping an all-isolation day. Still **no substitution** (purely subtractive; reason-aware `rankSubstitutes` is a swap-time feature, never runs in generation).

Combinations that still degrade (warned, not silent), all unchanged:
- **lower_back x `lower_post`**: hinge is the only in-contract compound; if all hinges are removed, the contract refuses a squat and the day ships accessory-only + the warning.
- **knee + lower_back**: thins squat/lunge + hinge; the floor finds no safe in-region compound and ships accessory work + the warning. **Still untested** (the only multi-flag generation test is knee+shoulder).
- **shoulder x wrist**: a push day can lose all pressing; the upper floor (1) reaches for another upper compound (a pull), keeping a compound but maybe no press.
- **All four flags + dumbbell-only**: maximal thinning; untested.

---

## SECTION 6: Intra-session ordering (role model)

Ordering is the **exercise role model** (`assignRole` `:1379` / `orderByRole` `:1431`, `ROLE_ORDER` `:1342`). After `selectForSession`:
1. **Bucket + rank** each exercise: Lower {squat, hinge, lunge} by pattern priority `squat > hinge > lunge` then canonical -> fatigue desc -> id (`compareLowerRole` `:1398`); Upper {the four push/pull compounds} by canonical -> fatigue desc -> push-before-pull -> id (`compareUpperRole` `:1413`).
2. **Assign roles**: top compound per bucket -> PRIMARY_LOWER / PRIMARY_UPPER, rest SECONDARY; isolation -> ISOLATION; calf/core -> FINISHER; a lone lunge -> PRIMARY_LOWER.
3. **Order** PRIMARY_LOWER -> PRIMARY_UPPER -> SECONDARY_LOWER -> SECONDARY_UPPER -> ISOLATION -> FINISHER, stable within a role. Position 0 stays a compound, so the strength set-bump lands on the primary lift.
4. **30-min only**: `buildSupersets` reorders into adjacent antagonist pairs, breaking role order.

What this fixed (unchanged): squat and hinge are no longer adjacent at the front (squat -> bench -> hinge -> row); load/fatigue ordering inside a bucket exists. The selection-side compound-first term (Section 4) does not propagate here; the role comparators only rank already-bucketed compounds.

Suboptimal sequences that remain (unchanged):
- **30-min antagonist supersets still pair squat <-> hinge and squat <-> glute_iso** (`SQUAT_PATTERNS` vs `HINGE_PATTERNS`, `antagonist()` `:1281`): not genuine antagonists (both load the posterior chain / legs); on a 30-min full-body day this pairs the two most fatiguing lifts.
- **Selection vs display disagree** on lunge-led emphases (`lower_lean`, `phul_lower_hyp`): slot order front-loads lunge for selection freshness; the role model presents squat first. Documented as intentional.
- **No push/pull interleaving for straight-set sessions** beyond the role grouping.

---

## SECTION 7: Known gaps and untested combinations

### Resolved since the prior audit (no longer gaps)
- **Compound-first within a mixed pattern** (`is_compound`, `#138`): implemented AND covered (`generation.test.ts` "P0 3.1: compound-first within a mixed pattern (squat / hinge)", `:1493`), asserting the unnamed compound (not the higher-fatigue isolation) wins the squat slot end-to-end. This was a latent ordering hole the prior audit did not name.
- (Carried from 2026-06-11: squat/hinge front-adjacency; powerbuilding pull-day mismatch; `ppl-x2-6` A/B; `fb-emphasis-3`; silent all-isolation leg days; `answers.days` coherence; count > 6 from the UI.)

### Variable combinations still with no test coverage
1. **Priority muscle other than glutes, end-to-end** (chest/back/shoulders/arms/legs; incl. whether `arms` front-loads both `biceps_iso` and `triceps_iso`).
2. **`bodybuilding` training style end-to-end** (only the `resolveBias`/`resolveRepRange` tables today).
3. **priority x trainingStyle**, **priority x varietyPreference**, **priority x restrictions** in combination.
4. **`loadingLean` machine/dumbbell end-to-end**; **loadingLean x consistent**, **loadingLean x restrictions**.
5. **Restriction combinations**: knee+lower_back, lower_back alone on `lower_post`, three or four flags, restrictions x thin equipment, restrictions x `consistent`.
6. **`behavior` demote x consistent**, **behavior x restrictions**, **behavior demote of a canonical-anchor-named exercise**.
7. **`lose_fat` x powerbuilding/bodybuilding**, and `general_fitness` in any generated routine.
8. **PHUL x non-balanced style** (collapses the day-level contrast, documented but unasserted), PHUL x restrictions, PHUL x non-glutes priority. (PHUL itself is covered: per-emphasis goldens, no-vertical-push, consistent anchor sharing, varied differentiation, + byte-identity guards for the other four 4-day styles.)
9. **Day-count edges**: count = 1, count = 7+ via the action, and any `trainingDays.length != style.sessions.length`.
10. **Hidden-exercise pool filtering** (action-level, absent from `generation.test.ts`).
11. **90+ min volume coherence per style** beyond the pattern-cap test.
12. **Superset pairing quality** (the 30-min suite checks group size/adjacency, not whether the squat/hinge pairing is a sensible antagonist).

### Combinations likely to produce a low-quality (not broken) routine
- **knee + lower_back -> degraded leg days** (warned, not silent; no compound loading when the lower region is fully contraindicated; no substitution). Highest residual restriction risk; untested.
- **lower_back x `lower_post` -> no-compound posterior day** (warned; the contract refuses a squat).
- **strength x 6-day PPL (or `fb-hmhp-4`) -> six heavy days, no fatigue cap** (code-acknowledged).
- **`pplul-5` -> two near-identical leg days** (no quad/posterior contrast, no guard).
- **30-min full-body -> squat/hinge or squat/glute_iso supersets** treated as antagonists.
- **Dumbbell-only users never get vertical pulls** (`vertical_pull` slots no-op; backfill substitutes; back-width work structurally under-served for that tier). Documented limitation.
- **PHUL deadlift set-count asymmetry**: on `phul_lower_power` the set-bump lands on the squat (position 0), so the squat gets 4 sets and the deadlift 3. Accepted v1 limitation (also lowers systemic load of two heavy lifts in one session).

---

## Suggested follow-ups (not yet acted on)
- Add the **untested high-risk combinations** as tests: knee+lower_back (assert the warning + degraded composition), bodybuilding end-to-end, non-glutes priority end-to-end, PHUL x non-balanced style.
- **`suggestedStyleKey` is shipped as a non-default suggestion** (PHUL for powerbuilding at 4 days, surfaced in `TuneYourPlanPanel`). Remaining work: surface the "Suggested" badge in the primary onboarding style picker (not just the tune panel), or make `recommendStyle` itself intent-aware.
- **Differentiate `pplul-5` leg days** (quad-led vs posterior-led, like `ulppl-5` / `ppl-x2-6`), the last redundant-leg-day style.
- Re-key the **anchor map by occurrence index** before authoring any emphasis with two of the same anchor pattern (still latent; PHUL does not trigger it).
- Revisit the **30-min squat/hinge superset** pairing (not a real antagonist) and the **dumbbell-only vertical-pull** gap.
- Optional **per-pattern set-count override on strength days** to make PHUL's squat and deadlift co-equal.
- A **minimum-compound substitution** (a safe leg press for a contraindicated squat) would upgrade the restriction holes from "warned + degraded" to "covered"; the future hook is `substitution_class`.
- Add `quad_iso` / `hamstring_iso` movement patterns: this would let leg-curl / leg-extension work be expressed directly and render the `#138` compound-first defensive term inert (its stated end-state).
