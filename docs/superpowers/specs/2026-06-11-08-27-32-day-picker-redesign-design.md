# Day-picker redesign (Issue 0), design spec

**Status: DRAFT, spec-first.** Not approved to build. Like every prior engine/UX change this session, it should go through the review loop (science/UX lens + architecture lens) and have its open questions resolved before TDD. **It is the unblocker for Item 5** (`ppl-x2-6` A/B differentiation) in the generation engine quality track: the 6-day split is unreachable until the day picker can express six training days, so Item 5's 6-day path cannot be generated or tested end-to-end today.

---

## 1. Problem

The "days per week" input is a **coarse three-bucket selector** and the quick flow (the only live entry point) caps it below six, so a six-day trainee can never get a six-day routine.

Verified against the live code (2026-06-11):

- `DAYS_PER_WEEK_OPTIONS = ['2-3', '4', '5-6']` (`recommendation.ts:6`). The answer is a bucket, not an exact count, and the top bucket `'5-6'` is ambiguous.
- Both real entry points, `OnboardingModal` and `GenerateRoutineButton`, render `RoutineSetupFlow` with `mode="quick"`.
- **Quick mode is a fixed six steps** (equipment, experience, goal, days/week, session time, confirm+start) and **skips the "which days" step**, seeding `trainingDays` from `SUGGESTED_DAYS[days]` (`RoutineSetupFlow.tsx`).
- `SUGGESTED_DAYS['5-6'] = [1, 2, 3, 4, 5]` (`constants.ts:87`), i.e. **5 days**. So quick mode tops out at `trainingDays.length === 5` and only ever resolves `STYLES[5]`.
- `STYLES[6]` (`ppl-x2-6`) is therefore **unreachable in practice**, even though the engine, `MAX_TRAINING_DAYS['5-6'] = 6` (`constants.ts:96`), and the full flow's "which days" step all support six. No caller invokes the full flow.

Net: the deepest cause is the bucket model (it cannot express "exactly 6"); the proximate cause is quick mode seeding five days from the ambiguous `'5-6'` bucket and skipping the only step that could add a sixth.

## 2. Goal

