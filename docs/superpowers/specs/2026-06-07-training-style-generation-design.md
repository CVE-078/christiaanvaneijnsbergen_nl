# Training style, generation input, design

Date: 2026-06-07
Status: approved design, ready for implementation plan
Branch: `feature/training-style-generation`
Roadmap: Tier 2 #4 (the first of three generation-input refinements; variety preference and loading lean are separate follow-up branches)
Reviews: training science validated via Claude.ai; architecture/maintainability pass via Perplexity. Both green-lit with the refinements folded in below.

**Rollout posture:** treat this as a controlled first step, not a final architecture. The reviews validate the reasoning, but the real proof is whether outputs stay coherent across many split types and equipment pools during the validation block. The remap table and the heavy-pattern set are deliberately data (single edit points) so they can be tuned from real-use evidence without touching generation logic.

## Goal

Add a `training_style` generation input so a routine can be biased toward how the user wants to train (Balanced / Strength / Bodybuilding / Powerbuilding), layered on the existing slot-first engine without rewriting it. Both AI architecture reviews rank this the single biggest quality lever before any AI.

## Primary decisions (from brainstorming + Claude.ai science review)

| Decision | Choice |
| --- | --- |
| Scope | Training style only on this branch; variety preference + loading lean ship as their own follow-up branches. |
| Style vs goal | Two axes that compose. Training style owns the bias + base rep ranges (method); the existing `goal` stays the outcome/density modifier (lose-fat nudges reps up, unchanged). |
| Persistence | Persist on `profiles` (nullable `training_style`), like `priority_muscle`. |
| Mechanism | Remap that preserves the program's day-to-day rhythm. Balanced = identity. |

## The new axis

`TrainingStyle = 'balanced' | 'strength' | 'bodybuilding' | 'powerbuilding'`, surfaced in the UI as:

- **Balanced** (default) — today's exact behaviour. Identity transform. Existing routines regenerate byte-identical, no migration risk.
- **Strength** — heavy, low-rep, centred on compounds.
- **Bodybuilding** — hypertrophy/pump across the board.
- **Powerbuilding** — heavy on the main movement patterns, hypertrophy on accessories.

The roadmap's "general fitness" style collapses into **Balanced**: general-fitness already lives on the `goal` axis (`general_fitness`), so it is not a training style. Goal and training style are orthogonal and compose.

## Mechanism (remap, preserves rhythm)

Each session in a `ProgramStyle` already carries a `bias` (`strength` / `hypertrophy` / `pump` / `balanced`) via its emphasis. That bias encodes the session's role in the week (a 3-day full body is a heavy day + a hypertrophy day + a balanced day; a 4-day full body ends on a pump finisher). Training style transforms that per-session bias rather than flattening it.

Two pure functions in `src/lib/pulse/generation.ts`:

### `resolveBias(sessionBias: Bias, style: TrainingStyle): Bias`

A transparent remap table applied to each session's bias before rep/set logic:

| session bias ↓ \ style → | balanced | strength | bodybuilding | powerbuilding |
| --- | --- | --- | --- | --- |
| strength | strength | strength | hypertrophy | strength |
| balanced | balanced | strength | hypertrophy | strength |
| hypertrophy | hypertrophy | strength | hypertrophy | strength |
| pump | pump | **hypertrophy** | pump | strength |

Notes:
- **Balanced** is the identity column (existing behaviour preserved exactly).
- **Strength** maps a pump-finisher day to `hypertrophy`, not to a 6-rep heavy day, so the week keeps one lower-intensity day. This is standard strength programming (a lighter/accumulation day) and avoids accumulated CNS fatigue the app has no model to detect yet. (Confirmed correct in the science review.)
- **Bodybuilding** centres on `hypertrophy` but keeps `pump` finishers as pump. For a uniformly-hypertrophy split (PPL, U/L) it is close to today's behaviour by design.
- **Powerbuilding** maps every session to `strength` bias (so the heavy-compound treatment and the first-compound set bump apply), but the *rep ranges* are split per movement pattern, see below.

**Separation of concerns (single source of truth for each transform):** `resolveBias` is the **only** place day-level style remapping happens. `resolveRepRange` never remaps the bias itself; it takes the **already-resolved** bias and only interprets the movement pattern (for the one Powerbuilding accessory case). This keeps future style additions to a single table edit and prevents the two functions from drifting.

### `resolveRepRange(effectiveBias, pattern, isCompound, goal, style): string`

