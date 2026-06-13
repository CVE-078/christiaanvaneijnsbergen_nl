# Explain layer: canonical reason registry + shared "why" affordance

Date: 2026-06-13. Source: the accepted explain-layer audit (`docs/audits/2026-06-12-23-51-27-explain-layer-audit.md`) and its Disposition section, refined by two adversarial spec reviews (architecture + coaching-voice). This spec turns the accepted findings into a concrete, code-level design for the first roadmap "Explain layer" entry (mechanism + the top-three items), with the cheap one-liners as in-entry follow-ons.

## Problem

The explain problem is concentrated drift, not absence. `decisionCopy.ts` is a working what/why/next backbone for the four dated `DecisionEvent` types, but the Train-time surfaces bypass it with independent strings. Confirmed today:

- **Auto-deload, ~4 phrasings:** `ExerciseCard.tsx:198-200` ("↓ Deloading this week to break the stall" when deloading, "Stalled, no e1RM gain in 3 weeks" when stalled-but-not-yet-deloaded), `decisionCopy` deload ("No e1RM gain in 3 weeks, so the lift stalled." / "Lighter targets this week to break the plateau, then build back up."), `SetLogger.tsx:401` ("You stalled around X kg × R, so back off on purpose. Drop to ..."), `FinishDebrief.tsx:170` ("↓ Auto-deload on N lifts").
- **Progression target:** an editorial sentence in `SetLogger` (variant `editorial`) versus a terse `card` variant whose number is not tappable, so the why is unreachable on the most-touched coaching surface.
- **Behind / Lapsed:** surfaced as bare pill words (`"N session(s) behind"`, `"Back after Nd"`, LogView.tsx:105-108), no reachable why, even though the engine knows the missed slots and the never-punish behavior.

The cost is both a trust gap (the moat is traceable, explainable adaptation) and a coming i18n tax: ~4 deload strings + 2 progression strings to translate and keep honest instead of one each.

## Goal

One mechanism, no second explanation path. A canonical concept registry (`explainCopy.ts`) holds one parameterized why (and optional next) per timeless rule concept. A shared on-demand affordance surfaces it: tap a value, the coach answers, zero chrome until invoked. `decisionCopy`'s cases pull their why/next from the matching concept, so exactly one canonical sentence exists per concept, consumed by every surface (Train card, guided logger, finish debrief, Coach Timeline).

This is the binding i18n seam: it ships before the queued i18n extraction so the future `coaching` namespace translates one sentence per concept and the "translated copy drifted from English" bug class cannot exist.

## Non-goals (accepted pushback, do not drift)

- Engine internals stay silent (anchor ranks, fatigue tiebreaks, caps/floors, role model, variety anchors, supersets, day ordering). Explaining selection mechanics is engineering transparency, not coaching.
- Equipment exclusions stay silent (self-evident).
- Behind / lapsed get an **on-demand** why, never an always-on banner. The calm surface matters most exactly where anxiety is highest.
- The dense Train `card` stays terse. The fix is "make the number tappable", not "make the card talk".
- No new persisted data, no migration, no engine/selection change. Pure copy + presentation. (One small scope question on the "behind" pill wording is raised under Open decisions; it is the only thing that would touch non-copy code, and only if approved.)

## Two affordance kinds (a review correction)

The audit pitched "one gesture: tap a number, the coach answers." Review surfaced that the targets are not one kind of thing, and conflating them muddies both. There are **two affordances sharing one component family**:

1. **Why** (a coaching decision the engine made): a target weight, a deload target, a behind/lapsed status. The user asks "why is it like this". These are the moat-serving surfaces.
2. **Glossary** (a term, not a decision): e1RM, "warm-up", a volume target. The user asks "what does this mean". This is a definition, not a coaching why.

They share the registry shape and the popover/sheet rendering, but they read differently and get different visual affordances (see below). e1RM is a glossary term, not a coaching decision; the spec treats it as such.

## Architecture

Three units, each independently testable.

### 1. `src/lib/pulse/explainCopy.ts` (pure, the registry)

The single source of truth for why/next sentences. Same shape `decisionCopy` established.

