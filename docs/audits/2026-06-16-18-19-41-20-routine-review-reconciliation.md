# 20-routine external review, reconciled against code-truth (2026-06-16)

Companion to `docs/audits/2026-06-16-17-14-00-20-routines-for-review.md` (the 20 generated routines). Three LLMs (ChatGPT, Perplexity, Claude AI) scored the set. This doc records their verdicts and reconciles every headline finding against the actual engine code, because the reviewers can only see the static blueprints the diagnostic printed, not the code.

## Scores

- **ChatGPT: 8.3/10.** Above the "ready to move on" bar with reservations. Top issue cited: "volume accounting too literal."
- **Perplexity: "good foundation, not yet production-ready at the 8/10 standard."** Top issues: coverage imbalance, volume realism, constraint overcorrection.
- **Claude AI: ~6.6/10 average.** Strongest on per-routine rigour. Top issues: isolation set-inflation, zero-coverage under restriction/thin equipment, priority-muscle weakness, no MRV cap.

The divergence is explained below: ChatGPT over-weighted a finding that is largely already built and partly a display artifact; Claude AI's read is the most code-accurate on the real defects; Perplexity aligns with Claude AI.

## Reconciliation (verdict + code evidence)

| Finding | Verdict | Code evidence |
|---|---|---|
| "Volume accounting too literal, design a direct+indirect model" (ChatGPT #1) | **Already built + display artifact** | `weeklyMuscleSets` already computes `effective` = direct + 0.5/secondary (`muscleVolume.ts:80`); the gap gate already applies compound carryover (`CARRYOVER_CREDITS`, `muscleVolume.ts:22-27`: press→triceps/front_delts, pull→biceps/rear_delts at 0.5). The diagnostic printed DIRECT only, so reviewers saw "lats 0" and inferred blindness. |
| "lats 0 despite rows" | **Display artifact, not a gap** | Rows seed `primary_muscle = upper_back`; `back` is an aggregate target (lats+upper_back), and the gaps line reports `back 75%`, not a lats gap. Rows count. Legit sub-point: the lats/upper_back seed split is coarse. |
| Isolation set-inflation, 6x/8x (Claude #1, ChatGPT #2) | **REAL, strongest cross-reviewer signal** | Base = 3 sets (4 for the strength first-compound, `generation.ts:2285-2289`). Single-exercise 6x/8x come from gap-fill set-bumps capped at `2 * baseSets` (`gapFill.ts:266`, `GAP_FILL_SET_CEILING=20` at `:76`). Gap-fill prefers bumping one iso over inserting a second, and nothing stops an iso exceeding the session's top compound. |
| No MRV ceiling, quads 160-170% / chest 200% (Claude #4) | **REAL, lowest stakes** | `max` in `MUSCLE_SET_TARGETS` exists but is NOT enforced (`muscleVolume.ts:101`, only `min` floors drive gap-fill). Caveat (Claude's own): RIR ramps + deloads run at training time. |
| Priority muscle too weak (Claude #3, ChatGPT #4) | **REAL; ChatGPT's "only reorders" is WRONG** | Priority ADDS volume: `PRIORITY_EXTRA_SETS_PER_WEEK = 4`, +1 per matching exercise (`generation.ts:308`). On a sparse split with ~2 chest slots that is only ~+2 sets, short of lifting chest (target 10) off 80%. Gap-fill ignores priority (`gapFill.ts` has no priority awareness). Confirmed: routine 6, priority chest → chest 80%, worst muscle. |
| Restriction overcorrection, zero-coverage muscles (Claude #2, Perplexity) | **REAL, biggest, a known TODO** | Filter is purely subtractive, no intent-matched substitute (`isContraindicated`, `generation.ts:867`). `COMPOUND_FLOOR` floors compounds-per-region, NOT muscles (`generation.ts:910-917`). Confirmed: quads 30% (knee, R12), triceps 0% (2-day, R11), side delts 0% (machines, R15), side+rear delts 0% (barbell, R16). |
| Shoulder restriction still allows overhead pressing | **Accurate** | Tagged `shoulder`: BB OHP, Arnold Press, DB Push Press, Upright Row, Dips. NOT tagged (survive): DB Overhead Press, Machine Shoulder Press (`2026-06-08-14-27-19-exercise-contraindications.sql:59-69`). |
| No vertical pull on full-body (Perplexity, self-flag) | **Partly real** | Full-body emphases lack a `vertical_pull` slot (data); barbell-only / machines-without-pulldown is an honest equipment limit. |
| PPL recommended at 3 days for hypertrophy (Claude #5) | **Artifact of the test config** | `--style ppl-3` was forced in the sample; the 3-day default is `fb-3` (R1). |

## Confirmed defect numbers (from the generated doc)

- R6 priority chest: `chest 8/10 (80%)`, the worst-covered muscle.
- R11 2-day full gym: `triceps 0/8 (0%)`, plus `no_vertical_pull`, `push_pull_imbalance`.
- R12 knee: `quads 3/10 (30%)`, `hamstrings 12/8 (150%)` (overcorrection).
- R15 machines+cables: `side_delts 0/8 (0%)`, `rear_delts 9/6 (150%)`.
- R16 barbell-only: `side_delts 0%`, `rear_delts 0%`.
- Over-volume (no cap): R5 quads 170% chest 130%; R8 chest 200% quads 160% triceps 150%; R17/R20 quads 160%.

## Decisions (user, 2026-06-16)

1. **Proceed with a bounded, spec-first calibration round** before the Laldy rebrand. Refinement, not redesign; keep the slot-first engine.
2. **Shoulder restriction:** do NOT make it a blanket overhead-press ban. The right long-term model is severity tiers (mild / moderate / severe) with per-exercise penalties. For the current single binary flag, **treat shoulder as "moderate"**: exclude BB OHP, DB OHP, Arnold Press, Upright Row; keep machine/neutral pressing, incline/horizontal pressing, rows, pulldowns, face pulls, rear-delt work. The deeper requirement: a restriction must visibly change the program (R14 barely differed from a normal U/L).
3. **MRV cap:** add a soft per-muscle weekly ceiling that trims the lowest-value accessory sets when a muscle exceeds its `max` band.