Takes the bias **already resolved** by `resolveBias` (the generator computes it once and reuses it for the set-count check), then resolves the rep range:

- **Powerbuilding** (the one special case, because a pure day-level bias collapses on uniformly-hypertrophy splits like PPL): the strength rep range is reserved for the **main movement patterns** only. An exported, named constant `POWERBUILDING_HEAVY_PATTERNS = new Set(['squat', 'hinge', 'horizontal_push', 'vertical_push'])` gets the strength range; **everything else follows the hypertrophy range** (rows via `horizontal_pull`, all `*_iso` isolation, `lunge`, `calf`, `core`, `glute_iso`). This is how real powerbuilding templates work (heavy on the big patterns, moderate-to-high on accessories) and maps onto Pulse's existing `movement_pattern` taxonomy with no new metadata. The constant is the single edit point for evolving which patterns count as "main" (it lives beside the remap table, so the heavy-pattern policy is data, not logic buried in the function).
  - **Accepted approximation:** conventional deadlift and Romanian deadlift are both `hinge`, so both land in the heavy bucket under Powerbuilding. The richer per-exercise metadata in generation Phase 0 #2 (`fatigue_cost`, `difficulty`) will later let RDLs drop to moderate. Documented here so it is a known seam, not a silent bug.
- **All other styles**: `repRange(effectiveBias, isCompound, goal)`, exactly as today (`pattern` is ignored). `repRange`'s signature is unchanged; `resolveRepRange` wraps it.

`goal` composition is unchanged: `repRange` already shifts both columns up when `goal === 'lose_fat'`, and that stacks on top of whatever the style resolves to.

### Set count

The existing rule, `+1` set on the first compound of a `strength`-bias session, keys off the **resolved** bias, so it now fires for Strength and Powerbuilding sessions too. It is scoped **per session** (`firstCompoundBumped` resets each session in the generation loop), so a 6-session Strength routine adds exactly six bumped compounds, one per day. Kept as-is; a golden test asserts the count so it cannot drift.

## Threading it through

- **Types** (`src/lib/pulse/types.ts`): add `TrainingStyle`; add `training_style: TrainingStyle | null` to the profile type.
- **Migration** (`docs/migrations/<full-timestamp>-training-style.sql`): `alter table public.profiles add column if not exists training_style text check (training_style in ('balanced','strength','bodybuilding','powerbuilding'))`, nullable. Existing RLS on `profiles` already scopes by `id`; no policy change. Apply manually in the Supabase SQL editor (no runner in this repo).
- **Lib generation** (`generation.ts`): `GenerationInput` gains an optional `trainingStyle?: TrainingStyle` (default `balanced`). For each session the generator computes `effectiveBias = resolveBias(session.bias, style)` **once**, then uses it for both the set-count check and `resolveRepRange(effectiveBias, pattern, ex.is_compound, goal, style)` for `reps` (it already has `pattern` in scope, currently `void pattern`). Absent / `balanced` is a no-op.
- **Server action** (`src/app/pulse/actions/routines.ts`): the `generateRoutine` action takes an optional `trainingStyle` param. When present it (a) passes it into the lib `generateRoutine` and (b) folds `training_style` into the existing `profiles` upsert, so generation never depends on a write-before-read race. When absent it falls back to the stored `profiles.training_style` (so a future regenerate from Plan/Profile honours the saved value). The existing profile read (`priority_muscle, gender`) adds `training_style`.
  - **Persistence is a remembered default, not a locked preference.** The setup flow always passes the *just-chosen* style into the generate call, so the per-program choice wins; the stored `profiles.training_style` is only the seed/fallback for a later regenerate where no explicit choice is made. This mirrors `priority_muscle` and resolves the "is it a lifelong preference or a per-program choice?" tension: it is the last choice you made, reusable, not a binding lifelong setting.
- **Rationale** (`buildRationale`): when style ≠ `balanced`, append a clause, e.g. "Trained for strength.", "A powerbuilding block.", "Built for hypertrophy." (no em dashes).
- **Hook** (`src/hooks/pulse/useProfile.ts`): add an optimistic `updateTrainingStyle(style)` mirroring `updatePriorityMuscle` (mutate local, await `serverUpdateTrainingStyle`, revalidate), plus the server action `updateTrainingStyle` in `actions/profile.ts`.
- **Setup step** (`src/components/pulse/RoutineSetupFlow.tsx`): one new optional step, "How do you want to train?", same card-button pattern as the existing goal/experience steps, default **Balanced**. Shown in both onboarding and the manual generate flow. Each create path (`GenerateRoutineButton`, `OnboardingModal`, `TemplatesTab`) passes the chosen style into the generate call.