```ts
export type ExplainConcept =
    // coaching "why" concepts
    | 'stalled'        // lift has plateaued, no deload applied yet (a diagnosis)
    | 'deload'         // auto-deload IS in effect on a stalled lift (a consequence)
    | 'progression'    // auto-progression target
    | 'behind'         // calendar "behind" status
    | 'lapsed'         // gap / "lapsed" status
    // glossary concepts (definition, not decision)
    | 'e1rm'           // estimated 1-rep max
    | 'warmup'         // warm-up ramp scheme
    | 'volume_target'  // per-muscle weekly volume target
    | 'recovery'       // recovery readout
    | 'strength_score'; // strength-score methodology

export interface ExplainParams {
    /** progression: true if the engine advanced reps (same weight), false if it advanced weight. */
    isRepAdvance?: boolean;
    /** lapsed: real days since the last session. May be non-finite; copy must tolerate it. */
    daysAway?: number;
    /** behind: sessions still waiting this cycle (never rendered as "overdue"). */
    behindBy?: number;
}

export interface ExplainCopy {
    title: string; // the affordance / popover heading, tense-neutral and non-scold
    why: string;   // the canonical reason / definition sentence (unit-agnostic)
    next?: string; // what to do about it (unit-agnostic)
}

/**
 * Canonical explanation for a coaching concept or glossary term.
 * Params are a loose bag (a concept ignores params it doesn't use); the concept
 * key, not the type system, says which params apply:
 *   - progression -> isRepAdvance
 *   - lapsed      -> daysAway (real gap; may be non-finite)
 *   - behind      -> behindBy
 *   - all others  -> no params
 */
export function explainCopy(concept: ExplainConcept, params?: ExplainParams): ExplainCopy;
```

Design rules:
- **Unit-agnostic, like `decisionCopy`.** The why/next never carry kg/lbs or a specific weight. Unit-bearing prescription detail ("Drop to 47.5 kg × 8") stays in the component, where the user's unit lives. The canonical deload why is the rule, not the numbers.
- **`title` is concept-scoped, tense-neutral, and never re-asserts a scold.** For behind/lapsed specifically the title must not lead with "behind" (see drafted copy). It is deliberately separate from `decisionCopy`'s event headlines, which stay past-tense and timeline-appropriate ("Squat deloaded").
- **`stalled` vs `deload` are separate concepts, not one phrasing (review catch B1).** `ExerciseCard.tsx:200` shows "Stalled, no e1RM gain in 3 weeks" when a lift has plateaued but no deload has been applied yet, alongside the user's option to take a lighter week. Replacing that with the `deload` why would tell the user a deload happened when it has not. So: `stalled` = diagnosis (plateau detected, not yet acted on), `deload` = consequence (a deload is now prescribed). The deload-applied banner (`ExerciseCard.tsx:198/199`) and the timeline event use `deload`; the stalled-not-deloaded banner uses `stalled`.
- **Numerals, not words, for the deload "3 weeks" (review catch B2).** The shipped `decisionCopy` string is "No e1RM gain in 3 weeks". Keep the numeral; it matches house Train voice and means the deload `why` is unchanged live, so the parity test passes on day one.

### 2. `decisionCopy` sources why/next from `explainCopy`

`decisionCopy` keeps its event-typed `headline`s (past tense, timeline voice) and its `kind`. Its `why`/`next` strings for `deload` and `progression` are **replaced by** `explainCopy('deload')` / `explainCopy('progression', { isRepAdvance })`. `ramp_back` and `swap` keep their current copy (they are OK in the audit; `ramp_back` is best-in-class). Net: the deload why exists in exactly one place; the Coach Timeline and the Train surfaces render the same sentence.

Parity test (concrete shape):
```ts
const deloadEvent = { type: 'deload', trigger: 'plateau', affectedArea: 'x', week: 5,
    magnitude: { fromKg: 60, toKg: 54 }, confidence: null } as DecisionEventRow;
expect(decisionCopy(deloadEvent, 'Squat').why).toBe(explainCopy('deload').why);

const repAdvance = { type: 'progression', trigger: 'targets_hit', affectedArea: 'x', week: 3,
    magnitude: { fromKg: 40, toKg: 40, fromReps: 8, toReps: 9 }, confidence: null } as DecisionEventRow;
expect(decisionCopy(repAdvance, 'Squat').why).toBe(explainCopy('progression', { isRepAdvance: true }).why);
```
The assertions compare by value (decisionCopy returns the same string explainCopy produces), so the two files cannot silently drift.

### 3. `src/components/pulse/Why.tsx` (the shared affordance) + `WhyPopover`

One client component, two visual treatments, one rendering core.

```tsx
<Why concept="progression" params={{ isRepAdvance }} variant="why">
    <span>47.5 kg × 8</span>
</Why>
<Why concept="e1rm" variant="glossary">e1RM</Why>
```

