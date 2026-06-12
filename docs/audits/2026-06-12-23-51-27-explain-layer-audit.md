# Explain-layer audit: every computed coaching output vs the explanation the user can reach

Date: 2026-06-12. Scope: the gap between Pulse's computed coaching decisions/numbers and their reachable "why", in both directions (under-explained AND over-explained), measured against the moat (traceable, explainable adaptation) and the design principle (simple surface, ignorable intelligence: explanation available on demand, not always on screen).

Method: full lib+view walk via three targeted inventories (display-layer numbers; generation-side decisions; adherence/Train coaching copy + DecisionEvent writer coverage), each grounded in file:line evidence.

## Core finding

The explain problem is **concentrated drift, not absence**. `decisionCopy.ts` is a working canonical what/why/next backbone for its four dated event types (deload, progression, ramp_back, swap) rendered by CoachPanel / CoachActivityTimeline / FinishDebrief. But the Train-time surfaces bypass it with independent strings: the auto-deload rule is phrased ~4 ways (ExerciseCard "break the stall"; decisionCopy "no e1RM gain in 3 weeks... break the plateau"; SetLogger "Back off to..." + aria "Deload target"; FinishDebrief "Auto-deload on N lifts"), and the progression target has a talkative editorial variant vs a terse card variant with no reachable why. Generation explains itself in exactly one place (the ProgramView rationale), which is simultaneously the app's one OVER-explained surface (persistent prose).

## Inventory (computed output -> surfaced -> explanation state -> placement verdict)

