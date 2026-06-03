# feat/supersets branch review

Date: 2026-06-03

## What was reviewed

This report covers the `feat/supersets` branch, based on current `main` (which already includes the Slate redesign). The branch adds a SUPERSETS feature (pair/unpair exercises, grouped rendering in the log and workout mode, a superset-aware rest timer) plus an exercise-instructions spec and plan that are docs-only.

Methodology: a multi-agent review by dimension (correctness, data model and migration, API security, Slate compliance, tests, integration and merge risk) with adversarial verification. Each agent had to confirm findings against the actual code at a real file:line. 7 candidate findings were refuted and removed. The findings below are the ones that survived verification.

## Slate redesign compliance (verdict first)

Verdict: PARTIALLY applied.

The new superset UI does not fully follow the Slate redesign. `SupersetCard` reintroduces design patterns the rest of the restyled app removed: a persistent coral outline, coral-tinted header chrome, an internal hairline divider, and emoji/unicode glyphs. The `RoutinesTab` Unpair button uses a raw red outside the pulse token palette. The `WorkoutModeScreen` superset additions themselves are on-Slate.

Specifics that break Slate (surfaces separate by tone shift and whitespace not borders; only the active/pending row is outlined; coral is the single accent; restrained typography):

- `src/components/pulse/SupersetCard.tsx:37` wraps the whole card in `border border-pulse-accent/35` permanently, regardless of active state. The sibling `ExerciseCard.tsx:73` uses a borderless `rounded-2xl bg-pulse-surface`. The shared `CARD` constant in `ui.ts:29` is `bg-pulse-surface rounded-2xl p-4` with no border.
- `src/components/pulse/SupersetCard.tsx:43` gives the header a standing `bg-pulse-accent/10 border-b border-pulse-accent/20`. `ExerciseCard.tsx:78` header is `bg-transparent border-none`.
- `src/components/pulse/SupersetCard.tsx:71` separates the two exercises with a hairline `h-px bg-pulse-border` divider instead of whitespace.
- `src/components/pulse/views/library/RoutinesTab.tsx:116` uses `text-red-400` for Unpair. The sibling Remove (`RoutinesTab.tsx:123`) and Delete routine (`RoutinesTab.tsx:388`) use `text-pulse-dim`; the adjacent Pair button (`RoutinesTab.tsx:109`) uses `text-pulse-accent`.
- `src/components/pulse/SupersetCard.tsx:45,52` use the emoji glyph `⚡ Superset` and unicode chevrons `▲`/`▼`. `ExerciseCard.tsx:125-135` uses a styled inline SVG chevron with `currentColor`/`text-pulse-muted`.

On-Slate (no change needed): the `WorkoutModeScreen` superset additions (SingleStep/PairStep, coral-free header label, neutral `bg-pulse-border` divider at line 118, `text-pulse-text`/`text-pulse-muted` typography). The pre-existing `text-black` on the footer CTA (`WorkoutModeScreen.tsx:268,276`) is not from this branch; canonical is `text-pulse-bg`.

To reach FULLY applied: drop the persistent coral outline and header wash from `SupersetCard`, convey grouping by a tone shift (`bg-pulse-surface-2`) and whitespace, reuse the shared `CARD` constant, replace the emoji and unicode chevrons with the `ExerciseCard` SVG pattern, and change Unpair to `text-pulse-dim`.

## Executive summary

| Severity | Count |
|----------|-------|
| High     | 2     |
| Medium   | 6     |
| Low      | 14    |
| Info     | 6     |
| Total    | 28    |

## Correctness

**PR badge regression in Workout Mode** `HIGH`
`src/components/pulse/WorkoutModeScreen.tsx:47-63 (SingleStep), 99-143 (PairStep)`
Evidence: the refactor extracted SingleStep and PairStep, but neither computes or passes the `isPR` prop to `<SetLogger>`. The pre-refactor code did `const isPR = !!(entry?.saved && isSetPR(entry.kg, entry.reps, re.id, prMap));` and passed `isPR={isPR}`. SetLogger still only renders the badge when `isPR` is true (`SetLogger.tsx:226`). Running `bunx vitest run src/components/pulse/__tests__/WorkoutModeScreen.test.tsx` fails at line 103 ("renders a PR tag on a saved set that beats the exercise best"): 1 failed, 11 passed.
Why it matters: a previously passing test now fails and the PR badge no longer appears for any saved set in Workout Mode, for both singles and pairs. This is a user-visible regression.
Recommendation: in both SingleStep and PairStep, recompute `isPR` per set and pass `isPR={isPR}` to SetLogger. Pass `prMap` down (already available via `usePulse` in the parent).