- **Affordance treatment (resolves the audit's one open visual fork; both reviews converged):** do NOT ship a single global treatment.
  - `variant="why"` on a **numeric prescription or a status word** (target weight, deload target, behind/lapsed pill): a **trailing muted "ⓘ" glyph** (12px, `text-pulse-muted`). A dotted underline under a weight reads as an input error at the exact moment the user is loading a bar, so numbers never get the underline.
  - `variant="glossary"` on a **term / acronym** (e1RM, "warm-up"): a **dotted underline** (`underline decoration-dotted decoration-pulse-muted underline-offset-2`), the established web convention for "tap for a definition". This reads correctly on a word, wrong on a number.
  - Recommended default if a caller omits `variant`: `why` (the ⓘ). This is the one user-facing visual decision; see Open decisions.
- Renders `children` plus the affordance glyph/underline inside a `button` carrying `aria-label={title}` (e.g. "Why this target", "What is e1RM"). The `aria-label` lives on the **button**, not on any wrapping `span`; where a surface previously labeled the value span (e.g. `SetLogger.tsx:398`'s "Deload target"/"Auto-progression target"), that label is removed from the span so screen readers announce the explanation once (review catch B2-arch).
- **Responsive surface, mirrors `AppShell`:** `useMediaQuery('(min-width: 1024px)')`. Mobile reuses `ModalSheet` (title + body). Desktop opens `WhyPopover` anchored to the trigger.
- **`WhyPopover` is a real dialog, not a bare tooltip (review catch 1-arch):** `role="dialog"`, `aria-label={title}`, rendered with a **transparent full-screen backdrop** (the click-outside hook, mirroring how `ModalSheet` uses its overlay) so dismissal and event handling are owned in one place and never fight `SetLogger`'s input focus / plate-calculator clicks. Focus moves into the popover on open and returns to the trigger on close (close = Escape, backdrop click, or a second tap of the trigger). Focus is contained to the popover + trigger while open.
- **Positioning:** an optional `position?: 'top' | 'bottom' | 'auto'` hint (default `auto`) plus a viewport clamp so the popover never hard-clips off the right/left edge. This is not full collision detection; the known v1 limitation is that the e1RM glossary popover near a chart edge may need the clamp or fall back to the sheet. Documented, not solved in v1.
- **Body:** `why` as the lead sentence, `next` as a second muted line when present. No weights rendered here (unit-agnostic); the number the user tapped is already on screen.

## Build order (deliberately not the audit's impact ranking)

Each step is its own commit; the suite stays green between them.

1. **Mechanism.** `explainCopy.ts` (with `stalled` + `deload` + `progression` to start) + `Why` + `WhyPopover` + unit tests (registry returns, params branches) + a component test (tap opens, Escape/backdrop/second-tap closes, aria-label present, desktop vs mobile branch, focus return). No surface wiring yet.
2. **Deload unification.** Point `decisionCopy` deload why/next at `explainCopy('deload')`. Route the deload-applied strings in `ExerciseCard` (line 199), `SetLogger` (the line 401 deload sentence), and `FinishDebrief` through `explainCopy('deload')` for the **why** (surfaces keep their terse headline/glyph and their unit-bearing prescription number). Route `ExerciseCard`'s stalled-but-not-deloaded banner (line 200) through `explainCopy('stalled')` (NOT deload). Make the `SetLogger` deload target number a `Why concept="deload" variant="why"` trigger; move its `aria-label` to the button. Parity test added. Pure plumbing.
3. **Progression-card tappable.** Wrap the `card`-variant target number in `SetLogger` with `Why concept="progression" variant="why"`. Point `decisionCopy` progression why/next at `explainCopy('progression', { isRepAdvance })`. The card stays terse; only the number becomes tappable. Pure plumbing.
4. **Behind / lapsed why.** NEW copy in `explainCopy` (drafted below), wired as a `Why` trigger on the status pill in the surface that renders it (`ProgramStatusCard` / Train status row, located during implementation). On-demand, never an always-on banner.
5. **Glossary + remaining one-liners (in this entry, capacity-permitting; each is a concept + one wrap).**
   - e1RM (`variant="glossary"`): wrap the acronym in **BestLifts and the Progress > Lifts header in v1**; defer the long tail (every chart label, SessionDetailModal, milestones) to a follow-on so this is genuinely "a few wraps", not "everywhere" (review catch 8-arch).
   - warm-up (`variant="glossary"`): the warm-up label in `ExerciseCard` expanded.
   - volume_target: wire on the `MuscleVolumeBars` **header label**, not the bars themselves (the bar stays free for a future drill-in; review catch B4).
   - recovery: the `RecoveryTile` status word.
   - strength_score: inside `StrengthBreakdownModal` (already a drill-in context).

## Drafted copy for the new + transparency-risk concepts (pre-written, not left to the implementer)

These are the ones a review flagged as most likely to go wrong unsupervised. Pulse voice, no em dashes, "you", never-punish, no engine internals.

**`stalled`** (diagnosis, no deload yet)
- title: "Why this looks stalled"
- why: "No e1RM gain in 3 weeks on this lift."
- next: "Hold the weight and aim to beat your reps, or take a lighter week."

**`deload`** (deload applied; the canonical sentence `decisionCopy` will reuse verbatim)
- title: "Why this deload"
- why: "No e1RM gain in 3 weeks, so the lift stalled."
- next: "Lighter targets this week to break the plateau, then build back up."

**`progression`** (canonical; reused by `decisionCopy`)
- isRepAdvance true: why "You hit your target reps at the prescribed RIR." / next "Add a rep this session at the same weight."
- isRepAdvance false: why "You hit the top of the rep range at your target RIR." / next "Heavier this session, reps reset to the bottom of the range."

**`behind`** (params: `behindBy`)
- title: "Your schedule" (neutral, not "Why you're behind")
- why: "Your plan moves with you. A few sessions are still waiting, not overdue, so nothing is lost."
- next: "Just pick up at your next session. The plan slides forward to meet you."

**`lapsed`** (params: `daysAway`)
- title: "Welcome back"
- why (finite): "It's been {daysAway} days since your last session. Time off is fine; your program waited for you, it didn't run on without you."
- why (non-finite/unknown): "It's been a while since your last session. Time off is fine; your program waited for you."
- next: "Start with this week's session. If you've been away a while, we'll ease the first one back."

**`e1rm`** (glossary)
- title: "What is e1RM"
- why: "Estimated one-rep max: the most you could lift once, calculated from your sets."

**`warmup`** (glossary)
- title: "Warm-up sets"
- why: "Lighter ramp-up sets to prep the movement before your working weight."

**`volume_target`** (kept coaching-shaped, NOT provenance; review catch on engineering transparency)
- title: "Weekly volume target"
- why: "A weekly set target that keeps this muscle growing without overdoing it."

**`recovery`**
- title: "Recovery"
- why: "Based on how hard and how recently you trained each muscle."

**`strength_score`** (outcome-framed, methodology stays invisible; review catch on engineering transparency)
- title: "Strength score"
- why: "How strong your main lifts are relative to typical standards for your bodyweight."

## Testing

- `explainCopy.test.ts`: every concept returns non-empty `title` + `why`; progression branches on `isRepAdvance`; lapsed interpolates a finite `daysAway` and tolerates a non-finite value (mirrors `decisionCopy`'s ramp_back guard); `stalled.why !== deload.why`; behind/lapsed titles do not contain the word "behind"; no em dash in any returned string.
- `decisionCopy.test.ts`: add the parity assertions above (deload + both progression branches).
- `Why.test.tsx`: renders children + the right affordance per `variant`; trigger has the concept's `aria-label`; tap opens the body with `why` (+ `next` when present); Escape, backdrop click, and second-tap all close; focus returns to the trigger on close; mobile branch renders `ModalSheet`, desktop branch renders `WhyPopover` (drive `useMediaQuery` via the existing `AppShell` test seam).
- Surface tests (`SetLogger`, `ExerciseCard`, `FinishDebrief`, `ProgramStatusCard`): the canonical why is reachable where wired; the stalled banner reaches `stalled` copy not `deload`; the dense card still shows its terse number (no regression to "the card talks").

## i18n readiness

`explainCopy` returns plain strings keyed by concept, the exact shape a `coaching` message namespace will adopt: one entry per concept, parameters as ICU args (`isRepAdvance`, `daysAway`, `behindBy`). No translation work here; the point is that when i18n lands there is one string per concept to translate, already isolated. This spec is the binding predecessor to the i18n extraction.

## Risk / rollback

Pure copy + presentation, no data or engine change, so rollback is reverting the commits. The one behavioral surface area is focus management in `WhyPopover`; the component test covers open/close (Escape/backdrop/second-tap)/focus-return. The affordance choice is reversible in one place (the `Why` wrapper).

## Open decisions for review

1. **Affordance treatment (recommended, both reviews agree):** ⓘ glyph on numeric prescriptions + status words (`variant="why"`), dotted underline on glossary terms (`variant="glossary"`). Rationale: a dotted underline under a weight target reads as an input error. Confirm, or pick a single global treatment (then ⓘ wins overall).
2. **"Behind" pill wording (small scope question).** The reachable why reframes "behind" warmly, but the pill itself still reads `"N session(s) behind"`, a scold the user sees before tapping. Options: (a) keep the pill as-is, add only the on-demand why (in scope, pure copy); (b) also soften the pill word (touches `formatProgramStatus`/LogView, a small extension beyond "pure copy"). Recommendation: (a) for this entry, log (b) as a follow-on. Confirm.
