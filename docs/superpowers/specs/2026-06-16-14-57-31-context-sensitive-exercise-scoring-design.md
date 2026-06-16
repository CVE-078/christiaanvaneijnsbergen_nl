# Context-sensitive exercise scoring, design

Date: 2026-06-16 (revised after review round 2)
Status: spec (pre-implementation). Two external review rounds folded in (see "Review reconciliation"). Next: writing-plans, then roadmap START and TDD.
Branch: feature/generation-context-scoring

## Summary

The generator's exercise-selection quality plateaued on a flat, context-free score.
`ISOLATION_QUALITY` ranks an isolation the same on every day, in every style, at every
rep band. That produces five recurring failures:

1. **Push Press at hypertrophy reps.** A power movement gets an 8-12 prescription.
2. **Step-Up at low reps.** A load-limited unilateral lift gets a 3-6 prescription.
3. **Incline DB Press missing on aesthetic splits.** The canonical-anchor order leads with
   flat bench, so incline variants only land as a third pick a chest day never reaches.
4. **Pullover over-selection.** `back_iso` overvalues Dumbbell Pullover relative to its
   peers and the pool is thin, so it recurs week to week (the calibration spec's
   known-deferred issue, `2026-06-16-12-43-23`).
5. **Styles feel samey.** Balanced, Bodybuilding, and Powerbuilding differ only in rep
   ranges and set bumps, not in which exercises they pick.

This spec replaces the flat quality score with a context-sensitive one, computed from
per-exercise metadata against the session context (goal, style, focus, rep band). It is
the calibration spec's deferred "#1 lever" (lines 76-80 there), delivered as one spec per
the whole-bucket scope decision (2026-06-16).

## Scope (the five levers, one spec)

1. A continuous `contextScore` (exercise x goal x style x focus x rep-context) replacing the
   flat `ISOLATION_QUALITY` comparator layer in `byPattern`.
2. Per-exercise preferred rep windows, doing double duty: a selection penalty and an
   assignment clamp.
3. Style distinctiveness via two levers: a categorical per-style reorder of the primary
   lifts, plus a soft accessory affinity.
4. A weekly isolation-repetition soft cap (saturating penalty).
5. An indirect compound-carryover credit for the muscle-coverage WARNING layer only, as a
   per-pattern map (NOT a flat fraction; see section 6 for why the flat version was rejected).

## Non-goals

- No change to gap-fill (`gapFill.ts` stays direct-set only and untouched).
- No change to selection driven by the carryover credit (warnings only). The carryover
  number never surfaces in the UI.
- No new engine architecture: the slot-first generator and the layered `byPattern`
  comparator stay. This adds metadata and re-tunes one comparator layer.
- **No volume-distribution change.** Set counts per muscle stay slot-count driven and
  identical across styles. The science lens was explicit: exercise selection + rep ranges
  deliver roughly 60% of felt style distinctiveness; the remaining 40% is per-muscle volume
  allocation, which needs the deferred volume-first planner. This spec makes styles
  meaningfully more distinct, not fully distinct. Set expectations accordingly.
- No fatigue model, no frequency model (unchanged limitations).
- No runtime config table; tunables are exported, test-locked constants (this repo's idiom,
  and it keeps the scorer a pure function).

## The safety invariant (sacred)

Every new behavior is a **no-op when the metadata is absent**. Synthetic test pools are
nameless and carry no `quality` / `rep_min` / `rep_max` / `attributes`, so every new term
defaults to neutral and the generation goldens (captured at Balanced + build_muscle +
intermediate, on nameless pools) stay **byte-identical**. This is the exact gate
`ISOLATION_QUALITY`, `CANONICAL_ANCHORS`, and `floorRepRangeForLoad` already use.

Real-catalogue behavior changes by design and is protected by separate real-catalogue
tests, not by the byte-identity goldens. The Balanced training style is the identity style
(`BIAS_REMAP.balanced` is identity, and `STYLE_PROFILES.balanced` is the neutral profile),
so a Balanced routine is unaffected; only Strength / Bodybuilding / Powerbuilding and
time-crunch sessions change, which is the point.

