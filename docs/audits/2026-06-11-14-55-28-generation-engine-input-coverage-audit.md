# Pulse routine generation engine, input & coverage audit (2026-06-11)

**Supersedes** `docs/audits/2026-06-10-21-30-25-generation-engine-input-coverage-audit.md`. Re-run against the current tree after the generation engine quality track, the 2026-06-11 live-test fixes, Issue 0 (weekly frequency), the squat-on-posterior fix, and the PHUL style addition all landed. Most of the high-severity findings in the prior audit are now fixed or mitigated; this version records the current state and the residual gaps.

**Method:** full read of `src/lib/pulse/generation.ts`, `src/lib/pulse/types.ts`, `src/app/pulse/actions/routines.ts`, `src/lib/pulse/__tests__/generation.test.ts`, plus `recommendation.ts`, `behavior.ts`, and `weeklyFrequency.ts` for the input types. Documentation and gap-analysis only, no code changed here. Where a behavior depends on seed data not in these files (the exercise catalog, the `contraindications` column), that is stated rather than guessed.

**Pipeline, end to end:** `generateAndSaveRoutine` (action) gathers and hardens inputs, loads the global exercise pool minus hidden exercises, derives a behavior signal from swap history, resolves profile-stored preferences, then calls `generateRoutine`. `generateRoutine` orders the training days, computes volume, filters the pool (equipment + contraindications), and for each session runs `tiltEmphasis -> resolveBias -> selectForSession (+ minimum-compound floor) -> orderByRole (exercise role model) -> set/rep assignment -> optional supersets`.

---

## SECTION 0: What changed since the 2026-06-10 audit

| Prior finding | Status now | Mechanism |
|---|---|---|
| **Tier sort places squat + hinge adjacent at the front of every dual-compound day** | **Fixed** | Replaced by the exercise role model (`assignRole` / `orderByRole`, `:1349` / `:1401`): PRIMARY_LOWER -> PRIMARY_UPPER -> SECONDARY_LOWER -> SECONDARY_UPPER -> ISOLATION -> FINISHER, so the two heaviest compounds lead and are separated by the opposite category (squat -> bench -> hinge -> row). |
| **Powerbuilding pull day gets hypertrophy reps + a mismatched set bump** | **Fixed** | `horizontal_pull` and `vertical_pull` added to `POWERBUILDING_HEAVY_PATTERNS` (`:617`, all six compounds now). A powerbuilding pull day trains heavy. |
| **knee + lower_back -> all-isolation leg days; lower_back x `lower_post` -> no-compound posterior** | **Mitigated (warned, no longer silent)** | Per-focus minimum-compound floor (`COMPOUND_FLOOR`, `:737`) seats a same-region compound before backfill; if genuinely unsatisfiable it appends `LIMITED_VARIETY_WARNING` to the rationale and ships honest accessory work. Still subtractive (no substitution). |
| **`ppl-x2-6` has no A/B differentiation (two identical leg/push/pull days)** | **Fixed** | `ppl-x2-6` now runs `push_heavy` / `pull_heavy` / `lower_quad` (A) vs `push_volume` / `pull_volume` / `lower_post` (B): strength-vs-volume contrast on push/pull, quad-vs-posterior on legs. |
| **`fb-emphasis-3` mislabeled as full body (1x frequency body-part split)** | **Fixed** | Removed from `STYLES[3]`; the 3-day options are now `fb-3`, `ppl-3`, `ulf-3`. |
| **`answers.days` is a dead input that can disagree with `trainingDays.length`** | **Mostly resolved** | `answers.days` is now an exact `WeeklyFrequency` (`2 \| 3 \| 4 \| 5 \| 6`), and the quick-flow day grid requires the day selection to match the frequency exactly, so the count matches the answer by construction. It still only feeds `buildRationale`, but it can no longer silently disagree in the standard flow. |
| **`lower_lean` trains at pump bias** | **Changed** | `lower_lean` is now `hypertrophy` bias (compounds 8-12), so `ul-aesthetic-4` lower A is no longer accessory-level loading. |
| **30-min squat/hinge superset treated as antagonist** | **Still present** | `buildSupersets` / `antagonist` unchanged; `SQUAT_PATTERNS` vs `HINGE_PATTERNS` still pair as antagonists. |
| **`pplul-5` two near-identical leg days (`legs` == `lower_general` slots)** | **Still present** | Unchanged; the only 5-day style without a quad/posterior split. |
| **count > 6 silent truncation** | **Mostly closed in the UI** | `WeeklyFrequency` caps at 6 and `MAX_TRAINING_DAYS` caps the day grid, so the standard flow cannot reach 7+. The action still accepts arbitrary `trainingDays` if called directly (no length cap in `generateAndSaveRoutine`). |

