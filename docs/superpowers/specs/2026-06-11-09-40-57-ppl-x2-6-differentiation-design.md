# `ppl-x2-6` A/B session differentiation (Item 5), design spec

**Status: APPROVED 2026-06-11, in implementation** (branch `feature/ppl-x2-6-differentiation`). The review loop resolved all five open questions; Section 9 below records the decisions and supersedes the open phrasing in Sections 3, 4, and 7. Roadmap: generation engine quality track, Item 5. Unblocked by Issue 0 (day-picker redesign, merged #118): the 6-day path is now reachable from the quick flow and testable end-to-end.

---

## 1. Problem

The 6-day PPL x2 style (`ppl-x2-6`) uses identical emphasis definitions for both push days, both pull days, and both leg days:

```ts
{ focus: 'push', emphasis: 'push', variant: 'A' },
{ focus: 'pull', emphasis: 'pull', variant: 'A' },
{ focus: 'legs', emphasis: 'legs', variant: 'A' },
{ focus: 'push', emphasis: 'push', variant: 'B' },
{ focus: 'pull', emphasis: 'pull', variant: 'B' },
{ focus: 'legs', emphasis: 'legs', variant: 'B' },
```

Verified consequences (live code, 2026-06-11):

- Both leg days run the same slot list (`legs`: squat, hinge, lunge, glute_iso, calf, core) with no quad/posterior split and no heavy/volume contrast.
- Under `consistent` variety, the anchor map keys by `(focus, pattern)`, so Legs A and Legs B share the same squat AND the same hinge anchor; push/pull likewise share their compounds. With identical slot lists and identical bias, the A and B sessions are near-clones: same lifts, same order class, same rep ranges. This is the 6-day equivalent of the cross-focus collapse already fixed in `ulppl-5`.
- Under `varied`, the avoid-set forces different exercise picks, but the structure is still undifferentiated: same bias, same slot order, no designed contrast.

## 2. Goal

- Each A/B pair differs **by design**: a quad-led vs posterior-led leg split, and a heavy vs volume contrast on push and pull.
- Zero behavior change to every other style: the existing `push` / `pull` / `legs` emphases stay untouched because `ppl-3`, `ppl-fb-4`, `pplul-5`, and `ulppl-5` use them.
- Pure data: `EMPHASES` entries + the `STYLES[6]` session list + the `EmphasisKey` union. No engine logic, no migration, no UI change.

## 3. Proposed design

### 3.1 New `STYLES[6][0]` session list

```ts
{ focus: 'push', emphasis: 'push_heavy',   variant: 'A' },
{ focus: 'pull', emphasis: 'pull_heavy',   variant: 'A' },
{ focus: 'legs', emphasis: 'lower_quad',   variant: 'A' },
{ focus: 'push', emphasis: 'push_volume',  variant: 'B' },
{ focus: 'pull', emphasis: 'pull_volume',  variant: 'B' },
{ focus: 'legs', emphasis: 'lower_post',   variant: 'B' },
```

- **Legs A/B reuse `lower_quad` / `lower_post`** (the proven quad/posterior pair from `ul-classic-4` and `ulppl-5`), unmodified. Reuse, not new `legs_*` emphases: the split is identical in intent, and one definition per concept keeps future edits in one place. Note the coupling: a later edit to either emphasis now also touches the 6-day style.
- `focus` strings stay `push` / `pull` / `legs` (so `workout_type`, tabs, and the schedule pinning are untouched). The `consistent` anchor still keys `(focus, pattern)`, which is exactly what we want: Push A and Push B share the same bench (progressive overload), while the slot order and bias differentiate the sessions.
- `bestFor` copy: "Six days, each muscle group twice: a heavy A block and a volume B block." (user-visible; no em dashes).

### 3.2 Four new emphases (additive; `EmphasisKey` union extends)

```ts
push_heavy:  { bias: 'strength',    slots: ['horizontal_push', 'vertical_push', 'chest_iso', 'shoulder_iso', 'triceps_iso', 'triceps_iso'] },
push_volume: { bias: 'hypertrophy', slots: ['vertical_push', 'horizontal_push', 'shoulder_iso', 'chest_iso', 'triceps_iso', 'triceps_iso'] },
pull_heavy:  { bias: 'strength',    slots: ['horizontal_pull', 'vertical_pull', 'back_iso', 'shoulder_iso', 'biceps_iso', 'back_iso'] },
pull_volume: { bias: 'hypertrophy', slots: ['vertical_pull', 'horizontal_pull', 'back_iso', 'biceps_iso', 'shoulder_iso', 'back_iso'] },
```

- The `_heavy` slot lists match today's `push` / `pull` compositions (including the deliberate doubled 6th slot, 2x `triceps_iso` / 2x `back_iso`, which sits exactly at the max-2-per-pattern cap); only the bias changes to `strength`.
- The `_volume` lists swap the two compound slots so the B day's lead pattern (OHP / vertical pull) gets the freshest pick and the earliest backfill priority.

## 4. What the contrast actually delivers (and what it does not)

Be precise here; the review should sign off on these mechanics, not on a looser reading.

- **Bias contrast (the strong axis):** A days train strength bias: compounds at 3-6 reps (`repRange('strength', true)`), accessories 10-15, and the session's first compound takes the +1 set bump. B days train hypertrophy: compounds 8-12, accessories 12-15, no bump.
- **Selection contrast:** the lead slot is filled first and drives backfill priority, so under `varied` the B day's lead pattern gets the fresh pick. Under `consistent` the anchors intentionally keep the same main lifts across A/B; the contrast there is bias + slot priority, not exercise identity.
- **Presentation order is NOT guaranteed by slot order.** The exercise role model (`orderByRole`) orders the session, and within the Upper bucket it ranks canonical -> fatigue desc -> push-before-pull -> id. On `push_volume` under `consistent`, Bench (canonical rank 0, fatigue 4+) and OHP (canonical rank 0, lower fatigue) both land rank-0 canonical, so Bench may still display first even though OHP led selection. "OHP-led" therefore means "OHP gets selection freshness and backfill priority", not "OHP is printed first". v1 accepts this; forcing display order would need a role-model hook (out of scope, see open questions).
- **Training-style interplay:** a non-balanced `TrainingStyle` remaps both biases through `BIAS_REMAP` (e.g. `strength` style remaps hypertrophy -> strength, collapsing the A/B rep contrast; `bodybuilding` collapses it the other way). Accepted: this is exactly how the style axis already behaves everywhere else, and `balanced` (the default) preserves the contrast.
- **Dumbbell-only users:** `pull_volume` leads with `vertical_pull`, which no-ops without a pull-up bar / cables / machines; the equipment filter skips it and backfill covers (the same behavior the existing `pull` emphasis has). Their Pull B contrast is bias-only.

## 5. Scope / ripple

- `src/lib/pulse/types.ts`: `EmphasisKey` union + 4 keys.
- `src/lib/pulse/generation.ts`: 4 `EMPHASES` entries + the `STYLES[6][0]` session list + `bestFor` copy. Nothing else.
- No engine logic change, no migration, no action/route/UI change, no new persisted value.
- Every other style is byte-identical by construction (existing emphases untouched); the engine-change guard and golden identity tests must stay green unmodified.

## 6. Test surface (inventory verified against the live suite, 2026-06-11)

New tests:

- Golden composition tests per new emphasis (roadmap requirement): with the deep pool, Push A contains a horizontal push compound at 3-6 reps with the 4-set bump; Push B compounds at 8-12, no bump (balanced style); same shape for Pull A/B; Legs A has squat + lunge and no hinge; Legs B has hinge + glute_iso and no squat.
- `consistent`: Push A and Push B share the same horizontal_push anchor (same bench both days).
- Byte-identity: `ppl-3` / `ul-classic-4` / `ulppl-5` blueprints unchanged against the pre-change goldens.

Rebaseline inventory. Four existing tests build their premise on BOTH legs days sharing a slot, which the quad/posterior split removes. The invariants they test are untouched; only the premise must migrate to a pattern that still appears twice (push A/B `horizontal_push` is the natural home). Confirm each old -> new at implementation time:

1. `generation.test.ts` ~1405 "fresh lower-fatigue anchor still beats a used higher-fatigue one": legs x2 squat -> push x2 horizontal_push (fresh bench-aa vs used bench-zz).
2. `generation.test.ts` ~1421 GQ3 substitution-class dedup: legs x2 hinge (two RDL variants + Good Morning) -> push x2 horizontal_push (two same-class press variants + a distinct-class press).
3. `generation.test.ts` ~1226 loading-lean "fresh non-preferred beats used preferred across two same-focus sessions": legs x2 squat -> push x2 horizontal_push.
4. `generation.test.ts` ~1935 "same-focus sessions STILL share the pattern anchor": legs x2 squat anchor -> push x2 horizontal_push anchor.

Survivors (verified compatible): the trainingStyle balanced-identity archetype table (~660, compares the same style against itself, both sides change together); "6-day PPL + strength: exactly one bumped compound per session" (~711, every bias remaps to a bump under `strength` style, count stays 6); GQ2 glute_iso fresh-wins (~1350, both `lower_quad` and `lower_post` still carry `glute_iso`); the Issue 0 quick-flow test (asserts the style key only).

## 7. Open questions for the review loop

1. **B-day bias:** `hypertrophy` (proposed) vs `pump` vs `balanced`? Hypertrophy is the conventional volume-day pairing for PPL x2 and keeps compounds meaningfully loaded (8-12); pump would push compounds to 12-15.
2. **Legs bias contrast:** proposal keeps both leg days `hypertrophy` (pure quad/posterior contrast, reusing the proven pair). Alternative: a `strength`-biased Legs A (heavy squat day) to mirror the push/pull heavy/volume shape; that needs a new `lower_quad_heavy` emphasis instead of reuse. Which does the science lens prefer for a general-population 6-day trainee?
3. **Weekly fatigue shape:** the A block (Push A strength, Pull A strength) puts two strength-biased days back to back at the week's start (Legs A stays hypertrophy under the proposal). Acceptable, or should heavy days be interleaved (e.g. Push A heavy / Pull B volume ordering)? Note the day-to-session mapping is positional (session i -> trainingDays[i], Mon-Sat by default).
4. **Doubled 6th slots:** keep the deliberate 2x triceps_iso / 2x back_iso on BOTH push/pull days (12 weekly iso slots at 45-60 min), or trim one side?
5. **Presentation-order nuance (Section 4):** is selection-priority-without-display-guarantee acceptable for v1?

## 8. Non-goals

- No engine or role-model logic change (display-order forcing is explicitly out).
- No per-session schedule labels (that is the separate Bug 6 relabel follow-up with its own migration).
- No change to the existing `push` / `pull` / `legs` / `lower_quad` / `lower_post` emphasis definitions.
- No migration; nothing persisted changes shape.

## 9. Review decisions (resolved 2026-06-11)

- **Q1, A/B bias pairing:** strength/hypertrophy, as proposed. Push A / Pull A strength (compounds 3-6, +1 set bump on the first compound); Push B / Pull B hypertrophy (compounds 8-12, no bump).
- **Q2, legs bias:** both leg days stay hypertrophy; no `lower_quad_heavy`. The quad/posterior structural contrast is the differentiation; a strength Legs A would stack three consecutive heavy sessions (Mon-Wed), too aggressive for a general-population intermediate.
- **Q3, consecutive heavy days:** Push A Monday + Pull A Tuesday is accepted (opposing muscle groups; literature shows similar strength/composition outcomes for consecutive vs non-consecutive days in recreationally trained subjects). No interleaving.
- **Q4, doubled isolation slots:** trimmed from the HEAVY days only. `push_heavy` carries 1x `triceps_iso`, `pull_heavy` 1x `back_iso` (the strength day already carries the set bump, and 2x isolation there exceeds MAV alongside indirect work from two pressing/pulling compounds); `push_volume` keeps 2x `triceps_iso`, `pull_volume` keeps 2x `back_iso`. Weekly: 3 triceps-iso and 3 back-iso slots. This supersedes Section 3.2's heavy slot lists: `push_heavy` = [horizontal_push, vertical_push, chest_iso, shoulder_iso, triceps_iso]; `pull_heavy` = [horizontal_pull, vertical_pull, back_iso, shoulder_iso, biceps_iso].
- **Q4 consequence (found at implementation, accepted):** the heavy emphases now have 5 slots while a 45-60 min intermediate session targets 6 exercises, so the 6th comes from backfill and lands deterministically on the lead compound pattern (patterns tie at one use, the stable sort keeps slot order, horizontal push/pull is first): the heavy day gets a second horizontal push/pull variant at strength reps. This reads as heavy-day compound volume rather than undesigned filler, and it respects the max-2-per-pattern cap; if review later prefers a deliberate 6th slot, it is a one-line append. It also means the four migrated tests (Section 6) pin `sessionTime: '~30 min'` (4 exercises = no backfill) so their premise stays single-slot-per-pattern.
- **Q5, display order:** accepted for v1. "Led" means selection freshness + backfill priority; the role model may still display the bench variant first via canonical-rank ordering. No display-order forcing mechanism.
- **Architecture (share by contract):** reusing `lower_quad` / `lower_post` across `ul-classic-4`, `ulppl-5`, and now `ppl-x2-6` is correct because the emphasis contract (movement intent, slot constraints, ordering assumptions) is identical across consumers; a comment in `STYLES[6]` makes the intentional share and its blast radius explicit.
