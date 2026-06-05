import type { Gender, StrengthScore } from './types';

// The four main lifts the strength score is built from.
export type MainLift = 'bench' | 'squat' | 'deadlift' | 'ohp';

// Bodyweight-multiple thresholds per lift per gender. Five ascending values map to
// the score anchors [0, 25, 50, 75, 100], i.e. Untrained -> Novice ->
// Intermediate -> Advanced -> Elite. A lifter's e1RM / bodyweight ratio is
// scored against these via scoreRatio.
export const STRENGTH_STANDARDS: Record<Gender, Record<MainLift, number[]>> = {
    male: {
        bench: [0.5, 0.75, 1.25, 1.75, 2.0],
        squat: [0.75, 1.25, 1.5, 2.25, 2.75],
        deadlift: [1.0, 1.5, 2.0, 2.5, 3.0],
        ohp: [0.35, 0.55, 0.8, 1.1, 1.4],
    },
    female: {
        bench: [0.35, 0.5, 0.75, 1.0, 1.5],
        squat: [0.5, 0.75, 1.25, 1.75, 2.0],
        deadlift: [0.5, 1.0, 1.25, 1.75, 2.5],
        ohp: [0.2, 0.35, 0.5, 0.75, 1.0],
    },
};

// Human title per main lift, shown in the per-lift breakdown.
const LIFT_LABELS: Record<MainLift, string> = {
    bench: 'Bench Press',
    squat: 'Squat',
    deadlift: 'Deadlift',
    ohp: 'Overhead Press',
};

// The score anchors the five thresholds map to, in order.
const ANCHORS = [0, 25, 50, 75, 100];

// Classify a resolved exercise name into a main lift, or null if it is not one.
// Order matters: 'deadlift' and 'squat' are checked before nothing else can
// shadow them; 'bench' wins on contains. Case-insensitive substring match.
export function classifyLift(name: string): MainLift | null {
    const n = name.toLowerCase();
    if (n.includes('bench')) return 'bench';
    if (n.includes('deadlift')) return 'deadlift';
    if (n.includes('squat')) return 'squat';
    if (n.includes('overhead') || n.includes('ohp') || n.includes('shoulder press') || n.includes('military')) {
        return 'ohp';
    }
    return null;
}

// Score a bodyweight-multiple ratio against ascending thresholds, returning a
// rounded 0-100. Below thresholds[0] is 0, at/above thresholds[4] is 100, and
// in between it is piecewise-linear: 25 points per band between the bracketing
// anchors.
export function scoreRatio(ratio: number, thresholds: number[]): number {
    if (ratio <= thresholds[0]) return 0;
    if (ratio >= thresholds[thresholds.length - 1]) return 100;
    for (let i = 1; i < thresholds.length; i++) {
        if (ratio < thresholds[i]) {
            const lo = thresholds[i - 1];
            const hi = thresholds[i];
            const frac = (ratio - lo) / (hi - lo);
            return Math.round(ANCHORS[i - 1] + frac * (ANCHORS[i] - ANCHORS[i - 1]));
        }
    }
    return 100;
}

// Map an overall 0-100 score to a level label using the band boundaries.
function levelFor(score: number): string {
    if (score < 25) return 'Beginner';
    if (score < 50) return 'Novice';
    if (score < 75) return 'Intermediate';
    if (score < 90) return 'Advanced';
    return 'Elite';
}

// Compute the strength score from the user's gender, bodyweight, and best lifts.
// Returns a null score with a reason when prerequisites are missing.
export function computeStrengthScore(args: {
    gender: Gender | null;
    bodyweightKg: number | null;
    lifts: Array<{ name: string; e1rm: number }>;
}): StrengthScore {
    const { gender, bodyweightKg, lifts } = args;
    if (gender === null) {
        return { score: null, level: null, reason: 'Set your gender in Profile to get a strength score.', lifts: [] };
    }
    if (bodyweightKg === null || bodyweightKg <= 0) {
        return { score: null, level: null, reason: 'Log your bodyweight to get a strength score.', lifts: [] };
    }

    // Keep the best e1RM per main lift.
    const bestByLift = new Map<MainLift, number>();
    for (const { name, e1rm } of lifts) {
        const lift = classifyLift(name);
        if (!lift) continue;
        if (e1rm > (bestByLift.get(lift) ?? 0)) bestByLift.set(lift, e1rm);
    }

    if (bestByLift.size === 0) {
        return {
            score: null,
            level: null,
            reason: 'Log a main lift (bench, squat, deadlift, or overhead press) to get a strength score.',
            lifts: [],
        };
    }

    const order: MainLift[] = ['bench', 'squat', 'deadlift', 'ohp'];
    const breakdown = order
        .filter((lift) => bestByLift.has(lift))
        .map((lift) => {
            const e1rm = bestByLift.get(lift) as number;
            const ratio = e1rm / bodyweightKg;
            const subScore = scoreRatio(ratio, STRENGTH_STANDARDS[gender][lift]);
            return { lift, label: LIFT_LABELS[lift], subScore, ratio };
        });

    const score = Math.round(breakdown.reduce((sum, l) => sum + l.subScore, 0) / breakdown.length);
    return { score, level: levelFor(score), reason: null, lifts: breakdown };
}