## UI copy

Step title: "How do you want to train?" with a one-line sub-head framing these as *how you train*, not *how hard*: "Same plan, tuned to your style. You can change this anytime you regenerate." Four cards:
- **Balanced** — "A bit of everything. Heavy days, hypertrophy days, and a pump day." (recommended/default)
- **Strength** — "Lower reps and heavier loads on the big lifts. Still keeps one lighter day each week." (the second sentence heads off the "every day is maximal" misread; it is a method, not a brutality dial.)
- **Bodybuilding** — "Moderate-to-high reps for size, across every session."
- **Powerbuilding** — "A blend: heavy, low-rep work on the main lifts, higher-rep work on the accessories." (spelled out because it is the least self-explanatory of the four.)

Framing rule for the copy: each description leads with the *rep/load character* (the method), never with "harder" or "more intense", so users read these as different ways to train rather than difficulty tiers. No em dashes anywhere (project rule).

## Out of scope (this branch)

- A standalone training-style editor on the Profile screen (the style is set during routine setup for now; the column is there for a later Profile control).
- Variety preference (avoid-set strictness) and loading lean (selection secondary sort), each its own follow-up branch.
- Any fatigue/frequency model. See the accepted limitation below.

## Accepted limitations

Both limitations below must be encoded **in the code, not only here**: a short comment at the relevant site plus a clearly-named test. The point is that a future engineer working on fatigue modelling or taxonomy growth rediscovers them as intentional, not as bugs.

- **High-frequency Strength** (e.g. 6-day PPL + Strength): all six sessions remap to `strength` bias, a neurologically demanding but valid output. The app has no fatigue model to cap frequency by style, and adding one now would be premature. Documented, not enforced. A comment at `resolveBias` states that training style does **not** constrain frequency (so fatigue work must not assume it does), and the golden suite includes a "6-day PPL + Strength produces sane rep ranges across all sessions" guard so the output stays well-formed even if it is heavy.
- **Deadlift / RDL share the `hinge` pattern**, so both land in `POWERBUILDING_HEAVY_PATTERNS` under Powerbuilding. A comment beside the constant records this as an intentional approximation pending Phase 0 #2 metadata, and the Powerbuilding test names the case so it reads as expected, not accidental.

## Testing

Pure functions (unit, no React):
- `resolveBias`: every cell of the 4×4 table.
- `resolveRepRange`: Powerbuilding gives the strength range for each pattern in `POWERBUILDING_HEAVY_PATTERNS` and the hypertrophy range for representative non-heavy patterns (`horizontal_pull`, `biceps_iso`, `lunge`); lose-fat still shifts on top; **Balanced reproduces today's `repRange` output for all four biases × compound/iso** (regression guard, encodes the identity invariant).
- `generateRoutine` (blueprint level, the regression guarantee that matters most for rollout):
  - **Balanced (or omitted) produces a blueprint identical to the current engine across every split archetype**, not just one full-body case: 2-day FB, 3-day FB, 3-day PPL, 4-day Classic U/L, and 6-day PPL ×2. Each is a snapshot/identity assertion (run the same fixed inputs with no style and with `balanced`, expect byte-identical blueprints). This is the safety net for the whole change.
  - Strength on a hypertrophy split (PPL) lowers the rep ranges and adds the set bump on the first compound of each session.
  - Powerbuilding on a PPL split gives the strength range to heavy-pattern lifts and the hypertrophy range to accessories within the same session.
  - Powerbuilding on a U/L split (a different session structure) likewise splits heavy patterns vs accessories, so the behaviour is verified on more than one archetype.
  - 6-day PPL + Strength: all sessions have non-empty, well-formed rep ranges, and exactly one bumped compound per session (the accepted-limitation guard).
- Action: the `trainingStyle` param persists to `profiles` and drives generation; absent, generation falls back to the stored value.
- `RoutineSetupFlow`: the new step renders, defaults to Balanced, and the choice flows into the generate call (test the step in isolation with the same pattern as the existing step tests).

## Edge cases

- No style chosen / legacy profile (`null`) → treated as `balanced` everywhere (identity).
- Style present but a session bias not in the table → impossible (`Bias` is a closed union), but `resolveBias` returns the input unchanged as a defensive default.
- Thin equipment pool / fallback selection is unaffected; training style only changes bias, rep ranges, and set count, never the pool filter or slot order.