New this cycle: **PHUL** (`phul-4`) added to `STYLES[4]` (now five 4-day styles); the **squat-on-posterior** contract (`isOffContractLowerCompound`, `:794`) keeps `lower_post` squat-free under thin pools; **WeeklyFrequency** replaced the `DaysPerWeek` buckets.

---

## SECTION 1: Complete input variable inventory

| # | Variable / type | Enters via | Directly affects | Interaction effects | Test coverage |
|---|---|---|---|---|---|
| 1 | `answers.equipment` `Set<EquipmentKey>` | Setup-flow equipment step (pre-filled from active / travel equipment profile) | `hasEquipment` pool filter (`:699`, applied in `generateRoutine`) | Thins the pool every other selector draws from; a thin pool forces cross-session repetition and the `vertical_pull` no-op for dumbbell-only users; interacts with `loadingLean` (a preferred modality absent from kit is a silent no-op). The minimum-compound floor + finisher deflection now backstop a thin lower pool. | **Fully tested** (equipment filter, Smith Machine gating, thin-pool fallback, floor + deflection) |
| 2 | `answers.experience` `'beginner'\|'intermediate'\|'advanced'` | Onboarding | `volumeFor` -> exercises-per-session + base sets (`:546`) | Combines with `sessionTime` in `VOLUME`; the exercise count interacts with `PATTERN_CAP` and backfill. | **Fully tested** (time scaling, volume floor) |
| 3 | `answers.goal` `'build_muscle'\|'lose_fat'\|'general_fitness'` | Onboarding | `repRange` / `resolveRepRange` (`lose_fat` shifts both columns up one notch, `:555`) | Composes with `trainingStyle` (the resolved bias is what `repRange` reads); `lose_fat` does not soften a strength-bias compound. | **Partially tested**: `lose_fat` on balanced/strength; `lose_fat x powerbuilding/bodybuilding` and `general_fitness` in generation still unasserted. |
| 4 | `answers.days` `WeeklyFrequency` (`2\|3\|4\|5\|6`) | Setup-flow days step (combined frequency + Mon-Sun grid) | **Nothing in the engine.** Only `buildRationale` (`:1674`) reads it for the human string | Now an exact number; the grid forces `trainingDays.length === days`, so it can no longer silently disagree with the real session count in the standard flow. | `weeklyFrequency` guard unit-tested; the days-vs-length coherence is enforced in the UI, not asserted in `generation.test.ts`. |
| 5 | `answers.gender` `Gender\|null` (optional, "Prefer not to say") | Onboarding | **Not read by `generateRoutine`.** In the action, priority is seeded from `profileRow.gender` via `genderDefault` (`routines.ts:475`) | Seeds `priority` (female -> glutes) only when `priority_muscle` is null. | `genderDefault` unit-tested; the action seeding path untested at generation level. |
| 6 | `trainingDays` `number[]` (0-6 weekdays) | Setup-flow day grid | `orderTrainingDays` (`:1501`); caps sessions emitted (`i >= days.length` skips) | Length drives session count; if length < `style.sessions.length` some sessions drop; if length > sessions, extra days get no session. Standard flow now constrains length to the frequency. | **Fully tested** (`orderTrainingDays`, anchor-aware schedule); count/length mismatch edges still untested. |
| 7 | `sessionTime` `'~30 min'\|'45–60 min'\|'90+ min'` | Setup flow | `volumeFor` (counts) + `isSuperset` (30 min only) | 30 min triggers `buildSupersets`; higher volume interacts with caps and backfill relaxation. | **Fully tested** (time scaling, supersets) |
| 8 | `style` (`ProgramStyle`, from `styleKey`) | Setup-flow style picker / `recommendStyle` default | Session list: each session's `focus`, `emphasis`, `variant` | Determines `FOCUS_TYPE`, the emphasis bias fed to `resolveBias`, and the slot list fed to `selectForSession`. `STYLES[4]` now has five styles (PHUL added). | **Fully tested** (every style -> schedule length, emphasis-key existence, variant letters; PHUL goldens; byte-identity guards for all four other 4-day styles) |
| 9 | `priority` `PriorityMuscle\|null` | Profile `priority_muscle` (or gender-seeded) | `tiltEmphasis` reorders existing slots front-to-back (`:296`) | Only reorders patterns already in the emphasis (never injects); composes with `trainingStyle` (orthogonal) and the caps. | **Partially tested**: `tiltEmphasis` unit-tested for all; only **glutes** verified end-to-end. chest/back/shoulders/arms/legs still unasserted in a generated routine. |
| 10 | `trainingStyle` `'balanced'\|'strength'\|'bodybuilding'\|'powerbuilding'` | Profile `training_style` / setup flow | `resolveBias` (`:598`) -> reps + the strength set-bump; `resolveRepRange` powerbuilding per-pattern override (`:649`) | Does not change slot composition or selection, only reps/sets; powerbuilding now keys on all six compound patterns. | **Partially tested**: balanced/strength/powerbuilding generation tested; **bodybuilding still never asserted end-to-end** (only via `resolveBias` / `resolveRepRange` tables). |
| 11 | `varietyPreference` `'consistent'\|'varied'` | Profile `variety_preference` / setup flow | Anchor map in `selectForSession` | Keyed `${focus}:${pattern}`; interacts with same-focus vs different-focus sessions and the `used` avoid-set (anchor bypasses it). | **Fully tested** (identity, determinism, anchoring, accessory rotation, no within-session dup; PHUL shares bench/squat across power+volume days). |
| 12 | `loadingLean` `'barbell'\|'dumbbell'\|'machine'\|'cable'\|null` | Profile `loading_lean` / setup flow | `byPattern` sort, floats preferred-equipment first (`:972`) | Fresh-preference still beats it; sits below the behavior demote layer, above substitution-class freshness; no-op when modality absent from pool. | **Partially tested**: barbell float + fresh-beats-used + null identity + cable fallback. machine/dumbbell and `x consistent` / `x restrictions` still unasserted. |
| 13 | `restrictions` `RestrictionFlag[]` | Profile `movement_restrictions` / setup flow / Profile editor | `isContraindicated` hard pool filter (`:706`) | Subtractive only; can empty a pattern, but the minimum-compound floor + Item 2 guard now backstop it (warn, never silently ship accessory-only without a notice); never relaxed. | **Partially tested**: identity, single knee, single-flag-leg, knee+shoulder, and the minimum-compound guard. The same-region combos (knee+lower_back) are still untested (Section 5). |
| 14 | `behavior` `BehaviorSignal {demote: string[]}` | Derived in action via `loadSwapHistory` -> `analyzeSwapBehavior` (`routines.ts:516`) | `byPattern` demote layer, sinks demoted ids **on non-anchor patterns only** | Never touches `COMPOUND_ANCHOR_PATTERNS`; soft (won't drop the only candidate); independent of canonical rank. | **Fully tested** (golden, non-anchor sink, anchor no-op, only-candidate). |
| 15 | `anchorDow` `number` | `startAnchor` weekday (or today) in the action (`routines.ts:444`) | `orderTrainingDays` rotation | Defaults to Monday (1) when absent. | **Fully tested** |
| 16 | `makeGroupId` `() => string` | Action passes `crypto.randomUUID` | Superset group ids (30 min) | None | Indirectly tested |
| 17 | Hidden exercises | Action `loadHiddenExerciseIds` filters the pool before `generateRoutine` (`routines.ts:491`) | Shrinks the pool (like an extra equipment filter) | Same thin-pool interactions as equipment. | **Untested** in `generation.test.ts` (action-level concern). |

Two structural observations:
- **`answers.gender` is still a dead input to the engine**; priority is profile-seeded in the action. **`answers.days` is no longer a coherence risk** in the standard flow (exact frequency + grid-match), though it remains engine-inert (rationale-only).
- **Training style and priority remain the only inputs settable from two sources** (param vs stored profile), param-wins, resolved in the action (`routines.ts:475-477`). That precedence is still untested (no action-level harness, per project convention).

---

## SECTION 2: Split selection matrix

`recommendStyle(count)` still returns `STYLES[count][0]` (the first listed style), count-only, ignoring goal / training style / experience. The setup flow shows a picker only when a count has more than one style; quick-start auto-applies the recommendation. The user chooses manually for 3, 4, and 5 days, and has no choice for 2 and 6.

### 2 days, `STYLES[2]`, single style (no choice)
- **`fb-2` Full Body** (only option): `full_body/fb_strength (A)`, `full_body/fb_hyper (B)`. Sound for 2 days; squat once (A), lunge on B, hinge both. No concern beyond the inherent low weekly volume.

### 3 days, `STYLES[3]`, three styles
- **`fb-3` Full Body** (recommended): `fb_strength (A)`, `fb_hyper (B)`, `fb_balanced (C)`. Each muscle ~3x/week. Correct default.
- **`ppl-3` Push / Pull / Legs**: each muscle ~1x/week. Lowest-frequency 3-day option; steered by `bestFor` only. Acceptable as a named split, an easy mis-pick for a hypertrophy goal.
- **`ulf-3` Upper / Lower / Full Body**: ~1.5x frequency per region. Reasonable.
- **Verdict:** the mislabeled `fb-emphasis-3` is gone; the remaining three are all defensible. Mild underdetermination (frequency varies 3x vs 1x), default correct.

### 4 days, `STYLES[4]`, five styles
- **`ul-classic-4` Classic Upper / Lower** (recommended): `upper_chest_back (A)`, `lower_quad (A)`, `upper_delts_arms (B)`, `lower_post (B)`. Each half 2x/week, quad/posterior split. Strong default.
- **`ul-aesthetic-4` Aesthetic Upper / Lower**: `upper_aesthetic_a (A)`, `lower_lean (A)` (now **hypertrophy** bias, lunge-led with squat second), `upper_aesthetic_b (B)` (pump), `lower_post (B)`. Bilateral squat is light by design (acceptable for "aesthetic").
- **`phul-4` Power Hypertrophy Upper Lower** (NEW): `phul_upper_power (A)`, `phul_lower_power (A)` (both strength), `phul_upper_hyp (B)`, `phul_lower_hyp (B)` (both hypertrophy). Powerbuilding: each region heavy once, volume once. The only 4-day style with a strength day; the only lower day carrying squat AND hinge together (`phul_lower_power`). Designed for the Balanced training style (Strength / Bodybuilding / Powerbuilding collapse the day-level contrast via `resolveBias`, surfaced in `bestFor`). **Not the default** (index 2; `recommendStyle(4)` stays `ul-classic-4`).
- **`ppl-fb-4` Push / Pull / Legs + Full Body**: uneven frequency; the FB day's leg work is one squat + one hinge.
- **`fb-hmhp-4` Full Body Heavy/Medium/Heavy/Pump**: high-frequency full body. Fine.
- **Verdict:** five options; default sound. PHUL is the powerbuilding gap-filler. See Section 3 for the PHUL deadlift set-count asymmetry.

### 5 days, `STYLES[5]`, three styles
- **`ulppl-5`** (recommended): `upper_general`, `lower_quad`, `push`, `pull`, `legs/lower_post`. The two lower days are quad-led vs posterior-led. Best-constructed 5-day option.
- **`pplul-5`**: `push, pull, legs, upper/upper_general, lower/lower_general`. **Still a concern, redundant leg days:** `legs` and `lower_general` are byte-identical slot lists (`squat, hinge, lunge, glute_iso, calf, core`), differing only in bias. Different focus -> distinct anchor keys, so `consistent` picks different squats but trains the same six patterns twice. No quad/posterior differentiation.
- **`fb-ul-hybrid-5`**: `fb_strength, upper_chest_back (A), lower_quad (A), upper_delts_arms (B), lower_post (B)`. Coherent.
- **Verdict:** `pplul-5` is the questionable one (unchanged from the prior audit).

### 6 days, `STYLES[6]`, single style (no choice)
- **`ppl-x2-6` Push / Pull / Legs x2** (only option): now **differentiated** A/B. `push_heavy (A)` / `pull_heavy (A)` (strength bias, compounds 3-6, first-compound set bump) + `lower_quad (A)`; `push_volume (B)` / `pull_volume (B)` (hypertrophy) + `lower_post (B)`. The prior "no A/B contrast" finding is resolved: strength-vs-volume on push/pull, quad-vs-posterior on legs. Under `consistent`, legs A (`legs:squat`) and legs B (`legs:hinge`) anchor different patterns, so they no longer collapse to the same lifts.
- **Residual:** the A block is two consecutive strength days (Push A Mon + Pull A Tue, opposing muscle groups); accepted in the Item 5 review.

### Cross-cutting day-count gaps
- **count = 1:** `STYLES[1]` undefined -> resolves to 2 -> `fb-2`, but `trainingDays.length` 1 drops session B. Net: a single full-body day. The standard flow can no longer request 1 (min `WeeklyFrequency` is 2), but the action would accept it. Untested.
- **count = 7+:** resolves to `STYLES[6]` -> 6 sessions; a 7th selected day gets no schedule entry. The UI caps at 6 (`WeeklyFrequency` / `MAX_TRAINING_DAYS`), so this is unreachable from the standard flow; the action has no length cap.

---

## SECTION 3: Training style interaction effects

`BIAS_REMAP` (`:598` via `resolveBias`) is the whole mechanism. Training style never changes slot composition or exercise choice; it only remaps the session bias, which changes rep ranges and the strength set-bump.

### What each style changes
- **`balanced`**: Identity column. Byte-identical to no style (golden-tested rollout invariant).
- **`strength`**: `strength->strength`, `balanced->strength`, `hypertrophy->strength`, `pump->hypertrophy`. Most sessions become strength bias (compounds 3-6, first compound +1 set). Pump days soften to hypertrophy, not strength.
- **`bodybuilding`**: `strength->hypertrophy`, `balanced->hypertrophy`, `hypertrophy->hypertrophy`, `pump->pump`. Everything heavier collapses to hypertrophy; pump stays pump; no set-bump fires.
- **`powerbuilding`**: Every bias remaps to `strength` (the set-bump fires on the first compound of every session), but `resolveRepRange` overrides reps per pattern: `POWERBUILDING_HEAVY_PATTERNS` get strength reps, everything else hypertrophy.

### Interaction with each split type
- **Full-body / U-L / PPL under balanced/bodybuilding:** clean; reps follow the resolved bias uniformly.
- **Strength x high-frequency splits (6-day PPL, `fb-hmhp-4`):** remaps all sessions to strength with no frequency cap. A 6-day PPL under strength becomes six heavy 3-6 days each with a bumped first compound. Code-acknowledged; the engine will emit it (no fatigue model). **Unchanged limitation.**
- **Powerbuilding x PPL pull day:** **Fixed.** `POWERBUILDING_HEAVY_PATTERNS` now includes `horizontal_pull` and `vertical_pull`, so a powerbuilding pull day trains its row/pulldown in the strength range and the set-bump matches. The prior set/rep mismatch is gone.
- **PHUL x non-balanced style:** PHUL encodes its power/volume contrast as day-level biases. `strength` remaps both volume days to strength (all four days heavy); `bodybuilding` remaps both power days to hypertrophy (all four days volume); `powerbuilding` flattens to per-pattern reps on all four days. Documented and intended; `balanced` (default) preserves the contrast, and the `bestFor` copy plus the interpolated rationale say so. Not a defect.
- **Bodybuilding x any split:** no set-bump, all hypertrophy/pump. Coherent but still untested end-to-end.

### Interaction with priority muscle
`tiltEmphasis` (slot reorder) and `resolveBias`/`resolveRepRange` (reps/sets) are orthogonal and compose cleanly. Strength+glutes (hinge-first heavy), powerbuilding+glutes (hinge+squat heavy, glute_iso hypertrophy), strength+arms (isolation front-loaded but not bumped) all produce coherent routines. None is tested in combination (only glutes alone, and style alone).

### Rep-range table
Base `repRange` (build_muscle goal, before any `lose_fat` shift):

| bias | compound | isolation |
|---|---|---|
| strength | 3-6 | 10-15 |
| hypertrophy | 8-12 | 12-15 |
| balanced | 8-12 | 10-15 |
| pump | 12-15 | 15-20 |

Resolved ranges by training style (compound / isolation), keyed on the session's original bias:

| Style | strength session | balanced session | hypertrophy session | pump session |
|---|---|---|---|---|
| **balanced** | 3-6 / 10-15 | 8-12 / 10-15 | 8-12 / 12-15 | 12-15 / 15-20 |
| **strength** | 3-6 / 10-15 | 3-6 / 10-15 | 3-6 / 10-15 | 8-12 / 12-15 |
| **bodybuilding** | 8-12 / 12-15 | 8-12 / 12-15 | 8-12 / 12-15 | 12-15 / 15-20 |
| **powerbuilding** | per-pattern (below) | per-pattern | per-pattern | per-pattern |

Powerbuilding ignores session bias and keys on pattern:
- Heavy patterns (now **all six**: `squat, hinge, horizontal_push, vertical_push, horizontal_pull, vertical_pull`): compound **3-6**.
- Everything else (`lunge, all *_iso, calf, core`): compound / isolation **8-12 / 12-15**.

`lose_fat` shifts each resolved range up one notch, except a strength-bias compound stays heavy-ish (`repRange`).

---

## SECTION 4: Exercise variety x consistent anchor interaction

### Anchor map keying
- The anchor map (`anchors: Map<string,string>`) is per-generation and never persisted.
- Consulted only when `variety === 'consistent'` and the slot pattern is in `COMPOUND_ANCHOR_PATTERNS` = `{squat, hinge, horizontal_push, vertical_push, horizontal_pull, vertical_pull}` (`:636`).
- Key is `` `${focus}:${slot}` `` (focus + movement pattern, no slot index, no role). First fill picks the freshest candidate and stores it; later fills of the same key reuse it, bypassing the `used` avoid-set.

### Which exercises repeat across which sessions
- **Same-focus sessions share anchors.** In `ul-classic-4`, lower A (`lower_quad`, squat, no hinge) and lower B (`lower_post`, hinge, no squat) are both focus `lower` but never collide on a heavy pattern (the quad/posterior split). In `ppl-x2-6`, legs A (`lower_quad`) anchors `legs:squat` and legs B (`lower_post`) anchors `legs:hinge`, so the two leg days now anchor different patterns. **PHUL** uses focus `upper` for both upper days and `lower` for both lower days, so `upper:horizontal_push` (bench) and `lower:squat` are shared across the power and volume day, which is exactly the intended progressive-overload behavior.
- **Different-focus sessions get distinct keys** -> distinct exercises (`push:horizontal_push` vs `full_body:horizontal_push`).
- **Accessories always rotate**, even under `consistent` (isolation not in `COMPOUND_ANCHOR_PATTERNS`).
- **`varied`** (default, and null/undefined) never anchors; golden-tested byte-identical to base.

### Residual too-aggressive case
- **`pplul-5` redundant leg days:** because `legs` slots equal `lower_general` slots, the two leg days train the same six patterns twice; under `consistent` they pick different squats (distinct focus keys) but the same movement structure. The 6-day `ppl-x2-6` redundancy is resolved; `pplul-5` is not.

### The slotIndex anchor-key gap (latent)
- The anchor key omits the slot index; the design assumes one anchored slot per (focus, compound pattern). If an emphasis or its backfill places two slots of the same anchor pattern, both map to one key. The defensive fall-through (anchored exercise already chosen -> fresh, unanchored pick) prevents within-session duplicates.
- **Still dormant.** No emphasis lists the same `COMPOUND_ANCHOR_PATTERN` twice. **PHUL was checked:** `phul_upper_power` (hp/hpull/vpush/vpull), `phul_lower_power` (squat/hinge), `phul_upper_hyp` (hp/hpull/vpull), `phul_lower_hyp` (squat/hinge) each list every anchor pattern at most once. The only way to seat a second instance of an anchor pattern is backfill (e.g. PHUL Upper Hypertrophy at 90+ min backfilling a 2nd horizontal_push), which is fresh and unanchored, so it can differ across sessions. Acceptable, not broken.
- Fix when first needed: key by `${focus}:${slot}:${occurrenceIndex}` or assign anchor slots explicit ids. No test covers a same-anchor-pattern-twice emphasis.

---

## SECTION 5: Movement restrictions coverage

Mechanism (`isContraindicated`, `:706`): a hard pool filter run alongside `hasEquipment`. An exercise is removed if its per-exercise `contraindications: RestrictionFlag[]` intersects the user's flagged set. Never relaxed.

### Which patterns are excluded per flag
**No pattern-level mapping in code.** Exclusion is data-driven by the `contraindications` column in the exercise seed (`2026-06-08-...-exercise-contraindications.sql`, not in these files). The seed was tagged with a "safe-leg / safe-push survival invariant per single flag" (each single flag leaves at least one safe leg and one safe push); that invariant is per single flag, **not** per combination. Exact exercises cannot be enumerated without the seed.

### What now backstops an emptied session
This is the main change since the prior audit. Two guards run in `generateRoutine` / `selectForSession`:
- **Minimum-compound floor** (`COMPOUND_FLOOR`, `:737`): lower / legs / full_body need 2 compounds, upper / push / pull need 1. When the first slot pass falls short, the floor guard seats compounds from the session's **own** region only (`FLOOR_FALLBACK_PATTERNS` / `FLOOR_REGION`: lower searches squat > hinge > lunge, upper searches the four upper compounds), under every cap, never crossing regions and never relaxing. It honors the quad/posterior contract via `isOffContractLowerCompound` (no squat on `lower_post`).
- **Item 2 zero-compound guard**: if a session ends with no compound at all, it seats one safe compound (lower/legs never receives an upper compound) or, if none survives, appends a non-blocking notice. An unsatisfiable floor appends `LIMITED_VARIETY_WARNING` to the rationale.

Net: the restriction holes that the prior audit rated highest severity now **warn and degrade gracefully** rather than silently shipping an all-isolation day. Still **no substitution** (purely subtractive; the reason-aware `rankSubstitutes` is a swap-time feature, never runs in generation).

### Combinations that still degrade (now warned, not silent)
- **lower_back x `lower_post`** (lower B of `ul-classic-4` / `ul-aesthetic-4` / `fb-ul-hybrid-5`, `legs` of `ulppl-5`): `lower_post`'s only compound is hinge. If lower_back removes all hinge variants, the floor guard finds no in-contract lower compound (it will not seat a squat, per the contract) and the day ships as glute_iso + lunge + calf + core with the limited-variety warning.
- **knee + lower_back** (still untested): knee thins squat/lunge, lower_back thins hinge. On a `lower_quad` day knee removes squat and lunge; on a `lower_post` day lower_back removes the hinge. The floor guard searches the lower region, finds nothing safe, and ships accessory work plus the warning. No longer silent, still a low-quality leg day, and **still not covered by a test** (the existing two-flag test uses knee+shoulder, which hit different sessions).
- **shoulder x wrist:** both hit pressing; a push day can lose all pressing compounds. The upper floor (1) tries another upper compound (a pull), so the session keeps a compound but may have no press.
- **All four flags + dumbbell-only:** maximal thinning; several patterns can empty and the session leans on backfill + the floor guard + the warning. Untested.

---

## SECTION 6: Intra-session ordering (rewritten: role model, not tier sort)

Ordering is now the **exercise role model** (`assignRole` / `orderByRole`, `:1349` / `:1401`), which replaced the old `patternTier` sort + squat/hinge interleave. After `selectForSession`:

1. **Bucket + rank.** Each selected exercise is bucketed Lower {squat, hinge, lunge} / Upper {the four push-pull compounds} / Isolation / Finisher. The Lower bucket is ranked by pattern priority `squat > hinge > lunge`, then canonical-anchor rank -> fatigue desc -> id (`compareLowerRole`). The Upper bucket is ranked canonical -> fatigue desc -> push-before-pull -> id (`compareUpperRole`).
2. **Assign roles.** The top-ranked compound in each bucket becomes PRIMARY_LOWER / PRIMARY_UPPER; the rest SECONDARY; isolation -> ISOLATION; calf/core -> FINISHER. A lone lunge (no squat/hinge present) is promoted to PRIMARY_LOWER.
3. **Order** by role: PRIMARY_LOWER -> PRIMARY_UPPER -> SECONDARY_LOWER -> SECONDARY_UPPER -> ISOLATION -> FINISHER, stable within a role. Position 0 stays a compound, so the strength set-bump lands on the session's primary lift.
4. **30-min sessions only:** `buildSupersets` then reorders into adjacent antagonist pairs, breaking role order to place a push next to a pull.

### What this fixed
- **Squat and hinge are no longer adjacent at the front.** On a dual-compound day the order is squat (PRIMARY_LOWER) -> the primary upper compound -> hinge (SECONDARY_LOWER) -> ..., i.e. the two heaviest lifts are separated by the opposite category (squat -> bench -> hinge -> row). The prior audit's highest within-session ordering concern is resolved.
- **Load/fatigue ordering inside a bucket now exists.** `byPattern` selection and the role-model ranking both use canonical-anchor rank and fatigue (anchor patterns prefer the higher-fatigue primary lift), so a heavy primary leads its lighter same-pattern variants rather than depending on slot order alone.

### Suboptimal sequences that remain
- **30-min antagonist supersets still pair squat <-> hinge and squat <-> glute_iso** (`SQUAT_PATTERNS` vs `HINGE_PATTERNS`, `antagonist()` true). Supersetting squat with deadlift or hip thrust does not give genuine antagonist recovery; both load the posterior chain and legs. On a 30-min full-body day this can pair the two most fatiguing lifts. The push/pull pairings are fine; the lower-body ones are not real antagonists. **Unchanged.**
- **Selection vs display can disagree** on lunge-led emphases (`lower_lean`, `phul_lower_hyp`): the slot order front-loads lunge for selection freshness, while the role model presents squat first (PRIMARY_LOWER). Documented as intentional.
- **No push/pull interleaving for straight-set sessions** beyond the role grouping; local-fatigue alternation within the SECONDARY tier is incidental.

---

## SECTION 7: Known gaps and untested combinations

### Resolved since the prior audit (no longer gaps)
- Squat/hinge front-adjacency (role model).
- Powerbuilding pull day heavy-range + set-bump mismatch (pulls added to the heavy set).
- `ppl-x2-6` undifferentiated A/B (heavy/volume + quad/posterior split).
- `fb-emphasis-3` mislabeled full body (removed).
- Silent all-isolation leg days under restrictions (now warned via the minimum-compound floor + Item 2 guard).
- `answers.days` disagreeing with the session count in the standard flow (exact `WeeklyFrequency` + grid match).
- count > 6 silent truncation from the UI (capped at 6).

### Variable combinations still with no test coverage
1. **Priority muscle other than glutes, end-to-end** (chest/back/shoulders/arms/legs in a generated routine, including whether `arms` front-loads both `biceps_iso` and `triceps_iso`).
2. **`bodybuilding` training style end-to-end** (only the `resolveBias` / `resolveRepRange` tables, no `generateRoutine` assertion of hypertrophy-everywhere + no set-bump).
3. **priority x trainingStyle**, **priority x varietyPreference**, **priority x restrictions** in combination.
4. **`loadingLean` machine/dumbbell end-to-end**; **loadingLean x consistent**, **loadingLean x restrictions**.
5. **Restriction combinations:** knee+lower_back (leg-degrading, now warned), lower_back alone on `lower_post`, three or four flags, restrictions x thin equipment, restrictions x `consistent`.
6. **`behavior` demote x consistent**, **behavior x restrictions**, **behavior demote of a canonical-anchor-named exercise**.
7. **`lose_fat` x powerbuilding/bodybuilding**, and `general_fitness` goal in any generated routine.
8. **PHUL-specific combos:** PHUL x powerbuilding/strength/bodybuilding (collapses the day-level contrast, documented but unasserted), PHUL x restrictions, PHUL x non-glutes priority. PHUL itself is covered (13 tests: per-emphasis goldens, the no-vertical-push assertion, consistent anchor sharing, varied differentiation, plus byte-identity guards for the other four 4-day styles).
9. **Day-count edges:** count = 1, count = 7+ via the action, and any `trainingDays.length != style.sessions.length` (now UI-constrained, action-reachable).
10. **Hidden-exercise pool filtering** (action-level, absent from `generation.test.ts`).
11. **90+ min volume coherence per style** beyond the pattern-cap test.
12. **Superset pairing quality** (the 30-min suite checks group size/adjacency, not whether the squat/hinge pairing is a sensible antagonist).

### Combinations likely to produce a low-quality (not broken) routine
- **knee + lower_back -> degraded leg days.** Now warned via the minimum-compound floor rather than silently all-isolation, but still a low-quality leg day with no compound loading when the lower region is fully contraindicated. No substitution. Highest residual restriction risk; still untested.
- **lower_back x `lower_post` -> no-compound posterior day** (warned). The contract correctly refuses to seat a squat; if all hinges are removed the day is accessory-only with the limited-variety notice.
- **strength x 6-day PPL (or `fb-hmhp-4`) -> six heavy days, no fatigue cap.** Code-acknowledged; the engine emits it.
- **`pplul-5` -> two near-identical leg days** (`legs` slots equal `lower_general`). Low variety, no quad/posterior contrast. No guard.
- **30-min full-body -> squat/hinge or squat/glute_iso supersets** treated as antagonists, pairing maximally fatiguing lifts.
- **Dumbbell-only users never get vertical pulls.** The `vertical_pull` slots no-op (no DB vertical pull) and backfill substitutes other patterns, so back-width work is structurally under-served for that equipment tier. A documented limitation rather than a bug.
- **PHUL deadlift set-count asymmetry.** On `phul_lower_power`, the strength set-bump lands on the squat (PRIMARY_LOWER, position 0), so the squat gets 4 sets and the deadlift 3. Canonical PHUL treats them as co-equal primaries; the bump always goes to position 0 after role ordering. An accepted v1 limitation (also lowers the systemic load of two heavy lifts in one session). Documented in the PHUL spec.

---

## Suggested follow-ups (not yet acted on)
- Add the **untested high-risk combinations** as tests: knee+lower_back (now warned, assert the warning + degraded composition), bodybuilding end-to-end, non-glutes priority end-to-end, PHUL x non-balanced style.
- Consider an **intent-aware `recommendStyle`** (or a "Suggested" badge) so `phul-4` surfaces for powerbuilding-leaning users instead of always defaulting to `ul-classic-4` (the recommendation is still count-only).
- **Differentiate `pplul-5` leg days** (quad-led vs posterior-led, like `ulppl-5` / `ppl-x2-6`), the last redundant-leg-day style.
- Re-key the **anchor map by occurrence index** before authoring any emphasis with two of the same anchor pattern (still latent; PHUL does not trigger it).
- Revisit the **30-min squat/hinge superset** pairing (not a real antagonist) and the **dumbbell-only vertical-pull** gap.
- Optional **per-pattern set-count override on strength days** to make PHUL's squat and deadlift co-equal (closes the deadlift set-count asymmetry).
- A **minimum-compound substitution** (a safe leg press for a contraindicated squat) would upgrade the restriction holes from "warned + degraded" to "covered"; the future hook is `substitution_class`.