**Moving a superset pair past an adjacent pair breaks the second pair's adjacency** `HIGH`
`src/components/pulse/views/library/RoutinesTab.tsx:263-275 (paired branch of handleMove)`
Evidence: with `[A,B(g1),C,D(g2)]`, moving g1 down does `below = reordered.splice(si+1,1)` which removes only C, then `reordered.splice(fi,0,C)`, producing `[C,A,B,D]`. C(g2) and D(g2) are now non-adjacent. `groupExercises` (`utils.ts:381-399`) only groups when `exercises[i+1]` shares the same `superset_group_id`, so g2 renders as two single cards even though both rows still carry `superset_group_id=g2` in the DB.
Why it matters: the reorder moves only one element of the target pair, corrupting the group's adjacency invariant. The superset dissolves visually with no error, DB and UI diverge, and the rest-timer grouping that relies on adjacency misbehaves.
Recommendation: when the element being skipped over is part of a superset, move both members of that neighbor pair together. Detect the neighbor's group and splice the contiguous pair, mirroring the single-moving branch.

**Rest timer never fires in variant (A/B) workouts** `MEDIUM`
`src/components/pulse/views/LogView.tsx:81 (handleSave) vs 71-76 / 155`
Evidence: WorkoutModeScreen renders with `exercises={workoutExercises}` (variant-filtered, line 155), but `onSave` is `handleSave`, which resolves the saved exercise via `routineExercises.find((r) => r.id === rid)` (line 81) where `routineExercises` is the non-variant base list (line 46). When `session.variant` is set, `workoutExercises` comes from the `${baseType}:${variant}` key (lines 73-75) whose rows have different ids. `routineExercises.find` returns undefined and `handleSave` returns early at line 82, so `fireTrigger` never runs and no rest timer starts during a variant workout.
Why it matters: rest timer is a core logging feature; it silently stops in variant workouts. `updateLog` at line 79 still runs so data is saved, making the bug easy to miss.
Recommendation: resolve the exercise/partner from the same list shown in the active context. Pass the variant-aware list into the lookup, or have WorkoutModeScreen compute the rest-timer decision from its own `exercises` prop.

**Two-member-per-group assumption is unenforced** `LOW`
`src/lib/pulse/utils.ts:381-399 (groupExercises); src/components/pulse/views/LogView.tsx:84-96 (partner lookup)`
Evidence: `groupExercises` only pairs `exercises[i]` with `exercises[i+1]` (advances `i+=2`), so a group_id on 3+ adjacent rows groups the first two and renders the third as a single. The partner lookup uses `routineExercises.find(r => r.superset_group_id === group && r.id !== exercise.id)` (lines 85-86), returning an arbitrary first match if more than one partner exists. The migration adds only a nullable UUID column with no constraint limiting a group to two rows.
Why it matters: the pair invariant lives only in the POST route. Any other path that sets `superset_group_id` (manual SQL, future bulk clone, a partial unpair) can produce a 3+ group the UI mis-renders and whose rest timer picks an arbitrary partner.
Recommendation: document and ideally enforce the two-member invariant (partial unique/exclusion constraint or count check). At minimum, handle a >2 group defensively instead of relying on adjacency luck.

**Non-atomic superset write in the pair route** `LOW`
`src/app/api/pulse/supersets/route.ts:49-56`
Evidence: POST does a single `.update({superset_group_id: groupId}).in('id', [a,b])` with no transaction. If it updates one row then fails, one exercise is left orphaned in a half-formed group, which `groupExercises` renders as a normal exercise while the DB thinks it is supersetted.
Why it matters: a partial failure produces a single-member group, breaking the pair invariant silently.
Recommendation: wrap the paired update in an RPC/transaction, or verify both rows updated and roll back on partial failure.

## Data model and migration

