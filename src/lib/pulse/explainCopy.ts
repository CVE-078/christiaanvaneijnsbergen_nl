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
    /** recovery: the readout's tone, so the copy explains the current state, not a generic blurb. */
    recoveryTone?: 'fresh' | 'ready' | 'watch' | 'easeoff' | 'none';
    /** recovery: the muscle categories driving the state (watch / ease off), for the "which" line. */
    recoveryMuscles?: string[];
}

/** A scale legend row (e.g. the recovery states), rendered with a tone-coloured dot. */
export interface ExplainLegendRow {
    tone: 'success' | 'warn' | 'error';
    label: string;
    desc: string;
}

export interface ExplainCopy {
    /** The affordance / popover heading, tense-neutral and non-scold. */
    title: string;
    /** The canonical reason / definition sentence (unit-agnostic). */
    why: string;
    /** What to do about it (unit-agnostic). Absent for glossary definitions. */
    next?: string;
    /** Optional scale legend (only recovery uses it today), shown under the why. */
    legend?: ExplainLegendRow[];
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// "Chest", "Chest and Back", "Chest, Back and 2 more": the recovery "which" line.
function musclePhrase(muscles: string[]): string {
    if (muscles.length === 0) return 'Your muscles';
    if (muscles.length === 1) return muscles[0];
    if (muscles.length === 2) return `${muscles[0]} and ${muscles[1]}`;
    return `${muscles.slice(0, 2).join(', ')} and ${muscles.length - 2} more`;
}

// The recovery scale, explained once. Shown in the recovery "why" so every state
// is legible, not just the active one (the original tile only labelled the word).
const RECOVERY_LEGEND: ExplainLegendRow[] = [
    { tone: 'success', label: 'Fresh', desc: 'every trained muscle recovered and on target.' },
    { tone: 'success', label: 'Ready', desc: 'nothing overworked, with room for more volume.' },
    { tone: 'warn', label: 'Watch', desc: 'at full volume and trained close to failure.' },
    { tone: 'error', label: 'Ease off', desc: 'past the weekly volume target, dial it back.' },
];

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

        case 'recovery': {
            // State-aware: the popover explains the CURRENT state (which muscles +
            // the cause + what to do) and shows the full scale, so "Watch" is no
            // longer an unexplained word. Recovery is read from how hard and how
            // recently each muscle was trained relative to its weekly volume target.
            const tone = params.recoveryTone ?? 'none';
            const muscles = (params.recoveryMuscles ?? []).map(cap);
            const phrase = musclePhrase(muscles);
            const verb = muscles.length === 1 ? 'is' : 'are';
            const them = muscles.length === 1 ? 'it' : 'them';
            switch (tone) {
                case 'easeoff':
                    return {
                        title: 'Recovery: Ease off',
                        why: `${phrase} ${verb} past the weekly volume target and carrying high fatigue.`,
                        next: `Back off the volume or rest ${them} a day before training hard again.`,
                        legend: RECOVERY_LEGEND,
                    };
                case 'watch':
                    return {
                        title: 'Recovery: Watch',
                        why: `${phrase} ${verb} getting heavy: you have hit the weekly volume and trained close to failure (low reps in reserve).`,
                        next: `Not a problem yet, just worth watching. Train ${them} lighter or give ${them} an extra day.`,
                        legend: RECOVERY_LEGEND,
                    };
                case 'fresh':
                    return {
                        title: 'Recovery: Fresh',
                        why: 'Every muscle you have trained is recovered and on target, with no lingering fatigue.',
                        next: 'Good to train as planned.',
                        legend: RECOVERY_LEGEND,
                    };
                case 'ready':
                    return {
                        title: 'Recovery: Ready',
                        why: 'Nothing is overworked, and some muscles are under their weekly volume, so there is room to do more.',
                        next: 'Add a set or bring up a muscle that is behind.',
                        legend: RECOVERY_LEGEND,
                    };
                default:
                    return {
                        title: 'Recovery',
                        why: 'Log a session and this shows which muscles are fresh and which are carrying fatigue, from how hard and how recently you trained each one.',
                    };
            }
        }

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