- A user can choose an **exact** weekly training frequency, including **six days**, through the live (quick) entry point, and get the matching routine (`STYLES[6]` reachable).
- The 6-day path is generatable and **testable end-to-end**, unblocking Item 5.
- No regression to the 2/3/4/5-day flows; existing routines and the golden tests stay intact.
- Onboarding stays short (the quick flow's whole point); do not reintroduce a heavy multi-step day picker.

## 3. Current behaviour (precise)

- `DaysPerWeek = '2-3' | '4' | '5-6'` flows through `OnboardingAnswers.days` into: `recommendTemplate` (`recommendation.ts`), `buildRationale` ("N days/week" copy, `generation.ts`), the generate-action validation (`routines.ts`), and `SUGGESTED_DAYS` / `MAX_TRAINING_DAYS` (`constants.ts`).
- `trainingDays.length` (not `answers.days`) is what actually drives `resolveStyle` / `STYLES[count]` and the session count. The bucket and the real count can already disagree (e.g. `'5-6'` + 5 days), which is the existing latent inconsistency this redesign should also close.
- `answers.days` is **not persisted** on the profile (no `days` column), so there is **no migration**.

## 4. Proposed redesign

**Recommended: replace the three-bucket `DaysPerWeek` with an exact integer frequency (2 to 6).**

- Change `DaysPerWeek` from the string-bucket union to an exact set, e.g. `2 | 3 | 4 | 5 | 6` (a numeric union or a `'2'..'6'` string union; decide in review). `OnboardingAnswers.days` becomes the exact count.
- Rekey `SUGGESTED_DAYS` / `MAX_TRAINING_DAYS` by exact count, with a sensible default weekday layout per count (the sixth day added to today's `'5-6'` layout, e.g. `6 -> [1, 2, 3, 4, 5, 6]`).
- The quick flow seeds `trainingDays = SUGGESTED_DAYS[n]` directly, so picking 6 yields six training days and `STYLES[6]` with no extra step.
- `recommendTemplate` maps exact counts to its structure tiers (beginner/2-3 -> full-body, 4 -> upper-lower, else ppl); `buildRationale` prints the exact number; the generate-action validation accepts the exact set.

This removes the ambiguity at the root: the user states an exact frequency, `trainingDays.length` matches it by construction, and the bucket/count disagreement disappears.

**Alternative (smaller diff): split the top bucket.** Keep the bucket model but replace `'5-6'` with explicit `'5'` and `'6'` (so `DAYS_PER_WEEK_OPTIONS = ['2-3', '4', '5', '6']`), seeding `SUGGESTED_DAYS['6'] = [1, 2, 3, 4, 5, 6]`. Smaller ripple, but it leaves `'2-3'` ambiguous and does not fix the general bucket/count mismatch. Offered as the conservative option if the full retype is judged too broad for now.

## 5. Scope / ripple (no migration)

Files touched by the recommended approach (verified consumers): `recommendation.ts` (the type + `recommendTemplate`), `constants.ts` (`SUGGESTED_DAYS`, `MAX_TRAINING_DAYS`), `generation.ts` (`buildRationale`), `actions/routines.ts` (validation against the new set), `RoutineSetupFlow.tsx` (the picker UI + step seeding), and tests (`constants.test.ts` asserts `SUGGESTED_DAYS['5-6']`; a `buildRationale` test asserts the "4 days/week" string). No DB change (`days` is transient). The generation engine, `STYLES`, and `recommendStyle` already support all counts and need no change.

## 6. Quick-flow handling

The quick flow keeps its six-step shape; only the days/week step changes (bucket picker -> exact-frequency picker). It continues to **auto-seed `trainingDays` from `SUGGESTED_DAYS[n]` and skip the manual "which days" step**, so choosing 6 produces `[1, 2, 3, 4, 5, 6]` with no added friction. The full flow's "which days" step (manual weekday selection up to the count) is unchanged and remains the place to customise exact weekdays.

## 7. Item 5 dependency and test surface

Once six days is reachable through the quick flow:
- Item 5 (`ppl-x2-6` A/B differentiation, its own spec) can be generated and tested end-to-end, since `STYLES[6]` is now produced by a real user path.
- Tests for this issue: the quick flow with frequency 6 yields six `trainingDays` and a `STYLES[6]` (`ppl-x2-6`) routine; `recommendTemplate` / `buildRationale` handle the exact counts; `SUGGESTED_DAYS` / `MAX_TRAINING_DAYS` cover 2 to 6; the 2/3/4/5 paths stay byte-identical (golden) where the layout is unchanged.

## 8. Open questions for the review loop

- **Exact frequency vs split-bucket (Section 4):** adopt the full retype to an exact count (recommended, removes the root ambiguity) or the smaller split-bucket change? This is the central decision and the one with the most ripple.
- **Type shape:** if exact, numeric union `2|3|4|5|6` or string `'2'..'6'`? Numeric reads cleaner for `trainingDays.length` comparisons; string matches the current union style. Pick one for consistency.
- **Default weekday layout for 6 days:** `[1, 2, 3, 4, 5, 6]` (Mon-Sat) is the obvious seed, but a 6-day PPL x2 is commonly run with the rest day placed differently. Confirm the default rest-day placement (and whether the quick flow should expose it at all, or leave weekday customisation to the full flow).
- **`recommendTemplate` mapping:** confirm the exact-count -> structure mapping (does 5 map to ppl, does 6?), since the bucket boundaries change.
- **Onboarding-friction guard:** the quick flow must stay six steps. Confirm the exact-frequency picker is a single step (a 2-to-6 selector), not a return to the multi-day grid.

## 9. Non-goals

- Not Item 5 itself (the A/B differentiation of `ppl-x2-6` is its own spec, written after this ships).
- No change to the generation engine, `STYLES`, `recommendStyle`, or the role model.
- No new persisted column or migration.
- Not a redesign of the full-flow "which days" weekday grid beyond rekeying its cap.
