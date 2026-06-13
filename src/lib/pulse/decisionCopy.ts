import type { DecisionEventRow, DecisionEventType } from './types';
import { explainCopy } from './explainCopy';

export interface DecisionCopy {
    // The event type, kept for the UI to pick the glyph and colour.
    kind: DecisionEventType;
    headline: string;
    why: string;
    next?: string;
}

// Turn one logged decision into plain-language copy: what changed (headline), why
// (the trigger), and what to do next. Pure and unit-agnostic on purpose, the
// weight delta + relative time live in the component, where the user's unit does.
// `exerciseName` is the resolved name for the affected lift, or null when it is a
// program-wide decision (ramp-back) or the lift can no longer be resolved.
export function decisionCopy(event: DecisionEventRow, exerciseName: string | null): DecisionCopy {
    const name = exerciseName?.trim() || null;

    switch (event.type) {
        case 'deload': {
            // The why/next are single-sourced from the canonical concept registry
            // so the timeline and the Train surfaces render the same sentence.
            const e = explainCopy('deload');
            return {
                kind: 'deload',
                headline: name ? `${name} deloaded` : 'Lift deloaded',
                why: e.why,
                next: e.next,
            };
        }

        case 'progression': {
            // A weight advance resets reps to the bottom of the range; a rep advance
            // holds the weight. Read it off the stored magnitude.
            const { fromKg, toKg, fromReps, toReps } = event.magnitude;
            const isRepAdvance =
                fromKg != null &&
                toKg != null &&
                toKg <= fromKg &&
                fromReps != null &&
                toReps != null &&
                toReps > fromReps;
            return {
                kind: 'progression',
                headline: name ? `${name} progressed` : 'Lift progressed',
                why: isRepAdvance
                    ? 'You hit your target reps at the prescribed RIR.'
                    : 'You hit the top of the rep range at your target RIR.',
                next: isRepAdvance
                    ? 'Add a rep this session at the same weight.'
                    : 'Heavier this session, reps reset to the bottom of the range.',
            };
        }

        case 'ramp_back': {
            // A user-initiated lighten reads differently from a gap-driven re-entry:
            // it does not insert a week, so progression continues as normal.
            if (event.trigger === 'manual') {
                return {
                    kind: 'ramp_back',
                    headline: 'Lighter week',
                    why: 'You chose to go easier this week.',
                    next: 'An easier RIR target this week; your progression continues normally.',
                };
            }
            const daysAway = event.magnitude.daysAway;
            const why =
                typeof daysAway === 'number' && Number.isFinite(daysAway)
                    ? `${daysAway} days since your last session, so we eased you back in.`
                    : 'After a break in training, we eased you back in.';
            return {
                kind: 'ramp_back',
                headline: 'Ramp-back week added',
                why,
                next: 'An easier RIR target this week, then back to the plan.',
            };
        }

        case 'swap':
        default:
            return {
                kind: 'swap',
                headline: name ? `Swapped ${name}` : 'Exercise swapped',
                why: 'You changed the exercise for this slot.',
            };
    }
}

// Group an already-ordered (newest-first) decision list into week buckets,
// preserving order: weeks appear in first-seen order, events keep their order
// within each week. Used by the full timeline's week headers.
export function groupDecisionsByWeek(events: DecisionEventRow[]): Array<{ week: number; events: DecisionEventRow[] }> {
    const groups: Array<{ week: number; events: DecisionEventRow[] }> = [];
    for (const event of events) {
        const last = groups[groups.length - 1];
        if (last && last.week === event.week) {
            last.events.push(event);
        } else {
            groups.push({ week: event.week, events: [event] });
        }
    }
    return groups;
}