**No constraint prevents a group spanning more than two rows or two routines** `LOW`
`docs/migrations/2026-05-31-supersets.sql:2-7`
Evidence: the migration only adds `superset_group_id UUID DEFAULT NULL` plus a partial index. There is no constraint limiting a group to two members or tying members to the same `routine_id`. The consumer model assumes pairs: `ExerciseItem = RoutineExercise | [RoutineExercise, RoutineExercise]` (`types.ts:165`) and `groupExercises` emits at most a 2-tuple (`utils.ts:391`). The POST route rejects 3+ at write time (`route.ts:45-47`), so today the only ways to exceed two are the orphan/reorder paths above or direct DB writes.
Why it matters: the schema permits N-member and cross-routine groups; the model relies entirely on application code holding the invariant. A 3-member group renders the third as an unpaired single while still flagged paired.
Recommendation: document the "exactly two, same routine, adjacent order" invariant in the migration and consider enforcing it (deferred constraint/trigger checking count = 2 and a single routine_id). At minimum add the routine_id scope as a comment.

**API routes duplicate UUID_RE and bypass the shared auth helper** `LOW`
`src/app/api/pulse/supersets/route.ts:4,8` (also `[groupId]/route.ts:4`)
Evidence: both routes define a local `UUID_RE` that accepts any version/variant, diverging from the canonical v4-strict export in `utils.ts:20`. Both also inline `await supabase.auth.getUser()` + manual 401 instead of `getUserOrUnauthorized` from `auth.ts:29`. `actions.ts` already imports the canonical `UUID_RE`.
Why it matters: the audit centralized `UUID_RE` and `getUserOrUnauthorized` so routes do not diverge. The looser regex accepts non-v4 ids the rest of the app rejects, and the hand-rolled 401 duplicates the contract.
Recommendation: import `UUID_RE` from `@/lib/pulse/utils` and use `getUserOrUnauthorized` from `@/lib/pulse/auth` in both routes. (Note: this finding overlaps the API security and integration sections below, which raise the same point.)

**Merge-conflict surface on shared SELECT strings and types** `LOW`
`src/lib/pulse/queries.ts:17-21`
Evidence: this branch edits `ROUTINES_SELECT` (`queries.ts:19`), the `addExerciseToRoutine` returning select (`actions.ts:417`), and `RoutineExercise`/`ExerciseItem` (`types.ts:161-165`, `utils.ts:381-399`). `feature/rich-set-types` also edits `queries.ts`, `actions.ts`, and `types.ts`.
Why it matters: both branches add columns to the same select string and fields to the same interface, so textual conflicts on `queries.ts:19`, `actions.ts:417`, and `types.ts:150-163` are likely. See the dedicated merge-risk note for the verified, narrower picture.
Recommendation: whoever merges second should re-add the other branch's column rather than taking one side wholesale, and union the new fields. Consider extracting the `routine_exercises` column list into one shared constant.

**superset_group_id is nullable, backward compatible, and covered by existing RLS** `INFO`
`docs/migrations/2026-05-31-supersets.sql:2-3`
Evidence: the column is `UUID DEFAULT NULL`, so existing rows get NULL and `groupExercises` treats NULL as unpaired (`utils.ts:387`). `routine_exercises` already has RLS `FOR ALL` with an ownership EXISTS check (`docs/migrations/2026-05-26-exercise-library-schema.sql:98-108`); RLS is row-level so the new column is automatically protected. The later RLS migration (`2026-06-03-enable-rls-core-tables.sql`) intentionally covers only set_logs/profiles/bodyweight_logs/exercise_notes.
Why it matters: confirms the backward-compatibility and RLS-coverage concerns from the brief are satisfied. No RLS change is needed for this migration.
Recommendation: optionally add a one-line comment noting RLS is inherited from `routine_exercises`.

**superset_group_id added to all read paths consistently** `INFO`
`src/lib/pulse/queries.ts:19`
Evidence: `ROUTINES_SELECT` now selects `superset_group_id` (`queries.ts:19`), and `addExerciseToRoutine`'s returning select includes it (`actions.ts:417`). `RoutineExercise` declares `superset_group_id: string | null` (`types.ts:161`). New rows omit the column and rely on DB default NULL (`actions.ts:406-415`).
Why it matters: confirms the "is the select updated everywhere it is read" check passes for this column. Every consumer reads the field the loaders return.
Recommendation: no change for supersets. Pre-existing and unrelated: `ROUTINES_SELECT` still does not select `variant` even though `RoutineExercise.variant` is typed non-undefined (`types.ts:160`).

## API security

