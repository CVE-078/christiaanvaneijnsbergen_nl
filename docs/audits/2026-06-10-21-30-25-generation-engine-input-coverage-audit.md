# Pulse routine generation engine — input & coverage audit (2026-06-10)

**Method:** full read of `src/lib/pulse/generation.ts`, `src/lib/pulse/types.ts`, `src/app/pulse/actions/routines.ts`, and `src/lib/pulse/__tests__/generation.test.ts`, plus `recommendation.ts` and `behavior.ts` for the input types they define. Documentation and gap-analysis only, no code changed. Where a behavior depends on seed data not present in these files (the exercise catalog, the `contraindications` column), that is stated explicitly rather than guessed.

**Pipeline, end to end:** `generateAndSaveRoutine` (action) gathers and hardens inputs, loads the global exercise pool minus hidden exercises, derives a behavior signal from swap history, resolves profile-stored preferences, then calls `generateRoutine`. `generateRoutine` orders the training days, computes volume, filters the pool (equipment + contraindications), and for each session runs `tiltEmphasis -> resolveBias -> selectForSession -> tier sort -> set/rep assignment -> optional supersets`.

---

## SECTION 1 — Complete input variable inventory

| # | Variable / type | Enters via | Directly affects | Interaction effects | Test coverage |
|---|---|---|---|---|---|
| 1 | `answers.equipment` `Set<EquipmentKey>` | Onboarding / setup-flow equipment step (pre-filled from active/travel equipment profile) | `hasEquipment` pool filter (`generation.ts:590`, applied at `:1151`) | Thins the pool that every other selector draws from; a thin pool forces cross-session repetition and triggers `vertical_pull` no-op for dumbbell-only users; interacts with `loadingLean` (a preferred modality absent from kit is silently a no-op) | **Fully tested** (equipment filter, Smith Machine gating, thin-pool fallback) |
| 2 | `answers.experience` `'beginner'\|'intermediate'\|'advanced'` | Onboarding | `volumeFor` -> exercises-per-session + base sets (`:447`) | Combines with `sessionTime` in the `VOLUME` table; the exercise count interacts with `PATTERN_CAP` and backfill (more slots = more chance to hit caps) | **Fully tested** (time scaling, volume floor) |
| 3 | `answers.goal` `'build_muscle'\|'lose_fat'\|'general_fitness'` | Onboarding | `repRange` / `resolveRepRange` (`lose_fat` shifts both columns up one notch, `:456`) | Composes with `trainingStyle` (the resolved bias is what `repRange` reads); `lose_fat` does **not** shift a strength-bias compound (stays heavy) | **Partially tested**: `lose_fat` covered on balanced/strength; `lose_fat x powerbuilding/bodybuilding` end-to-end untested; `general_fitness` never asserted in generation |
| 4 | `answers.days` `'2-3'\|'4'\|'5-6'` | Onboarding | **Nothing in the engine.** Only consumed by `buildRationale` (`:1276`) for the human string | Can silently **disagree** with `trainingDays.length`, which is the value that actually drives `resolveStyle` and session count. No reconciliation anywhere | **Untested** as a coherence concern |
| 5 | `answers.gender` `Gender\|null` (optional) | Onboarding | **Not read by `generateRoutine`.** In the action, priority is seeded from `profileRow.gender` via `genderDefault` (`routines.ts:480`), not from `answers.gender` | Seeds `priority` (female -> glutes) only when `priority_muscle` is null | `genderDefault` unit-tested; the action seeding path is **untested** at generation level |
| 6 | `trainingDays` `number[]` (0-6 weekdays) | Setup flow day picker | `orderTrainingDays` (schedule day order, `:1135`); caps sessions emitted (`i >= days.length` skips, `:1170`) | Length drives `resolveStyle`; if length < `style.sessions.length` some sessions are dropped; if length > sessions, extra days get no session | **Fully tested** (`orderTrainingDays`, anchor-aware schedule); count/length mismatch edge cases untested |
| 7 | `sessionTime` `'~30 min'\|'45-60 min'\|'90+ min'` | Setup flow | `volumeFor` (counts) + `isSuperset` (30 min only, `:1147`) | 30 min triggers `buildSupersets`; higher volume interacts with caps and backfill relaxation | **Fully tested** (time scaling, supersets) |
| 8 | `style` (`ProgramStyle`, from `styleKey`) | Setup flow style picker / `recommendStyle` default | Session list: each session's `focus`, `emphasis`, `variant` (`:1169`) | Determines `FOCUS_TYPE`, the emphasis bias fed to `resolveBias`, and the slot list fed to `selectForSession` | **Fully tested** (every style -> schedule length, emphasis-key existence, variant letters) |
| 9 | `priority` `PriorityMuscle\|null` | Profile `priority_muscle` (or gender-seeded) | `tiltEmphasis` reorders existing slots front-to-back (`:208`) | Only reorders patterns already in the emphasis (never injects); composes with `trainingStyle` (orthogonal) and caps | **Partially tested**: `tiltEmphasis` unit-tested for all; only **glutes** verified end-to-end (Bug 5). Chest/back/shoulders/arms/legs priority never asserted in a generated routine |
| 10 | `trainingStyle` `'balanced'\|'strength'\|'bodybuilding'\|'powerbuilding'` | Profile `training_style` / setup flow | `resolveBias` (BIAS_REMAP, `:490`) -> reps + the strength set-bump; `resolveRepRange` powerbuilding per-pattern override (`:540`) | Does **not** change slot composition or exercise selection, only reps/sets; powerbuilding interacts with movement pattern (heavy set membership) | **Partially tested**: balanced/strength/powerbuilding generation tested; **bodybuilding never asserted end-to-end** (only via `resolveBias`/rationale) |
| 11 | `varietyPreference` `'consistent'\|'varied'` | Profile `variety_preference` / setup flow | Anchor map in `selectForSession` (`:917`) | Keyed `${focus}:${pattern}`; interacts with same-focus vs different-focus sessions and with the `used` avoid-set (anchor bypasses it) | **Fully tested** (identity, determinism, anchoring, accessory rotation, no within-session dup) |
| 12 | `loadingLean` `'barbell'\|'dumbbell'\|'machine'\|'cable'\|null` | Profile `loading_lean` / setup flow | `byPattern` sort, floats preferred-equipment first (`:816`) | Fresh-preference still beats it; sits below the demote layer but above substitution-class freshness; no-op when modality absent from pool | **Partially tested**: barbell float + fresh-beats-used + null identity + cable fallback. **machine/dumbbell never asserted**; `loadingLean x consistent`, `x restrictions` untested |
| 13 | `restrictions` `RestrictionFlag[]` | Profile `movement_restrictions` / setup flow / Profile editor | `isContraindicated` hard pool filter (`:597`, applied `:1152`) | Subtractive only; can empty a pattern (backfill must cover); compounds with equipment thinning; never relaxed | **Partially tested**: identity, single knee, single-flag-leg, knee+shoulder. **The dangerous same-region combos are untested** (Section 5) |
| 14 | `behavior` `BehaviorSignal {demote: string[]}` | Derived in action from `loadSwapHistory` -> `analyzeSwapBehavior` (`routines.ts:519`) | `byPattern` demote layer, sinks demoted ids **on non-anchor patterns only** (`:811`) | Never touches `COMPOUND_ANCHOR_PATTERNS`; soft (won't drop the only candidate); independent of canonical rank | **Fully tested** (golden, non-anchor sink, anchor no-op, only-candidate) |
| 15 | `anchorDow` `number` | `startAnchor` weekday (or today) in the action (`routines.ts:449`) | `orderTrainingDays` rotation (`:1135`) | Defaults to Monday (1) when absent | **Fully tested** |
| 16 | `makeGroupId` `() => string` | Action passes `crypto.randomUUID` | Superset group ids (30 min) | None | Indirectly tested |
| 17 | Hidden exercises | Action `loadHiddenExerciseIds` filters the pool before `generateRoutine` (`routines.ts:496`) | Shrinks the pool (acts like an extra equipment filter) | Same thin-pool interactions as equipment | **Untested** in `generation.test.ts` (action-level concern) |

Two structural observations:

- **`answers.days` and `answers.gender` are effectively dead inputs to the engine.** `days` only feeds the rationale string and can disagree with the real session count; `gender` is not read by `generateRoutine` at all (priority is profile-seeded in the action).
- **Training style and priority are the only two inputs settable from multiple sources** (param vs stored profile), with param-wins precedence resolved in the action (`routines.ts:481-491`). That precedence is untested (no action-level harness, per project convention).

---

## SECTION 2 — Split selection matrix

`recommendStyle(count)` always returns `STYLES[count][0]` (the first listed style). The setup flow shows a picker only when a count has more than one style; quick-start auto-applies the recommendation. So the user chooses manually for 3, 4, and 5 days, and has no choice for 2 and 6.

### 2 days — `STYLES[2]`, single style (no choice)
- **`fb-2` Full Body** (recommended, only option): `full_body/fb_strength (A)`, `full_body/fb_hyper (B)`.
  - `fb_strength`: `hinge, squat, horizontal_push, horizontal_pull, vertical_push, biceps_iso, core` (bias strength).
  - `fb_hyper`: `lunge, hinge, horizontal_push, horizontal_pull, shoulder_iso, triceps_iso, biceps_iso` (bias hypertrophy).
- **Science:** Sound for 2 days. Squat trained once (day A); day B substitutes lunge. Hinge both days. At 45-60 min the 7th slot trims, so each day lands at 6 lifts. No concern beyond the inherent low weekly volume of 2 sessions.

### 3 days — `STYLES[3]`, four styles (**underdetermined**)
- **`fb-3` Full Body** (recommended): `fb_strength (A)`, `fb_hyper (B)`, `fb_balanced (C)`. Each muscle ~3x/week. Best general default; recommendation correct.
- **`fb-emphasis-3` Full Body - Emphasis Days**: `fb_chest_back (A)`, `fb_legs (B)`, `fb_delts_arms (C)`.
  - `fb_legs` = `squat, hinge, lunge, glute_iso, calf, core` — a **pure leg day with zero upper-body work**. `fb_chest_back` = `horizontal_push, horizontal_pull, vertical_push, chest_iso, back_iso, core` — **zero leg work**.
  - **Concern:** mislabeled. It is a 3-way body-part split, not "full body." Each region hit ~1x/week, the opposite of the full-body frequency advantage the name implies.
- **`ppl-3` Push / Pull / Legs**: `push`, `pull`, `legs` (null variants).
  - **Concern:** each muscle once per week. Lowest-frequency option at 3 days; generally inferior to `fb-3`. Offered with equal billing, only a `bestFor` string to steer away.
- **`ulf-3` Upper / Lower / Full Body**: `upper_general`, `lower_general`, `fb_balanced`. Reasonable ~1.5x frequency per region.
- **Underdetermined verdict:** Yes. Four options with materially different weekly frequency (3x vs 1x), guidance is one `bestFor` line each. Default is correct, but `fb-emphasis-3` and `ppl-3` are easy mis-picks.

### 4 days — `STYLES[4]`, four styles (**underdetermined**)
- **`ul-classic-4` Classic Upper / Lower** (recommended): `upper_chest_back (A)`, `lower_quad (A)`, `upper_delts_arms (B)`, `lower_post (B)`. Each half 2x/week, quad/posterior lower split. Strong default, correct.
- **`ul-aesthetic-4` Aesthetic Upper / Lower**: `upper_aesthetic_a (A)`, `lower_lean (A)`, `upper_aesthetic_b (B)`, `lower_post (B)`.
  - `lower_lean` (bias pump) = `lunge, squat, glute_iso, calf, core` — squat is the **second** slot behind lunge. Squat trained once across the week (lower A only; lower B is `lower_post`, hinge-led).
  - **Concern:** light on bilateral squat strength by design (acceptable for "aesthetic," but quad loading is deprioritized).
- **`ppl-fb-4` Push / Pull / Legs + Full Body**: `push, pull, legs, full_body/fb_balanced`. Uneven frequency; the FB day's leg work is one squat + one hinge.
- **`fb-hmhp-4` Full Body Heavy/Medium/Heavy/Pump**: `fb_strength (A)`, `fb_balanced (B)`, `fb_hyper (C)`, `fb_pump (D)`. High-frequency full body. Fine.
- **Underdetermined verdict:** Yes, four options. Default sound.

### 5 days — `STYLES[5]`, three styles (**underdetermined**)
- **`ulppl-5` Upper / Lower / Push / Pull / Legs** (recommended): `upper_general`, `lower_quad`, `push`, `pull`, `legs/lower_post`.
  - The `legs` focus is paired with the `lower_post` emphasis (posterior), and `lower` uses `lower_quad`, so the two lower days are genuinely differentiated (quad-led vs posterior-led). Best-constructed 5-day option. Recommendation correct.
- **`pplul-5` PPL + Upper / Lower**: `push, pull, legs, upper/upper_general, lower/lower_general`.
  - **Concern — redundant leg days:** `legs` and `lower_general` are **byte-identical slot lists** (`squat, hinge, lunge, glute_iso, calf, core`), differing only in bias (`hypertrophy` vs `balanced`). Two near-identical leg days, no quad/posterior differentiation. Under `varied` they rotate exercises; under `consistent` they get distinct anchor keys so they pick different squats but train the same six patterns twice.
- **`fb-ul-hybrid-5`**: `fb_strength, upper_chest_back (A), lower_quad (A), upper_delts_arms (B), lower_post (B)`. Coherent.
- **Underdetermined verdict:** Yes, three options. `pplul-5` is the questionable one.

### 6 days — `STYLES[6]`, single style (no choice)
- **`ppl-x2-6` Push / Pull / Legs x2** (recommended, only option): `push (A), pull (A), legs (A), push (B), pull (B), legs (B)`.
  - **Concern — no A/B differentiation in emphasis:** both push days use identical `push`, both pull days `pull`, both leg days `legs`. No heavy/volume or quad/posterior contrast between A and B. Under `consistent` (same focus `legs`), legs A and legs B share the **same** squat and hinge anchors, so the two leg days become very similar. The only differentiator across A/B is exercise rotation under `varied`. Conventional PPL x2 usually contrasts the blocks (heavy vs pump); this one does not.

### Cross-cutting day-count gaps
- **count = 1:** `STYLES[1]` undefined -> resolves to 2 -> `fb-2` (2 sessions), but `trainingDays.length` 1 drops session B. Net: a single full-body day. Never tested.
- **count = 7+:** resolves to `STYLES[6]` -> 6 sessions; a 7th selected day gets **no schedule entry**. Silent. The `days` UI caps at "5-6", but `generateAndSaveRoutine` accepts any valid-weekday `trainingDays` with no length cap.

---

## SECTION 3 — Training style interaction effects

`BIAS_REMAP` (`generation.ts:490`) is the whole mechanism. Training style **never changes slot composition or exercise choice**; it only remaps the session bias, which changes rep ranges and the strength set-bump.

### What each style changes
- **`balanced`** — Identity column. Byte-identical to no style (rollout safety invariant, golden-tested).
- **`strength`** — `strength->strength`, `balanced->strength`, `hypertrophy->strength`, `pump->hypertrophy`. Most sessions become strength bias (compounds 3-6, first compound +1 set via `firstCompoundBumped`, `:1210`). Pump days do **not** become strength; they soften to hypertrophy.
- **`bodybuilding`** — `strength->hypertrophy`, `balanced->hypertrophy`, `hypertrophy->hypertrophy`, `pump->pump`. Everything heavier collapses to hypertrophy; pump days stay pump. No strength set-bump fires.
- **`powerbuilding`** — Every bias remaps to `strength` (so the set-bump fires on the first compound of **every** session), but `resolveRepRange` overrides reps **per pattern**: `POWERBUILDING_HEAVY_PATTERNS` get strength reps, everything else hypertrophy (`:547`).

### Interaction with each split type
- **Full-body / U-L / PPL under balanced/bodybuilding:** clean; reps follow the resolved bias uniformly.
- **Strength x high-frequency splits (6-day PPL, `fb-hmhp-4`):** remaps **all** sessions to strength with no frequency cap. A 6-day PPL under strength becomes six heavy 3-6 days each with a bumped first compound. Code-acknowledged at `:486-489`. A genuinely high-fatigue, autoregulation-free prescription the engine will emit.
- **Powerbuilding x PPL "pull" day — real defect:** `POWERBUILDING_HEAVY_PATTERNS = {squat, hinge, horizontal_push, vertical_push}`. **Neither `horizontal_pull` nor `vertical_pull` is in it.** So a powerbuilding `pull` session gets the **hypertrophy** range on every lift, including its primary row. Yet because `effectiveBias` resolved to `strength`, the **first compound still gets the +1 set bump**. Result: the pull day's main row reads 4 sets at 8-12 reps (a set/rep signal mismatch), and the back is never trained heavy under "powerbuilding." Holds on `ppl-3`, `ppl-fb-4`, `pplul-5`, `ulppl-5`, `ppl-x2-6`. U/L splits dodge it because their upper days bundle a heavy pressing pattern.
- **Bodybuilding x any split:** no set-bump ever, all hypertrophy/pump. Coherent but completely untested end-to-end (Section 7).

### Interaction with priority muscle
`tiltEmphasis` (slot reorder) and `resolveBias`/`resolveRepRange` (reps/sets) are orthogonal and compose cleanly:
- **Strength + glutes:** lower days reorder hinge-first (`PRIORITY_PATTERNS.glutes = [hinge, squat, lunge, glute_iso]`), strength bias gives the hinge 3-6 + 4 sets. Coherent (heavy hip-hinge glute focus). Upper days: glutes is a no-op, strength still applies.
- **Powerbuilding + glutes:** hinge and squat are both heavy patterns -> strength reps; glute_iso stays hypertrophy. Coherent.
- **Strength + arms:** `PRIORITY_PATTERNS.arms = [biceps_iso, triceps_iso]`, both isolation. The bumped/heavy treatment goes to compounds; the arms priority front-loads isolation slots (10-15 under strength bias). No bug, but priority and style pull in different directions (the "strength" framing does nothing for the prioritized arms).

No style x priority combination produces an invalid routine, but **none is tested** (only glutes alone, and style alone).

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
- Heavy patterns (`squat, hinge, horizontal_push, vertical_push`): compound **3-6**.
- Everything else (`horizontal_pull, vertical_pull, lunge, all *_iso, calf, core`): compound **8-12**, isolation **12-15**.

`lose_fat` shifts each resolved range up one notch (strength compound 3-6 -> 6-10; hypertrophy compound 8-12 -> 10-15; isolation columns up correspondingly), except a strength-bias compound stays heavy-ish (`repRange`, `:464`).

---

## SECTION 4 — Exercise variety x consistent anchor interaction

### Anchor map keying
- The anchor map (`anchors: Map<string,string>`, `:1164`) is **per-generation and never persisted**.
- Consulted only when `variety === 'consistent'` **and** the slot pattern is in `COMPOUND_ANCHOR_PATTERNS` = `{squat, hinge, horizontal_push, vertical_push, horizontal_pull, vertical_pull}` (`:917`).
- Key is `` `${focus}:${slot}` `` (`:924`) — **focus + movement pattern, no slot index, no exercise role**. Value is the first exercise chosen for that key.
- First fill: pick the freshest candidate, store it. Later fills of the same key: reuse the stored exercise, **bypassing the `used` avoid-set** (`:926-934`).

### Which exercises repeat across which sessions
- **Same-focus sessions share anchors.** `legs A`/`legs B` in `ppl-x2-6` (both focus `legs`) reuse the same squat and hinge. `lower A`/`lower B` in `ul-classic-4` are both focus `lower`, but the quad/posterior emphasis split means `lower_quad` has no hinge slot and `lower_post` has no squat slot, so they never collide on the same heavy pattern (locked by the "two lower days share no squat/hinge" test).
- **Different-focus sessions get distinct keys** -> distinct exercises (`push:horizontal_push` vs `full_body:horizontal_push`), the Bug 1 fix.
- **Accessories always rotate**, even under `consistent` (isolation not in `COMPOUND_ANCHOR_PATTERNS`).
- **`varied` (default, and null/undefined)** never anchors; every slot prefers a fresh exercise. Golden-tested byte-identical to base.

### Too-aggressive cases
- **`pplul-5` / `ppl-x2-6` redundant leg days:** because `legs` slots equal `lower_general` slots, and both `ppl-x2-6` leg days share focus `legs`, `consistent` pins the **same squat and the same hinge** across both leg sessions. Documented intent, but for a 6-day program it means two leg days built around identical main lifts and identical patterns; only the rotating accessories distinguish them.

### The slotIndex anchor-key gap (the "glute_iso repeat" reference)
- The anchor key omits the slot index. The design assumes **one anchored slot per (focus, compound pattern)**. If a single session's emphasis (or its backfill) places **two slots of the same anchor pattern**, both map to one key.
- Current defensive handling (`:935-938`): when the anchored exercise is already in `chosenIds`, `candidates.find(id === anchoredId)` returns undefined, so the second slot **falls through to a fresh pick without re-anchoring**. This prevents a within-session duplicate.
- **Why it is dormant today:** no emphasis in `EMPHASES` lists the same `COMPOUND_ANCHOR_PATTERN` twice (`push` doubles `triceps_iso`, `pull` doubles `back_iso`, both non-anchor isolation). The second-anchor-slot case only arises via backfill adding a second instance of an anchor pattern (allowed up to `PATTERN_CAP = 2`); that instance is fresh and unanchored, so it can differ across sessions. Acceptable, not broken.
- **`glute_iso` specifically is NOT an anchor pattern.** It is never written to the anchor map. Under `consistent`, two sessions training `glute_iso`, or two `glute_iso` slots in one session (via backfill), are governed by the fresh-preference + the `unilateralCapApplies` exemption (`:644`), **not** the anchor map. Any "glute_iso repeats where it should not" symptom traces to the pattern cap / unilateral-exemption logic (the `lower_post` lunge-starvation fix), not to a shared anchor key.

**Conclusion:** the slotIndex key gap is a **latent fragility**, not an active bug in the shipped catalog. It will bite the moment an emphasis is authored with two of the same anchor pattern (e.g. a future "two horizontal-press" upper day meant to keep both presses stable across sessions): the second press could not be anchored independently and would silently drift. Fix is to key by `${focus}:${slot}:${occurrenceIndex}` or assign anchor slots explicit ids. No test covers a same-anchor-pattern-twice emphasis.

---

## SECTION 5 — Movement restrictions coverage

Mechanism (`isContraindicated`, `:597`): a hard pool filter run alongside `hasEquipment`. An exercise is removed if its per-exercise `contraindications: RestrictionFlag[]` intersects the user's flagged set. Never relaxed (unlike the equipment / heavy / unilateral thin-pool fallbacks).

### Which patterns are excluded per flag
**There is no pattern-level mapping in code.** The four files contain no "knee -> squat/lunge" table. Exclusion is entirely **data-driven** by the `contraindications` column in the exercise seed (`2026-06-08-...-exercise-contraindications.sql`, not in these files).

| Flag | Patterns excluded |
|---|---|
| knee | Whatever individual exercises carry `'knee'` in the seed (per the catalog, typically deep squat/lunge variants, leg extension). Pattern-level effect is emergent, not declared. |
| lower_back | Whatever carries `'lower_back'` (typically loaded hinges: conventional deadlift, RDL, good morning, barbell row). |
| shoulder | Whatever carries `'shoulder'` (typically overhead pressing, upright rows, certain flyes). |
| wrist | Whatever carries `'wrist'` (typically straight-bar curls, front-rack work, push-ups). |

Exact exercises cannot be enumerated without the seed. The roadmap notes the seed was tagged with a "safe-leg/safe-push survival invariant per flag," meaning each **single** flag leaves at least one safe leg and one safe push. That invariant is per single flag, **not** per combination.

### Substitution logic
**Not implemented.** Restrictions are purely subtractive. There is no substitute front-loading, no "replace the contraindicated squat with a safe leg press." (CLAUDE.md confirms "v1 is purely subtractive ... no preferred-substitute front-loading yet; future hook is `substitution_class`.") The reason-aware `rankSubstitutes` (`'pain'` lens) is a **swap-time** feature, separate from generation; it never runs during `generateRoutine`.

### Combinations that can empty or near-empty a session
- **lower_back x `lower_post`** (lower B of `ul-classic-4`/`ul-aesthetic-4`/`fb-ul-hybrid-5`, and the `legs` day of `ulppl-5`): `lower_post` slots = `hinge, glute_iso, lunge, calf, core`, its **only compound is `hinge`**. If lower_back removes all hinge variants, the session degrades to `glute_iso + lunge + calf + core` with **no heavy compound**. The code's own TODO at `:86-90` flags this exact hole for the equipment-constrained case; a lower_back restriction is the restriction analog with the same outcome. No minimum-compound guard exists.
- **knee x lower_back together (the dangerous combo):** knee thins squat/lunge, lower_back thins hinge. On a `lower_quad` day (`squat, lunge, glute_iso, calf, core`) the knee flag removes squat and lunge compounds, leaving `glute_iso + calf + core`, all isolation. On a `lower_post` day the lower_back flag removes the lone hinge. A knee+lower_back user can get **leg days with zero compound loading**. The "single flag never empties leg work" invariant does not cover this; there is no test for knee+lower_back (the existing two-flag test uses knee+shoulder, which touch different sessions).
- **shoulder x wrist:** both hit pressing. A `push` day or `vertical_push` slot could lose all overhead pressing (shoulder) and the bench/push-up alternatives (wrist), leaving only chest_iso/triceps_iso. Backfill fills the count but the session can end up with no pressing compound.
- **All four flags at once:** maximal pool thinning; with a simultaneously thin equipment set (dumbbell-only), several patterns could empty and the session leans entirely on backfill. Untested.

---

## SECTION 6 — Intra-session ordering

Ordering is determined in two stages after `selectForSession`:

1. **Tier sort** (`:1195`), a stable sort by `patternTier`:
   - Tier 1: compound `squat` or `hinge`.
   - Tier 2: compound `horizontal_push`, `horizontal_pull`, `vertical_push`, `vertical_pull`, `lunge`.
   - Tier 3: any `*_iso`.
   - Tier 4: `calf`, `core`, anything else.
   - Non-compound exercises in a Tier 1/2 pattern fall through to Tier 3.
2. **Within a tier**, order is the **selection order** (emphasis slot order, then backfill order), preserved by the stable sort. **No fatigue, load, or size ranking inside a tier.**
3. **30-min sessions only:** `buildSupersets` then reorders into adjacent antagonist pairs (`:1203`), breaking strict tier order to place a push next to a pull.

Compounds always precede isolation (isolation-before-compound is structurally impossible), and finishers (calf/core) come last. That part is correct.

### Suboptimal sequences
- **Squat and hinge always adjacent at the very front of every full-body / dual-compound leg day.** Both are Tier 1, so the sort places them consecutively. `fb_strength` -> `deadlift, squat, ...`; `fb_balanced`, `fb_legs`, `legs`, `lower_general`, `fb_hyper` all carry both. Sequencing the two highest systemic-fatigue lifts back to back is a real coach-quality issue; a coach would separate them. The tier sort guarantees the opposite.
- **No load ordering inside Tier 2.** A heavy barbell row and a light cable row are both Tier 2 and ordered purely by which slot/backfill picked them. Same for `vertical_push` vs `lunge`: a lunge can present before an overhead press on slot order alone.
- **`lower_lean` (ul-aesthetic-4 lower A):** slot order is `lunge, squat, ...` but the tier sort moves squat (Tier 1) ahead of lunge (Tier 2). So selection front-loads lunge (fresh-pick priority) while presentation leads with squat: selection priority and display order disagree. Minor.
- **30-min antagonist supersets pair squat <-> hinge and squat <-> glute_iso as "antagonists"** (`SQUAT_PATTERNS={squat,lunge}` vs `HINGE_PATTERNS={hinge,glute_iso}`, `antagonist()` true, `:1023`). Supersetting squat with deadlift, or squat with hip thrust, does not give genuine antagonist recovery; both hammer the posterior chain and legs. On a 30-min full-body day this can pair the two most fatiguing lifts into one superset. The push/pull pairings are fine; the lower-body ones are not real antagonists in the recovery sense.
- **No push/pull interleaving for straight-set sessions.** Non-30-min sessions present a compound block then an isolation block; no alternation to manage local fatigue beyond tier grouping. `upper_general` happens to alternate reasonably by slot order, but that is incidental, not enforced.

---

## SECTION 7 — Known gaps and untested combinations

### Variable combinations with no test coverage
1. **Priority muscle other than glutes, end-to-end.** Only `tiltEmphasis` units + glutes (Bug 5). chest/back/shoulders/arms/legs priority in a generated routine is unverified, including whether `arms` front-loads both `biceps_iso` and `triceps_iso`.
2. **`bodybuilding` training style end-to-end.** Only `resolveBias`/`buildRationale`. No `generateRoutine` assertion of hypertrophy-everywhere + no set-bump.
3. **Priority x trainingStyle**, **priority x varietyPreference**, **priority x restrictions** — none tested in combination.
4. **`loadingLean` machine/dumbbell/cable end-to-end** (only barbell float + cable fallback); **loadingLean x consistent**, **loadingLean x restrictions** untested.
5. **Restriction combinations:** knee+lower_back (leg-emptying), lower_back alone on `lower_post` (no-compound posterior), three or four flags, restrictions x thin equipment, restrictions x `consistent`. Only knee+shoulder (different sessions, safe) is tested.
6. **`behavior` demote x consistent**, **behavior x restrictions**, **behavior demote of a canonical-anchor-named exercise** (logically disjoint but unasserted).
7. **`lose_fat` x powerbuilding/bodybuilding**, and `general_fitness` goal in any generated routine.
8. **Day-count edges:** count = 1, count = 7+, and any case where `trainingDays.length != style.sessions.length`. Silent session-drop / unscheduled-day behavior unverified.
9. **`answers.days` vs `trainingDays.length` disagreement** — no test; the rationale can claim a day count the routine does not have.
10. **Hidden-exercise pool filtering** — action-level, absent from `generation.test.ts`.
11. **90+ min volume coherence per style** beyond the pattern-cap test (no assertion each style reaches 7-8 lifts with sane composition at the top tier).
12. **Superset pairing quality** — the 30-min suite checks group size and adjacency, not whether the pairing is a sensible antagonist (the squat/hinge pairing passes existing tests).

### Combinations likely to produce a broken or low-quality routine (engine-logic basis)
- **knee + lower_back -> all-isolation leg days.** Highest severity. Knee removes squat/lunge compounds, lower_back removes the hinge, so `lower_quad` and `lower_post` can both end with zero compound loading. No minimum-compound guard, no substitution, untested. (Logic at `:1152` + `:79-95`; the `:86` TODO already concedes the equipment version.)
- **lower_back x `lower_post` -> no-compound posterior day.** `lower_post`'s only compound is hinge; remove it and the session is glute_iso + lunge + calf + core. Directly the case the code TODO warns about, reachable via a restriction.
- **powerbuilding x any PPL pull day -> no heavy work + set/rep mismatch.** Pull patterns are excluded from `POWERBUILDING_HEAVY_PATTERNS`, so the pull day is all hypertrophy reps, yet the first compound still gets the strength +1 set bump (effectiveBias resolved to strength). The back never sees a heavy range; the main row reads 4 sets x 8-12. (`:494` + `:510-515` + `:1210`.)
- **strength x 6-day PPL (or `fb-hmhp-4`) -> six heavy days, no fatigue cap.** Code-acknowledged (`:486-489`). The engine will emit it.
- **`pplul-5` / `ppl-x2-6` -> two near-identical leg days.** `legs` slots equal `lower_general`; under `consistent` the `ppl-x2-6` leg days share squat+hinge anchors. Low variety, no quad/posterior contrast. No test guards against duplicate-template leg days.
- **`fb-emphasis-3` mislabeled as full body.** `fb_legs` (no upper) and `fb_chest_back` (no legs) deliver 1x weekly frequency under a "Full Body" name.
- **count > 6 -> silent truncation** to 6 sessions with an unscheduled training day. No guard, no test.
- **30-min full-body -> squat/hinge or squat/glute_iso supersets** treated as antagonists, pairing maximally fatiguing lifts.
- **Dumbbell-only users never get vertical pulls.** The `vertical_pull` slots no-op (no DB dumbbell vertical pull) and backfill substitutes other patterns, so back-width work is structurally under-served for that equipment tier. Acknowledged in the `EMPHASES` comments; a limitation rather than a bug, but a whole movement category is silently dropped for the most common minimal-equipment user.

---

## Suggested follow-ups (not yet acted on)
- Add a **minimum-compound guard** for leg/posterior sessions before isolation backfill (covers both the equipment-thin and restriction-thin holes; closes the `:86` TODO and the knee+lower_back case).
- Fix or document **powerbuilding pull-day** behavior (either add the pull patterns to a heavy set or stop bumping the set count when the resolved reps are hypertrophy).
- Re-key the **anchor map by occurrence index** before authoring any emphasis with two of the same anchor pattern.
- Differentiate the **`ppl-x2-6` and `pplul-5` leg days** (quad-led vs posterior-led, like `ul-classic-4`).
- Add the **untested high-risk combinations** above as tests (knee+lower_back, powerbuilding pull, bodybuilding end-to-end, non-glutes priority end-to-end).