## 1. Metadata model

Four columns on `exercises`, mirrored onto `ExerciseMeta`, all defaulting to a no-op.

| Column | Type | Default | Meaning |
|--------|------|---------|---------|
| `quality` | `numeric(3,2)` (0-1) | `NULL` -> `NEUTRAL_QUALITY` (0.80) | Base hypertrophy quality. Migrates the `ISOLATION_QUALITY` map into a column, closing the long-standing "wants a quality column next to fatigue" TODO. |
| `rep_min` | `smallint` | `NULL` | Low end of the preferred rep window. `NULL` = no per-exercise constraint. |
| `rep_max` | `smallint` | `NULL` | High end of the preferred rep window. |
| `attributes` | `text[]` | `'{}'` | Objective semantic properties of the exercise (not style labels). v1 vocab: `incline`, `lengthened_bias`, `explosive`. Extensible. |

`attributes` holds only **objective facts about the exercise** (it is an incline movement;
it loads the muscle in a lengthened position; it is an explosive/power lift). Which
attributes a style *prefers* is a preference and lives in the style profile (section 3),
never on the exercise. A value like `powerbuilding` would be a preference, not a property,
and is forbidden here, so `attributes` cannot drift into a second classification system. The
equipment / compound lean is **derived** from existing fields (`equipment`, `is_compound`),
not tagged, so the seed touches roughly 10-25 exercises, not the catalogue.

**Honest scope on `lengthened_bias`:** it buys exercise SELECTION (the engine prefers
lengthened-position movements under Bodybuilding), not the actual lengthened-partial
range-of-motion stimulus, which the engine cannot express. Copy must not oversell it as the
latter.

Carryover (section 6) reuses the existing `secondary_muscle_groups`; no new column.

## 2. The score and the explicit hierarchy

A pure function returns a **breakdown**, not a bare number, so each term is unit-testable and
the selection reasoning is inspectable (this also serves debugging, so no separate runtime
debug-logging mode is needed):

```
interface ScoreBreakdown {
  total: number;
  quality: number;          // base
  styleAffinity: number;    // >= 0, bounded
  repFitBonus: number;      // small graded overlap bonus, >= 0
  repeatPenalty: number;    // <= 0, saturating
}
contextScore(ex: ExerciseMeta, ctx: ScoreContext): ScoreBreakdown
// ctx = { goal, style, focus, repBand: [lo, hi], sessionMode }
```

`total = quality + styleAffinity + repFitBonus + repeatPenalty`.

**Nameless guard (load-bearing for the goldens):** `contextScore` returns a neutral breakdown
(`total = NEUTRAL_QUALITY`, every other term 0) for any exercise without a `name`, the same gate
`isolationQuality` uses today. This matters for more than tidiness: a synthetic golden pool can
select the same exercise id in two sessions, so an *ungated* `repeatPenalty` would reorder a
nameless pool and break byte-identity. With the guard, a nameless pool yields a uniform neutral
total and the comparator falls through to fatigue / id exactly as the old `ISOLATION_QUALITY`
layer did. The style / rep-fit / repeat terms therefore only ever act on named,
metadata-bearing catalogue exercises, which is the entire target set.

**Partial-metadata is a silent ranking decision (a watch-item the red-team raised).** A real
exercise with `quality` seeded but `attributes` empty looks identical to a deliberately neutral
one, so the style engine never sees it. The seed-coverage tests (section 9) are the mitigation:
they assert the exercises that *should* carry windows / attributes actually do, so an omission
fails a test rather than silently degrading a ranking.

The **gross rep-mismatch** guard is deliberately NOT inside this total. It is a separate,
dominant comparator layer (below) so it can apply to anchor patterns too and can never be
out-weighed by quality or style. The magnitudes are banded so precedence is unambiguous and
coefficients do not fight, and the banding is locked by **ordering-invariant tests** (section
9) that assert the precedence as a logical guarantee, not an empirical accident.

**The `byPattern` comparator, top to bottom (new and modified layers marked):**

