import { describe, it, expect } from 'vitest';
import { validateProgram } from '@/lib/pulse/programValidation';
import type { ExerciseMeta, RoutineBlueprint } from '@/lib/pulse/generation';
import type { MovementPattern, EquipmentKey, ExerciseCategory } from '@/lib/pulse/types';

// Minimal pool: one exercise per pattern, id === pattern, dumbbells, generic.
const ALL: MovementPattern[] = [
    'horizontal_push',
    'vertical_push',
    'horizontal_pull',
    'vertical_pull',
    'squat',
    'hinge',
    'lunge',
    'calf',
    'core',
    'chest_iso',
    'back_iso',
    'shoulder_iso',
    'biceps_iso',
    'triceps_iso',
    'glute_iso',
];
function meta(id: string, pattern: MovementPattern, equipment: EquipmentKey[] = ['dumbbells']): ExerciseMeta {
    return {
        id,
        movement_pattern: pattern,
        equipment,
        is_compound: !pattern.endsWith('_iso') && pattern !== 'calf' && pattern !== 'core',
        category: 'legs' as ExerciseCategory,
        substitution_class: null,
        unilateral: false,
        contraindications: [],
    };
}
const POOL: ExerciseMeta[] = ALL.map((p) => meta(p, p));
const POOL_NO_VPULL = POOL.filter((e) => e.movement_pattern !== 'vertical_pull');

type Row = { pattern: MovementPattern; sets?: number; workout_type?: string; variant?: string | null; order?: number };
function blueprint(rows: Row[], schedule: RoutineBlueprint['schedule'] = []): RoutineBlueprint {
    return {
        schedule,
        warnings: [],
        exercises: rows.map((r, i) => ({
            exercise_id: r.pattern,
            workout_type: (r.workout_type ?? 'full_body') as RoutineBlueprint['exercises'][number]['workout_type'],
            variant: (r.variant ?? null) as RoutineBlueprint['exercises'][number]['variant'],
            order: r.order ?? i,
            sets: String(r.sets ?? 3),
            reps: '8-12',
            superset_group_id: null,
        })),
    };
}

