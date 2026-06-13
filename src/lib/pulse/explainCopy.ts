// The canonical concept registry: one parameterized "why" (and optional "next")
// per timeless rule concept or glossary term. This is the single source of truth
// for the explain layer. `decisionCopy` sources its deload / progression why+next
// from here, and the shared <Why> affordance renders these strings on demand, so
// exactly one canonical sentence exists per concept across every surface (Train
// card, guided logger, finish debrief, Coach Timeline).
//
// It is also the binding i18n seam: when the queued i18n extraction lands, the
// `coaching` namespace adopts this shape (one entry per concept, params as ICU
// args), so "translated copy drifted from English" cannot happen.

export type ExplainConcept =
    // coaching "why" concepts (a decision the engine made)
    | 'stalled' // lift has plateaued, no deload applied yet (a diagnosis)
    | 'deload' // auto-deload IS in effect on a stalled lift (a consequence)
    | 'progression' // auto-progression target
    | 'behind' // calendar "behind" status
    | 'lapsed' // gap / "lapsed" status
    // glossary concepts (a definition, not a decision)
    | 'e1rm' // estimated 1-rep max
    | 'warmup' // warm-up ramp scheme
    | 'volume_target' // per-muscle weekly volume target
    | 'recovery' // recovery readout
    | 'strength_score' // strength-score methodology
    | 'rir' // reps in reserve (proximity to failure)
    | 'phase' // periodized training phases (the block arc)
    | 'deload_week'; // a planned program deload week (distinct from the stalled-lift `deload` above)

export interface ExplainParams {
    /** progression: true if the engine advanced reps (same weight), false if it advanced weight. */
    isRepAdvance?: boolean;
    /** lapsed: real days since the last session. May be non-finite; copy tolerates it. */
    daysAway?: number;
    /** behind: sessions still waiting this cycle (never rendered as "overdue"). */
    behindBy?: number;
}

export interface ExplainCopy {
    /** The affordance / popover heading, tense-neutral and non-scold. */
    title: string;
    /** The canonical reason / definition sentence (unit-agnostic). */
    why: string;
    /** What to do about it (unit-agnostic). Absent for glossary definitions. */
    next?: string;
}

/**
 * Canonical explanation for a coaching concept or glossary term.
 *
 * Params are a loose bag (a concept ignores params it doesn't use); the concept
 * key, not the type system, says which params apply:
 *   - progression -> isRepAdvance
 *   - lapsed      -> daysAway (real gap; may be non-finite)
 *   - behind      -> behindBy
 *   - all others  -> no params
 *
 * Unit-agnostic on purpose, like `decisionCopy`: the why/next never carry a
 * weight or kg/lbs. The number the user tapped is already on screen; the
 * unit-bearing prescription detail stays in the component, where the unit lives.
 */
export function explainCopy(concept: ExplainConcept, params: ExplainParams = {}): ExplainCopy {
    switch (concept) {
        case 'stalled':
            // Diagnosis: the plateau is detected but no deload has been applied yet.
            // Distinct from `deload`, which would wrongly claim a deload happened.
            return {
                title: 'Why this looks stalled',
                why: 'No e1RM gain in 3 weeks on this lift.',
                next: 'Hold the weight and aim to beat your reps, or take a lighter week.',
            };

        case 'deload':
            // Consequence: a deload is now prescribed. This `why`/`next` is the
            // canonical pair `decisionCopy` reuses verbatim (parity test-locked).
            return {
                title: 'Why this deload',
                why: 'No e1RM gain in 3 weeks, so the lift stalled.',
                next: 'Lighter targets this week to break the plateau, then build back up.',
            };

        case 'progression':
            // A rep advance holds the weight; a weight advance resets reps. Reused
            // by decisionCopy's progression case (parity test-locked).
            return params.isRepAdvance
                ? {
                      title: 'Why this target',
                      why: 'You hit your target reps at the prescribed RIR.',
                      next: 'Add a rep this session at the same weight.',
                  }
                : {
                      title: 'Why this target',
                      why: 'You hit the top of the rep range at your target RIR.',
                      next: 'Heavier this session, reps reset to the bottom of the range.',
                  };

        case 'behind':
            // Never-punish: the plan slides forward, sessions wait, nothing is lost.
            // The title stays neutral and must not lead with "behind".
            return {
                title: 'Your schedule',
                why: 'Your plan moves with you. A few sessions are still waiting, not overdue, so nothing is lost.',
                next: 'Just pick up at your next session. The plan slides forward to meet you.',
            };

        case 'lapsed': {
            const d = params.daysAway;
            const why =
                typeof d === 'number' && Number.isFinite(d)
                    ? `It's been ${d} days since your last session. Time off is fine; your program waited for you, it didn't run on without you.`
                    : "It's been a while since your last session. Time off is fine; your program waited for you.";
            return {
                title: 'Welcome back',
                why,
                next: "Start with this week's session. If you've been away a while, we'll ease the first one back.",
            };
        }

        case 'e1rm':
            return {
                title: 'What is e1RM',
                why: 'Estimated one-rep max: the most you could lift once, calculated from your sets.',
            };

        case 'warmup':
            return {
                title: 'Warm-up sets',
                why: 'Lighter ramp-up sets to prep the movement before your working weight.',
            };

        case 'volume_target':
            // Kept coaching-shaped, not engine provenance (the set-count math stays invisible).
            return {
                title: 'Weekly volume target',
                why: 'A weekly set target that keeps this muscle growing without overdoing it.',
            };

        case 'recovery':
            return {
                title: 'Recovery',
                why: 'Based on how hard and how recently you trained each muscle.',
            };

        case 'strength_score':
            // Outcome-framed; the scoring methodology stays invisible.
            return {
                title: 'Strength score',
                why: 'How strong your main lifts are relative to typical standards for your bodyweight.',
            };

        case 'rir':
            return {
                title: 'What is RIR',
                why: 'Reps in reserve: how many more reps you could do before failure. RIR 3 leaves a few in the tank; RIR 0 is all-out.',
            };

        case 'phase':
            return {
                title: 'Training phases',
                why: 'Your program runs in phases that gradually raise the effort, then a deload week to recover. The cycle then repeats.',
            };

        case 'deload_week':
            // The planned program deload (block-arc), NOT the stalled-lift auto-deload.
            // No supercompensation overclaim: fatigue management is the defensible claim.
            return {
                title: 'What is a deload',
                why: 'A planned lighter week, less volume and easier effort, so built-up fatigue clears before the next block. Not a break, just easier.',
            };
    }
}

// Per-phase plain-language descriptions for the Plan block arc, keyed by the
// phase subtitle (see data.ts PHASES). Data-accurate to the actual volume ramp
// (volume climbs through the block, it is not the textbook "volume falls as
// intensity rises" model), and deliberately free of any supercompensation
// ("come back stronger") overclaim. Registry-homed here, not in program data, so
// the i18n extraction has one canonical sentence per phase.
export const PHASE_DESCRIPTIONS: Record<string, string> = {
    Accumulation:
        'Building your base. Volume starts manageable and climbs week to week, with a rep or two left in the tank so you adapt and recover well.',
    Intensification: 'Pushing harder. Volume keeps building and you train closer to your limit as the block ramps up.',
    Overreach: 'The hardest stretch, by design. Peak volume with sets taken close to failure to drive new adaptation.',
    'Peak & Deload':
        'One last hard push, then a lighter deload week so accumulated fatigue clears before the next block.',
    Deload: 'A lighter week. Less volume and easier effort so fatigue clears before the next block.',
};