1. behavior demote, non-anchor (existing)
2. beginner difficulty deprioritise (existing)
3. preferred-equipment / loading lean (existing)
4. substitution-class freshness (existing; dedups *variants*)
5. front-delt-isolation suppression (existing)
6. **gross rep-mismatch (NEW, all patterns):** an exercise whose `[rep_min, rep_max]` window
   does not overlap `repBand` sorts after one that does. Binary, dominant. Sits above
   `anchorRank` so a gross misfit loses regardless of canonical rank (mostly inert on
   anchors, whose windows are wide). No window (NULL) = never a mismatch. The overlap boundary
   is an intentional cliff (a window that just fails to overlap is a genuinely worse fit than
   one that just does); the rep bands are coarse and stable so it rarely flips a pick.
7. **`anchorRank`, now style-aware (MODIFIED, anchor patterns):** canonical primary order,
   with an optional per-style reorder of the name list (section 3). Balanced = the default
   order = byte-identical.
8. compound-first, defensive (existing)
9. **`contextScore.total` (NEW, non-anchor only):** replaces the `ISOLATION_QUALITY` layer.
   Higher total first. This is where quality, style affinity, the graded rep-fit bonus, and
   the saturating weekly-repeat penalty combine. **Anchor patterns never rank by
   `contextScore.total`** (a guard test enforces this): an anchor expresses movement identity,
   not exercise quality, so letting quality reorder anchors would erode the canonical concept.
10. role-aware fatigue tiebreak (existing)
11. stable id (existing)

**Design boundary (Perplexity):** anchor patterns are identity-driven. Only canonical order
(with its style reorder) and the gross rep-mismatch guard apply to them. No continuous quality
re-ranking. Keep the anchor path tiny and stable; do not migrate anchor ranking onto
`contextScore`.

### Magnitude bands (constants, section 7)

- Quality base spans `[0, 1]`.
- `styleAffinity` is bounded to `[0, STYLE_AFFINITY_MAX]` (0.25). It CAN overcome a quality
  gap up to its bound, which lets a tagged accessory beat a marginally higher-quality peer
  under a style. This is the **weak (accessory) style lever**; the strong lever is the
  primary reorder (section 3).
- `repFitBonus` is small, `[0, REP_FIT_BONUS_MAX]` (0.10), a tiebreak among already-overlapping
  windows (a tight 8-10 beats a catch-all 3-15 on an 8-12 day). Below style and quality on
  purpose; it discriminates, it does not decide.