describe('validateProgram (P2.3)', () => {
    it('a balanced week returns no warnings', () => {
        const bp = blueprint([
            { pattern: 'horizontal_push' },
            { pattern: 'vertical_push' },
            { pattern: 'horizontal_pull' },
            { pattern: 'vertical_pull' },
        ]);
        expect(validateProgram(bp, POOL)).toEqual([]);
    });

    it('flags push/pull imbalance when the week is heavily press-skewed', () => {
        const rows: Row[] = Array.from({ length: 6 }, () => ({ pattern: 'horizontal_push' as MovementPattern }));
        rows.push({ pattern: 'horizontal_pull' });
        expect(validateProgram(blueprint(rows), POOL)).toContain('push_pull_imbalance');
    });

    it('does not flag a roughly balanced press/pull week', () => {
        const bp = blueprint([
            { pattern: 'horizontal_push' },
            { pattern: 'vertical_push' },
            { pattern: 'horizontal_pull' },
            { pattern: 'vertical_pull' },
            { pattern: 'chest_iso' },
            { pattern: 'back_iso' },
        ]);
        expect(validateProgram(bp, POOL)).not.toContain('push_pull_imbalance');
    });

    it('shoulder isolation does not inflate the press side (rear/side delts are not pressing)', () => {
        // The muscle bridge maps all shoulder_iso to the undifferentiated "shoulders",
        // so counting it as press wrongly flagged balanced programs that simply added
        // lateral / rear-delt work (the 45-min baseline). Compound press/pull is 1:1 here.
        const bp = blueprint([
            { pattern: 'horizontal_push' },
            { pattern: 'horizontal_pull' },
            { pattern: 'shoulder_iso' },
            { pattern: 'shoulder_iso' },
            { pattern: 'shoulder_iso' },
        ]);
        expect(validateProgram(bp, POOL)).not.toContain('push_pull_imbalance');
    });

    // ── #4-refinement: asymmetric push/pull threshold ─────────────────────────
    // Press-heavy is the posture / shoulder risk the warning copy cites, so it now
    // flags at 1.5 (tightened from 2.0). A slightly pull-favored (back-focused) week
    // is the healthiest per the cited science, so the pull-heavy side keeps the
    // looser 2.0 tolerance and an intentional aesthetic back-lean stays clean.
    it('flags a moderately PRESS-heavy week (ratio ~1.78), tightened from 2.0', () => {
        // press = 4 x horizontal_push (0.80 each), pull = 2 x horizontal_pull (0.90):
        // ratio 1.78, between the old 2.0 and the new 1.5 press cap. Was clean before.
        const bp = blueprint([
            { pattern: 'horizontal_push' },
            { pattern: 'horizontal_push' },
            { pattern: 'horizontal_push' },
            { pattern: 'horizontal_push' },
            { pattern: 'horizontal_pull' },
            { pattern: 'horizontal_pull' },
        ]);
        expect(validateProgram(bp, POOL)).toContain('push_pull_imbalance');
    });

    it('does NOT flag a moderately PULL-heavy week at the same ~1.69 ratio (healthy back-lean tolerated)', () => {
        // pull = 3 x horizontal_pull (0.90), press = 2 x horizontal_push (0.80): ratio
        // 1.69, pull-favored. The press side at the same ratio would flag; the pull side
        // is tolerated up to 2.0 (mirrors the intentionally back-focused aesthetic split).
        const bp = blueprint([
            { pattern: 'horizontal_pull' },
            { pattern: 'horizontal_pull' },
            { pattern: 'horizontal_pull' },
            { pattern: 'horizontal_push' },
            { pattern: 'horizontal_push' },
        ]);
        expect(validateProgram(bp, POOL)).not.toContain('push_pull_imbalance');
    });

    it('still flags an EXTREME pull-heavy week (ratio > 2.0)', () => {
        // pull = 5 x horizontal_pull, press = 1 x horizontal_push: ratio ~5.6. Even the
        // healthy direction warns once the lean is extreme.
        const bp = blueprint([
            { pattern: 'horizontal_pull' },
            { pattern: 'horizontal_pull' },
            { pattern: 'horizontal_pull' },
            { pattern: 'horizontal_pull' },
            { pattern: 'horizontal_pull' },
            { pattern: 'horizontal_push' },
        ]);
        expect(validateProgram(bp, POOL)).toContain('push_pull_imbalance');
    });

    it('flags label_mismatch when a hamstring day leads with a squat', () => {
        const schedule: RoutineBlueprint['schedule'] = [
            { day_of_week: 1, workout_type: 'lower', variant: 'B', label: 'Lower (Hamstrings & Glutes)' },
        ];
        const bp = blueprint(
            [
                { pattern: 'squat', workout_type: 'lower', variant: 'B', order: 0 },
                { pattern: 'hinge', workout_type: 'lower', variant: 'B', order: 1 },
            ],
            schedule,
        );
        expect(validateProgram(bp, POOL)).toContain('label_mismatch');
    });

    it('passes a hamstring day that leads with a hinge, and a quad day that leads with a lunge', () => {
        const schedule: RoutineBlueprint['schedule'] = [
            { day_of_week: 1, workout_type: 'lower', variant: 'B', label: 'Lower (Hamstrings & Glutes)' },
            { day_of_week: 2, workout_type: 'lower', variant: 'A', label: 'Lower (Quads)' },
        ];
        const bp = blueprint(
            [
                { pattern: 'hinge', workout_type: 'lower', variant: 'B', order: 0 },
                { pattern: 'lunge', workout_type: 'lower', variant: 'A', order: 0 },
            ],
            schedule,
        );
        expect(validateProgram(bp, POOL)).not.toContain('label_mismatch');
    });

    it('flags no_vertical_pull on an upper/pull week with none, when the pool supports one', () => {
        const schedule: RoutineBlueprint['schedule'] = [
            { day_of_week: 1, workout_type: 'pull', variant: null, label: null },
        ];
        const bp = blueprint([{ pattern: 'horizontal_pull', workout_type: 'pull' }], schedule);
        expect(validateProgram(bp, POOL)).toContain('no_vertical_pull');
        // ...but not when the pool cannot supply a vertical pull.
        expect(validateProgram(bp, POOL_NO_VPULL)).not.toContain('no_vertical_pull');
    });

    it('fires no_vertical_pull on a full-body week too (movement-based, not split-based)', () => {
        // A full-body week that lands on all-horizontal pulling has the same lat gap
        // as an upper/pull split, so it is NOT exempt when the pool supports a vertical pull.
        const schedule: RoutineBlueprint['schedule'] = [
            { day_of_week: 1, workout_type: 'full_body', variant: 'A', label: null },
        ];
        const bp = blueprint([{ pattern: 'horizontal_pull', workout_type: 'full_body', variant: 'A' }], schedule);
        expect(validateProgram(bp, POOL)).toContain('no_vertical_pull');
        expect(validateProgram(bp, POOL_NO_VPULL)).not.toContain('no_vertical_pull');
    });

    it('does not fire no_vertical_pull when the week trains no pulling at all', () => {
        // No horizontal pull either => not a "missing vertical pull" case (a no-pull
        // program is a different gap), so this check stays silent.
        const bp = blueprint([{ pattern: 'horizontal_push' }, { pattern: 'squat' }]);
        expect(validateProgram(bp, POOL)).not.toContain('no_vertical_pull');
    });

    it('is deterministic', () => {
        const rows: Row[] = Array.from({ length: 6 }, () => ({ pattern: 'horizontal_push' as MovementPattern }));
        rows.push({ pattern: 'horizontal_pull' });
        const bp = blueprint(rows);
        expect(validateProgram(bp, POOL)).toEqual(validateProgram(bp, POOL));
    });
});