**Adjacency check assumes contiguous order values that deletes do not maintain** `MEDIUM`
`src/app/api/pulse/supersets/route.ts:40-44`
Evidence: the route computes `minOrder`/`maxOrder` and rejects unless `maxOrder - minOrder === 1`. But `removeExerciseFromRoutine` (`actions.ts:430-432`) deletes a row without renumbering, and `addExerciseToRoutine` (`actions.ts:402`) uses `max(order)+1`. Only `reorderRoutineExercises` (`actions.ts:475`) renormalizes. So after any delete the order sequence has gaps (e.g. 1,2,4,5), and two visually adjacent exercises can have order values differing by 2.
Why it matters: two genuinely adjacent exercises get rejected with "Exercises must be adjacent in the routine" whenever a gap exists. Pairing silently breaks for any routine the user has edited by deleting an exercise.
Recommendation: fetch all `routine_exercises` for the shared `routine_id`, sort by order, and verify the two ids occupy consecutive positions. Do not subtract raw order values.

**Routes hand-roll auth instead of getUserOrUnauthorized** `LOW`
`src/app/api/pulse/supersets/route.ts:7-9` (also `[groupId]/route.ts:15-17`)
Evidence: both routes inline `createClient()` + `supabase.auth.getUser()` + manual 401. Every sibling route (logs, routines, sessions, notes, exercises, profile, bodyweight, templates) calls `getUserOrUnauthorized()` from `@/lib/pulse/auth`.
Why it matters: the check is correct (not a vulnerability) but diverges from the post-audit pattern and duplicates the 401 contract.
Recommendation: replace the inline block with `const { supabase, user, response } = await getUserOrUnauthorized(); if (response) return response;` in both files.

**Local UUID_RE diverges from the canonical strict v4 pattern** `LOW`
`src/app/api/pulse/supersets/route.ts:4` (also `[groupId]/route.ts:4`)
Evidence: routes use `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` (any version/variant). The canonical export in `utils.ts:20` is v4-strict (`-4[0-9a-f]{3}-[89ab]...`). Group ids are minted with `crypto.randomUUID()` (`route.ts:49`) which is valid v4, so the strict pattern would accept them.
Why it matters: not a security hole (it still rejects garbage) but duplicates a centralized constant and is laxer than canonical.
Recommendation: import `UUID_RE` from `@/lib/pulse/utils` and delete the local copies.

**Ownership verified inline instead of reusing a shared primitive** `LOW`
`src/app/api/pulse/supersets/route.ts:24-36`
Evidence: POST selects `... workout_routines!inner ( user_id )` and checks `a.workout_routines.user_id !== user.id || b... !== user.id` for a 403. `actions.ts:430,448` use a shared `assertOwnsRoutineExercise(supabase, id, userId)` for single ids. This is NOT an IDOR: ownership is enforced two ways: the `!inner` join + explicit comparison rejects non-owned exercises (403), and `routine_exercises` RLS (`2026-05-26-exercise-library-schema.sql:98-115`) scoped through `workout_routines.user_id = auth.uid()` blocks other users' rows even on the UPDATE/DELETE.
Why it matters: the only issue is that the inline ownership logic diverges from the shared helper pattern the audit promoted.
Recommendation: where practical, add a batch `assertOwnsRoutineExercises` so superset routes reuse one ownership code path.

## Tests

**Superset API routes have zero test coverage** `MEDIUM`
`src/app/api/pulse/supersets/route.ts:1-59` (and `[groupId]/route.ts:1-40`)
Evidence: grep for any test referencing `api/pulse/supersets` returns nothing. The POST route enforces ownership (`:34`), adjacency (`:42`), already-paired 409 (`:45`), self-pair (`:19`), same-routine (`:37`); DELETE enforces ownership (`:28-30`). None is exercised by any test.
Why it matters: these routes are the security boundary for the feature. The ownership, adjacency, same-routine, already-paired, and 401/403/404 paths are exactly what is most likely to regress, yet nothing verifies them. A future change could drop the ownership filter with no test failing.
Recommendation: add route tests (mock createClient/getUser and the query builder) covering 401 no user; 400 invalid/non-UUID ids and self-pair; 404 when rows.length !== 2; 403 when a routine belongs to another user; 400 cross-routine and non-adjacent; 409 already paired; 200 happy path. For DELETE: 400 invalid groupId, 401, 404 empty, 403 not owned, 200 ok.

