import { describe, it, expect } from 'vitest';
import { selectSplit, volumeFor, repRangeFor, generateRoutine, applyTemplateVolume } from '@/lib/pulse/generation';
import type { ExerciseMeta, GenerationInput } from '@/lib/pulse/generation';
import type { EquipmentKey, MovementPattern, ExerciseCategory } from '@/lib/pulse/types';

describe('selectSplit', () => {
    it('beginner or 2-3 days -> all full_body', () => {
        expect(selectSplit('beginner', '2-3', 3)).toEqual(['full_body', 'full_body', 'full_body']);
        expect(selectSplit('advanced', '2-3', 2)).toEqual(['full_body', 'full_body']);
    });
    it('4 days (non-beginner) -> upper/lower alternating', () => {
        expect(selectSplit('intermediate', '4', 4)).toEqual(['upper', 'lower', 'upper', 'lower']);
    });
    it('5-6 days (non-beginner) -> push/pull/legs cycle', () => {
        expect(selectSplit('advanced', '5-6', 6)).toEqual(['push', 'pull', 'legs', 'push', 'pull', 'legs']);
    });
});

describe('volumeFor', () => {
    it('30 min never drops below the floor of 3 exercises / 2 sets', () => {
        const v = volumeFor('~30 min', 'beginner');
        expect(v.exercises).toBeGreaterThanOrEqual(3);
        expect(v.sets).toBeGreaterThanOrEqual(2);
    });
    it('90+ min gives more exercises than 30 min', () => {
        expect(volumeFor('90+ min', 'intermediate').exercises).toBeGreaterThan(
            volumeFor('~30 min', 'intermediate').exercises,
        );
    });
});

describe('repRangeFor', () => {
    it('maps goal to a rep range', () => {
        expect(repRangeFor('build_muscle')).toBe('8-12');
        expect(repRangeFor('lose_fat')).toBe('12-15');
        expect(repRangeFor('general_fitness')).toBe('10-12');
    });
});

function meta(
    id: string,
    pattern: MovementPattern,
    equipment: EquipmentKey[] = ['dumbbells'],
    compound = true,
): ExerciseMeta {
    return { id, movement_pattern: pattern, equipment, is_compound: compound, category: 'chest' as ExerciseCategory };
}

const POOL: ExerciseMeta[] = [
    meta('sq1', 'squat'),
    meta('sq2', 'squat'),
    meta('sq3', 'squat'),
    meta('hp1', 'horizontal_push'),
    meta('hp2', 'horizontal_push'),
    meta('hp3', 'horizontal_push'),
    meta('hl1', 'horizontal_pull'),
    meta('hl2', 'horizontal_pull'),
    meta('hl3', 'horizontal_pull'),
    meta('hi1', 'hinge'),
    meta('hi2', 'hinge'),
    meta('vp1', 'vertical_push'),
    meta('vl1', 'vertical_pull'),
    meta('co1', 'core'),
    meta('bar1', 'squat', ['barbell']),
];

const baseInput: GenerationInput = {
    answers: {
        equipment: new Set<EquipmentKey>(['dumbbells']),
        experience: 'intermediate',
        goal: 'build_muscle',
        days: '2-3',
    },
    sessionTime: '~30 min',
    trainingDays: [1, 3, 5],
    pool: POOL,
};

function sessionIds(bp: ReturnType<typeof generateRoutine>, wt: string, variant: string | null): string[] {
    return bp.exercises.filter((e) => e.workout_type === wt && e.variant === variant).map((e) => e.exercise_id);
}

describe('generateRoutine', () => {
    it('30-min full body has at least 3 exercises per day and is never empty (the reported bug)', () => {
        const bp = generateRoutine(baseInput);
        expect(bp.schedule).toHaveLength(3);
        for (const s of bp.schedule) {
            expect(sessionIds(bp, s.workout_type, s.variant).length).toBeGreaterThanOrEqual(3);
        }
    });

    it('repeated full-body days are not identical (variation)', () => {
        const bp = generateRoutine(baseInput);
        const sigs = bp.schedule.map((s) => sessionIds(bp, s.workout_type, s.variant).slice().sort().join(','));
        expect(new Set(sigs).size).toBeGreaterThan(1);
    });

    it('respects equipment: dumbbells-only never selects the barbell-only exercise', () => {
        const bp = generateRoutine(baseInput);
        expect(bp.exercises.some((e) => e.exercise_id === 'bar1')).toBe(false);
    });

    it('no duplicate exercise within a single session', () => {
        const bp = generateRoutine(baseInput);
        for (const s of bp.schedule) {
            const ids = sessionIds(bp, s.workout_type, s.variant);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });

    it('schedules onto the chosen training days with the goal rep range', () => {
        const bp = generateRoutine(baseInput);
        expect(bp.schedule.map((s) => s.day_of_week)).toEqual([1, 3, 5]);
        expect(bp.exercises.every((e) => e.reps === '8-12')).toBe(true);
    });
});

describe('applyTemplateVolume', () => {
    const full = Array.from({ length: 8 }, (_, i) => ({
        workout_type: 'full_body',
        variant: null,
        order: i,
        sets: '4',
    }));
    it('30-min keeps at least 3 exercises per session (regression: never 1)', () => {
        expect(applyTemplateVolume(full, '~30 min', 'beginner').length).toBeGreaterThanOrEqual(3);
    });
    it('90-min keeps more than 30-min', () => {
        expect(applyTemplateVolume(full, '90+ min', 'advanced').length).toBeGreaterThan(
            applyTemplateVolume(full, '~30 min', 'beginner').length,
        );
    });
    it('does not invent exercises beyond what the template has', () => {
        expect(applyTemplateVolume(full.slice(0, 2), '90+ min', 'advanced').length).toBe(2);
    });
});
