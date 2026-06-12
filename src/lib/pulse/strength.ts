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

// Neutral standard for when no gender is set: the midpoint of the male and female
// thresholds per lift/level. Strength standards are genuinely gender-based, so this is
// a reasonable "unspecified" baseline that scores everyone without gating; setting
// gender in Profile refines it to the gender-specific table. The average of two
// ascending sequences is itself ascending, so the bands stay valid.
export const NEUTRAL_STANDARDS: Record<MainLift, number[]> = (
    ['bench', 'squat', 'deadlift', 'ohp'] as MainLift[]
).reduce(
    (acc, lift) => {
        acc[lift] = STRENGTH_STANDARDS.male[lift].map((m, i) => (m + STRENGTH_STANDARDS.female[lift][i]) / 2);
        return acc;
    },
    {} as Record<MainLift, number[]>,
);

// Resolve the threshold table for a (possibly unset) gender. Null -> neutral.
export function standardsFor(gender: Gender | null): Record<MainLift, number[]> {
    return gender ? STRENGTH_STANDARDS[gender] : NEUTRAL_STANDARDS;
}

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

// Compute the strength score from the user's bodyweight and best lifts. Gender is
// optional: with it, the gender-specific standards are used; without it, a neutral
// (gender-midpoint) standard scores anyway and the result is flagged `approximate`.
// Returns a null score with a reason only when bodyweight or a main lift is missing.
export function computeStrengthScore(args: {
    gender: Gender | null;
    bodyweightKg: number | null;
    lifts: Array<{ name: string; e1rm: number }>;
}): StrengthScore {
    const { gender, bodyweightKg, lifts } = args;
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

    const standards = standardsFor(gender);
    const order: MainLift[] = ['bench', 'squat', 'deadlift', 'ohp'];
    const breakdown = order
        .filter((lift) => bestByLift.has(lift))
        .map((lift) => {
            const e1rm = bestByLift.get(lift) as number;
            const ratio = e1rm / bodyweightKg;
            const subScore = scoreRatio(ratio, standards[lift]);
            return { lift, label: LIFT_LABELS[lift], subScore, ratio };
        });

    const score = Math.round(breakdown.reduce((sum, l) => sum + l.subScore, 0) / breakdown.length);
    return { score, level: levelFor(score), reason: null, approximate: gender === null, lifts: breakdown };
}

// Strength score as a weekly series. For each week present in any lift's
// history, score the cumulative best e1RM per lift as of that week. Bodyweight
// is deliberately held at the current value across the series: this isolates
// e1RM progress so the trend reads as "are my lifts going up". Bodyweight change
// is covered by the Recomp dashboard, folding it in here would conflate two
// signals (a cut/recomp would move the score from weight loss, not lifting).
export function computeStrengthScoreSeries(args: {
    gender: Gender | null;
    bodyweightKg: number | null;
    liftsByWeek: Array<{ name: string; history: Array<{ week: number; e1rm: number }> }>;
}): Array<{ week: number; score: number }> {
    const { gender, bodyweightKg, liftsByWeek } = args;
    const weeks = new Set<number>();
    for (const l of liftsByWeek) for (const h of l.history) weeks.add(h.week);
    const out: Array<{ week: number; score: number }> = [];
    for (const w of [...weeks].sort((a, b) => a - b)) {
        const lifts = liftsByWeek
            .map(({ name, history }) => {
                const upto = history.filter((h) => h.week <= w).map((h) => h.e1rm);
                return upto.length ? { name, e1rm: Math.max(...upto) } : null;
            })
            .filter((x): x is { name: string; e1rm: number } => x !== null);
        const { score } = computeStrengthScore({ gender, bodyweightKg, lifts });
        if (score !== null) out.push({ week: w, score });
    }
    return out;
}

export interface StrengthDelta {
    text: string;
    tone: 'up' | 'down' | 'flat' | 'none';
}

// Tile delta label: latest score vs the first point of the series.
export function strengthDeltaLabel(series: Array<{ week: number; score: number }>): StrengthDelta {
    if (series.length < 2) return { text: 'log lifts to see', tone: 'none' };
    const delta = series[series.length - 1].score - series[0].score;
    if (delta > 0) return { text: `▲ ${delta} this cycle`, tone: 'up' };
    if (delta < 0) return { text: `▼ ${Math.abs(delta)} this cycle`, tone: 'down' };
    return { text: 'no change', tone: 'flat' };
}