**WorkoutModeScreen superset stepping and per-pair savedCount untested** `MEDIUM`
`src/components/pulse/__tests__/WorkoutModeScreen.test.tsx:136-159`
Evidence: the only superset test asserts the header shows "Superset" and both names render for a single pair step. Untested: stepping across a mix of singles and pairs (`steps = groupExercises(exercises)`, `WorkoutModeScreen.tsx:164`); the "Superset · Step X of N" vs "Exercise X of N" label math (`:208-210`); Next/Previous advancing by step not exercise; isLast/Finish on a pair step; savedCount summing both pair members (`:190-199`).
Why it matters: the headline behavior is that a pair becomes ONE step. The step-count and dual savedCount are new and easy to get off-by-one. The existing test would still pass if stepping reverted to per-exercise.
Recommendation: add a test with `exercises = [single, pairA, pairB]` asserting initial label "Exercise 1 of 2", Next shows the pair with "Superset · Step 2 of 2" and Finish (isLast), and that saving across both pair members updates the combined "N sets logged" count.

**RoutinesTab superset-aware reorder (handleMove) completely untested** `MEDIUM`
`src/components/pulse/__tests__/LibraryView.test.tsx:257-344`
Evidence: tests only assert the "Pair ↓" button appears for two adjacent unpaired exercises (line 298) and that exactly one "Unpair" appears on a pair (line 343). The rewritten `handleMove` (moving a whole pair up/down, a single hopping over a pair) is never invoked. `canMoveUp`/`canMoveDown` (`firstPairIdx>0`, `secondPairIdx<len-1`) is unverified.
Why it matters: `handleMove` is the largest, branchiest new code. Reorder bugs corrupt the order column and break the adjacency invariant the API relies on. Only static button presence is checked. This is the same logic as the HIGH reorder bug above.
Recommendation: add tests clicking Move up/down (aria-label `Move <name> up/down`) on a paired exercise (assert `reorderRoutineExercises` called with the pair moved as a block, correct id order); a single above a pair moving down (assert it jumps after the pair, not between); boundary cases where buttons should be disabled. Assert the exact orderedIds array.

**groupExercises lacks edge-case coverage** `LOW`
`src/lib/pulse/__tests__/utils.test.ts:779-823`
Evidence: tests cover all-single, one pair + trailing single, solo group_id with no match, two pairs, empty. Missing: three consecutive rows with the same group_id (3rd should fall through as a single); two same-group rows not adjacent (`[A(g1), B(null), C(g1)]` should be three singles); a pair as the last two items with no trailing single; a single immediately followed by a pair.
Why it matters: `groupExercises` is the core grouping primitive used by LogView and WorkoutModeScreen. Its pairwise `i+=2` logic has non-obvious behavior for malformed/triplet data. A regression that greedily groups three or matches non-adjacent rows would pass the current suite.
Recommendation: add `[g1,g1,g1] -> [pair, single]`; `[g1, null, g1] -> three singles`; `[single, g1, g1]` at tail -> `[single, pair]`. Assert exact pair member ids and that the orphaned 3rd is not `Array.isArray`.

**Pair/Unpair/Remove handlers (fetch + reload) untested** `LOW`
`src/components/pulse/__tests__/LibraryView.test.tsx:257-344`
Evidence: `handlePair` POSTs to `/api/pulse/supersets` and reloads; `handleUnpair` DELETEs `/api/pulse/supersets/{groupId}` and reloads; `handleRemove` DELETEs the superset before `removeExerciseFromRoutine`. `global.fetch` is mocked (`LibraryView.test.tsx:7`) but no test asserts the URL/body, the correct groupId, or the unpair-before-remove ordering.
Why it matters: these handlers are the only way the UI mutates supersets. A wrong URL, swapped ids, or missing unpair-before-remove (orphaning a half-superset) ships undetected. fetch is already mocked, so the cost is low.
Recommendation: assert clicking "Pair ↓" calls `fetch('/api/pulse/supersets', POST, body {exerciseAId, exerciseBId})`; "Unpair" DELETEs the right groupId; removing a paired exercise calls the DELETE superset endpoint before `removeExerciseFromRoutine`.

**SupersetCard collapse/expand state and note wiring not tested** `LOW`
`src/components/pulse/__tests__/SupersetCard.test.tsx:40-51`
Evidence: the two tests render the card and assert both names plus the "superset" label. But the body renders ExerciseCards only when `open` is true (`SupersetCard.tsx:56`), default `open=false` (`:33`). The header toggle, `aria-expanded` (`:42`), and the `onSaveNote`/`onDeleteNote` wiring to `first.id`/`second.id` (`:67-69,81-83`) are untested.
Why it matters: collapse/expand is the primary interaction and `aria-expanded` is its accessibility contract. The note callbacks remap a single id per child; a `first.id`/`second.id` swap would silently save the wrong exercise's note.
Recommendation: add tests for initial `aria-expanded=false`; clicking the header toggles to true and reveals the SetLoggers; a note save on the second exercise calls `onSaveNote` with `second.id`.

