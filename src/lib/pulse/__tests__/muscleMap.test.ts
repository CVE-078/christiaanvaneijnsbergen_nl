import { describe, it, expect } from 'vitest';
import { PATTERN_MUSCLE_MAP, muscleContributions, primaryMuscle, secondarySets } from '../muscleMap';
import { MOVEMENT_PATTERNS, EXERCISE_CATEGORIES } from '../types';

// Golden tests for the frozen v1 MovementPattern -> muscle bridge
// (docs/superpowers/designs/2026-06-06-00-54-52-phase0-source-material.md §1).
// These lock the canonical map so future engine work can't silently regress it.
describe('PATTERN_MUSCLE_MAP', () => {
    it('covers all 15 movement patterns and nothing else', () => {
        for (const p of MOVEMENT_PATTERNS) {
            expect(PATTERN_MUSCLE_MAP[p]).toBeDefined();
        }
        expect(Object.keys(PATTERN_MUSCLE_MAP)).toHaveLength(MOVEMENT_PATTERNS.length);
    });

    it('weights sum to 1.0 per pattern (contribution signals, never renormalized)', () => {
        for (const p of MOVEMENT_PATTERNS) {
            const sum = Object.values(PATTERN_MUSCLE_MAP[p]).reduce((a, b) => a + b, 0);
            expect(sum).toBeCloseTo(1, 5);
        }
    });

    it('only targets the 10 real categories, each weight in (0, 1]', () => {
        for (const p of MOVEMENT_PATTERNS) {
            for (const [cat, w] of Object.entries(PATTERN_MUSCLE_MAP[p])) {
                expect(EXERCISE_CATEGORIES).toContain(cat);
                expect(w).toBeGreaterThan(0);
                expect(w).toBeLessThanOrEqual(1);
            }
        }
    });

    it('matches the frozen v1 weights exactly (locks the canonical map)', () => {
        expect(PATTERN_MUSCLE_MAP.horizontal_push).toEqual({ chest: 0.55, triceps: 0.25, shoulders: 0.2 });
        expect(PATTERN_MUSCLE_MAP.vertical_push).toEqual({ shoulders: 0.55, triceps: 0.3, chest: 0.15 });
        expect(PATTERN_MUSCLE_MAP.horizontal_pull).toEqual({ back: 0.7, biceps: 0.2, shoulders: 0.1 });
        expect(PATTERN_MUSCLE_MAP.vertical_pull).toEqual({ back: 0.65, biceps: 0.25, shoulders: 0.1 });
        expect(PATTERN_MUSCLE_MAP.squat).toEqual({ legs: 0.7, glutes: 0.25, calves: 0.05 });
        expect(PATTERN_MUSCLE_MAP.hinge).toEqual({ legs: 0.45, glutes: 0.4, back: 0.15 });
        expect(PATTERN_MUSCLE_MAP.lunge).toEqual({ legs: 0.6, glutes: 0.35, calves: 0.05 });
        expect(PATTERN_MUSCLE_MAP.calf).toEqual({ calves: 1 });
        expect(PATTERN_MUSCLE_MAP.core).toEqual({ abs: 1 });
        expect(PATTERN_MUSCLE_MAP.chest_iso).toEqual({ chest: 0.85, shoulders: 0.15 });
        expect(PATTERN_MUSCLE_MAP.back_iso).toEqual({ back: 1 });
        expect(PATTERN_MUSCLE_MAP.shoulder_iso).toEqual({ shoulders: 1 });
        expect(PATTERN_MUSCLE_MAP.biceps_iso).toEqual({ biceps: 1 });
        expect(PATTERN_MUSCLE_MAP.triceps_iso).toEqual({ triceps: 1 });
        expect(PATTERN_MUSCLE_MAP.glute_iso).toEqual({ glutes: 0.85, legs: 0.15 });
    });

    it('preserves the squat-vs-hinge distinction through glute proportion', () => {
        // The accepted cost of one `legs` bucket: squat vs hinge differ only via glutes.
        expect(PATTERN_MUSCLE_MAP.hinge.glutes!).toBeGreaterThan(PATTERN_MUSCLE_MAP.squat.glutes!);
    });
});

describe('muscleContributions', () => {
    it('returns the weighted contributions for a pattern', () => {
        expect(muscleContributions('horizontal_pull')).toEqual({ back: 0.7, biceps: 0.2, shoulders: 0.1 });
    });

    it('returns a copy, so callers cannot mutate the shared map', () => {
        const c = muscleContributions('squat');
        c.legs = 0;
        expect(PATTERN_MUSCLE_MAP.squat.legs).toBe(0.7);
    });
});

describe('primaryMuscle', () => {
    it('returns the dominant category (ties broken primary-first)', () => {
        expect(primaryMuscle('horizontal_push')).toBe('chest');
        expect(primaryMuscle('vertical_push')).toBe('shoulders');
        expect(primaryMuscle('vertical_pull')).toBe('back');
        expect(primaryMuscle('hinge')).toBe('legs'); // 0.45 legs > 0.40 glutes
        expect(primaryMuscle('glute_iso')).toBe('glutes');
        expect(primaryMuscle('calf')).toBe('calves');
    });
});

describe('secondarySets', () => {
    it('buckets secondaries (>=0.20 -> 0.5, 0.10-0.19 -> 0.25), excluding the primary', () => {
        expect(secondarySets('horizontal_push', 'chest')).toEqual({ triceps: 0.5, shoulders: 0.5 });
        expect(secondarySets('vertical_push', 'shoulders')).toEqual({ triceps: 0.5, chest: 0.25 });
        expect(secondarySets('horizontal_pull', 'back')).toEqual({ biceps: 0.5, shoulders: 0.25 });
        expect(secondarySets('vertical_pull', 'back')).toEqual({ biceps: 0.5, shoulders: 0.25 });
        expect(secondarySets('chest_iso', 'chest')).toEqual({ shoulders: 0.25 });
        expect(secondarySets('glute_iso', 'glutes')).toEqual({ legs: 0.25 });
    });

    it('caps above-band secondaries (hinge/lunge glutes) at 0.5 and drops sub-0.10 (calves)', () => {
        expect(secondarySets('hinge', 'legs')).toEqual({ glutes: 0.5, back: 0.25 });
        expect(secondarySets('squat', 'legs')).toEqual({ glutes: 0.5 });
        expect(secondarySets('lunge', 'legs')).toEqual({ glutes: 0.5 });
    });

    it('excludes the exercise category even when it is not the pattern primary', () => {
        // A back-categorized deadlift on the hinge pattern: legs + glutes are secondaries.
        expect(secondarySets('hinge', 'back')).toEqual({ legs: 0.5, glutes: 0.5 });
    });

    it('returns {} for single-primary (isolation) patterns', () => {
        expect(secondarySets('biceps_iso', 'biceps')).toEqual({});
        expect(secondarySets('calf', 'calves')).toEqual({});
        expect(secondarySets('core', 'abs')).toEqual({});
    });
});
