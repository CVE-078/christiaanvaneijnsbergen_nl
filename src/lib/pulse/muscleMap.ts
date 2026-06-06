import type { MovementPattern, ExerciseCategory } from './types';

// Weighted contribution of a MovementPattern to Pulse's 10 reporting categories.
// v1 bridge from the Phase 0 design doc §1
// (docs/superpowers/designs/2026-06-06-00-54-52-phase0-source-material.md); hinge's
// back-share was raised 0.10 → 0.15 per the 2026-06-06 volume-science review (a hinge
// carries real erector/lat load that 0.10 understated).
//
// The weights are contribution SIGNALS, not a probability distribution: they sum
// to 1.0 per pattern, but consumers must NOT re-normalize per exercise or session
// (that destroys volume interpretability). The 15 movement patterns stay the
// generation control layer; this map only collapses the muscle-target side into
// the 10 categories (the three-layer rule). `legs` is deliberately one bucket —
// squat vs hinge differ only through their glute proportion (0.25 vs 0.40).
export type MuscleContribution = Partial<Record<ExerciseCategory, number>>;

export const PATTERN_MUSCLE_MAP: Record<MovementPattern, MuscleContribution> = {
    horizontal_push: { chest: 0.55, triceps: 0.25, shoulders: 0.2 },
    vertical_push: { shoulders: 0.55, triceps: 0.3, chest: 0.15 },
    horizontal_pull: { back: 0.7, biceps: 0.2, shoulders: 0.1 },
    vertical_pull: { back: 0.65, biceps: 0.25, shoulders: 0.1 },
    squat: { legs: 0.7, glutes: 0.25, calves: 0.05 },
    hinge: { legs: 0.45, glutes: 0.4, back: 0.15 },
    lunge: { legs: 0.6, glutes: 0.35, calves: 0.05 },
    calf: { calves: 1 },
    core: { abs: 1 },
    chest_iso: { chest: 0.85, shoulders: 0.15 },
    back_iso: { back: 1 },
    shoulder_iso: { shoulders: 1 },
    biceps_iso: { biceps: 1 },
    triceps_iso: { triceps: 1 },
    glute_iso: { glutes: 0.85, legs: 0.15 },
};

// The weighted muscle-category contributions for a movement pattern. Returns a
// shallow copy so callers cannot mutate the shared frozen map.
export function muscleContributions(pattern: MovementPattern): MuscleContribution {
    return { ...PATTERN_MUSCLE_MAP[pattern] };
}

// The single dominant category for a pattern (the highest weight). Ties resolve
// to the first-declared category, since each entry is authored primary-first.
export function primaryMuscle(pattern: MovementPattern): ExerciseCategory {
    const entries = Object.entries(PATTERN_MUSCLE_MAP[pattern]) as [ExerciseCategory, number][];
    return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}