- `repeatPenalty` saturates: `[0, -0.50, -0.75, -0.85]` by prior-selection count, capped at
  -0.85. The first repeat is the big signal (a fresh 0.80 peer beats a repeated 0.95:
  0.95 - 0.50 = 0.45 < 0.80); later repeats add little (appearance #7 vs #8 is not meaningful).
- gross rep-mismatch sorts as a layer above the total, so it always wins; equivalently it
  dominates the full `[0,1]` quality range plus the style bound.

## 3. Style distinctiveness (two levers, not one nudge)

Round 2 corrected a framing inconsistency: style is not "a soft nudge". It has two levers of
different strength, and the felt difference comes from the strong one.

- **Strong lever, the primary reorder (categorical).** A per-style reorder of the canonical
  primary name list, the thing users judge a program by. It only reshuffles *legitimate*
  primaries (it cannot pull in a bad exercise), but within that set it is decisive. Expanded
  this round from one pattern (chest) to ~3 patterns for the divergent style.
- **Weak lever, the accessory affinity (soft, capped 0.25).** Shuffles non-anchor accessories
  via `contextScore.styleAffinity`. Never touches the primaries.

The single source for "what a style prefers":

```
interface StyleProfile {
  preferredAttributes: ReadonlySet<string>;   // +ATTRIBUTE_BUMP each, capped into STYLE_AFFINITY_MAX
  equipmentBias: Partial<Record<EquipmentKey, number>>; // e.g. machines/cables under bodybuilding
  compoundBias: number;                        // + favours compounds (powerbuilding), - favours isolation density
  canonicalReorder?: Partial<Record<MovementPattern, string[]>>; // per-style PRIMARY name order
}
const STYLE_PROFILES: Record<TrainingStyle, StyleProfile>;
```

- **Balanced:** neutral. No-op. (Identity, protects goldens.)
- **Bodybuilding:** the divergent style, and where the 3-pattern reorder lands.
  `preferredAttributes = {incline, lengthened_bias}`, `equipmentBias` favours `machines` /
  `cables`, `compoundBias` slightly negative (isolation density).
  `canonicalReorder` on **three patterns**: `horizontal_push` leads with incline variants
  (`Incline Dumbbell Press`, `Incline Barbell Press`, ...); `horizontal_pull` leads with
  machine/cable rows (`Seated Cable Row`, `Chest-Supported Row`, ...); a leg pattern (`squat`)
  leads with the machine option where the catalogue supports it (`Hack Squat` / `Leg Press`
  ahead of `Barbell Squat`). So Bodybuilding's big lifts read distinctly machine/cable/incline.
- **Powerbuilding / Strength:** `compoundBias` positive, `equipmentBias` favours `barbell`. A
  barbell-leading `canonicalReorder` that, for most patterns, *matches* the canonical default
  (which already leads with barbell), so it reinforces rather than changes. This is honest and
  intentional: Powerbuilding, Strength, and Balanced legitimately share heavy barbell primaries;
  they diverge through rep ranges and set bumps (the existing `BIAS_REMAP` / `resolveRepRange`),
  not through different big lifts. The visible exercise divergence is Bodybuilding's.

**Time-crunch** is a session-length mode (~30 min), not a `TrainingStyle`. It applies a small
overlay on top of the style profile: a positive `compoundBias` nudge (a compound is a better use
of a short session) keyed on `ctx.sessionMode`. Minimal and additive.

`styleAffinity` formula (clamped to `[0, STYLE_AFFINITY_MAX]`):

```
sum(ATTRIBUTE_BUMP for a in ex.attributes if a in profile.preferredAttributes)
  + (profile.equipmentBias matched against ex.equipment)
  + (profile.compoundBias if ex.is_compound, applied as sign-appropriate)
  + timeCrunchOverlay(ctx.sessionMode, ex)
```

The canonical reorder is consulted inside `anchorRank`: when `profile.canonicalReorder[pattern]`
exists, it is the name order for that pattern; otherwise `CANONICAL_ANCHORS[pattern]`. Both are
name-keyed (ids are UUIDs), guarded by the existing catalogue-consistency test. Expanding the
reorder grows the name-keyed surface, which strengthens the deferred case for deriving the
reorder from `attributes` (section "Deferred").

**Emergent-cluster watch-item (red-team):** style affinity + substitution-class freshness can
form a local optimum around a favoured attribute family (incline DB / incline machine / incline
smith all preferred by Bodybuilding). The `PATTERN_CAP = 2` already bounds it (two presses max
per session), and a real-catalogue test asserts movement diversity is not reduced under
Bodybuilding versus Balanced.

## 4. Rep windows: selection and assignment

The per-exercise `[rep_min, rep_max]` window does two jobs:

- **Selection** (section 2, layer 6 + the graded `repFitBonus`): a window that does not overlap
  the session band loses (gross-mismatch). Among overlapping windows, a tighter, better-centred
  window earns a small bonus.
- **Assignment:** after `resolveRepRange`, clamp the assigned band into the exercise window.
  `floorRepRangeForLoad` composes (its dumbbell-only lower-compound predicate remains the
  implicit window for that class; an explicit `[rep_min, rep_max]` is authoritative where
  present). So Push Press shows its low band even if a thin pool forces it onto a hypertrophy
  day; Step-Up never shows 3-6.

**The two jobs have different ideal widths (science lens).** A tight window (Push Press) drives
both selection and assignment. A wide window (Step-Up `[8, 15]`) overlaps almost every band, so
it is inert as a selection penalty and buys only the assignment floor. That is acceptable; just
know which job a given window is actually doing.

**Clamp-beats-exclude (v1 default).** The gross-mismatch selection penalty already excludes a
misfit whenever an alternative exists. The clamp only fires when the pool is so thin the misfit
is the only option, and a present primary (clamped to sane reps) beats an empty slot. A
hard-exclude for true power lifts (never seat a clean on a hypertrophy day even if it means
under-filling) is a noted future option, not v1.

Seed windows only where the bias/goal range misfires (the ~10-25 exceptions):

- Power / explosive (`explosive` attribute, low ceiling): clean variants `[1, 5]` (the worst
  offenders, a clean at 8-12 is incoherent); Push Press `[3, 5]`; high-pull / snatch-grip pulls
  `[3, 6]` if present.
- Load-limited / stability-limited (raised floor): Step-Up `[8, 15]`; Bulgarian / rear-foot
  split squat `[6, 15]`; Walking Lunge `[8, 20]`.
- Small-muscle isolation that sub-8 loading just turns into momentum, a real misfire under
  Strength / lose_fat shifts: Lateral Raise / Rear Delt Fly / Cable Lateral `[10, 25]`; Face
  Pull `[10, 20]`.
- Joint-stress safety: flyes / Pec Deck `[8, 20]` (heavy low-rep flyes are a shoulder-capsule
  liability).
- **Leave NULL (do NOT seed):** true barbell/machine compounds (Front Squat, Hack Squat, Leg
  Press, the main presses and squats). These legitimately belong at 3-6 under Strength and 8-15
  under hypertrophy, and the bias/goal chain already handles them. Seeding a window on a real
  barbell compound is where a window does damage. The risk is seeding too many, not too few.

The clamp is a pure helper, `clampRepsToWindow(band, ex)`, applied in the assignment path
alongside `floorRepRangeForLoad`. Nameless exercises have no window -> no clamp -> goldens hold.

## 5. Weekly isolation-repetition soft cap

Thread a `Map<exerciseId, number>` of routine-wide prior selections (like the existing `used`
set, but counted). Each prior selection of the **same exercise** adds the saturating
`repeatPenalty` to its `contextScore` on non-anchor patterns, so a fresh alternative of even
modestly lower quality wins, while a thin pool can still repeat (soft, never a hard block).

This strengthens today's binary `used` preference into a count-scaled one, and complements
substitution-class freshness (that dedups *variants*; this caps literal *repeats*). It is the
structural fix for Pullover over-selection.

**Tripwire (science lens):** the repeat penalty is non-anchor only by design, because repeating
the same squat or bench across the week is *correct* frequency, not a fault. Whoever later
extends the cap must keep it off `COMPOUND_ANCHOR_PATTERNS`, or it will punish correct frequency
(and would collide with the `consistent` variety preference, which pins the same anchor across
same-focus days on purpose).

**Pullover, fixed mechanically + a code-truth bug surfaced in review.** The recurrence is fixed
by the cap. Separately, the calibration migration (`2026-06-16-13-33-44`) re-tagged
**Straight-Arm Pulldown** to `back_iso` / non-compound, but it was never added to
`ISOLATION_QUALITY`, so today it scores `NEUTRAL_QUALITY` (0.80), *below* Dumbbell Pullover's
0.85. The better lat isolation currently loses to the one we want to demote. The quality seed
fixes this as a **peer re-ranking** (Straight-Arm Pulldown high, ~0.95; Pullover at its true
lower value, ~0.70-0.75), which also defuses the red-team's double-correction / oscillation
worry: the alternative the cap rotates toward is now a *good* peer, not a mediocre one. (The
`back_iso` bucket conflates lat-width, trap, and rear-delt sub-regions; a finer split is a noted
taxonomy follow-up, not this spec.)

A test asserts both that the cap alone reduces Pullover frequency AND that the rotation target
is Straight-Arm Pulldown (a good peer), not week-to-week oscillation between mediocre options.

## 6. Compound-carryover credit (WARNING layer only): a per-pattern map, NOT a flat fraction

`muscleCoverageGaps` currently compares **direct** sets to `MUSCLE_SET_TARGETS.min`. The change:
compare a measure that credits a compound's secondary muscles, but only for movement -> muscle
pairs where the carryover is physiologically real.

**A flat 0.5 was rejected (all three reviewers, decisive).** A flat fraction over "secondary
sets from compounds" would credit `squat -> hamstrings` and silently suppress a genuine
hamstring gap. Hamstring undertraining is one of the most common and most injurious real-world
programming holes, so a false negative there is worse than the false-positive warnings the
credit is meant to remove. The safe direction is to **under-credit**: a sparse map, default 0.0.

```
// pattern -> secondary muscle -> credit fraction. Unlisted pair = 0 (no credit, warning fires).
const CARRYOVER_CREDITS: Partial<Record<MovementPattern, Partial<Record<Muscle, number>>>> = {
  horizontal_push: { triceps: 0.5, front_delts: 0.5 },
  vertical_push:   { triceps: 0.5, front_delts: 0.5 },
  horizontal_pull: { biceps: 0.5, rear_delts: 0.5 },
  vertical_pull:   { biceps: 0.5 },
  // squat / hinge / lunge: NOTHING. Hamstring, glute, and quad gaps still warn.
};
coverageSets(muscle) = directSets(muscle)
  + sum over compound rows R with secondary S == muscle of:
      sets(R) * (CARRYOVER_CREDITS[R.pattern]?.[muscle] ?? 0)
```

- Only **compounds** carry over (an isolation's secondary contribution is negligible). The
  existing `effective` measure cannot be reused: it credits all exercises (isolations included)
  and all secondaries flatly, which is exactly the over-credit being avoided.
- **Warnings only.** `weeklyMuscleSets` and `gapFill.ts` are untouched; gap-fill stays
  direct-only. The divergence is intentional and documented: gap-fill guarantees a floor of
  dedicated direct isolation, while the warning stops nagging about a muscle a compound already
  trains indirectly (a push-heavy week no longer fires a false "triceps low"). Because the
  credited pairs (press->triceps, pull->biceps, etc.) are exactly the muscles gap-fill can also
  service, the two systems stay aligned; the dangerous misalignment (warning says "covered"
  while a real gap persists) only arises for the uncredited pairs, which is why squat->hamstring
  is zero.
- **Keep the carryover number off the UI.** It lives only inside `muscleCoverageGaps`. Surfacing
  a carryover-adjusted "covered" badge next to a routine where gap-fill added direct work would
  read as contradictory; invisible, it never does.

No-data guard and pool-scope guard in `muscleCoverageGaps` are unchanged, so unattributed /
synthetic pools still return `[]`.

## 7. Constants (named, exported, test-locked)

| Constant | Default | Rationale |
|----------|---------|-----------|
| `NEUTRAL_QUALITY` | 0.80 | existing; `quality` NULL fallback |
| `STYLE_AFFINITY_MAX` | 0.25 | upper bound on the accessory style bump |
| `ATTRIBUTE_BUMP` | 0.10 | per matched preferred attribute |
| `REP_FIT_BONUS_MAX` | 0.10 | graded overlap tiebreak; below quality/style |
| `REPEAT_PENALTY` | `[0, -0.50, -0.75, -0.85]` | saturating by prior count, capped at -0.85 |
| `CARRYOVER_CREDITS` | per-pattern map above | warning-only compound-secondary credit; unlisted pair = 0 |

The gross rep-mismatch is a comparator layer (a sort precedence), not a magnitude, so it has no
coefficient to tune.

## 8. Migration and seeding

One dated migration (`docs/migrations/`, hand-apply on merge):

- `ALTER TABLE exercises ADD COLUMN quality numeric(3,2), rep_min smallint, rep_max smallint,
  attributes text[] NOT NULL DEFAULT '{}'`.
- Seed `quality` from the `ISOLATION_QUALITY` map (a direct numeric copy; the map is already
  0-1, so there is no rank distortion). Unseeded rows stay NULL -> 0.80.
- Seed `quality` for the `back_iso` peer re-ranking (add Straight-Arm Pulldown high, lower
  Pullover; section 5).
- Seed `rep_min` / `rep_max` and the `explosive` attribute for the targeted exercises (section 4).
- Seed `attributes` (`incline`, `lengthened_bias`) for the bodybuilding-relevant exercises.

The migration doc includes a **rollback snippet** that resets `quality` to the `ISOLATION_QUALITY`
values for a named set, so a bad seed value can be reverted without a full down-migration.

`ExerciseMeta` gains the four fields; `EXERCISES_SELECT` and the routine-embedded
`exercise:exercises(...)` projection select them; defaults preserve no-op behavior.

`ISOLATION_QUALITY` (the constant) is kept as the migration seed source and as a parity
test-oracle, after which the column is authoritative. (A `quality_source` audit column was
considered and rejected as YAGNI for a two-tester app; git and the seed migration are the record.)

## 9. Testing

- **Goldens:** synthetic byte-identity unchanged (the proof the no-op gate holds).
- **Ordering-invariant tests (logical guarantees, not empirical):** a gross rep-mismatch always
  sorts behind any overlapping candidate; `styleAffinity` can never flip a quality gap greater
  than `STYLE_AFFINITY_MAX`; a first repeat always loses to a fresh peer of higher quality up to
  0.95; anchor patterns never rank by `contextScore.total`.
- **Migration parity:** post-migration `quality` equals `ISOLATION_QUALITY` for every listed
  exercise; unseeded exercises are NULL (read as 0.80).
- **Seed coverage:** every power move has `rep_min`/`rep_max` and the `explosive` attribute;
  every load-limited unilateral has a raised-floor window; the listed bodybuilding exercises
  carry their `attributes` (the mitigation for silent partial-metadata).
- **Rep windows:** Push Press never exceeds its ceiling on any day; Step-Up never below 8.
- **Selection:** Push Press loses to a real press on a hypertrophy day when one is available;
  Incline DB Press leads horizontal_push on a Bodybuilding chest day; Straight-Arm Pulldown
  out-ranks Pullover on a `back_iso` slot.
- **Style distinctiveness:** Bodybuilding's PRIMARY lifts differ from Balanced on the reordered
  patterns (chest/back/leg); Bodybuilding and Balanced produce measurably different exercise
  sets; movement diversity under Bodybuilding is not reduced versus Balanced (the cluster
  watch-item).
- **Weekly cap:** Pullover weekly count drops under the cap alone (no quality change); the
  rotation target is Straight-Arm Pulldown, not oscillation; the penalty saturates.
- **Carryover:** a push-heavy week no longer fires a false triceps-low warning; a squat-heavy
  week with no direct hamstring work STILL fires a hamstring warning (the squat->hamstring-zero
  guarantee); gap-fill output is unchanged by the carryover change.
- **`contextScore` units:** each breakdown term in isolation (quality only, style only, rep-fit
  only, repeat only).
- **Catalogue-consistency:** every name in `STYLE_PROFILES[*].canonicalReorder` exists in the
  seed (mirrors the `CANONICAL_ANCHORS` / `ISOLATION_QUALITY` guard).

## Implementation sequencing (honours the red-team's scope concern)

The red-team argued the five levers should not ship as one undifferentiated change because the
four selection levers (style, rep windows, repeat penalty, quality calibration) are entangled:
a selection shift could come from any of them. We keep one spec but sequence the implementation
so behavior shifts are attributable:

1. **Carryover (orthogonal).** It is the one clean, independent piece (warnings only, no
   selection effect). Ship it first as its own slice with its own tests.
2. **Metadata model + the gross rep-mismatch + rep-window clamp.** Add the columns and the
   assignment/selection plumbing with the ordering-invariant tests.
3. **The entangled selection levers** (style profiles + reorder, `contextScore` replacing
   `ISOLATION_QUALITY`, repeat penalty, quality calibration) together, behind the invariant and
   isolation tests so a regression points at the responsible lever.

## Review reconciliation

### Round 1 (over the chat design)
Adopted: named test-locked constants and an explicit hierarchy; saturating (not linear) repeat
penalty; carryover as a structured tunable; `attributes` separated from the `StyleProfile`
preference; graded rep-fit under a binary gross-mismatch guard; a `contextScore` breakdown object.
Dismissed: a runtime config table (the repo's idiom is exported constants); a `quality_source`
column (YAGNI). Corrected: `ISOLATION_QUALITY` is already numeric (no distortion); `effective`
cannot back the warning carryover (it credits isolations).

### Round 2 (over this spec; science + architecture + red-team)
**Adopted, blocking:**
- **Per-pattern carryover map, default 0.0** (replaces flat 0.5). All three flagged it; the
  decisive case is `squat -> hamstrings` masking a genuine, injurious gap. Section 6.
- **Expand the style primary reorder to ~3 patterns** (user-confirmed). A soft affinity alone
  leaves the big lifts identical across styles, so styles stayed samey; the reorder is the strong
  lever. Reframed style as two levers, not one nudge. Section 3.

**Adopted, non-blocking:**
- Expanded rep-window seed (clean variants, lateral raise / fly / face pull, split-squat /
  lunge floors), and the explicit "leave true barbell/machine compounds NULL" guardrail. Section 4.
- The Straight-Arm Pulldown quality bug (a live inversion the calibration left), fixed as a peer
  re-ranking. Section 5.
- Ordering-invariant tests, the anchor-never-uses-`contextScore.total` guard, seed-coverage tests,
  and a rollback snippet. Sections 2, 8, 9.
- Implementation sequencing with carryover as the orthogonal first slice (honours the scope
  concern without splitting the spec). Honest scope note that volume distribution is the deferred
  40% of style distinctiveness. Sections "Implementation sequencing", Non-goals, 3.
- Documented: clamp-beats-exclude default (+ hard-exclude-for-power-lifts as future); keep the
  carryover number off the UI; the repeat-cap-must-stay-off-anchors tripwire; the
  `lengthened_bias`-buys-selection-not-ROM honesty note; the emergent-cluster watch-item.

**Dismissed / deferred with reason:** deriving `canonicalReorder` from `attributes` instead of
name lists (explicit lists win on clarity for v1; the expansion strengthens the deferred case,
not a v1 change); a finer `back_iso` sub-region split (taxonomy follow-up); per-exercise or
per-muscle carryover fractions beyond the credited families (the sparse map is the safe v1).

**Corrected reviewer slips (verified against code):** the red-team's clamp scenario placed Push
Press on `horizontal_push`; it is `vertical_push` (the point holds with the corrected example).
The flat-fraction "tested against real programs" suggestion is moot once the map defaults to 0.0.

**Triangulation rulings (red-team Part 2):** carryover shape -> side with the science lens
(per-pattern map, adopted). Style strength -> the debate was misframed; the real lever is reorder
coverage, not the 0.25 cap, so we expanded the reorder and kept the cap. Scope -> keep one spec
but sequence the implementation (carryover first), which captures the red-team's separability
point without the overhead of two specs.

## Open questions (resolved or remaining)

1. ~~Carryover fraction defensibility~~ -> RESOLVED: per-pattern map, default 0.0, only the
   strong arm/delt families credited. Remaining: confirm the exact credited fractions (all 0.5
   for now) against any literature the loop surfaces.
2. The seeded rep windows: confirm the values (Push Press `[3,5]`, clean variants `[1,5]`,
   lateral raise `[10,25]`, etc.) are right and the list is complete.
3. The Bodybuilding `canonicalReorder` targets: which exact machine/cable/incline primary leads
   each of the three reordered patterns, given the real catalogue.

## Deferred / future

- Derive `canonicalReorder` from `attributes` once the attribute vocab is stable (retires the
  growing name-keyed surface).
- A finer `back_iso` split (lat-width / trap / rear-delt sub-regions).
- Per-exercise or per-muscle carryover fractions.
- Hard-exclude (not clamp) for true power lifts on incompatible days.
- A `quality` column for compounds (today compounds rank by `anchorRank` + fatigue, not quality).
- The Step-Up knee-contraindication data inconsistency (a separate catalogue cleanup the quality
  audit flagged; not a scoring change).
- The volume-distribution planner, which delivers the remaining ~40% of style distinctiveness.
- An `anchor_rank` column to retire the name-keyed `CANONICAL_ANCHORS`.