| # | Output | Computed | Surfaced | State | Verdict |
|---|---|---|---|---|---|
| 1 | Progression target | `computeProgression`/`computeSuggestion` | SetLogger (both variants), FinishDebrief | partial: editorial sentence, card terse with no why | UNDER (card) + DRIFT |
| 2 | Auto-deload target (90%) | `shouldDeload`/`deloadTarget` | SetLogger, ExerciseCard stalled card, decisionCopy, FinishDebrief | explained but ~4 phrasings | DRIFT |
| 3 | Plateau detection | `computePlateau` | ExerciseCard only; absent from Progress charts | partial | UNDER (Progress; covered by the page-depth lane item) |
| 4 | Ramp-back (gap) | `computeRegenSuggestion` | RegenNudge, LogView banner, decisionCopy | full, consistent | OK (best-in-class) |
| 5 | Manual lighten | `lightenThisWeek` | LogView banner + decisionCopy | full | OK |
| 6 | Catch-up nudge | `computeRegenSuggestion` | RegenNudge only | full | OK (correctly unlogged) |
| 7 | Behind status | `computeProgramPosition` | pill + count | unexplained | UNDER |
| 8 | Lapsed status | same | pill + "Back after Nd" | partial | UNDER |
| 9 | Paused status | `activePause` | pill + LogView banner | full | OK |
| 10 | Strength Score + level | `computeStrengthScore` | tile, breakdown modal | partial (gender caption only; methodology invisible) | UNDER |
| 11 | Strength trend/delta | `computeStrengthScoreSeries` | tile delta + modal line | unexplained | UNDER (minor) |
| 12 | Recovery readout | `recoveryReadout` | RecoveryTile | partial (word + muscles; drivers unstated) | UNDER (minor) |
| 13 | e1RM | `calcE1RM` | BestLifts, charts, drill-in, milestones | bare acronym everywhere | UNDER (cheapest fix) |
| 14 | PR detection | `computePRMap`/`isSetPR` | toast, badge, debrief, milestones | full, consistent | OK |
| 15 | Per-muscle volume vs targets | `accumulatePerMuscle`+`computeVolumeProgress` | MuscleVolumeBars, Train rail | partial (target provenance unstated) | UNDER (minor) |
| 16 | Priority tilt | `priorityFocusLine` + rationale clause | volume card, rationale | full | OK |
| 17 | Recomp verdict | `computeRecompSignal` | RecompCard | partial (thresholds unstated) | OK-ish (low) |
| 18 | Warm-up sets | `computeWarmupSets` | ExerciseCard expanded | unexplained | UNDER (minor) |
| 19 | Generation rationale | `buildRationale` | ProgramView header, setup preview | full, but persistent prose | OVER |
| 20 | Quad/posterior split clause | `hasQuadPosteriorSplit` | rationale prose | full | OK (rides #19) |
| 21 | Duress warnings | `LIMITED_VARIETY_WARNING` etc. | appended into rationale string | buried in prose | placement wrong |
| 22 | Restriction exclusions honored | `isContraindicated` | never shown | unexplained | UNDER (trust feature) |
| 23 | Equipment exclusions | `hasEquipment` | never shown | self-evident | OK (leave silent) |
| 24 | Rep-range/bias resolution | `repRange`/`resolveBias`/`resolveRepRange` | numbers only on Plan rows | unexplained | UNDER |
| 25 | Strength +1 set bump | generation | number only | unexplained | UNDER (minor, rides #24) |
| 26 | Per-slot exercise reason | `exerciseReason` | ProgramView rows, swap picker | full inline | OK |
| 27 | DecisionEvent timeline | `decisionCopy` | CoachPanel, timeline | full structured | OK (the model citizen) |
| 28 | Engine internals (anchors, fatigue tiebreaks, caps/floors, role model, variety anchors, supersets, day ordering) | generation.ts | never shown | unexplained | OK, correctly silent |

## Coach-voice consistency

Through decisionCopy: deload, progression, ramp_back (gap + the manual lighten dual-write via `adjustments.ts`), swap. Outside it: catch-up (ad-hoc, deliberately unlogged), pause (own table, consistent ad-hoc copy), behind/lapsed (label-only, no copy), generation (own rationale system), PR (ad-hoc but verified consistent), autoregulation (deliberately untracked, `utils.ts:386`). The drift concentrates in one concept (deload, 4 phrasings) plus a milder progression split. decisionCopy is canonical for its types, but Train surfaces carry independent strings: the i18n double-duty risk is ~4 deload strings + 2 progression strings to translate and keep honest instead of 1 each.

## Ranked under-explained (by moat impact)

1. Progression-target why (card variant): the most-touched coaching output; the why exists as copy, the card's number just is not tappable.
2. Behind/Lapsed why: the moat's calendar adaptation surfaces its two negative states as bare pill words; the engine knows the missed slots and the never-punish behavior.
3. Deload copy unification: over-fragmented rather than missing; flagship adaptive behavior should have one voice.
4. Rep-range why on Plan rows: the visible fingerprint of bias/style resolution, never explained.
5. Restriction exclusions honored: invisible safety feature should be a visible one.
6. Strength Score methodology (in the modal). 7. e1RM spelled out (one glossary line). 8. Recovery drivers / volume-target provenance / warm-up scheme (one-liners once the mechanism exists).

## Over-explained

ProgramView's persistent rationale prose (collapse behind "Why this plan"; facts chips stay); duress warnings appended into the rationale string (should be a distinct, dismissible generation-time notice); guided SetLogger stacking flagged for the queued guided live-test pass only.

## Recommended mechanism (one path, not two)

A canonical reason registry + one shared on-demand "why" affordance: `explainCopy.ts` (concept keys -> parameterized `{ headline, why, next? }`, the shape decisionCopy established) + a single `Why` affordance (tap a value -> popover on desktop, ModalSheet on mobile; zero chrome until invoked). decisionCopy's four cases pull their why-sentences from the matching explainCopy concept, so exactly one canonical sentence exists per concept, consumed by every surface. The user learns one gesture: tap a number, the coach answers.

## Pushback (accepted)

Engine internals (row 28) stay unexplained: explaining selection mechanics is engineering transparency, not coaching ("RDL for your posterior chain", not "RDL won the canonical-anchor tiebreak"). Equipment exclusions stay silent (self-evident). Behind/lapsed get an on-demand why, never always-on banners (the calm surface matters most exactly where anxiety is highest). The editorial-vs-card progression split is partly deliberate: the fix is "make the card's number tappable", not "make the card talk".

## Disposition (2026-06-12 review)

Findings accepted with corrections: (1) registry + deload unification merged into ONE roadmap entry shipping with the top-3 items only, the cheap one-liners as in-entry follow-ons; (2) build order is mechanism -> deload unification -> progression-card tappable -> behind/lapsed (new copy, written deliberately) -> one-liners, deliberately not the impact ranking; (3) the i18n dependency is binding: explainCopy precedes the queued i18n extraction so i18n translates one sentence per concept; (4) the OVER fixes are a second, smaller, file-opportunistic entry; (5) plateau-on-chart needs no new entry (already in the page-depth lane); (6) both entries file below the validation block and the open launch-floor items. Entries live in `docs/roadmap.md` ("Explain layer" block, 2026-06-12).