**LogView grouping test does not assert pairIdx/exIdx contract or single+pair mixing** `INFO`
`src/components/pulse/__tests__/LogView.test.tsx:141-167`
Evidence: the test renders exactly two exercises sharing grp-1 and asserts the label + names. LogView passes `pairIdx={i}` (post-grouping index, `LogView.tsx:232`) while ExerciseCard gets `exIdx={i}` (`:247`). With a mix of singles and pairs, `i` is the post-grouping index, so a single after a pair gets a non-contiguous `exIdx`. No test covers a mixed routine.
Why it matters: `pairIdx` feeds SupersetCard's child `exIdx` (`pairIdx`, `pairIdx+1`, `SupersetCard.tsx:59,73`). If `exIdx` is order-sensitive (animation/keying), the grouped-index basis could collide. The mixed list is the realistic production scenario and is untested.
Recommendation: add a LogView test with `[single, pairA, pairB]` asserting one ExerciseCard plus one SupersetCard render in order, and that both pair names and the single name appear.

## Integration and merge risk

**Pair/Unpair UI uses window.location.reload() instead of SWR mutate** `MEDIUM`
`src/components/pulse/views/library/RoutinesTab.tsx:310,316`
Evidence: `handlePair` ends with `window.location.reload();` (line 310) and `handleUnpair` with the same (line 316). The established pattern in `useRoutines.ts` is `await mutateRoutines();` after every mutation (lines 55,64,74), and the context exposes server-action wrappers that revalidate via SWR. `handleRemove` in the same file already composes context actions correctly.
Why it matters: a full reload throws away all client state (active tab, scroll, in-progress edits, the SWR cache) and is jarring, where every other routine mutation does an in-place revalidate. It also bypasses the provider/context boundary the audit consolidated, calling `fetch()` directly from the view.
Recommendation: move the pair/unpair fetch calls behind context/hook actions in `useRoutines` (alongside `reorderRoutineExercises`) and call `await mutateRoutines()` on success. At minimum, replace `window.location.reload()` with the existing `mutateRoutines`.

**handleSetSave re-parses the log key inline instead of using parseLogKey** `LOW`
`src/components/pulse/WorkoutModeScreen.tsx (handleSetSave, the key.indexOf('-')/key.lastIndexOf('-') block)`
Evidence: the new `handleSetSave` does `const firstDash = key.indexOf('-'); const lastDash = key.lastIndexOf('-'); const rid = key.slice(firstDash + 1, lastDash);`. `utils.ts:78` already exports `parseLogKey(key)` returning `{ week, routineExerciseId, setIdx }`, used everywhere else (LogView uses `parseLogKey(key)?.routineExerciseId`).
Why it matters: this hand-inlines the substring logic without `parseLogKey`'s validation (UUID check, NaN guards). It diverges from the post-audit convention and does the wrong thing on a malformed key instead of returning null.
Recommendation: use `const rid = parseLogKey(key)?.routineExerciseId;` and guard on it, matching LogView.

**SupersetCard separates surfaces with borders against Slate rules** `LOW`
`src/components/pulse/SupersetCard.tsx:37,43,71`
Evidence: outer container `border border-pulse-accent/35 rounded-xl ... bg-pulse-surface` (line 37); header `bg-pulse-accent/10 border-b border-pulse-accent/20` (line 43); the two ExerciseCards split by `<div className="h-px bg-pulse-border mx-4" />` (line 71). The shared `CARD` constant in `ui.ts:29` is `bg-pulse-surface rounded-2xl p-4` with no border.
Why it matters: a persistent coral outline on every superset (not just active/pending) plus a hairline divider contradict Slate. It reimplements card chrome inline rather than using the shared `CARD` constant, so the block reads as a different design dialect. This overlaps the Slate-compliance section above; both point at the same code.
Recommendation: convey grouping with a tone shift (`bg-pulse-surface-2` inner vs `bg-pulse-surface`) and whitespace, reserve any coral outline for active/pending, drop the divider in favor of spacing, and reuse the `CARD` constant.

