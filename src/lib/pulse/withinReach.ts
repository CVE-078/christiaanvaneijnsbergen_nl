import type { AdherenceStatus } from './types';

// A small forward-looking "within reach" hook for the Progress overview: the one
// near-term goal worth nudging toward. Progress is otherwise all rear-view, so
// this turns it from a report card into a bit of motivation. Pure and calm by
// design: it returns null far more often than not, so the surface stays quiet
// until something is genuinely close.

export interface WithinReach {
    text: string;
    kind: 'block' | 'milestone';
}

// How close (in sessions) the end of the block must be before we nudge, scaled to
// the user's weekly cadence so it means "roughly the last week and a half".
const blockThreshold = (sessionsPerWeek: number) => sessionsPerWeek + 2;
// Session-count milestones land every 10 sessions; nudge only when within this many.
const MILESTONE_WINDOW = 3;

export function computeWithinReach(args: {
    completedCount: number;
    sessionsPerWeek: number;
    programWeeks: number;
    status: AdherenceStatus;
}): WithinReach | null {
    const { completedCount, sessionsPerWeek, programWeeks, status } = args;

    // Don't nudge toward a goal while paused or lapsed; those states hand off to
    // pause / ramp-back, and "finish your block" would read wrong mid-break.
    if (status === 'paused' || status === 'lapsed') return null;
    if (completedCount <= 0 || sessionsPerWeek <= 0 || programWeeks <= 0) return null;

    // Sessions remaining to finish the current block (completion-paced). Uses the
    // position within the block so it resets cleanly each cycle.
    const sessionsPerBlock = sessionsPerWeek * programWeeks;
    const doneInBlock = completedCount % sessionsPerBlock;
    const toFinishBlock = doneInBlock === 0 ? 0 : sessionsPerBlock - doneInBlock;
    const blockClose = toFinishBlock >= 1 && toFinishBlock <= blockThreshold(sessionsPerWeek);

    // Sessions remaining to the next every-10 workout milestone.
    const toMilestone = (10 - (completedCount % 10)) % 10;
    const nextMilestone = completedCount + toMilestone;
    const milestoneClose = toMilestone >= 1 && toMilestone <= MILESTONE_WINDOW;

    // Prefer whichever is more imminent; the block finish wins ties (more meaningful).
    const blockCandidate: WithinReach | null = blockClose
        ? {
              kind: 'block',
              text: `${toFinishBlock} ${session(toFinishBlock)} to finish your ${programWeeks}-week block`,
          }
        : null;
    const milestoneCandidate: WithinReach | null = milestoneClose
        ? { kind: 'milestone', text: `${toMilestone} ${session(toMilestone)} to your ${nextMilestone}th workout` }
        : null;

    if (blockCandidate && milestoneCandidate) {
        return toMilestone < toFinishBlock ? milestoneCandidate : blockCandidate;
    }
    return blockCandidate ?? milestoneCandidate;
}

function session(n: number): string {
    return n === 1 ? 'session' : 'sessions';
}