(API auth and UUID_RE duplication also appear here as integration-consistency findings; they are the same issues already detailed under API security.)

## Merge risk vs feature/rich-set-types

The brief listed `WorkoutModeScreen`, `LogView`, `utils.ts`, `types.ts`, `actions.ts`, and `queries.ts` as shared-edit conflict surfaces. Verification narrows this.

**Brief overstated the overlap** `INFO`
`git diff main...feature/rich-set-types --stat` shows that branch changes only: `actions.ts`, `SetLogger.tsx`, `HistoryView.tsx`, `queries.ts`, `types.ts`, `validation.ts`, a set-logs-drops migration, and tests. It does NOT touch `WorkoutModeScreen.tsx`, `views/LogView.tsx`, or `lib/pulse/utils.ts`. So the supersets rewrites of those three files carry zero merge conflict against rich-set-types. Treat them as conflict-free.

Real conflict surface is three files:

- **types.ts** `LOW` likely conflict. Both branches add fields to `RoutineExercise` (`types.ts:150-163`). Union the new fields at merge.
- **queries.ts** `LOW` likely conflict. Both add columns to the single-line `ROUTINES_SELECT` (`queries.ts:19`). Re-add the other branch's column rather than taking one side.
- **actions.ts** `INFO` conflict unlikely. supersets edits the select string in `addExerciseToRoutine` (~line 414); rich-set-types adds `drops` inside `saveLogs` (~line 84). ~330 lines apart in different functions, so git auto-merges cleanly. Sanity-check after merge that `addExerciseToRoutine` still returns `superset_group_id` and `saveLogs` still persists `drops`.

Suggested durable fix: extract the `routine_exercises` column list into one shared constant so both selects stay in sync.

## Exercise-instructions docs (no code)

`docs/superpowers/plans/2026-05-31-exercise-instructions.md` (1426 lines) and `docs/superpowers/specs/2026-05-31-exercise-instructions-design.md` (152 lines) are docs only. The branch `--stat` shows no `src/` files for exercise instructions: no component, no migration column, no type field. They ship no behavior and carry no merge or RLS risk. They can land without implementation review. `INFO`

## Recommended actions (prioritized)

1. Fix the PR badge regression: recompute and pass `isPR` in SingleStep and PairStep (`WorkoutModeScreen.tsx`). Re-run `WorkoutModeScreen.test.tsx` to green. (HIGH)
2. Fix the pair-over-pair reorder so an adjacent neighbor pair moves as a unit (`RoutinesTab.tsx:263-275`). (HIGH)
3. Fix the variant rest timer: resolve the saved exercise from the variant-aware list, not the base list (`LogView.tsx:81`). (MEDIUM)
4. Fix the adjacency check to sort by order and compare positions, not raw order values (`supersets/route.ts:40-44`). (MEDIUM)
5. Replace `window.location.reload()` in pair/unpair with `mutateRoutines()` via context (`RoutinesTab.tsx:310,316`). (MEDIUM)
6. Bring the superset UI onto Slate: drop the persistent coral border and header wash, use a tone shift + whitespace, reuse the `CARD` constant, swap emoji/unicode for the SVG chevron, change Unpair to `text-pulse-dim` (`SupersetCard.tsx:37,43,45,52,71`; `RoutinesTab.tsx:116`). (MEDIUM/LOW)
7. Add the missing tests: superset API routes (auth/IDOR/adjacency/validation), WorkoutModeScreen stepping + savedCount, RoutinesTab `handleMove` reorder, pair/unpair handlers, `groupExercises` edge cases, SupersetCard expand + note wiring. (MEDIUM/LOW)
8. Reuse shared helpers in the routes: `getUserOrUnauthorized` for auth, canonical `UUID_RE` from utils, and `parseLogKey` in `handleSetSave`. (LOW)
9. Make the paired write atomic (RPC/transaction or verify-and-rollback) (`supersets/route.ts:49-56`). (LOW)
10. Document, and ideally constrain, the "exactly two, same routine, adjacent" invariant in the migration; add a comment that RLS is inherited from `routine_exercises`. (LOW)
11. At merge time, union `RoutineExercise` fields (`types.ts`) and re-add both columns to `ROUTINES_SELECT` (`queries.ts`); sanity-check `actions.ts`. Treat `WorkoutModeScreen`/`LogView`/`utils.ts` as conflict-free. (LOW)
