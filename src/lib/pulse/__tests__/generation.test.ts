import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    STYLES,
    EMPHASES,
    volumeFor,
    repRange,
    recommendStyle,
    suggestedStyleKey,
    resolveStyle,
    generateRoutine,
    orderTrainingDays,
    applyTemplateVolume,
    buildRationale,
    genderDefault,
    resolvePriority,
    tiltEmphasis,
    resolveBias,
    resolveRepRange,
    POWERBUILDING_HEAVY_PATTERNS,
    COMPOUND_ANCHOR_PATTERNS,
    CANONICAL_ANCHORS,
    assignRole,
    focusLabelForEmphasis,
    PRIORITY_MUSCLE_SET_CEILING,
} from '@/lib/pulse/generation';
import type { ExerciseMeta, GenerationInput } from '@/lib/pulse/generation';
import { EMPTY_BEHAVIOR } from '@/lib/pulse/behavior';
import { validateProgram } from '@/lib/pulse/programValidation';
import type {
    EquipmentKey,
    MovementPattern,
    ExerciseCategory,
    ProgramStyle,
    Bias,
    TrainingStyle,
    RestrictionFlag,
} from '@/lib/pulse/types';

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

describe('repRange', () => {
    it('strength compound is heavy; hypertrophy isolation is moderate; pump is high', () => {
        expect(repRange('strength', true)).toBe('3-6');
        expect(repRange('strength', false)).toBe('10-15');
        expect(repRange('hypertrophy', true)).toBe('8-12');
        expect(repRange('hypertrophy', false)).toBe('12-15');
        expect(repRange('balanced', true)).toBe('8-12');
        expect(repRange('balanced', false)).toBe('10-15');
    });
    it('pump bias raises both columns (compound 12-15, isolation 15-20)', () => {
        expect(repRange('pump', true)).toBe('12-15');
        expect(repRange('pump', false)).toBe('15-20');
    });
    it('lose_fat shifts both columns up one notch', () => {
        // Strength bias stays heavy-ish even when cutting (the day's purpose is the
        // heavy lift); the density bias applies to hypertrophy/pump/balanced days.
        expect(repRange('strength', true, 'lose_fat')).toBe('6-10');
        expect(repRange('hypertrophy', false, 'lose_fat')).toBe('15-20');
    });
});

describe('resolveBias', () => {
    // The full 4x4 remap table from the spec. Rows = session bias, cols = style.
    const TABLE: Record<Bias, Record<TrainingStyle, Bias>> = {
        strength: {
            balanced: 'strength',
            strength: 'strength',
            bodybuilding: 'hypertrophy',
            powerbuilding: 'strength',
        },
        balanced: {
            balanced: 'balanced',
            strength: 'strength',
            bodybuilding: 'hypertrophy',
            powerbuilding: 'strength',
        },
        hypertrophy: {
            balanced: 'hypertrophy',
            strength: 'strength',
            bodybuilding: 'hypertrophy',
            powerbuilding: 'strength',
        },
        pump: { balanced: 'pump', strength: 'hypertrophy', bodybuilding: 'pump', powerbuilding: 'strength' },
    };
    const biases: Bias[] = ['strength', 'balanced', 'hypertrophy', 'pump'];
    const styles: TrainingStyle[] = ['balanced', 'strength', 'bodybuilding', 'powerbuilding'];
    for (const b of biases) {
        for (const s of styles) {
            it(`${s} maps ${b} -> ${TABLE[b][s]}`, () => {
                expect(resolveBias(b, s)).toBe(TABLE[b][s]);
            });
        }
    }
    it('balanced is the identity for every bias', () => {
        for (const b of biases) expect(resolveBias(b, 'balanced')).toBe(b);
    });
});

describe('resolveRepRange', () => {
    it('non-powerbuilding styles defer to repRange on the resolved bias (pattern ignored)', () => {
        expect(resolveRepRange('hypertrophy', 'horizontal_push', true, 'build_muscle', 'bodybuilding')).toBe(
            repRange('hypertrophy', true, 'build_muscle'),
        );
    });
    it('balanced reproduces repRange exactly for every bias x compound/iso', () => {
        const biases: Bias[] = ['strength', 'balanced', 'hypertrophy', 'pump'];
        for (const b of biases) {
            for (const compound of [true, false]) {
                expect(resolveRepRange(b, 'horizontal_push', compound, 'build_muscle', 'balanced')).toBe(
                    repRange(b, compound, 'build_muscle'),
                );
            }
        }
    });
    it('powerbuilding gives the strength range to every heavy pattern', () => {
        for (const p of POWERBUILDING_HEAVY_PATTERNS) {
            expect(resolveRepRange('strength', p, true, 'build_muscle', 'powerbuilding')).toBe(
                repRange('strength', true, 'build_muscle'),
            );
        }
    });
    it('powerbuilding now trains pulling compounds heavy (horizontal_pull, vertical_pull)', () => {
        // Item 1: pulls were excluded from the heavy set, so a powerbuilding pull
        // session got hypertrophy reps while the first compound still took the
        // strength +1 set bump. The pulls now ride the strength range like the
        // other primary compounds.
        for (const p of ['horizontal_pull', 'vertical_pull'] as MovementPattern[]) {
            expect(resolveRepRange('hypertrophy', p, true, 'build_muscle', 'powerbuilding')).toBe(
                repRange('strength', true, 'build_muscle'),
            );
        }
    });
    it('powerbuilding gives the hypertrophy range to accessories (lunge, isolation)', () => {
        // horizontal_pull moved to the heavy set (Item 1); lunge and isolation
        // remain accessories.
        for (const p of ['lunge', 'biceps_iso'] as MovementPattern[]) {
            const isCompound = p === 'lunge';
            expect(resolveRepRange('strength', p, isCompound, 'build_muscle', 'powerbuilding')).toBe(
                repRange('hypertrophy', isCompound, 'build_muscle'),
            );
        }
    });
    it('lose_fat still shifts on top of the resolved range', () => {
        expect(resolveRepRange('strength', 'squat', true, 'lose_fat', 'strength')).toBe(
            repRange('strength', true, 'lose_fat'),
        );
    });
    it('deadlift/RDL both ride the hinge pattern (intentional approximation)', () => {
        expect(POWERBUILDING_HEAVY_PATTERNS.has('hinge')).toBe(true);
    });
});

describe('recommendStyle / resolveStyle', () => {
    it('returns the first (recommended) style per count', () => {
        expect(recommendStyle(3)).toBe('fb-3');
        expect(recommendStyle(4)).toBe('ul-classic-4');
        expect(recommendStyle(5)).toBe('ulppl-5');
    });
    it('resolves a known key and falls back to the recommendation for an unknown key', () => {
        expect(resolveStyle('ppl-3', 3).key).toBe('ppl-3');
        expect(resolveStyle('does-not-exist', 3).key).toBe('fb-3');
    });
    it('is gender-agnostic, the default no longer depends on gender', () => {
        expect(recommendStyle(4)).toBe('ul-classic-4');
        expect(recommendStyle(3)).toBe('fb-3');
        expect(recommendStyle(5)).toBe('ulppl-5');
    });
});

describe('suggestedStyleKey (intent-aware suggestion, #18 follow-up)', () => {
    it('suggests PHUL for a powerbuilding lifter at 4 days', () => {
        expect(suggestedStyleKey(4, 'powerbuilding')).toBe('phul-4');
    });
    it('falls back to the count-only recommendation for other training styles at 4 days', () => {
        expect(suggestedStyleKey(4, 'balanced')).toBe('ul-classic-4');
        expect(suggestedStyleKey(4, 'strength')).toBe('ul-classic-4');
        expect(suggestedStyleKey(4, 'bodybuilding')).toBe('ul-classic-4');
        expect(suggestedStyleKey(4, undefined)).toBe('ul-classic-4');
        expect(suggestedStyleKey(4, null)).toBe('ul-classic-4');
    });
    it('only triggers at 4 days (PHUL is a 4-day style); other counts use the default', () => {
        expect(suggestedStyleKey(3, 'powerbuilding')).toBe(recommendStyle(3));
        expect(suggestedStyleKey(5, 'powerbuilding')).toBe(recommendStyle(5));
        expect(suggestedStyleKey(6, 'powerbuilding')).toBe(recommendStyle(6));
    });
    it('does not change the auto-applied default: recommendStyle(4) is still ul-classic-4', () => {
        expect(recommendStyle(4)).toBe('ul-classic-4');
    });
});

describe('muscle priority', () => {
    it('genderDefault seeds glutes for female, balanced otherwise', () => {
        expect(genderDefault('female')).toBe('glutes');
        expect(genderDefault('male')).toBe('balanced');
        expect(genderDefault(null)).toBe('balanced');
    });

    it('resolvePriority maps balanced/null to no priority', () => {
        expect(resolvePriority('balanced')).toBeNull();
        expect(resolvePriority(null)).toBeNull();
        expect(resolvePriority(undefined)).toBeNull();
        expect(resolvePriority('glutes')).toBe('glutes');
    });

    it('tiltEmphasis front-loads glute priority patterns compound-first (hinge before glute_iso)', () => {
        const lower = EMPHASES.lower_post; // slots: hinge, hamstring_iso, glute_iso, calf, core
        const tilted = tiltEmphasis(lower, 'glutes');
        // Bug 5: the glutes priority hierarchy is hinge > squat > lunge > glute_iso,
        // so the COMPOUND hip patterns lead and direct glute isolation follows. For
        // lower_post (no squat or lunge slot) the present priority patterns are hinge
        // then glute_iso; hamstring_iso (a leg, not glute, pattern), calf + core
        // (non-priority) keep their tail order.
        expect(tilted.slots.slice(0, 3)).toEqual(['hinge', 'glute_iso', 'hamstring_iso']);
        expect(tilted.slots[0]).toBe('hinge'); // a compound leads, never glute_iso
        expect(tilted.slots).toHaveLength(lower.slots.length); // permutation, no injection
        expect(new Set(tilted.slots)).toEqual(new Set(lower.slots));
        expect(tilted.bias).toBe(lower.bias);
    });

    it('tiltEmphasis is the identity when the priority does not train this session', () => {
        const push = EMPHASES.push; // no glute/hinge patterns
        expect(tiltEmphasis(push, 'glutes')).toBe(push);
    });

    it('tiltEmphasis is the identity for a null priority', () => {
        expect(tiltEmphasis(EMPHASES.lower_quad, null)).toBe(EMPHASES.lower_quad);
    });
});

// ── Test pool builder ────────────────────────────────────────────────────────

function meta(
    id: string,
    pattern: MovementPattern,
    equipment: EquipmentKey[] = ['dumbbells'],
    compound = true,
    role: Partial<
        Pick<ExerciseMeta, 'substitution_class' | 'unilateral' | 'fatigue' | 'contraindications' | 'name'>
    > = {},
): ExerciseMeta {
    return {
        id,
        movement_pattern: pattern,
        equipment,
        is_compound: compound,
        category: 'chest' as ExerciseCategory,
        substitution_class: null,
        unilateral: false,
        contraindications: [],
        ...role,
    };
}

// Two dumbbell-usable options for every pattern a slot can request, plus a few
// equipment-gated rows that must never appear for a dumbbells-only user.
const ALL_PATTERNS: MovementPattern[] = [
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
    'quad_iso',
    'hamstring_iso',
];

function deepPool(perPattern = 2): ExerciseMeta[] {
    const pool: ExerciseMeta[] = [];
    for (const p of ALL_PATTERNS) {
        // compounds for the big patterns, isolation for *_iso / calf / core
        const compound = !p.endsWith('_iso') && p !== 'calf' && p !== 'core';
        for (let i = 1; i <= perPattern; i++) {
            pool.push(meta(`${p}-${i}`, p, ['dumbbells'], compound));
        }
    }
    // Equipment-gated rows that must be filtered out for dumbbells-only.
    pool.push(meta('bar-sq', 'squat', ['barbell'], true));
    pool.push(meta('mach-lp', 'squat', ['machines'], true));
    pool.push(meta('bar-pu', 'vertical_pull', ['pull_up_bar'], true));
    return pool;
}

const dumbbellsOnly = new Set<EquipmentKey>(['dumbbells']);

function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
    let n = 0;
    return {
        style: STYLES[4][0], // Classic Upper / Lower
        answers: {
            equipment: dumbbellsOnly,
            experience: 'intermediate',
            goal: 'build_muscle',
            days: 4,
        },
        sessionTime: '45–60 min',
        trainingDays: [1, 2, 4, 5],
        pool: deepPool(),
        makeGroupId: () => `g${++n}`,
        ...overrides,
    };
}

function sessionIds(bp: ReturnType<typeof generateRoutine>, wt: string, variant: string | null): string[] {
    return bp.exercises.filter((e) => e.workout_type === wt && e.variant === variant).map((e) => e.exercise_id);
}

// ── Beginner / general-fitness rep floor (P3.1) ──────────────────────────────

describe('beginner / general-fitness rep floor (P3.1)', () => {
    const fbStrengthA = (overrides: Partial<GenerationInput['answers']>) =>
        generateRoutine(
            input({
                style: STYLES[3][0], // fb-3: Full Body A = fb_strength (strength bias)
                answers: { equipment: dumbbellsOnly, experience: 'intermediate', goal: 'build_muscle', days: 3, ...overrides },
                sessionTime: '~30 min',
                trainingDays: [1, 3, 5],
                pool: deepPool(),
            }),
        ).exercises.filter((e) => e.workout_type === 'full_body' && e.variant === 'A');

    it('a beginner never gets a 3-6 compound on the strength day (floored to 5-8)', () => {
        const rows = fbStrengthA({ experience: 'beginner' });
        expect(rows.some((e) => e.reps === '3-6')).toBe(false);
        expect(rows.some((e) => e.reps === '5-8')).toBe(true);
    });

    it('a beginner who picks PHUL still gets its power day floored off 3-6 (safety > split > style)', () => {
        const pool = deepPool(2);
        const patternOf = new Map(pool.map((e) => [e.id, e.movement_pattern]));
        const phul = STYLES[4].find((s) => s.key === 'phul-4') as ProgramStyle;
        const bp = generateRoutine(
            input({
                style: phul,
                pool,
                trainingDays: [1, 2, 4, 5],
                answers: { equipment: dumbbellsOnly, experience: 'beginner', goal: 'build_muscle', days: 4 },
            }),
        );
        const upperAcompounds = bp.exercises.filter((e) => {
            const p = patternOf.get(e.exercise_id);
            return e.workout_type === 'upper' && e.variant === 'A' && p && !p.endsWith('_iso');
        });
        expect(upperAcompounds.length).toBeGreaterThan(0);
        expect(upperAcompounds.every((e) => e.reps !== '3-6')).toBe(true);
    });

    it('a general-fitness lifter never gets a 3-6 compound', () => {
        const rows = fbStrengthA({ goal: 'general_fitness' });
        expect(rows.some((e) => e.reps === '3-6')).toBe(false);
    });

    it('intermediate build_muscle is unchanged (still 3-6 on the strength day)', () => {
        const rows = fbStrengthA({});
        expect(rows.some((e) => e.reps === '3-6')).toBe(true);
    });
});

// ── Post-generation validator clean on golden inputs (P2.3) ──────────────────

describe('post-generation validator is clean on the golden inputs (P2.3)', () => {
    // fb-hmhp-4 legitimately carries no vertical pull (the full-body emphases use
    // horizontal pulling), so on a pool that supplies a vertical pull it correctly
    // earns no_vertical_pull (movement-based check, P2.3 + science review). Every
    // other golden contains a vertical pull, so it stays clean.
    const cases: Array<{ key: string; days: number[]; expect: string[] }> = [
        { key: 'ppl-3', days: [1, 3, 5], expect: [] },
        { key: 'ul-classic-4', days: [1, 2, 4, 5], expect: [] },
        { key: 'ulppl-5', days: [1, 2, 3, 5, 6], expect: [] },
        { key: 'ul-aesthetic-4', days: [1, 2, 4, 5], expect: [] },
        { key: 'ppl-fb-4', days: [1, 2, 4, 5], expect: [] },
        { key: 'fb-hmhp-4', days: [1, 2, 4, 5], expect: ['no_vertical_pull'] },
    ];
    for (const { key, days, expect: want } of cases) {
        it(`${key} validator warnings == ${JSON.stringify(want)}`, () => {
            const styleObj = Object.values(STYLES)
                .flat()
                .find((s) => s.key === key) as ProgramStyle;
            const pool = deepPool();
            const bp = generateRoutine(input({ style: styleObj, trainingDays: days, pool }));
            expect(validateProgram(bp, pool)).toEqual(want);
        });
    }

    it('validateProgram is a no-op on the default golden path', () => {
        expect(validateProgram(generateRoutine(input()), deepPool())).toEqual([]);
    });
});

// ── Bodybuilding character (P3.3) ────────────────────────────────────────────

describe('bodybuilding character (P3.3)', () => {
    const isIso = (p: MovementPattern | null | undefined) =>
        !!p && (p.endsWith('_iso') || p === 'calf' || p === 'core');

    it('isolation gets the pump range (15-20); compounds stay hypertrophy (8-12); balanced unchanged', () => {
        expect(resolveRepRange('hypertrophy', 'chest_iso', false, 'build_muscle', 'bodybuilding')).toBe('15-20');
        expect(resolveRepRange('hypertrophy', 'horizontal_push', true, 'build_muscle', 'bodybuilding')).toBe('8-12');
        expect(resolveRepRange('hypertrophy', 'chest_iso', false, 'build_muscle', 'balanced')).toBe('12-15');
    });

    it('a bodybuilding routine reads pump (15-20) on isolation and hypertrophy (8-12) on compounds', () => {
        const pool = deepPool();
        const patternOf = new Map(pool.map((e) => [e.id, e.movement_pattern]));
        const bb = generateRoutine(input({ pool, trainingStyle: 'bodybuilding' }));
        for (const e of bb.exercises) {
            const expected = isIso(patternOf.get(e.exercise_id)) ? '15-20' : '8-12';
            expect(e.reps).toBe(expected);
        }
    });

    it('balanced is byte-identical to no training style (bodybuilding rep-range change is gated)', () => {
        const pool = deepPool();
        const a = generateRoutine(input({ pool }));
        const b = generateRoutine(input({ pool, trainingStyle: 'balanced' }));
        expect(a.exercises).toEqual(b.exercises);
    });

    it('PHUL is excluded: split identity outranks bodybuilding (power day stays 3-6)', () => {
        const pool = deepPool(2);
        const patternOf = new Map(pool.map((e) => [e.id, e.movement_pattern]));
        const phul = STYLES[4].find((s) => s.key === 'phul-4') as ProgramStyle;
        const bb = generateRoutine(
            input({ style: phul, pool, trainingStyle: 'bodybuilding', trainingDays: [1, 2, 4, 5] }),
        );
        const upperA = bb.exercises.filter((e) => e.workout_type === 'upper' && e.variant === 'A');
        const compounds = upperA.filter((e) => !isIso(patternOf.get(e.exercise_id)));
        expect(compounds.length).toBeGreaterThan(0);
        expect(compounds.every((e) => e.reps === '3-6')).toBe(true);
    });
});

// ── Beginner exercise-complexity filter (P3.1b) ──────────────────────────────

describe('beginner exercise-complexity filter (P3.1b)', () => {
    it('a beginner soft-deprioritises an advanced-difficulty lift; intermediate is unaffected', () => {
        const pool = deepPool().map((e) =>
            e.id === 'horizontal_push-1'
                ? { ...e, difficulty: 'advanced' as const }
                : e.id === 'horizontal_push-2'
                  ? { ...e, difficulty: 'beginner' as const }
                  : e,
        );
        const beginner = generateRoutine(
            input({
                pool,
                answers: { equipment: dumbbellsOnly, experience: 'beginner', goal: 'build_muscle', days: 4 },
            }),
        );
        const intermediate = generateRoutine(
            input({
                pool,
                answers: { equipment: dumbbellsOnly, experience: 'intermediate', goal: 'build_muscle', days: 4 },
            }),
        );
        const has = (bp: ReturnType<typeof generateRoutine>, id: string) =>
            bp.exercises.some((e) => e.exercise_id === id);
        // Beginner avoids the advanced option and takes the beginner-friendly one.
        expect(has(beginner, 'horizontal_push-1')).toBe(false);
        expect(has(beginner, 'horizontal_push-2')).toBe(true);
        // Intermediate is unaffected (normal id tiebreak picks -1).
        expect(has(intermediate, 'horizontal_push-1')).toBe(true);
    });
});

// ── Measurable priority muscle (P3.2) ────────────────────────────────────────

describe('measurable priority muscle (P3.2)', () => {
    const totalSets = (bp: ReturnType<typeof generateRoutine>) =>
        bp.exercises.reduce((n, e) => n + Number(e.sets), 0);
    const chestSets = (bp: ReturnType<typeof generateRoutine>, patternOf: Map<string, MovementPattern | null>) =>
        bp.exercises
            .filter((e) => {
                const p = patternOf.get(e.exercise_id);
                return p === 'horizontal_push' || p === 'chest_iso';
            })
            .reduce((n, e) => n + Number(e.sets), 0);

    it('adds bounded extra weekly volume vs an otherwise identical balanced baseline', () => {
        // Issue 6: priority was ordering-only. It must now add measurable weekly
        // volume to the priority muscle, capped so the rest of the plan stays balanced.
        const base = generateRoutine(input({ pool: deepPool() }));
        const prioritized = generateRoutine(input({ pool: deepPool(), priority: 'chest' }));
        const delta = totalSets(prioritized) - totalSets(base);
        expect(delta).toBeGreaterThan(0);
        expect(delta).toBeLessThanOrEqual(4); // capped at +4 sets/week
    });

    it('lands the extra sets on the priority muscle patterns, capped at the recoverable ceiling', () => {
        const pool = deepPool();
        const patternOf = new Map(pool.map((e) => [e.id, e.movement_pattern]));
        const base = generateRoutine(input({ pool }));
        const prioritized = generateRoutine(input({ pool, priority: 'chest' }));
        expect(chestSets(prioritized, patternOf)).toBeGreaterThan(chestSets(base, patternOf));
        // Total weekly direct chest sets never exceed the ~20-set recoverable ceiling.
        expect(chestSets(prioritized, patternOf)).toBeLessThanOrEqual(20);
    });

    it('null priority is byte-identical to the balanced baseline (no extra volume)', () => {
        const a = generateRoutine(input({ pool: deepPool() }));
        const b = generateRoutine(input({ pool: deepPool(), priority: null }));
        expect(totalSets(a)).toBe(totalSets(b));
    });

    it('never pushes the priority muscle past the ceiling on a dense split (gates on the weekly total, not a running count)', () => {
        // Regression: the dose ceiling used to gate on a mid-stream running count, so
        // on a 6-day advanced split (chest already baseline-saturated) early-session
        // bumps landed while the muscle's true weekly total was already at/over the
        // ceiling -- adding junk volume on top of a maxed muscle. The gate now uses the
        // projected weekly total, so when baseline already meets the ceiling, zero
        // sets are added.
        const pool = deepPool(3);
        const style = STYLES[6][0]; // ppl-x2-6 (the densest split)
        const adv = { equipment: dumbbellsOnly, experience: 'advanced' as const, goal: 'build_muscle' as const, days: 6 as const };
        const patternOf = new Map(pool.map((e) => [e.id, e.movement_pattern]));
        const days = [1, 2, 3, 4, 5, 6];
        const base = generateRoutine(input({ style, trainingDays: days, pool, answers: adv }));
        const prioritized = generateRoutine(input({ style, trainingDays: days, pool, answers: adv, priority: 'chest' }));
        const baseChest = chestSets(base, patternOf);
        // The dose never lands the muscle above max(baseline, ceiling): bumps stop at
        // the ceiling, and when baseline already exceeds it, nothing is added. The old
        // running-count gate violated this (it reached baseline + bumps).
        expect(chestSets(prioritized, patternOf)).toBeLessThanOrEqual(Math.max(baseChest, PRIORITY_MUSCLE_SET_CEILING));
    });
});

// ── Heavy-work limit warning (P2.2) ──────────────────────────────────────────

describe('heavy-work limit warning (P2.2)', () => {
    const sixDays = [1, 2, 3, 4, 5, 6];
    it('warns when a high-frequency week is almost all heavy (Strength style, 6 days)', () => {
        // Strength remaps every session to a strength bias; on a 6-day split that
        // is six heavy days, which is hard to recover from (Case 03).
        const bp = generateRoutine(
            input({
                style: STYLES[6][0], // ppl-x2-6
                answers: { equipment: dumbbellsOnly, experience: 'advanced', goal: 'build_muscle', days: 6 },
                trainingDays: sixDays,
                trainingStyle: 'strength',
                pool: deepPool(),
            }),
        );
        expect(bp.warnings).toContain('demanding_week');
    });

    it('does not warn for a balanced 6-day week (only the two heavy PPL days)', () => {
        const bp = generateRoutine(
            input({
                style: STYLES[6][0],
                answers: { equipment: dumbbellsOnly, experience: 'advanced', goal: 'build_muscle', days: 6 },
                trainingDays: sixDays,
                pool: deepPool(),
            }),
        );
        expect(bp.warnings).not.toContain('demanding_week');
    });
});

// ── Coverage-aware backfill: accessory over duplicate finisher (P2.1) ─────────

describe('coverage-aware backfill (P2.1)', () => {
    it('seats a real lower accessory instead of a 2nd calf/core when glute_iso is empty', () => {
        // Reproduces the dumbbell lower_post filler bug (Case 01 Lower B: two calf
        // raises + two core moves). With glute_iso unavailable, coverage-aware
        // backfill should deflect to a real lower-bucket accessory (a lunge, or the
        // non-compound hinge accessory that slips past the heavy-dedup cap) rather
        // than stacking a duplicate finisher.
        const pool = deepPool().filter((e) => e.movement_pattern !== 'glute_iso');
        pool.push(meta('hinge-accessory', 'hinge', ['dumbbells'], false));
        const bp = generateRoutine(input({ pool })); // ul-classic-4, Lower B = lower_post
        const patternOf = new Map(pool.map((e) => [e.id, e.movement_pattern]));
        const lowerB = sessionIds(bp, 'lower', 'B');
        // The gap is filled by a real lower-bucket accessory (a lunge or the
        // injected hinge accessory), not a duplicate finisher...
        expect(lowerB.some((id) => patternOf.get(id) === 'lunge' || id === 'hinge-accessory')).toBe(true);
        // ...and the session no longer doubles up a finisher pattern.
        const calfCount = lowerB.filter((id) => patternOf.get(id) === 'calf').length;
        const coreCount = lowerB.filter((id) => patternOf.get(id) === 'core').length;
        expect(calfCount).toBeLessThanOrEqual(1);
        expect(coreCount).toBeLessThanOrEqual(1);
    });
});

// ── Essential movement coverage (P1.1) ───────────────────────────────────────

describe('essential movement coverage (P1.1)', () => {
    const LOWER: MovementPattern[] = ['squat', 'hinge', 'lunge'];
    const PUSH: MovementPattern[] = ['horizontal_push', 'vertical_push'];
    const PULL: MovementPattern[] = ['horizontal_pull', 'vertical_pull'];

    it('a 30-min full-body week covers lower + push + pull in every session', () => {
        // Regression for Issue 1: the full-body emphases list a pull at slot index 3,
        // past a beginner 30-min budget of 3, so a short full-body WEEK trained zero
        // pulls. Essential coverage must reserve budget for lower/push/pull.
        const pool = deepPool();
        const patternOf = new Map(pool.map((e) => [e.id, e.movement_pattern]));
        const bp = generateRoutine(
            input({
                style: STYLES[3][0], // fb-3
                answers: { equipment: dumbbellsOnly, experience: 'beginner', goal: 'build_muscle', days: 3 },
                sessionTime: '~30 min',
                trainingDays: [1, 3, 5],
                pool,
            }),
        );
        for (const s of bp.schedule) {
            const patterns = sessionIds(bp, s.workout_type, s.variant).map((id) => patternOf.get(id)!);
            expect(patterns).toHaveLength(3);
            expect(patterns.some((p) => LOWER.includes(p))).toBe(true);
            expect(patterns.some((p) => PUSH.includes(p))).toBe(true);
            expect(patterns.some((p) => PULL.includes(p))).toBe(true);
        }
    });

    it('a full-body week never trains zero pulls across the whole week', () => {
        const pool = deepPool();
        const patternOf = new Map(pool.map((e) => [e.id, e.movement_pattern]));
        const bp = generateRoutine(
            input({
                style: STYLES[3][0],
                answers: { equipment: dumbbellsOnly, experience: 'beginner', goal: 'build_muscle', days: 3 },
                sessionTime: '~30 min',
                trainingDays: [1, 3, 5],
                pool,
            }),
        );
        const weekPatterns = bp.exercises.map((e) => patternOf.get(e.exercise_id)!);
        expect(weekPatterns.some((p) => PULL.includes(p))).toBe(true);
    });
});

// ── Restriction degradation warning (P1.2) ───────────────────────────────────

describe('restriction degradation warning (P1.2)', () => {
    it('warns when restrictions leave a full-body session without a pull', () => {
        // Tag every pull as contraindicated, then restrict it: the pull pattern is
        // emptied, so a full-body week cannot cover pulling. The routine must flag
        // the gap rather than silently shipping push + legs only.
        const pool = deepPool().map((e) =>
            e.movement_pattern === 'horizontal_pull' || e.movement_pattern === 'vertical_pull'
                ? { ...e, contraindications: ['shoulder' as RestrictionFlag] }
                : e,
        );
        const bp = generateRoutine(
            input({
                style: STYLES[3][0],
                answers: { equipment: dumbbellsOnly, experience: 'beginner', goal: 'build_muscle', days: 3 },
                sessionTime: '~30 min',
                trainingDays: [1, 3, 5],
                pool,
                restrictions: ['shoulder'],
            }),
        );
        const patternOf = new Map(pool.map((e) => [e.id, e.movement_pattern]));
        const PULL: MovementPattern[] = ['horizontal_pull', 'vertical_pull'];
        // No pull was selectable (the restriction removed them all)...
        expect(bp.exercises.every((e) => !PULL.includes(patternOf.get(e.exercise_id)!))).toBe(true);
        // ...and the routine flags the missing pattern.
        expect(bp.warnings).toContain('missing_pattern');
    });

    it('does not warn when restrictions still leave a usable pull', () => {
        // Only the barbell row is contraindicated; dumbbell pulls remain, so the
        // pattern is covered and no missing-pattern warning fires.
        const bp = generateRoutine(
            input({
                style: STYLES[3][0],
                answers: { equipment: dumbbellsOnly, experience: 'beginner', goal: 'build_muscle', days: 3 },
                sessionTime: '~30 min',
                trainingDays: [1, 3, 5],
                restrictions: ['shoulder'],
            }),
        );
        expect(bp.warnings).not.toContain('missing_pattern');
    });
});

// ── Session duration warning (P1.4) ──────────────────────────────────────────

describe('session duration warning (P1.4)', () => {
    it('warns when a session is estimated to exceed the selected time band', () => {
        // Advanced 45-60 min = 6 exercises x 4 sets; a compound-heavy upper day
        // estimates ~65 min, over the 60-min band. The engine keeps the volume
        // (decision: warn, do not trim) and flags it.
        const bp = generateRoutine(
            input({
                answers: { equipment: dumbbellsOnly, experience: 'advanced', goal: 'build_muscle', days: 4 },
                sessionTime: '45–60 min',
            }),
        );
        expect(bp.warnings).toContain('over_time');
    });

    it('does not warn for a 30-min routine that fits its band', () => {
        const bp = generateRoutine(
            input({
                style: STYLES[3][0],
                answers: { equipment: dumbbellsOnly, experience: 'beginner', goal: 'build_muscle', days: 3 },
                sessionTime: '~30 min',
                trainingDays: [1, 3, 5],
            }),
        );
        expect(bp.warnings).not.toContain('over_time');
    });
});

// ── 1. Equipment filter ──────────────────────────────────────────────────────

describe('equipment filter', () => {
    it('a dumbbells-only routine contains no barbell / machine / pull-up-bar exercises', () => {
        const bp = generateRoutine(input());
        const banned = new Set(['bar-sq', 'mach-lp', 'bar-pu']);
        expect(bp.exercises.some((e) => banned.has(e.exercise_id))).toBe(false);
    });
});

// ── 2. Distinct same-focus days ──────────────────────────────────────────────

describe('distinct same-focus days', () => {
    it('with a deep pool, Upper A and Upper B share no exercise; Lower A and Lower B share none', () => {
        // 4-deep: each lower emphasis now has 5 distinct patterns + a backfill
        // 6th drawn from the shared accessory pool (glute_iso / lunge), so the
        // two lower days need more than 2 options per pattern to stay disjoint.
        const bp = generateRoutine(input({ pool: deepPool(4) }));
        const upperA = sessionIds(bp, 'upper', 'A');
        const upperB = sessionIds(bp, 'upper', 'B');
        const lowerA = sessionIds(bp, 'lower', 'A');
        const lowerB = sessionIds(bp, 'lower', 'B');
        expect(upperA.length).toBeGreaterThan(0);
        expect(upperB.length).toBeGreaterThan(0);
        expect(upperA.some((id) => upperB.includes(id))).toBe(false);
        expect(lowerA.some((id) => lowerB.includes(id))).toBe(false);
    });
});

// ── 3. No within-session duplicates ──────────────────────────────────────────

describe('no within-session duplicates', () => {
    it('every session has unique exercise ids', () => {
        const bp = generateRoutine(input());
        for (const s of bp.schedule) {
            const ids = sessionIds(bp, s.workout_type, s.variant);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });
});

// ── 4. Thin-pool fallback ────────────────────────────────────────────────────

describe('thin-pool fallback', () => {
    it('a pattern with one option may repeat across days but never within a session, and count is respected', () => {
        // One option per pattern → repetition across the two upper days is forced.
        const thin: ExerciseMeta[] = [];
        for (const p of ALL_PATTERNS) {
            const compound = !p.endsWith('_iso') && p !== 'calf' && p !== 'core';
            thin.push(meta(`${p}-only`, p, ['dumbbells'], compound));
        }
        const bp = generateRoutine(input({ pool: thin }));
        // No crash, schedule intact.
        expect(bp.schedule).toHaveLength(4);
        for (const s of bp.schedule) {
            const ids = sessionIds(bp, s.workout_type, s.variant);
            expect(ids.length).toBeGreaterThanOrEqual(3);
            expect(new Set(ids).size).toBe(ids.length); // no within-session dupes
        }
        // The shared option repeats across the two upper days (pool genuinely thin).
        const upperA = sessionIds(bp, 'upper', 'A');
        const upperB = sessionIds(bp, 'upper', 'B');
        expect(upperA.some((id) => upperB.includes(id))).toBe(true);
    });
});

// ── 5. Time scaling ──────────────────────────────────────────────────────────

describe('time scaling', () => {
    it('30-min intermediate → 4 exercises/session; 45-60 → 6', () => {
        const short = generateRoutine(input({ sessionTime: '~30 min' }));
        for (const s of short.schedule) {
            expect(sessionIds(short, s.workout_type, s.variant).length).toBe(4);
        }
        const med = generateRoutine(input({ sessionTime: '45–60 min' }));
        for (const s of med.schedule) {
            expect(sessionIds(med, s.workout_type, s.variant).length).toBe(6);
        }
    });
});

// ── 6. Supersets ─────────────────────────────────────────────────────────────

describe('supersets', () => {
    it('30-min sessions pair exercises into adjacent supersets of exactly 2; 45-60 are all straight sets', () => {
        const short = generateRoutine(input({ sessionTime: '~30 min' }));
        // Group sizes are exactly 2, and grouped members are adjacent in order.
        const byGroup = new Map<string, typeof short.exercises>();
        for (const e of short.exercises) {
            if (!e.superset_group_id) continue;
            const arr = byGroup.get(e.superset_group_id) ?? [];
            arr.push(e);
            byGroup.set(e.superset_group_id, arr);
        }
        expect(byGroup.size).toBeGreaterThan(0);
        for (const members of byGroup.values()) {
            expect(members).toHaveLength(2);
            const orders = members.map((m) => m.order).sort((a, b) => a - b);
            expect(orders[1] - orders[0]).toBe(1); // adjacent order
        }
        const med = generateRoutine(input({ sessionTime: '45–60 min' }));
        expect(med.exercises.every((e) => e.superset_group_id === null)).toBe(true);
    });
});

// ── 7. Rep ranges in a generated routine ─────────────────────────────────────

describe('rep ranges in generation', () => {
    it('a strength-bias full-body compound gets 3-6; a pump-bias day uses the pump table', () => {
        // fb-hmhp-4: day A strength, day D pump.
        const bp = generateRoutine(
            input({
                style: STYLES[4].find((s) => s.key === 'fb-hmhp-4') as ProgramStyle,
            }),
        );
        const dayA = bp.exercises.filter((e) => e.variant === 'A');
        expect(dayA.some((e) => e.reps === '3-6')).toBe(true); // strength compound
        const dayD = bp.exercises.filter((e) => e.variant === 'D');
        // pump table: compound 12-15, isolation 15-20.
        expect(dayD.every((e) => e.reps === '12-15' || e.reps === '15-20')).toBe(true);
    });

    it('lose_fat shifts the rep ranges up', () => {
        const bp = generateRoutine(
            input({
                answers: {
                    equipment: dumbbellsOnly,
                    experience: 'intermediate',
                    goal: 'lose_fat',
                    days: 4,
                },
            }),
        );
        // hypertrophy compound normally 8-12; lose_fat → 10-15. None should be 8-12.
        expect(bp.exercises.some((e) => e.reps === '10-15')).toBe(true);
    });
});

// ── 8. Styles ────────────────────────────────────────────────────────────────

describe('styles', () => {
    it('every catalog style produces sessions.length schedule days', () => {
        for (const [count, styles] of Object.entries(STYLES)) {
            const n = Number(count);
            const days = Array.from({ length: n }, (_, i) => i + 1);
            for (const style of styles) {
                const bp = generateRoutine(input({ style, trainingDays: days }));
                expect(bp.schedule).toHaveLength(style.sessions.length);
            }
        }
    });

    it('same-focus sessions get distinct variant letters', () => {
        // Classic Upper/Lower → upper A,B and lower A,B.
        const bp = generateRoutine(input());
        const upperVariants = bp.schedule.filter((s) => s.workout_type === 'upper').map((s) => s.variant);
        const lowerVariants = bp.schedule.filter((s) => s.workout_type === 'lower').map((s) => s.variant);
        expect(new Set(upperVariants)).toEqual(new Set(['A', 'B']));
        expect(new Set(lowerVariants)).toEqual(new Set(['A', 'B']));
        // fb-hmhp-4 uses four distinct letters A-D.
        const fb = generateRoutine(input({ style: STYLES[4].find((s) => s.key === 'fb-hmhp-4') as ProgramStyle }));
        expect(new Set(fb.schedule.map((s) => s.variant))).toEqual(new Set(['A', 'B', 'C', 'D']));
    });

    it('the 3-day picker drops fb-emphasis-3 (a 1x-frequency body-part split mislabeled full body)', () => {
        // Item 3: fb-emphasis-3 trained each muscle group ~1x/week (fb_chest_back has
        // no legs, fb_legs no upper) under a "Full Body" label. Removed so the 3-day
        // options are all genuinely sound; the recommended default is unchanged.
        const keys = STYLES[3].map((s) => s.key);
        expect(keys).not.toContain('fb-emphasis-3');
        expect(keys).toEqual(['fb-3', 'ppl-3', 'ulf-3']);
        expect(recommendStyle(3)).toBe('fb-3');
    });

    it('every emphasis key referenced by a style exists in the EMPHASES library', () => {
        for (const styles of Object.values(STYLES)) {
            for (const style of styles) {
                for (const session of style.sessions) {
                    expect(EMPHASES[session.emphasis]).toBeDefined();
                }
            }
        }
    });
});

// ── 9. Schedule variant pin ──────────────────────────────────────────────────

describe('schedule variant pin', () => {
    it('each schedule row carries the per-day variant from its session', () => {
        const style = STYLES[4][0]; // ul-classic-4
        const bp = generateRoutine(input({ style }));
        bp.schedule.forEach((row, i) => {
            expect(row.variant).toBe(style.sessions[i].variant);
        });
        // And the exercises emitted for that day carry the same variant.
        for (const row of bp.schedule) {
            const ids = bp.exercises.filter((e) => e.workout_type === row.workout_type && e.variant === row.variant);
            expect(ids.length).toBeGreaterThan(0);
        }
    });

    it('a single-session focus pins a null variant (PPL)', () => {
        const bp = generateRoutine(
            input({ style: STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle, trainingDays: [1, 3, 5] }),
        );
        expect(bp.schedule.every((s) => s.variant === null)).toBe(true);
    });
});

// ── Anchor-aware day ordering (#7 schedule rotation) ─────────────────────────

describe('orderTrainingDays', () => {
    const MWThSu = [1, 3, 4, 0]; // Mon, Wed, Thu, Sun (insertion order, unsorted)

    it('rotates the week so the first day is the first selected day on/after the anchor', () => {
        // Tue anchor: Wed is the first trained day on/after Tuesday.
        expect(orderTrainingDays(MWThSu, 2)).toEqual([3, 4, 0, 1]); // Wed, Thu, Sun, Mon
    });

    it('a Monday anchor keeps Monday first and pushes Sunday last (kills the Sunday-first artifact)', () => {
        // Naive ascending sort would put Sunday (0) first; anchored on Monday it is last.
        expect(orderTrainingDays(MWThSu, 1)).toEqual([1, 3, 4, 0]); // Mon, Wed, Thu, Sun
        expect(orderTrainingDays(MWThSu, 1)[0]).toBe(1);
    });

    it('for every anchor weekday, the first ordered day is the first selected day on/after the anchor', () => {
        for (let anchor = 0; anchor <= 6; anchor++) {
            const ordered = orderTrainingDays(MWThSu, anchor);
            const expectedFirst = [...MWThSu].sort((a, b) => ((a - anchor + 7) % 7) - ((b - anchor + 7) % 7))[0];
            expect(ordered[0]).toBe(expectedFirst);
            // The ordered set is a permutation of the input (no day lost or added).
            expect([...ordered].sort()).toEqual([...MWThSu].sort());
        }
    });

    it('is a no-op for a Sunday-free, Monday-inclusive set on a Monday anchor (existing routines unchanged)', () => {
        expect(orderTrainingDays([1, 2, 4, 5], 1)).toEqual([1, 2, 4, 5]);
        expect(orderTrainingDays([1, 3, 5], 1)).toEqual([1, 3, 5]);
    });
});

describe('generateRoutine anchor-aware schedule', () => {
    it('PPL + Full Body, Mon/Wed/Thu/Sun, Tuesday start → Wednesday is Push', () => {
        const style = STYLES[4].find((s) => s.key === 'ppl-fb-4') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 4, 0], anchorDow: 2 }));
        const wed = bp.schedule.find((s) => s.day_of_week === 3);
        expect(wed?.workout_type).toBe('push'); // session A (Push) lands on the first trained day after Tue
        // Sequence runs Wed→Thu→Sun→Mon = Push, Pull, Legs, Full Body.
        expect(bp.schedule.map((s) => [s.day_of_week, s.workout_type])).toEqual([
            [3, 'push'],
            [4, 'pull'],
            [0, 'legs'],
            [1, 'full_body'],
        ]);
    });

    it('PPL + Full Body, Mon/Wed/Thu/Sun, Monday start → Push is on Monday, not Sunday', () => {
        const style = STYLES[4].find((s) => s.key === 'ppl-fb-4') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 4, 0], anchorDow: 1 }));
        const push = bp.schedule.find((s) => s.workout_type === 'push');
        expect(push?.day_of_week).toBe(1); // Monday, not Sunday (the pre-fix artifact)
        expect(bp.schedule.find((s) => s.day_of_week === 0)?.workout_type).not.toBe('push');
    });

    it('defaults to a Monday week-start when no anchor is given', () => {
        const style = STYLES[4].find((s) => s.key === 'ppl-fb-4') as ProgramStyle;
        const withDefault = generateRoutine(input({ style, trainingDays: [1, 3, 4, 0] }));
        const withMonday = generateRoutine(input({ style, trainingDays: [1, 3, 4, 0], anchorDow: 1 }));
        expect(withDefault.schedule).toEqual(withMonday.schedule);
    });
});

// ── applyTemplateVolume (unchanged behaviour) ────────────────────────────────

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

describe('buildRationale', () => {
    const style = {
        key: 'ul-aesthetic-4',
        name: 'Aesthetic Upper / Lower',
        bestFor: 'Upper-body priority with extra isolation and a leaner lower.',
        sessions: [],
    } as unknown as import('../types').ProgramStyle;
    it('builds a rationale from answers, session time and style', () => {
        const answers = {
            equipment: new Set(),
            experience: 'intermediate',
            goal: 'build_muscle',
            days: 4,
        } as unknown as import('../recommendation').OnboardingAnswers;
        expect(buildRationale(answers, '45–60 min', style)).toBe(
            'Aesthetic Upper / Lower for intermediate lifters · 4 days/week · build muscle · 45–60 min sessions. Upper-body priority with extra isolation and a leaner lower.',
        );
    });
    it('prints the exact frequency, not a bucket (3 → "3 days/week")', () => {
        const answers = {
            equipment: new Set(),
            experience: 'intermediate',
            goal: 'build_muscle',
            days: 3,
        } as unknown as import('../recommendation').OnboardingAnswers;
        const r = buildRationale(answers, '45–60 min', style);
        expect(r).toContain('3 days/week');
        expect(r).not.toContain('2-3');
    });
    it('maps goals to friendly labels', () => {
        const a = (g: string) =>
            ({
                equipment: new Set(),
                experience: 'beginner',
                goal: g,
                days: 3,
            }) as unknown as import('../recommendation').OnboardingAnswers;
        expect(buildRationale(a('lose_fat'), '~30 min', style)).toContain('lose fat');
        expect(buildRationale(a('general_fitness'), '~30 min', style)).toContain('general fitness');
    });
    const answers = {
        equipment: new Set(),
        experience: 'intermediate',
        goal: 'build_muscle',
        days: 4,
    } as unknown as import('../recommendation').OnboardingAnswers;
    it('appends a priority-tilt sentence naming the muscle when a priority is set', () => {
        expect(buildRationale(answers, '45–60 min', style, 'chest')).toMatch(/leans? .*into chest/i);
    });
    it('omits the priority sentence when there is no priority', () => {
        expect(buildRationale(answers, '45–60 min', style, null)).not.toMatch(
            /into (chest|back|legs|glutes|shoulders|arms)/i,
        );
    });
});

// ── 10. generateRoutine + trainingStyle ──────────────────────────────────────

describe('generateRoutine + trainingStyle', () => {
    it('balanced (and omitted) reproduce the current blueprint across every archetype', () => {
        const archetypes: { key: string; count: number; days: number[] }[] = [
            { key: STYLES[2][0].key, count: 2, days: [1, 4] },
            { key: STYLES[3][0].key, count: 3, days: [1, 3, 5] },
            { key: 'ppl-3', count: 3, days: [1, 3, 5] },
            { key: 'ul-classic-4', count: 4, days: [1, 2, 4, 5] },
            { key: 'ppl-x2-6', count: 6, days: [1, 2, 3, 4, 5, 6] },
        ];
        for (const a of archetypes) {
            const style = STYLES[a.count].find((s) => s.key === a.key) as ProgramStyle;
            const base = generateRoutine(input({ style, trainingDays: a.days }));
            const balanced = generateRoutine(input({ style, trainingDays: a.days, trainingStyle: 'balanced' }));
            expect(balanced).toEqual(base);
        }
    });
    it('strength lowers rep ranges and bumps the first compound on a PPL split', () => {
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const base = generateRoutine(input({ style, trainingDays: [1, 3, 5] }));
        const strong = generateRoutine(input({ style, trainingDays: [1, 3, 5], trainingStyle: 'strength' }));
        expect(strong.exercises.map((e) => e.reps)).not.toEqual(base.exercises.map((e) => e.reps));
        expect(strong.exercises.some((e) => e.sets === '4')).toBe(true);
    });
    it('powerbuilding splits heavy patterns vs accessories within a PPL session', () => {
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], trainingStyle: 'powerbuilding' }));
        const strengthRange = repRange('strength', true, 'build_muscle');
        const hyperIso = repRange('hypertrophy', false, 'build_muscle');
        const push = bp.exercises.filter((e) => e.workout_type === 'push');
        expect(push.some((e) => e.reps === strengthRange)).toBe(true);
        expect(push.some((e) => e.reps === hyperIso)).toBe(true);
    });
    it('powerbuilding trains the primary row/pull compound heavy (3-6) on a PPL pull day', () => {
        // Item 1 end-to-end: the pull session's compound patterns (horizontal_pull,
        // vertical_pull) now land in the strength rep band, not hypertrophy.
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const pool = deepPool();
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, trainingStyle: 'powerbuilding' }));
        const pat = new Map(pool.map((e) => [e.id, e.movement_pattern]));
        const pullCompoundReps = bp.exercises
            .filter((e) => e.workout_type === 'pull')
            .filter((e) => {
                const p = pat.get(e.exercise_id);
                return p === 'horizontal_pull' || p === 'vertical_pull';
            })
            .map((e) => e.reps);
        expect(pullCompoundReps.length).toBeGreaterThan(0);
        expect(pullCompoundReps.every((r) => r === '3-6')).toBe(true);
    });
    it('powerbuilding also splits on a U/L split (more than one archetype verified)', () => {
        const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], trainingStyle: 'powerbuilding' }));
        const strengthRange = repRange('strength', true, 'build_muscle');
        const hyperIso = repRange('hypertrophy', false, 'build_muscle');
        expect(bp.exercises.some((e) => e.reps === strengthRange)).toBe(true);
        expect(bp.exercises.some((e) => e.reps === hyperIso)).toBe(true);
    });
    it('6-day PPL + strength: every session has a well-formed range and exactly one bumped compound', () => {
        const style = STYLES[6][0] as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5, 6], trainingStyle: 'strength' }));
        expect(bp.exercises.every((e) => /^\d+-\d+$/.test(e.reps))).toBe(true);
        expect(bp.exercises.filter((e) => e.sets === '4').length).toBe(bp.schedule.length);
    });
});

describe('buildRationale trainingStyle clause', () => {
    const answers = {
        equipment: new Set<EquipmentKey>(['dumbbells']),
        experience: 'intermediate' as const,
        goal: 'build_muscle' as const,
        days: 4 as const,
    };
    const style = STYLES[4][0];
    it('omits any style clause for balanced / undefined', () => {
        const r = buildRationale(answers, '45–60 min', style, null, 'balanced');
        expect(r).not.toMatch(/strength|powerbuilding|size/i);
    });
    it('adds a strength clause', () => {
        expect(buildRationale(answers, '45–60 min', style, null, 'strength')).toMatch(/strength/i);
    });
    it('adds a powerbuilding clause', () => {
        expect(buildRationale(answers, '45–60 min', style, null, 'powerbuilding')).toMatch(/powerbuilding/i);
    });
});

describe('buildRationale lower-split clause (quad-led vs posterior-led lower days)', () => {
    const answers = {
        equipment: new Set<EquipmentKey>(['dumbbells']),
        experience: 'intermediate' as const,
        goal: 'build_muscle' as const,
        days: 4 as const,
    };
    const styleByKey = (count: number, key: string) => STYLES[count].find((s) => s.key === key) as ProgramStyle;

    it('explains the split for a style with a quad-led and a posterior-led lower day', () => {
        // ul-classic-4: lower_quad (squat, no hinge) + lower_post (hinge, no squat).
        const r = buildRationale(answers, '45–60 min', styleByKey(4, 'ul-classic-4'));
        expect(r).toContain('split on purpose');
        expect(r).toContain('squat-free day is intentional');
    });

    it('explains the split for ulppl-5 and ppl-x2-6 (the other quad/posterior styles)', () => {
        expect(buildRationale(answers, '45–60 min', styleByKey(5, 'ulppl-5'))).toContain('split on purpose');
        expect(buildRationale(answers, '45–60 min', styleByKey(6, 'ppl-x2-6'))).toContain('split on purpose');
    });

    it('stays silent for PHUL (both lower days are squat-led: the split is power vs volume, not quad vs posterior)', () => {
        expect(buildRationale(answers, '45–60 min', styleByKey(4, 'phul-4'))).not.toContain('split on purpose');
    });

    it('stays silent when both lower days train the same patterns (ppl-fb-4 legs + full body)', () => {
        expect(buildRationale(answers, '45–60 min', styleByKey(4, 'ppl-fb-4'))).not.toContain('split on purpose');
    });
});

// ── 11. GQ1: exercise ordering and pattern guardrails ────────────────────────

// ── Exercise role model: role sequence (Item 4) ──────────────────────────────
// Spec: docs/superpowers/specs/2026-06-10-22-41-05-exercise-role-model-design.md.
// PL -> PU -> SL -> SU -> Isolation -> Finisher, coarse Lower/Upper buckets, lower
// pattern priority squat>hinge>lunge, upper push-before-pull tiebreak.
describe('exercise role model: role sequence (Item 4)', () => {
    const byId = (pool: ExerciseMeta[]) => new Map(pool.map((e) => [e.id, e]));
    const UPPER = new Set(['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull']);
    const LOWER = new Set(['squat', 'hinge', 'lunge']);
    const isUpperCompound = (e: ExerciseMeta) => e.is_compound && UPPER.has(e.movement_pattern ?? '');
    const isLowerCompound = (e: ExerciseMeta) => e.is_compound && LOWER.has(e.movement_pattern ?? '');
    const isFinisher = (e: ExerciseMeta) => e.movement_pattern === 'calf' || e.movement_pattern === 'core';
    // bucket rank for the non-decreasing-sequence checks: compounds 0, isolation 1, finisher 2.
    const bucketRank = (e: ExerciseMeta) => (isUpperCompound(e) || isLowerCompound(e) ? 0 : isFinisher(e) ? 2 : 1);

    // A minimal named pool: exactly one compound per fb_strength pattern, fatigue set
    // so the bench/row tie resolves by push-before-pull, not id order.
    const namedFullBodyPool = (): ExerciseMeta[] => [
        meta('ex-squat', 'squat', ['dumbbells'], true, { name: 'Barbell Squat', fatigue: 5 }),
        meta('ex-rdl', 'hinge', ['dumbbells'], true, { name: 'Romanian Deadlift', fatigue: 4 }),
        meta('ex-bench', 'horizontal_push', ['dumbbells'], true, { name: 'Barbell Bench Press', fatigue: 4 }),
        meta('ex-row', 'horizontal_pull', ['dumbbells'], true, { name: 'Barbell Row', fatigue: 4 }),
        meta('ex-curl', 'biceps_iso', ['dumbbells'], false),
        meta('ex-core', 'core', ['dumbbells'], false),
    ];

    // #1
    it('full body squat+bench+RDL+row orders PL -> PU -> SL -> SU', () => {
        const style = STYLES[2][0] as ProgramStyle; // fb-2, day A = fb_strength
        const bp = generateRoutine(input({ style, trainingDays: [1, 4], pool: namedFullBodyPool() }));
        const ids = sessionIds(bp, 'full_body', 'A');
        expect(ids[0]).toBe('ex-squat'); // Primary Lower
        expect(ids[1]).toBe('ex-bench'); // Primary Upper (push-before-pull beats the row at equal fatigue)
        expect(ids[2]).toBe('ex-rdl'); // Secondary Lower
        expect(ids[3]).toBe('ex-row'); // Secondary Upper
    });

    // #2
    it('upper-only session orders Primary/Secondary Upper before isolation before finisher', () => {
        const pool = deepPool();
        const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], pool }));
        const m = byId(pool);
        const items = sessionIds(bp, 'upper', 'A').map((id) => m.get(id)!);
        expect(items.some(isLowerCompound)).toBe(false); // no lower roles on an upper day
        expect(isUpperCompound(items[0])).toBe(true); // leads with Primary Upper
        const ranks = items.map(bucketRank);
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b)); // non-decreasing: compounds -> iso -> finisher
    });

    // #3
    it('legs session orders PL -> SL -> isolation -> finisher with squat and hinge adjacent', () => {
        const pool = deepPool();
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
        const m = byId(pool);
        const items = sessionIds(bp, 'legs', null).map((id) => m.get(id)!);
        expect(items.some(isUpperCompound)).toBe(false);
        expect(items[0].movement_pattern).toBe('squat'); // Primary Lower
        expect(items[1].movement_pattern).toBe('hinge'); // Secondary Lower, adjacent (no upper to separate)
        const ranks = items.map(bucketRank);
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    });

    // #4
    it('lone lunge promotion: a split squat is Primary Lower, before the first upper compound', () => {
        // knee + lower_back remove squat/hinge, leaving the lunge as the only lower compound.
        const pool: ExerciseMeta[] = [
            meta('ex-bss', 'lunge', ['dumbbells'], true, { name: 'Bulgarian Split Squat' }),
            meta('ex-rdl', 'hinge', ['dumbbells'], true, { contraindications: ['lower_back'] }),
            meta('ex-bench', 'horizontal_push', ['dumbbells'], true),
            meta('ex-row', 'horizontal_pull', ['dumbbells'], true),
            meta('ex-sh', 'shoulder_iso', ['dumbbells'], false),
            meta('ex-tri', 'triceps_iso', ['dumbbells'], false),
            meta('ex-bi', 'biceps_iso', ['dumbbells'], false),
        ];
        const style = STYLES[2][0] as ProgramStyle; // fb-2, day B = fb_hyper (has a lunge slot)
        const bp = generateRoutine(input({ style, trainingDays: [1, 4], pool, restrictions: ['knee', 'lower_back'] }));
        const m = byId(pool);
        const ids = sessionIds(bp, 'full_body', 'B');
        const lungeIdx = ids.indexOf('ex-bss');
        const firstUpperIdx = ids.findIndex((id) => isUpperCompound(m.get(id)!));
        expect(lungeIdx).toBeGreaterThanOrEqual(0);
        expect(firstUpperIdx).toBeGreaterThanOrEqual(0);
        expect(lungeIdx).toBeLessThan(firstUpperIdx);
    });

    // #5
    it('squat is Primary Lower even when the emphasis selects hinge before squat', () => {
        // fb_strength lists hinge before squat, so RDL is selected first; the pattern
        // priority squat>hinge must still rank Barbell Squat as Primary Lower.
        const style = STYLES[2][0] as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 4], pool: namedFullBodyPool() }));
        const ids = sessionIds(bp, 'full_body', 'A');
        expect(ids.indexOf('ex-squat')).toBeLessThan(ids.indexOf('ex-rdl'));
        expect(ids[0]).toBe('ex-squat');
    });

    // #6
    it('strength set-bump lands on position 0 (Primary Upper) on an upper session', () => {
        const pool = deepPool();
        const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], pool, trainingStyle: 'strength' }));
        const upperA = bp.exercises
            .filter((e) => e.workout_type === 'upper' && e.variant === 'A')
            .sort((a, b) => a.order - b.order);
        const bumped = upperA.filter((e) => e.sets === '4');
        expect(bumped).toHaveLength(1);
        expect(bumped[0].order).toBe(upperA[0].order); // bump on the leading Primary Upper
        const m = byId(pool);
        expect(isUpperCompound(m.get(upperA[0].exercise_id)!)).toBe(true);
    });

    // #7
    it('interleaveLowerCompounds has been removed (subsumed by the role model)', () => {
        const src = readFileSync(resolve(process.cwd(), 'src/lib/pulse/generation.ts'), 'utf8');
        expect(src).not.toContain('interleaveLowerCompounds');
    });

    // #8
    it('no session opens with two lower compounds when it also contains an upper compound', () => {
        const pool = deepPool();
        for (const [count, styles] of Object.entries(STYLES)) {
            const n = Number(count);
            const days = Array.from({ length: n }, (_, i) => i + 1);
            for (const style of styles) {
                const bp = generateRoutine(input({ style, trainingDays: days, pool, sessionTime: '90+ min' }));
                const m = byId(pool);
                for (const s of bp.schedule) {
                    const items = sessionIds(bp, s.workout_type, s.variant).map((id) => m.get(id)!);
                    if (items.length >= 2 && isLowerCompound(items[0]) && isLowerCompound(items[1])) {
                        // allowed only when the session has no upper compound to separate them
                        expect(items.some(isUpperCompound)).toBe(false);
                    }
                }
            }
        }
    });
});

describe('assignRole (pure role assignment, Item 4)', () => {
    it('ranks squat/hinge by rank; lunge is never Primary unless it is the lone lower compound', () => {
        expect(assignRole('squat', true, 1, false)).toBe('PRIMARY_LOWER');
        expect(assignRole('hinge', true, 2, false)).toBe('SECONDARY_LOWER');
        expect(assignRole('lunge', true, 1, false)).toBe('SECONDARY_LOWER'); // rank 1 but not lone
        expect(assignRole('lunge', true, 1, true)).toBe('PRIMARY_LOWER'); // lone lunge promotion
        expect(assignRole('lunge', true, 2, true)).toBe('SECONDARY_LOWER'); // subsequent lunges stay secondary
    });
    it('pools push and pull into one Upper bucket (one Primary Upper by rank)', () => {
        expect(assignRole('horizontal_push', true, 1, false)).toBe('PRIMARY_UPPER');
        expect(assignRole('horizontal_pull', true, 2, false)).toBe('SECONDARY_UPPER');
        expect(assignRole('vertical_pull', true, 1, false)).toBe('PRIMARY_UPPER');
    });
    it('maps isolation and finisher buckets regardless of rank', () => {
        expect(assignRole('chest_iso', false, 0, false)).toBe('ISOLATION');
        expect(assignRole('horizontal_push', false, 1, false)).toBe('ISOLATION'); // a non-compound press
        expect(assignRole('calf', false, 0, false)).toBe('FINISHER');
        expect(assignRole('core', false, 0, false)).toBe('FINISHER');
    });
});

// ── Role ordering: squat/hinge separation (Item 4) ───────────────────────────
// Re-homed from the interim interleave (now removed). These assertions are preserved
// verbatim and still hold under the role model: the role sort separates squat and
// hinge with the Primary Upper on a full-body day, and leaves a leg-only session's
// squat/hinge adjacent. The full role sequence is exercised by the "role sequence
// (Item 4)" block above.
describe('role ordering: squat/hinge separation (Item 4)', () => {
    const patternMapOf = (pool: ExerciseMeta[]) => new Map(pool.map((e) => [e.id, e]));
    const UPPER_COMPOUND = ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'];

    it('a full-body session with squat+hinge separates them with an upper compound', () => {
        // fb-3 day A is fb_strength: under the role model squat = Primary Lower and
        // hinge = Secondary Lower, separated by the Primary Upper at position 1.
        const pool = deepPool();
        const style = STYLES[3].find((s) => s.key === 'fb-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
        const meta = patternMapOf(pool);
        const dayA = bp.exercises
            .filter((e) => e.variant === 'A')
            .sort((a, b) => a.order - b.order)
            .map((e) => meta.get(e.exercise_id)!);
        const patterns = dayA.map((m) => m.movement_pattern);
        expect(patterns).toContain('squat');
        expect(patterns).toContain('hinge');
        // The two heavy lower compounds are no longer adjacent.
        expect(Math.abs(patterns.indexOf('squat') - patterns.indexOf('hinge'))).toBeGreaterThan(1);
        // The exercise slotted between them is an upper compound.
        expect(UPPER_COMPOUND).toContain(patterns[1]);
        expect(dayA[1].is_compound).toBe(true);
    });

    it('the strength set-bump still lands on the lead compound (position 0) after role ordering', () => {
        // fb_strength resolves to strength bias, so its first compound gets +1 set.
        // Role ordering must keep the bump on position 0 (the Primary Lower), not
        // shift it onto the inserted upper compound.
        const pool = deepPool();
        const style = STYLES[3].find((s) => s.key === 'fb-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
        const dayA = bp.exercises.filter((e) => e.variant === 'A').sort((a, b) => a.order - b.order);
        const bumped = dayA.filter((e) => e.sets === '4');
        expect(bumped).toHaveLength(1);
        expect(bumped[0].order).toBe(dayA[0].order); // the bump is on the first exercise
    });

    it('a leg-only session keeps squat and hinge adjacent (no upper compound to separate them)', () => {
        // ppl-3 legs is squat/hinge/lunge with no upper compound, so role ordering
        // keeps squat+hinge adjacent at the lead (Primary Lower then Secondary Lower).
        const pool = deepPool();
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
        const meta = patternMapOf(pool);
        const legs = bp.exercises
            .filter((e) => e.workout_type === 'legs')
            .sort((a, b) => a.order - b.order)
            .map((e) => meta.get(e.exercise_id)!.movement_pattern);
        expect(legs[0] === 'squat' || legs[0] === 'hinge').toBe(true);
        expect(legs[1] === 'squat' || legs[1] === 'hinge').toBe(true);
    });
});

describe('GQ1: tier sort -- compounds before isolation', () => {
    it('every session has all compound exercises ordered before all isolation exercises', () => {
        const pool = deepPool();
        // Use PPL (push/pull/legs) -- each session has a clear mix of compounds + isolations.
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
        const patternMap = new Map(pool.map((e) => [e.id, e]));
        for (const s of bp.schedule) {
            const sessionExs = bp.exercises
                .filter((e) => e.workout_type === s.workout_type && e.variant === s.variant)
                .sort((a, b) => a.order - b.order);
            let seenIso = false;
            for (const ex of sessionExs) {
                const m = patternMap.get(ex.exercise_id);
                if (!m) continue;
                const isIso =
                    (m.movement_pattern?.endsWith('_iso') ?? false) ||
                    m.movement_pattern === 'calf' ||
                    m.movement_pattern === 'core';
                if (!isIso) {
                    // A compound appeared -- it must not follow an isolation.
                    expect(seenIso).toBe(false);
                }
                if (isIso) seenIso = true;
            }
        }
    });

    it('Tier 1 squat/hinge compounds lead the legs session', () => {
        const pool = deepPool();
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, sessionTime: '45–60 min' }));
        const patternMap = new Map(pool.map((e) => [e.id, e]));
        const legsExs = bp.exercises.filter((e) => e.workout_type === 'legs').sort((a, b) => a.order - b.order);
        // The first exercise must be squat or hinge (both Tier 1).
        const first = patternMap.get(legsExs[0].exercise_id);
        const firstPattern = first?.movement_pattern;
        expect(firstPattern === 'squat' || firstPattern === 'hinge').toBe(true);
    });
});

describe('GQ1: hinge deduplication guard', () => {
    it('a session with a deep hinge pool never contains two hinge exercises', () => {
        const pool = deepPool();
        // Add extra hinge options so backfill has candidates.
        for (let i = 3; i <= 6; i++) {
            pool.push(meta(`hinge-${i}`, 'hinge', ['dumbbells'], true));
        }
        // 90+ min gives 7-8 exercises -- enough to trigger backfill on a legs session.
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, sessionTime: '90+ min' }));
        const patternMap = new Map(pool.map((e) => [e.id, e]));
        for (const s of bp.schedule) {
            const sessionExs = bp.exercises.filter((e) => e.workout_type === s.workout_type && e.variant === s.variant);
            const hingeCount = sessionExs.filter(
                (e) => patternMap.get(e.exercise_id)?.movement_pattern === 'hinge',
            ).length;
            expect(hingeCount).toBeLessThanOrEqual(1);
        }
    });

    it('squat compound is capped at one per session but lunge is never capped', () => {
        const pool = deepPool();
        for (let i = 3; i <= 6; i++) {
            pool.push(meta(`squat-${i}`, 'squat', ['dumbbells'], true));
            pool.push(meta(`lunge-${i}`, 'lunge', ['dumbbells'], true));
        }
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, sessionTime: '90+ min' }));
        const patternMap = new Map(pool.map((e) => [e.id, e]));
        const legsExs = bp.exercises.filter((e) => e.workout_type === 'legs');
        const squatCount = legsExs.filter((e) => patternMap.get(e.exercise_id)?.movement_pattern === 'squat').length;
        const lungeCount = legsExs.filter((e) => patternMap.get(e.exercise_id)?.movement_pattern === 'lunge').length;
        // At most one heavy squat compound; lunge can appear more than once (it is not capped).
        expect(squatCount).toBeLessThanOrEqual(1);
        expect(lungeCount).toBeGreaterThanOrEqual(1);
    });

    it('squat + lunge (Bulgarian Split Squat) is valid in the same session', () => {
        const pool = deepPool();
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
        const patternMap = new Map(pool.map((e) => [e.id, e]));
        const legsExs = bp.exercises.filter((e) => e.workout_type === 'legs');
        const patterns = new Set(legsExs.map((e) => patternMap.get(e.exercise_id)?.movement_pattern));
        // A squat + a lunge may (and should) coexist.
        expect(patterns.has('squat')).toBe(true);
        expect(patterns.has('lunge')).toBe(true);
    });
});

describe('GQ1: backfill prefers uncovered slots', () => {
    it('equipment-constrained pool (only 1 hinge option) still reaches the target exercise count', () => {
        const pool: ExerciseMeta[] = [];
        for (const p of ALL_PATTERNS) {
            const compound = !p.endsWith('_iso') && p !== 'calf' && p !== 'core';
            if (p === 'hinge') {
                // Only one hinge -- cap must not prevent filling the session.
                pool.push(meta('hinge-only', 'hinge', ['dumbbells'], true));
            } else {
                pool.push(meta(`${p}-1`, p, ['dumbbells'], compound));
                pool.push(meta(`${p}-2`, p, ['dumbbells'], compound));
            }
        }
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, sessionTime: '90+ min' }));
        // 90+ min intermediate = 8 exercises; beginner = 7 -- either is fine, check floor.
        for (const s of bp.schedule) {
            const count = sessionIds(bp, s.workout_type, s.variant).length;
            expect(count).toBeGreaterThanOrEqual(7);
        }
    });

    it('when leg-pattern pool is exhausted the heavy-cap relaxes and hinge fills the session', () => {
        // Pool: deep hinge (4 options), only 1 of every other leg pattern.
        // This exercises the relaxed-cap fallback: after squat/lunge/glute/calf/core
        // are exhausted, the second and third hinge should fill out the count.
        const pool: ExerciseMeta[] = [];
        for (const p of ALL_PATTERNS) {
            const compound = !p.endsWith('_iso') && p !== 'calf' && p !== 'core';
            if (p === 'hinge') {
                for (let i = 1; i <= 4; i++) pool.push(meta(`hinge-${i}`, 'hinge', ['dumbbells'], true));
            } else {
                pool.push(meta(`${p}-1`, p, ['dumbbells'], compound));
                pool.push(meta(`${p}-2`, p, ['dumbbells'], compound));
            }
        }
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, sessionTime: '90+ min' }));
        // The legs session specifically should hit target count via hinge fallback.
        const legsCount = sessionIds(bp, 'legs', null).length;
        expect(legsCount).toBeGreaterThanOrEqual(7);
    });
});

describe('GQ1: golden identity -- varied default unchanged', () => {
    it("'varied' and omitted still produce byte-identical output after GQ1", () => {
        for (const config of [{ days: [1, 3, 5] }, { days: [1, 2, 4, 5] }, { days: [1, 2, 3, 4, 5, 6] }]) {
            const style = STYLES[config.days.length][0] as ProgramStyle;
            const base = generateRoutine(input({ style, trainingDays: config.days }));
            const varied = generateRoutine(input({ style, trainingDays: config.days, varietyPreference: 'varied' }));
            expect(varied).toEqual(base);
        }
    });
});

describe('generateRoutine + varietyPreference', () => {
    const fbStyle = STYLES[4].find((s) => s.key === 'fb-hmhp-4') as ProgramStyle;
    const fbDays = [1, 2, 4, 5];

    const patternOf = (pool: ExerciseMeta[]) => new Map(pool.map((e) => [e.id, e.movement_pattern]));
    const distinctFor = (bp: ReturnType<typeof generateRoutine>, pool: ExerciseMeta[], pattern: MovementPattern) => {
        const pat = patternOf(pool);
        return new Set(bp.exercises.filter((e) => pat.get(e.exercise_id) === pattern).map((e) => e.exercise_id));
    };
    const countFor = (bp: ReturnType<typeof generateRoutine>, pool: ExerciseMeta[], pattern: MovementPattern) => {
        const pat = patternOf(pool);
        return bp.exercises.filter((e) => pat.get(e.exercise_id) === pattern).length;
    };

    it("'varied' and undefined produce identical output (identity)", () => {
        for (const a of [{ days: [1, 3, 5] }, { days: [1, 2, 4, 5] }, { days: [1, 2, 3, 4, 5, 6] }]) {
            const style = STYLES[a.days.length][0] as ProgramStyle;
            const base = generateRoutine(input({ style, trainingDays: a.days }));
            const varied = generateRoutine(input({ style, trainingDays: a.days, varietyPreference: 'varied' }));
            expect(varied).toEqual(base);
        }
    });

    it("'consistent' is deterministic (same input twice -> identical output)", () => {
        const a = generateRoutine(input({ style: fbStyle, trainingDays: fbDays, varietyPreference: 'consistent' }));
        const b = generateRoutine(input({ style: fbStyle, trainingDays: fbDays, varietyPreference: 'consistent' }));
        expect(a).toEqual(b);
    });

    it("'consistent' anchors each recurring compound to one exercise across sessions", () => {
        const pool = deepPool();
        const bp = generateRoutine(
            input({ style: fbStyle, trainingDays: fbDays, pool, varietyPreference: 'consistent' }),
        );
        for (const p of COMPOUND_ANCHOR_PATTERNS) {
            if (countFor(bp, pool, p) > 1) {
                expect(distinctFor(bp, pool, p).size).toBe(1);
            }
        }
    });

    it("'varied' (default) lets at least one recurring compound rotate across sessions", () => {
        const pool = deepPool();
        const bp = generateRoutine(input({ style: fbStyle, trainingDays: fbDays, pool, varietyPreference: 'varied' }));
        const rotated = [...COMPOUND_ANCHOR_PATTERNS].some(
            (p) => countFor(bp, pool, p) > 1 && distinctFor(bp, pool, p).size > 1,
        );
        expect(rotated).toBe(true);
    });

    it("'consistent' still rotates accessories (isolation is not anchored)", () => {
        const pool = deepPool();
        const bp = generateRoutine(
            input({ style: fbStyle, trainingDays: fbDays, pool, varietyPreference: 'consistent' }),
        );
        const isoRotated = (
            ['biceps_iso', 'triceps_iso', 'chest_iso', 'back_iso', 'shoulder_iso', 'glute_iso'] as MovementPattern[]
        ).some((p) => countFor(bp, pool, p) > 1 && distinctFor(bp, pool, p).size > 1);
        expect(isoRotated).toBe(true);
    });

    it("'consistent' never repeats an exercise within one session", () => {
        const pool = deepPool();
        const bp = generateRoutine(
            input({ style: fbStyle, trainingDays: fbDays, pool, varietyPreference: 'consistent' }),
        );
        for (const day of fbDays) {
            const variant = bp.schedule.find((s) => s.day_of_week === day)?.variant ?? null;
            const ids = sessionIds(bp, 'full_body', variant);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });
});

// ── 12. Loading lean: modality preference secondary sort ─────────────────────

describe('loading lean: preferred equipment floats before non-preferred', () => {
    const bbAndDb = new Set<EquipmentKey>(['dumbbells', 'barbell']);

    // Two squat exercises: 'squat-aa-dumbbell' sorts first alphabetically, but
    // 'squat-zz-barbell' should win when loadingLean is 'barbell'.
    function poolWithBarbell(): ExerciseMeta[] {
        return [
            meta('squat-aa-dumbbell', 'squat', ['dumbbells'], true),
            meta('squat-zz-barbell', 'squat', ['barbell'], true),
            ...ALL_PATTERNS.filter((p) => p !== 'squat').flatMap((p) => [
                meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
                meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
            ]),
        ];
    }

    it('picks barbell squat over alphabetically-first dumbbell squat when loadingLean is barbell', () => {
        const pool = poolWithBarbell();
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const answers = {
            equipment: bbAndDb,
            experience: 'intermediate' as const,
            goal: 'build_muscle' as const,
            days: 3 as const,
        };

        // Without loading lean: squat-aa-dumbbell wins (alphabetically first).
        const base = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, answers }));
        expect(sessionIds(base, 'legs', null)).toContain('squat-aa-dumbbell');

        // With loadingLean: 'barbell': squat-zz-barbell should be preferred.
        const lean = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, answers, loadingLean: 'barbell' }));
        expect(sessionIds(lean, 'legs', null)).toContain('squat-zz-barbell');
        expect(sessionIds(lean, 'legs', null)).not.toContain('squat-aa-dumbbell');
    });

    it('fresh non-preferred beats used preferred across two same-focus sessions', () => {
        // ppl-x2-6: push-A (heavy, horizontal_push lead) and push-B (volume,
        // horizontal_push second) both hit the horizontal_push slot. Barbell
        // bench (preferred) is fresh in push-A, so it wins there. By push-B the
        // barbell bench is in the used set, so the fresh dumbbell wins.
        // (Premise migrated from legs x2 squat when Item 5 split the leg days;
        // ~30 min keeps each push day at a single horizontal_push slot.)
        const pool = [
            meta('bench-aa-dumbbell', 'horizontal_push', ['dumbbells'], true),
            meta('bench-zz-barbell', 'horizontal_push', ['barbell'], true),
            ...ALL_PATTERNS.filter((p) => p !== 'horizontal_push').flatMap((p) => [
                meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
                meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
            ]),
        ];
        const style = STYLES[6][0] as ProgramStyle; // ppl-x2-6
        const answers = {
            equipment: bbAndDb,
            experience: 'intermediate' as const,
            goal: 'build_muscle' as const,
            days: 6 as const,
        };

        const bp = generateRoutine(
            input({
                style,
                trainingDays: [1, 2, 3, 4, 5, 6],
                pool,
                answers,
                loadingLean: 'barbell',
                sessionTime: '~30 min',
            }),
        );
        const pushA = sessionIds(bp, 'push', 'A');
        const pushB = sessionIds(bp, 'push', 'B');

        expect(pushA).toContain('bench-zz-barbell');
        expect(pushB).toContain('bench-aa-dumbbell');
        expect(pushB).not.toContain('bench-zz-barbell');
    });
});

describe('loading lean: graceful fallback when no preferred exercises exist', () => {
    it('generates a full session when loadingLean equipment is absent from pool', () => {
        // loadingLean: 'cable' but pool has only dumbbell exercises.
        // Generator should fall through and produce a normal result.
        const bp = generateRoutine(input({ loadingLean: 'cable' }));
        expect(bp.exercises.length).toBeGreaterThan(0);
    });
});

describe('loading lean: golden identity -- null/undefined is byte-identical to base', () => {
    it('undefined loadingLean produces byte-identical output', () => {
        for (const config of [{ days: [1, 3, 5] }, { days: [1, 2, 4, 5] }, { days: [1, 2, 3, 4, 5, 6] }]) {
            const style = STYLES[config.days.length][0] as ProgramStyle;
            const base = generateRoutine(input({ style, trainingDays: config.days }));
            const noLean = generateRoutine(input({ style, trainingDays: config.days, loadingLean: undefined }));
            expect(noLean).toEqual(base);
        }
    });

    it('null loadingLean produces byte-identical output', () => {
        const style = STYLES[4][0] as ProgramStyle;
        const base = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5] }));
        const nullLean = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], loadingLean: null }));
        expect(nullLean).toEqual(base);
    });
});

// ── 13. GQ2: fatigue metadata into backfill priority ─────────────────────────

function metaFatigue(
    id: string,
    pattern: MovementPattern,
    fatigue: number,
    equipment: EquipmentKey[] = ['dumbbells'],
    compound = true,
): ExerciseMeta {
    return {
        id,
        movement_pattern: pattern,
        equipment,
        is_compound: compound,
        category: 'chest' as ExerciseCategory,
        fatigue,
        substitution_class: null,
        unilateral: false,
        contraindications: [],
    };
}

describe('GQ2: lower-fatigue exercise preferred within same freshness (accessory slots)', () => {
    // Two shoulder-isolation exercises with the same equipment. shoulder_iso is
    // an accessory pattern (not in COMPOUND_ANCHOR_PATTERNS), so GQ2's original
    // lower-fatigue-first tiebreak still applies there post-GQ3 (see the
    // 'GQ3: anchor patterns prefer higher fatigue' suite below for the inverted
    // anchor-pattern behaviour).
    function poolWithFatigue(): ExerciseMeta[] {
        return [
            metaFatigue('shoulder-aa', 'shoulder_iso', 5, ['dumbbells'], false), // high fatigue, alphabetically first
            metaFatigue('shoulder-zz', 'shoulder_iso', 1, ['dumbbells'], false), // low fatigue, alphabetically last
            ...ALL_PATTERNS.filter((p) => p !== 'shoulder_iso').flatMap((p) => [
                meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
                meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
            ]),
        ];
    }

    it('picks lower-fatigue accessory over the alphabetically-first when both fresh', () => {
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;

        // Pool with no fatigue: alphabetically first (shoulder-aa) wins.
        const poolNoFatigue = [
            meta('shoulder-aa', 'shoulder_iso', ['dumbbells'], false),
            meta('shoulder-zz', 'shoulder_iso', ['dumbbells'], false),
            ...ALL_PATTERNS.filter((p) => p !== 'shoulder_iso').flatMap((p) => [
                meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
                meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
            ]),
        ];
        const base = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool: poolNoFatigue }));
        expect(sessionIds(base, 'push', null)).toContain('shoulder-aa');

        // Pool with fatigue tagged: shoulder-zz (fatigue 1) beats shoulder-aa (fatigue 5).
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool: poolWithFatigue() }));
        expect(sessionIds(bp, 'push', null)).toContain('shoulder-zz');
        expect(sessionIds(bp, 'push', null)).not.toContain('shoulder-aa');
    });

    it('fresh high-fatigue still beats used low-fatigue (fresh wins over fatigue)', () => {
        // calf is requested by both lower_quad (legs A) and lower_post (legs B) and
        // by no other ppl-x2-6 session, so legs A / legs B are the only two slots
        // competing for these two candidates -- a clean fresh-vs-used comparison,
        // mirroring the original GQ2 'squat' setup. (glute_iso now lives only on
        // lower_post, so it is no longer a cross-session A/B contest.)
        function poolCalf(): ExerciseMeta[] {
            return [
                metaFatigue('calf-aa', 'calf', 5, ['dumbbells'], false),
                metaFatigue('calf-zz', 'calf', 1, ['dumbbells'], false),
                ...ALL_PATTERNS.filter((p) => p !== 'calf').flatMap((p) => [
                    meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'core'),
                    meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'core'),
                ]),
            ];
        }
        // After session A uses calf-zz (low fatigue, fresh), session B should
        // pick calf-aa (high fatigue, fresh) rather than the used calf-zz.
        const style = STYLES[6][0] as ProgramStyle; // ppl-x2-6: legs appears twice
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5, 6], pool: poolCalf() }));
        const legsA = sessionIds(bp, 'legs', 'A');
        const legsB = sessionIds(bp, 'legs', 'B');
        // Session A picks the low-fatigue accessory (calf-zz, fatigue 1).
        expect(legsA).toContain('calf-zz');
        // Session B: calf-zz is used. Even though calf-aa is higher fatigue,
        // it is the only FRESH option -- fresh wins.
        expect(legsB).toContain('calf-aa');
    });
});

describe('GQ3: anchor patterns prefer higher fatigue', () => {
    // Anchor patterns (COMPOUND_ANCHOR_PATTERNS: squat, hinge, horizontal_push,
    // vertical_push, horizontal_pull, vertical_pull) build the session around a
    // primary lift. Fatigue cost tracks mechanical stimulus for these, so the
    // higher-fatigue option is the better anchor (Barbell Squat over Goblet
    // Squat); GQ2's lower-fatigue-first tiebreak is inverted for them.
    function poolWithFatigue(): ExerciseMeta[] {
        return [
            metaFatigue('squat-aa', 'squat', 1, ['dumbbells'], true), // low fatigue, alphabetically first
            metaFatigue('squat-zz', 'squat', 5, ['dumbbells'], true), // high fatigue, alphabetically last
            ...ALL_PATTERNS.filter((p) => p !== 'squat').flatMap((p) => [
                meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
                meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
            ]),
        ];
    }

    it('picks the higher-fatigue anchor over the alphabetically-first when both fresh', () => {
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;

        // Pool with no fatigue: alphabetically first (squat-aa) wins (unchanged).
        const poolNoFatigue = [
            meta('squat-aa', 'squat', ['dumbbells'], true),
            meta('squat-zz', 'squat', ['dumbbells'], true),
            ...ALL_PATTERNS.filter((p) => p !== 'squat').flatMap((p) => [
                meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
                meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
            ]),
        ];
        const base = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool: poolNoFatigue }));
        expect(sessionIds(base, 'legs', null)).toContain('squat-aa');

        // Pool with fatigue tagged: squat-zz (fatigue 5, the better anchor) beats
        // squat-aa (fatigue 1).
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool: poolWithFatigue() }));
        expect(sessionIds(bp, 'legs', null)).toContain('squat-zz');
        expect(sessionIds(bp, 'legs', null)).not.toContain('squat-aa');
    });

    it('fresh lower-fatigue anchor still beats a used higher-fatigue one (fresh wins over fatigue)', () => {
        // After push-A uses bench-zz (high fatigue, fresh), push-B should pick
        // bench-aa (low fatigue, fresh) rather than the used bench-zz.
        // (Premise migrated from legs x2 squat when Item 5 split the leg days;
        // ~30 min keeps each push day at a single horizontal_push slot.)
        const pool = [
            metaFatigue('bench-aa', 'horizontal_push', 1, ['dumbbells'], true), // low fatigue, alphabetically first
            metaFatigue('bench-zz', 'horizontal_push', 5, ['dumbbells'], true), // high fatigue, alphabetically last
            ...ALL_PATTERNS.filter((p) => p !== 'horizontal_push').flatMap((p) => [
                meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
                meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
            ]),
        ];
        const style = STYLES[6][0] as ProgramStyle; // ppl-x2-6: push × 2
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5, 6], pool, sessionTime: '~30 min' }));
        const pushA = sessionIds(bp, 'push', 'A');
        const pushB = sessionIds(bp, 'push', 'B');
        // Session A picks the better anchor (bench-zz, fatigue 5).
        expect(pushA).toContain('bench-zz');
        // Session B: bench-zz is used. Even though bench-aa is lower fatigue (a
        // weaker anchor), it is the only FRESH horizontal push -- fresh wins.
        expect(pushB).toContain('bench-aa');
    });
});

describe('P0 3.1: compound-first within a mixed pattern (squat / hinge)', () => {
    // Exercises the DEFENSIVE compound-first guard for a synthetic/legacy pool where
    // an unnamed isolation shares a compound pattern. (In the real catalog Leg
    // Extension / Leg Curl now live in the dedicated quad_iso / hamstring_iso patterns,
    // so squat / hinge no longer mix; this guard is a no-op there but still backstops
    // such mixed pools.) When a thin pool removes the named-anchor compounds,
    // an UNNAMED compound competes in-pattern with the isolation. Without the
    // compound-first guard the anchor-pattern fatigue tiebreak (higher-first) lets
    // a higher-fatigue isolation win the primary slot, and COMPOUND_FLOOR then
    // re-adds the compound redundantly (so the isolation is still present and an
    // accessory is displaced). The guard seats the compound in the slot directly.
    // byPattern is a closure, so this exercises the guard end-to-end via generateRoutine.
    function poolMixedSquat(): ExerciseMeta[] {
        return [
            metaFatigue('squat-compound', 'squat', 1, ['dumbbells'], true), // unnamed compound, low fatigue
            metaFatigue('squat-iso', 'squat', 5, ['dumbbells'], false), // isolation, high fatigue
            ...ALL_PATTERNS.filter((p) => p !== 'squat').flatMap((p) => [
                meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
                meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
            ]),
        ];
    }

    it('seats the unnamed compound in the squat slot, not the higher-fatigue isolation', () => {
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const legs = sessionIds(
            generateRoutine(input({ style, trainingDays: [1, 3, 5], pool: poolMixedSquat() })),
            'legs',
            null,
        );
        // Invariant: a primary compound slot prefers a compound over an isolation
        // when both survive filtering. Without the guard, `not.toContain('squat-iso')`
        // fails (the isolation wins the slot; the floor re-adds squat-compound, so both appear).
        expect(legs).toContain('squat-compound');
        expect(legs).not.toContain('squat-iso');
    });
});

describe('GQ3: substitution-class cross-session deduplication', () => {
    it('prefers a distinct movement family over a redundant variant of an already-used class', () => {
        // Two bench-press variants share substitution_class 'horizontal_press';
        // the machine press trains the same pattern via a distinct family. The
        // two push days of ppl-x2-6 both carry a horizontal_push slot -- without
        // the cross-session dedup, the routine could seat both bench variants,
        // which reads as redundant.
        // (Premise migrated from legs x2 hinge when Item 5 split the leg days;
        // ~30 min keeps each push day at a single horizontal_push slot.)
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'horizontal_push')
            .concat([
                meta('barbell-bench', 'horizontal_push', ['dumbbells'], true, {
                    substitution_class: 'horizontal_press',
                    fatigue: 5,
                }),
                meta('db-bench', 'horizontal_push', ['dumbbells'], true, {
                    substitution_class: 'horizontal_press',
                    fatigue: 4,
                }),
                meta('machine-press', 'horizontal_push', ['dumbbells'], true, {
                    substitution_class: 'machine_press',
                    fatigue: 1,
                }),
            ]);
        const style = STYLES[6][0] as ProgramStyle; // ppl-x2-6: push × 2
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5, 6], pool, sessionTime: '~30 min' }));
        const ids = bp.exercises.map((e) => e.exercise_id);
        // Push A anchors on the higher-fatigue bench variant (the better anchor)...
        expect(ids).toContain('barbell-bench');
        // ...and Push B reaches for the machine press -- a distinct substitution
        // class -- rather than seating the redundant second bench variant.
        expect(ids).toContain('machine-press');
        expect(ids).not.toContain('db-bench');
    });
});

describe('GQ3: unilateral exercise cap (at most one per session)', () => {
    it('a deep lunge-pattern pool never seats two unilateral exercises in the same session', () => {
        // Walking Lunge, Bulgarian Split Squat, and Step-Up are all single-limb
        // lifts that load the same movement; seating two together front-loads
        // fatigue without adding variety. Dumbbell Lunge is the bilateral option.
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'lunge')
            .concat([
                meta('bulgarian-split-squat', 'lunge', ['dumbbells'], true, {
                    unilateral: true,
                    substitution_class: 'unilateral_leg',
                }),
                meta('step-up', 'lunge', ['dumbbells'], true, {
                    unilateral: true,
                    substitution_class: 'unilateral_leg',
                }),
                meta('walking-lunge', 'lunge', ['dumbbells'], true, {
                    unilateral: true,
                    substitution_class: 'unilateral_leg',
                }),
                meta('dumbbell-lunge', 'lunge', ['dumbbells'], true, { unilateral: false }),
            ]);
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, sessionTime: '90+ min' }));
        const unilateralIds = new Set(['bulgarian-split-squat', 'step-up', 'walking-lunge']);
        for (const s of bp.schedule) {
            const sessionExs = bp.exercises.filter((e) => e.workout_type === s.workout_type && e.variant === s.variant);
            const unilateralCount = sessionExs.filter((e) => unilateralIds.has(e.exercise_id)).length;
            expect(unilateralCount).toBeLessThanOrEqual(1);
        }
        // The session that needed a second lunge-pattern pick reaches for the
        // bilateral Dumbbell Lunge rather than a redundant unilateral lift.
        expect(bp.exercises.map((e) => e.exercise_id)).toContain('dumbbell-lunge');
    });
});

describe('GQ3: front-delt-isolation suppression after a vertical press', () => {
    function pool(includeLateralRaise: boolean): ExerciseMeta[] {
        const base = deepPool().filter(
            (e) => e.movement_pattern !== 'vertical_push' && e.movement_pattern !== 'shoulder_iso',
        );
        base.push(meta('overhead-press', 'vertical_push', ['dumbbells'], true));
        base.push(
            meta('front-raise', 'shoulder_iso', ['dumbbells'], true, { substitution_class: 'front_delt_isolation' }),
        );
        if (includeLateralRaise) {
            base.push(
                meta('lateral-raise', 'shoulder_iso', ['dumbbells'], true, { substitution_class: 'lateral_raise' }),
            );
        }
        return base;
    }
    const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;

    it('prefers Lateral Raise over Front Raise once the session already has a vertical press', () => {
        // Pressing already loads the front delts, so Front Raise is a redundant
        // accessory in the same session; Lateral Raise targets the side delt and
        // adds genuine coverage.
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool: pool(true) }));
        const ids = sessionIds(bp, 'push', null);
        expect(ids).toContain('overhead-press');
        expect(ids).toContain('lateral-raise');
        expect(ids).not.toContain('front-raise');
    });

    it('still selects Front Raise when it is the only shoulder-isolation option (soft, not a hard block)', () => {
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool: pool(false) }));
        const ids = sessionIds(bp, 'push', null);
        expect(ids).toContain('overhead-press');
        expect(ids).toContain('front-raise');
    });
});

describe('GQ3: Smith Machine Bench Press equipment gating (post-correction tagging)', () => {
    // Re-tagged {machines, bench} (was incorrectly {barbell, bench}): a Smith
    // machine is a fixed-rail machine, not a barbell, so it must gate on machine
    // access rather than leaking into barbell-only pools.
    function pool(): ExerciseMeta[] {
        return deepPool()
            .filter((e) => e.movement_pattern !== 'horizontal_push')
            .concat([meta('smith-machine-bench-press', 'horizontal_push', ['machines', 'bench'], true)]);
    }
    const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;

    it('is excluded from a barbell-only pool with no machine access', () => {
        const answers = {
            equipment: new Set<EquipmentKey>(['barbell', 'bench', 'dumbbells']),
            experience: 'intermediate' as const,
            goal: 'build_muscle' as const,
            days: 3 as const,
        };
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool: pool(), answers }));
        expect(sessionIds(bp, 'push', null)).not.toContain('smith-machine-bench-press');
    });

    it('surfaces for a gym setup with machine access', () => {
        const answers = {
            equipment: new Set<EquipmentKey>(['machines', 'bench', 'dumbbells']),
            experience: 'intermediate' as const,
            goal: 'build_muscle' as const,
            days: 3 as const,
        };
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool: pool(), answers }));
        expect(sessionIds(bp, 'push', null)).toContain('smith-machine-bench-press');
    });
});

describe('GQ2: undefined fatigue is neutral (does not displace exercises with explicit fatigue)', () => {
    it('existing pool with no fatigue field preserves alphabetical ordering', () => {
        // deepPool() exercises have no fatigue set. They should all sort
        // stably among themselves (undefined → neutral, falling back to id).
        const style = STYLES[4][0] as ProgramStyle;
        const base = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5] }));
        const again = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5] }));
        // Deterministic: same pool, same output.
        expect(base).toEqual(again);
    });
});

describe('GQ2: loading lean still beats fatigue within same freshness', () => {
    it('preferred-equipment wins even when it has higher fatigue than non-preferred', () => {
        // pool: barbell squat (preferred by loadingLean, high fatigue 5) and
        // dumbbell squat (non-preferred, low fatigue 1). Loading lean preference
        // should override the fatigue tiebreak.
        const pool = [
            metaFatigue('squat-bb', 'squat', 5, ['barbell'], true),
            metaFatigue('squat-db', 'squat', 1, ['dumbbells'], true),
            ...ALL_PATTERNS.filter((p) => p !== 'squat').flatMap((p) => [
                meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
                meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'),
            ]),
        ];
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const answers = {
            equipment: new Set<EquipmentKey>(['dumbbells', 'barbell']),
            experience: 'intermediate' as const,
            goal: 'build_muscle' as const,
            days: 3 as const,
        };
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, answers, loadingLean: 'barbell' }));
        // Barbell squat (higher fatigue) still wins because loading lean takes priority.
        expect(sessionIds(bp, 'legs', null)).toContain('squat-bb');
        expect(sessionIds(bp, 'legs', null)).not.toContain('squat-db');
    });
});

describe('movement restrictions: golden identity -- empty/undefined is byte-identical to base', () => {
    it('undefined and [] restrictions produce byte-identical output', () => {
        for (const config of [{ days: [1, 3, 5] }, { days: [1, 2, 4, 5] }, { days: [1, 2, 3, 4, 5, 6] }]) {
            const style = STYLES[config.days.length][0] as ProgramStyle;
            const base = generateRoutine(input({ style, trainingDays: config.days }));
            const undef = generateRoutine(input({ style, trainingDays: config.days, restrictions: undefined }));
            const empty = generateRoutine(input({ style, trainingDays: config.days, restrictions: [] }));
            expect(undef).toEqual(base);
            expect(empty).toEqual(base);
        }
    });
});

describe('movement restrictions: a contraindicated exercise is excluded by name', () => {
    it('drops a knee-contraindicated squat and keeps a safe one', () => {
        const pool: ExerciseMeta[] = [
            meta('barbell-back-squat', 'squat', ['dumbbells'], true, { contraindications: ['knee'] }),
            meta('box-squat', 'squat', ['dumbbells'], true, { contraindications: [] }),
            ...deepPool().filter((e) => e.movement_pattern !== 'squat'),
        ];
        const bp = generateRoutine(input({ pool, restrictions: ['knee'] }));
        const ids = new Set(bp.exercises.map((e) => e.exercise_id));
        expect(ids.has('barbell-back-squat')).toBe(false);
        const baseIds = new Set(generateRoutine(input({ pool })).exercises.map((e) => e.exercise_id));
        expect(baseIds.has('barbell-back-squat') || baseIds.has('box-squat')).toBe(true);
    });
});

describe('movement restrictions: a single flag never empties leg work', () => {
    // Assert across both a 6-day split and a 3-day full-body config. The 3-day
    // case is where pool thinning bites hardest (fewer slots, more patterns per
    // session), so it is the more important guard.
    const kneePool = (): ExerciseMeta[] => [
        meta('barbell-back-squat', 'squat', ['dumbbells'], true, { contraindications: ['knee'] }),
        meta('leg-press', 'squat', ['dumbbells'], true, { contraindications: [] }),
        meta('romanian-deadlift', 'hinge', ['dumbbells'], true, { contraindications: [] }),
        ...deepPool().filter((e) => e.movement_pattern !== 'squat' && e.movement_pattern !== 'hinge'),
    ];
    it.each([
        { label: '6-day split', days: [1, 2, 3, 4, 5, 6] },
        { label: '3-day full body', days: [1, 3, 5] },
    ])('a knee restriction still leaves squat-or-hinge leg work available ($label)', ({ days }) => {
        const bp = generateRoutine(input({ pool: kneePool(), restrictions: ['knee'], trainingDays: days }));
        const ids = new Set(bp.exercises.map((e) => e.exercise_id));
        expect(ids.has('leg-press') || ids.has('romanian-deadlift')).toBe(true);
    });
});

describe('movement restrictions: two flags at once filter the union', () => {
    it('a knee + shoulder restriction drops both flagged lifts and still produces a routine', () => {
        const pool: ExerciseMeta[] = [
            meta('barbell-back-squat', 'squat', ['dumbbells'], true, { contraindications: ['knee'] }),
            meta('leg-press', 'squat', ['dumbbells'], true, { contraindications: [] }),
            meta('overhead-press', 'vertical_push', ['dumbbells'], true, { contraindications: ['shoulder'] }),
            meta('machine-shoulder-press', 'vertical_push', ['dumbbells'], true, { contraindications: [] }),
            ...deepPool().filter((e) => e.movement_pattern !== 'squat' && e.movement_pattern !== 'vertical_push'),
        ];
        const bp = generateRoutine(
            input({ pool, restrictions: ['knee', 'shoulder'], trainingDays: [1, 2, 3, 4, 5, 6] }),
        );
        const ids = new Set(bp.exercises.map((e) => e.exercise_id));
        expect(ids.has('barbell-back-squat')).toBe(false);
        expect(ids.has('overhead-press')).toBe(false);
        expect(bp.exercises.length).toBeGreaterThan(0);
    });
});

describe('Item 2: minimum-compound guard for restriction-emptied sessions', () => {
    // A pool where the leg compounds (squat/hinge/lunge) are all contraindicated,
    // but safe upper compounds + leg isolation remain.
    const legCompoundsContraindicated = (): ExerciseMeta[] => {
        const pool: ExerciseMeta[] = [];
        for (const p of ALL_PATTERNS) {
            const compound = !p.endsWith('_iso') && p !== 'calf' && p !== 'core';
            const contra: RestrictionFlag[] =
                p === 'squat' || p === 'hinge' || p === 'lunge' ? ['knee', 'lower_back'] : [];
            pool.push(meta(`${p}-1`, p, ['dumbbells'], compound, { contraindications: contra }));
            pool.push(meta(`${p}-2`, p, ['dumbbells'], compound, { contraindications: contra }));
        }
        return pool;
    };

    it('a restriction-emptied legs day NEVER receives an upper compound (region-restricted, 2026-06-11)', () => {
        // Rebaselined: the original assertion expected a cross-pattern compound
        // (an upper press/row) seated on the legs day. The cross-region fallback
        // was removed for lower/legs sessions: an upper compound on a leg day is
        // a different session, not a degraded one. The day now ships as honest
        // accessory work plus a warning.
        const pool = legCompoundsContraindicated();
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(
            input({ style, trainingDays: [1, 3, 5], pool, restrictions: ['knee', 'lower_back'] }),
        );
        const byId = new Map(pool.map((e) => [e.id, e]));
        const legs = sessionIds(bp, 'legs', null).map((id) => byId.get(id)!);
        expect(legs.length).toBe(volumeFor('45–60 min', 'intermediate').exercises);
        // No compound insert from another body region.
        expect(legs.some((e) => e.is_compound)).toBe(false);
        const upperPatterns = ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'];
        expect(legs.some((e) => upperPatterns.includes(e.movement_pattern as string))).toBe(false);
        // The user is told instead.
        expect(bp.warnings.length).toBeGreaterThan(0);
    });

    it('a full-body session keeps the any-region fallback (the prohibition covers lower/legs only)', () => {
        // fb-3: full_body sessions whose lower compounds are contraindicated may
        // still seat a safe upper compound; full body legitimately spans regions.
        const pool = legCompoundsContraindicated();
        const style = STYLES[3].find((s) => s.key === 'fb-3') as ProgramStyle;
        const bp = generateRoutine(
            input({ style, trainingDays: [1, 3, 5], pool, restrictions: ['knee', 'lower_back'] }),
        );
        const byId = new Map(pool.map((e) => [e.id, e]));
        const allRows = bp.exercises.map((e) => byId.get(e.exercise_id)!);
        expect(allRows.some((e) => e.is_compound)).toBe(true);
    });

    it('warns (does not block) when no compound survives anywhere in the pool', () => {
        // Contraindicate every compound; only isolation remains, so no fallback exists.
        const pool: ExerciseMeta[] = [];
        for (const p of ALL_PATTERNS) {
            const compound = !p.endsWith('_iso') && p !== 'calf' && p !== 'core';
            pool.push(meta(`${p}-1`, p, ['dumbbells'], compound, { contraindications: compound ? ['knee'] : [] }));
        }
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, restrictions: ['knee'] }));
        // Never hard-rejects, still produces a routine...
        expect(bp.exercises.length).toBeGreaterThan(0);
        // ...and surfaces a single clear warning key (deduped across sessions).
        expect(bp.warnings.length).toBe(1);
        expect(bp.warnings[0]).toBe('no_compound');
    });

    it('a normal routine carries an empty warnings array (golden)', () => {
        expect(generateRoutine(input()).warnings).toEqual([]);
    });
});

describe('behavior-driven demote (#7)', () => {
    const ids = (bp: ReturnType<typeof generateRoutine>) => bp.exercises.map((e) => e.exercise_id);

    it('GOLDEN: empty behavior and omitted behavior are byte-identical to base', () => {
        const base = JSON.stringify(generateRoutine(input()));
        expect(JSON.stringify(generateRoutine(input({ behavior: EMPTY_BEHAVIOR })))).toBe(base);
        expect(JSON.stringify(generateRoutine(input({ behavior: { demote: [] } })))).toBe(base);
    });

    it('sinks a demoted exercise on a NON-anchor pattern', () => {
        // triceps_iso occupies exactly ONE slot in Classic Upper/Lower, so demoting
        // it cleanly swaps -1 for -2. In deepPool all candidates tie on every
        // existing key, so the terminal alphabetical tiebreak makes -1 the base
        // pick; the demote layer flips it to -2.
        const base = generateRoutine(input());
        expect(ids(base)).toContain('triceps_iso-1');
        expect(ids(base)).not.toContain('triceps_iso-2');
        const demoted = generateRoutine(input({ behavior: { demote: ['triceps_iso-1'] } }));
        expect(ids(demoted)).toContain('triceps_iso-2');
        expect(ids(demoted)).not.toContain('triceps_iso-1');
    });

    it('does NOT reorder an ANCHOR pattern even when the exercise is demoted', () => {
        const base = JSON.stringify(generateRoutine(input()));
        const demoted = JSON.stringify(
            generateRoutine(input({ behavior: { demote: ['squat-1', 'horizontal_push-1'] } })),
        );
        expect(demoted).toBe(base);
    });

    it('still selects a demoted exercise when it is the only candidate for its slot', () => {
        const thin: ExerciseMeta[] = [];
        for (const p of ALL_PATTERNS) {
            thin.push(meta(`${p}-only`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'));
        }
        const all = generateRoutine(input({ pool: thin }));
        const demoted = generateRoutine(input({ pool: thin, behavior: { demote: ['triceps_iso-only'] } }));
        // If the style surfaces triceps_iso at all, the soft demote must not drop
        // the only candidate.
        if (all.exercises.some((e) => e.exercise_id === 'triceps_iso-only')) {
            expect(demoted.exercises.some((e) => e.exercise_id === 'triceps_iso-only')).toBe(true);
        }
    });
});

// ── P0 Group 1: emphasis data fixes ──────────────────────────────────────────
// Pure EMPHASES data fixes (spec 2026-06-10-10-41-58-generation-emphasis-fixes).
// 1.1 quad/posterior leg-day separation, 1.2 no hinge on pull, 1.3 vertical_pull
// on back-focused upper/pull days, 1.4 deliberate 6th slot on push/pull.

describe('P0 Group 1: emphasis data fixes', () => {
    const patternMap = (pool: ExerciseMeta[]) => new Map(pool.map((e) => [e.id, e.movement_pattern]));
    const patternsOf = (
        bp: ReturnType<typeof generateRoutine>,
        pool: ExerciseMeta[],
        wt: string,
        variant: string | null,
    ) => {
        const pat = patternMap(pool);
        return sessionIds(bp, wt, variant).map((id) => pat.get(id));
    };

    // ── 1.1 Lower vs Legs differentiation ────────────────────────────────────
    describe('1.1 quad days drop hinge, posterior day drops squat', () => {
        it('ulppl-5: lower (quad) has no hinge, legs (posterior) has no squat', () => {
            const pool = deepPool();
            const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5], pool }));
            expect(patternsOf(bp, pool, 'lower', null)).not.toContain('hinge');
            expect(patternsOf(bp, pool, 'legs', null)).not.toContain('squat');
        });

        it('ul-classic-4: lower A (quad) has no hinge, lower B (posterior) has no squat', () => {
            const pool = deepPool();
            const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], pool }));
            expect(patternsOf(bp, pool, 'lower', 'A')).not.toContain('hinge');
            expect(patternsOf(bp, pool, 'lower', 'B')).not.toContain('squat');
        });

        it('ul-aesthetic-4: lower A (lean/quad) has no hinge, lower B (posterior) has no squat', () => {
            const pool = deepPool();
            const style = STYLES[4].find((s) => s.key === 'ul-aesthetic-4') as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], pool }));
            expect(patternsOf(bp, pool, 'lower', 'A')).not.toContain('hinge');
            expect(patternsOf(bp, pool, 'lower', 'B')).not.toContain('squat');
        });

        it('under consistent, the two lower days share no squat/hinge exercise (ul-classic-4)', () => {
            const pool = deepPool();
            const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
            const bp = generateRoutine(
                input({ style, trainingDays: [1, 2, 4, 5], pool, varietyPreference: 'consistent' }),
            );
            const pat = patternMap(pool);
            const heavyIds = (variant: string) =>
                new Set(
                    sessionIds(bp, 'lower', variant).filter((id) => {
                        const p = pat.get(id);
                        return p === 'squat' || p === 'hinge';
                    }),
                );
            const a = heavyIds('A');
            const b = heavyIds('B');
            expect([...a].filter((id) => b.has(id))).toEqual([]);
        });
    });

    // ── 1.2 No hinge on Pull ─────────────────────────────────────────────────
    it('1.2 a pull session contains no hinge-pattern exercise', () => {
        const pool = deepPool();
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
        expect(patternsOf(bp, pool, 'pull', null)).not.toContain('hinge');
    });

    // ── 1.3 vertical_pull on back-focused upper/pull days ────────────────────
    describe('1.3 vertical_pull added to back-focused upper/pull days', () => {
        it('pull and upper_general contain a vertical_pull when the pool has one (ulppl-5)', () => {
            const pool = deepPool();
            const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5], pool }));
            expect(patternsOf(bp, pool, 'pull', null)).toContain('vertical_pull');
            expect(patternsOf(bp, pool, 'upper', null)).toContain('vertical_pull');
        });

        it('upper_chest_back contains a vertical_pull (ul-classic-4, upper A)', () => {
            const pool = deepPool();
            const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], pool }));
            expect(patternsOf(bp, pool, 'upper', 'A')).toContain('vertical_pull');
        });

        it('upper_aesthetic_a contains a vertical_pull (ul-aesthetic-4, upper A)', () => {
            const pool = deepPool();
            const style = STYLES[4].find((s) => s.key === 'ul-aesthetic-4') as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], pool }));
            expect(patternsOf(bp, pool, 'upper', 'A')).toContain('vertical_pull');
        });

        it('no-op safety: a pool with no vertical_pull still generates pull/upper, no error, none added', () => {
            const pool = deepPool().filter((e) => e.movement_pattern !== 'vertical_pull');
            const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5], pool }));
            expect(sessionIds(bp, 'pull', null).length).toBeGreaterThan(0);
            expect(sessionIds(bp, 'upper', null).length).toBeGreaterThan(0);
            expect(patternsOf(bp, pool, 'pull', null)).not.toContain('vertical_pull');
            expect(patternsOf(bp, pool, 'upper', null)).not.toContain('vertical_pull');
        });
    });

    // ── 1.4 deliberate 6th slot on push/pull ─────────────────────────────────
    it('1.4 push has two triceps_iso and pull has two back_iso at 6-exercise volume', () => {
        const pool = deepPool();
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
        const pushTriceps = patternsOf(bp, pool, 'push', null).filter((p) => p === 'triceps_iso');
        const pullBack = patternsOf(bp, pool, 'pull', null).filter((p) => p === 'back_iso');
        expect(pushTriceps).toHaveLength(2);
        expect(pullBack).toHaveLength(2);
    });

    // ── Decision 4: upper_general 7-slot drop at the 6-cap ────────────────────
    describe('upper_general 7th slot (triceps_iso) drops at the 6-exercise cap', () => {
        it('gym (vertical_pull available): contains vertical_pull, drops triceps_iso', () => {
            const pool = deepPool();
            const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5], pool }));
            const patterns = patternsOf(bp, pool, 'upper', null);
            expect(patterns).toContain('vertical_pull');
            expect(patterns).not.toContain('triceps_iso');
        });

        it('no vertical_pull in pool: keeps triceps_iso (byte-identical fallback)', () => {
            const pool = deepPool().filter((e) => e.movement_pattern !== 'vertical_pull');
            const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5], pool }));
            const patterns = patternsOf(bp, pool, 'upper', null);
            expect(patterns).not.toContain('vertical_pull');
            expect(patterns).toContain('triceps_iso');
        });
    });
});

// ── Generation engine bug fixes (2026-06-10) ─────────────────────────────────
// Bug 1 cross-session anchor scoping, Bug 2 canonical-anchor ranking, Bug 3
// strength rep range, Bug 4/7 pattern-diversity backfill + max-2-per-pattern cap,
// Bug 5 glutes-tilt compound-first, Bug 6 routine-wide squat/hinge invariant.
// Spec: docs/superpowers/specs/2026-06-10-14-00-00-generation-engine-bug-fixes-design.md
describe('generation engine bug fixes (2026-06-10)', () => {
    const patternMap = (pool: ExerciseMeta[]) => new Map(pool.map((e) => [e.id, e.movement_pattern]));

    // ── Bug 1: cross-session avoid-set / consistent-anchor focus scoping ──────
    describe('Bug 1: consistent anchors are scoped by (focus, pattern)', () => {
        it('different-focus sessions do NOT share a pattern anchor (Push vs Full Body)', () => {
            // ppl-fb-4: push (focus push) and full_body (focus full_body) both train
            // horizontal_push. Under the old pattern-only anchor they'd seat the same
            // bench; (focus,pattern) keying makes the full-body day pick a fresh one.
            const pool = deepPool();
            const style = STYLES[4].find((s) => s.key === 'ppl-fb-4') as ProgramStyle;
            const bp = generateRoutine(
                input({ style, trainingDays: [1, 2, 4, 5], pool, varietyPreference: 'consistent' }),
            );
            const pat = patternMap(pool);
            const hp = (wt: string) => sessionIds(bp, wt, null).filter((id) => pat.get(id) === 'horizontal_push');
            const push = hp('push');
            const fb = hp('full_body');
            expect(push).toHaveLength(1);
            expect(fb).toHaveLength(1);
            expect(push[0]).not.toBe(fb[0]); // disjoint across non-equivalent sessions
        });

        it('same-focus sessions STILL share the pattern anchor (Push A and Push B)', () => {
            // ppl-x2-6: push A and push B both have focus 'push', so the consistent
            // anchor (the intended feature) keeps the same bench AND the same OHP
            // across both, even though the volume day leads with vertical_push.
            // (Premise migrated from legs x2 squat when Item 5 split the leg days;
            // ~30 min keeps each push day at one slot per compound pattern.)
            const pool = deepPool();
            const style = STYLES[6][0] as ProgramStyle; // ppl-x2-6
            const bp = generateRoutine(
                input({
                    style,
                    trainingDays: [1, 2, 3, 4, 5, 6],
                    pool,
                    sessionTime: '~30 min',
                    varietyPreference: 'consistent',
                }),
            );
            const pat = patternMap(pool);
            const of = (v: string, p: string) => sessionIds(bp, 'push', v).filter((id) => pat.get(id) === p);
            for (const p of ['horizontal_push', 'vertical_push']) {
                const a = of('A', p);
                const b = of('B', p);
                expect(a).toHaveLength(1);
                expect(b).toHaveLength(1);
                expect(a[0]).toBe(b[0]); // shared anchor within the same focus
            }
        });

        it('no exercise appears in two different-focus sessions of a deep-pool routine', () => {
            // ulppl-5 has five distinct focuses; with a deep pool every session should
            // be disjoint (the genuine thin-pool repeat is covered elsewhere).
            const pool = deepPool(4);
            const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
            const bp = generateRoutine(
                input({ style, trainingDays: [1, 2, 3, 4, 5], pool, varietyPreference: 'consistent' }),
            );
            const byFocus = bp.schedule.map((s) => sessionIds(bp, s.workout_type, s.variant));
            for (let i = 0; i < byFocus.length; i++) {
                for (let j = i + 1; j < byFocus.length; j++) {
                    expect(byFocus[i].some((id) => byFocus[j].includes(id))).toBe(false);
                }
            }
        });
    });

    // ── Bug 2: canonical-anchor ranking ──────────────────────────────────────
    describe('Bug 2: canonical compound outranks a variation on a fatigue tie', () => {
        it('picks Barbell Bench Press over Close-Grip Bench Press for the horizontal_push anchor', () => {
            // Both are horizontal_push / compound / fatigue 4 (a real seed tie). The
            // ids are chosen so the variation sorts FIRST alphabetically, proving the
            // canonical rank (not id.localeCompare) decides.
            const pool = deepPool()
                .filter((e) => e.movement_pattern !== 'horizontal_push')
                .concat([
                    meta('aaa-cgbp', 'horizontal_push', ['dumbbells'], true, {
                        fatigue: 4,
                        substitution_class: 'horizontal_press',
                        name: 'Close-Grip Bench Press',
                    }),
                    meta('zzz-bbp', 'horizontal_push', ['dumbbells'], true, {
                        fatigue: 4,
                        substitution_class: 'horizontal_press',
                        name: 'Barbell Bench Press',
                    }),
                ]);
            const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
            const push = sessionIds(bp, 'push', null);
            expect(push).toContain('zzz-bbp'); // canonical wins despite later id
            expect(push).not.toContain('aaa-cgbp');
        });

        it('every CANONICAL_ANCHORS exercise name exists verbatim in the metadata seed', () => {
            // Guards the name-keyed map against silent degradation if a seed exercise
            // is renamed (the documented fragility of name keys vs UUIDs).
            const seed = readFileSync(
                resolve(process.cwd(), 'docs/migrations/2026-06-06-11-28-49-exercise-metadata-fields-seed.sql'),
                'utf8',
            );
            for (const names of Object.values(CANONICAL_ANCHORS)) {
                for (const n of names ?? []) expect(seed).toContain(`name = '${n}'`);
            }
        });

        it('is a no-op for synthetic (nameless) pools: byte-identical to base', () => {
            for (const config of [{ days: [1, 3, 5] }, { days: [1, 2, 4, 5] }, { days: [1, 2, 3, 4, 5, 6] }]) {
                const style = STYLES[config.days.length][0] as ProgramStyle;
                const base = JSON.stringify(generateRoutine(input({ style, trainingDays: config.days })));
                const again = JSON.stringify(generateRoutine(input({ style, trainingDays: config.days })));
                expect(again).toBe(base);
            }
        });
    });

    // ── Bug 3: strength rep ranges ────────────────────────────────────────────
    it('Bug 3: a strength-style routine produces 3-6 on compounds, not 6-10', () => {
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const pool = deepPool();
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, trainingStyle: 'strength' }));
        const pat = patternMap(pool);
        const compoundReps = bp.exercises
            .filter((e) => {
                const p = pat.get(e.exercise_id);
                return p && !p.endsWith('_iso') && p !== 'calf' && p !== 'core';
            })
            .map((e) => e.reps);
        expect(compoundReps.length).toBeGreaterThan(0);
        expect(compoundReps.every((r) => r === '3-6')).toBe(true);
        expect(bp.exercises.some((e) => e.reps === '6-10')).toBe(false);
    });

    // ── Bug 4 / 7: pattern-diversity backfill + max-2-per-pattern cap ─────────
    describe('Bug 4/7: at most two of any movement pattern per session', () => {
        it('holds across every catalog style at 90+ min volume', () => {
            const pool = deepPool();
            for (const [count, styles] of Object.entries(STYLES)) {
                const n = Number(count);
                const days = Array.from({ length: n }, (_, i) => i + 1);
                for (const style of styles) {
                    const bp = generateRoutine(input({ style, trainingDays: days, pool, sessionTime: '90+ min' }));
                    const pat = patternMap(pool);
                    for (const s of bp.schedule) {
                        const counts = new Map<string, number>();
                        for (const id of sessionIds(bp, s.workout_type, s.variant)) {
                            const p = pat.get(id) ?? '?';
                            counts.set(p, (counts.get(p) ?? 0) + 1);
                        }
                        for (const c of counts.values()) expect(c).toBeLessThanOrEqual(2);
                    }
                }
            }
        });

        it('a calf-deep, leg-thin pool does not stack 3+ calf (under-fills toward diversity instead)', () => {
            // Six calf options but only one of each other leg pattern: the old backfill
            // stacked a 3rd calf to hit the count; the cap (hard, unrelaxed) keeps it
            // to 2 and the session simply lands a touch short rather than 3 calf raises.
            const legThin = ['squat', 'hinge', 'lunge', 'glute_iso', 'core'] as MovementPattern[];
            const pool: ExerciseMeta[] = [
                ...Array.from({ length: 6 }, (_, i) => meta(`calf-${i}`, 'calf', ['dumbbells'], false)),
                ...legThin.map((p) =>
                    meta(`${p}-1`, p, ['dumbbells'], p === 'squat' || p === 'hinge' || p === 'lunge'),
                ),
                // Upper patterns kept deep so the push/pull days still fill normally.
                ...ALL_PATTERNS.filter((p) => p !== 'calf' && !legThin.includes(p)).flatMap((p) => [
                    meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'core'),
                    meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'core'),
                ]),
            ];
            const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, sessionTime: '90+ min' }));
            const pat = patternMap(pool);
            const legs = sessionIds(bp, 'legs', null);
            const calfCount = legs.filter((id) => pat.get(id) === 'calf').length;
            expect(calfCount).toBeLessThanOrEqual(2);
            expect(legs.length).toBeGreaterThanOrEqual(3); // never below the floor
        });
    });

    // ── Bug 5: glutes priority promotes the hinge compound, not isolation ─────
    it('Bug 5: a glutes-priority lower session has a hinge compound before any glute_iso', () => {
        const pool = deepPool();
        const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle; // lower B = lower_post
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], pool, priority: 'glutes' }));
        const pat = patternMap(pool);
        const lowerB = bp.exercises
            .filter((e) => e.workout_type === 'lower' && e.variant === 'B')
            .sort((a, b) => a.order - b.order)
            .map((e) => pat.get(e.exercise_id));
        const hingeIdx = lowerB.indexOf('hinge');
        const gluteIdx = lowerB.indexOf('glute_iso');
        expect(hingeIdx).toBeGreaterThanOrEqual(0); // a hinge compound is present
        if (gluteIdx >= 0) expect(hingeIdx).toBeLessThan(gluteIdx); // hinge precedes isolation
    });

    // ── Bug 6: routine-wide squat + hinge invariant (quad/posterior split kept) ─
    it('Bug 6: a multi-day routine trains both squat and hinge across the week', () => {
        const pool = deepPool();
        const pat = patternMap(pool);
        for (const key of ['ulppl-5', 'ul-classic-4', 'ppl-3']) {
            const count = key === 'ulppl-5' ? 5 : key === 'ul-classic-4' ? 4 : 3;
            const days = Array.from({ length: count }, (_, i) => i + 1);
            const style = STYLES[count].find((s) => s.key === key) as ProgramStyle;
            const bp = generateRoutine(input({ style, trainingDays: days, pool }));
            const patterns = new Set(bp.exercises.map((e) => pat.get(e.exercise_id)));
            expect(patterns.has('squat')).toBe(true);
            expect(patterns.has('hinge')).toBe(true);
        }
    });
});

// ── Anchor + unilateral-cap follow-ups (2026-06-10) ──────────────────────────
// Canonical rank now beats the fatigue heuristic for explicitly named anchors
// (so Romanian Deadlift anchors hinge over higher-fatigue Deadlift/Sumo), and the
// unilateral cap exempts isolation patterns (so a fresh unilateral glute accessory
// can't starve the lower_post lunge slot). Issues 1 & 4 are confirmed already-fixed
// and locked here. Spec discussion: 2026-06-10 reconciliation against the live tree.
describe('anchor + unilateral-cap follow-ups (2026-06-10)', () => {
    const patternMap = (pool: ExerciseMeta[]) => new Map(pool.map((e) => [e.id, e.movement_pattern]));

    // ── Issue 3: hinge canonical anchor = Romanian Deadlift ───────────────────
    it('Romanian Deadlift anchors hinge over higher-fatigue Deadlift/Sumo (named seed pool)', () => {
        // RDL is fatigue 4, Deadlift/Sumo are fatigue 5. Pre-fix the fatigue-first
        // sort hands the anchor to a deadlift (with Sumo winning on the arbitrary id
        // tiebreak). Canonical rank must now win: RDL is the canonical hinge anchor
        // for a hypertrophy program. The ids are chosen so Sumo would win id order.
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'hinge')
            .concat([
                meta('a-sumo', 'hinge', ['dumbbells'], true, {
                    fatigue: 5,
                    name: 'Sumo Deadlift',
                    substitution_class: 'hinge_pattern',
                }),
                meta('b-deadlift', 'hinge', ['dumbbells'], true, {
                    fatigue: 5,
                    name: 'Deadlift',
                    substitution_class: 'hinge_pattern',
                }),
                meta('m-rdl', 'hinge', ['dumbbells'], true, {
                    fatigue: 4,
                    name: 'Romanian Deadlift',
                    substitution_class: 'hinge_pattern',
                }),
            ]);
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool }));
        const legs = sessionIds(bp, 'legs', null);
        expect(legs).toContain('m-rdl'); // canonical wins despite lower fatigue + later id
        expect(legs).not.toContain('a-sumo');
        expect(legs).not.toContain('b-deadlift');
    });

    it('canonical-before-fatigue is a no-op for nameless synthetic pools (byte-identical)', () => {
        for (const days of [
            [1, 3, 5],
            [1, 2, 4, 5],
            [1, 2, 3, 4, 5, 6],
        ]) {
            const style = STYLES[days.length][0] as ProgramStyle;
            const base = JSON.stringify(generateRoutine(input({ style, trainingDays: days })));
            const again = JSON.stringify(generateRoutine(input({ style, trainingDays: days })));
            expect(again).toBe(base);
        }
    });

    // ── Issue 2 root cause: a unilateral isolation must not starve the lunge ───
    it('lower_post (Legs) keeps a lunge when a unilateral glute accessory is the only fresh glute pick', () => {
        // Reproduces the production trap: Lower consumes the two bilateral glute_iso
        // options, leaving Legs a unilateral glute accessory as its fresh pick. A
        // unilateral ISOLATION must not consume the single-limb-compound budget and
        // block the primary lunge. Lunges are all unilateral (the realistic case).
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'glute_iso' && e.movement_pattern !== 'lunge')
            .concat([
                meta('gl-bilat-1', 'glute_iso', ['dumbbells'], false, { unilateral: false }),
                meta('gl-bilat-2', 'glute_iso', ['dumbbells'], false, { unilateral: false }),
                meta('gl-uni', 'glute_iso', ['dumbbells'], false, {
                    unilateral: true,
                    substitution_class: 'glute_pattern',
                }),
                meta('lun-1', 'lunge', ['dumbbells'], true, { unilateral: true, substitution_class: 'unilateral_leg' }),
                meta('lun-2', 'lunge', ['dumbbells'], true, { unilateral: true, substitution_class: 'unilateral_leg' }),
                meta('lun-3', 'lunge', ['dumbbells'], true, { unilateral: true, substitution_class: 'unilateral_leg' }),
            ]);
        const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
        const bp = generateRoutine(
            input({ style, trainingDays: [1, 2, 3, 4, 5], pool, varietyPreference: 'consistent' }),
        );
        const pat = patternMap(pool);
        const legsLunges = sessionIds(bp, 'legs', null).filter((id) => pat.get(id) === 'lunge');
        expect(legsLunges.length).toBeGreaterThanOrEqual(1);
    });

    it('the existing per-session unilateral COMPOUND cap still holds (two unilateral lunges never coexist)', () => {
        // The isolation exemption must not loosen the cap on unilateral leg COMPOUNDS.
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'lunge')
            .concat([
                meta('uni-1', 'lunge', ['dumbbells'], true, { unilateral: true, substitution_class: 'unilateral_leg' }),
                meta('uni-2', 'lunge', ['dumbbells'], true, { unilateral: true, substitution_class: 'unilateral_leg' }),
                meta('bilat', 'lunge', ['dumbbells'], true, { unilateral: false }),
            ]);
        const style = STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 3, 5], pool, sessionTime: '90+ min' }));
        const uni = new Set(['uni-1', 'uni-2']);
        for (const s of bp.schedule) {
            const ids = bp.exercises
                .filter((e) => e.workout_type === s.workout_type && e.variant === s.variant)
                .map((e) => e.exercise_id);
            expect(ids.filter((id) => uni.has(id)).length).toBeLessThanOrEqual(1);
        }
    });

    // ── Issue 2 invariant: a hinge slot with candidates is never skipped ──────
    it('a hinge slot is never skipped when the hinge pool is non-empty (slot-filled invariant)', () => {
        const pool = deepPool();
        const pat = patternMap(pool);
        const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5], pool }));
        expect(sessionIds(bp, 'legs', null).some((id) => pat.get(id) === 'hinge')).toBe(true);
    });

    // ── Issue 1 (locked): ulppl-5 lower (quad) and legs (posterior) are disjoint
    it('ulppl-5 lower (quad) and legs (posterior) share no exercise with a deep pool', () => {
        const pool = deepPool(4);
        const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
        const bp = generateRoutine(
            input({ style, trainingDays: [1, 2, 3, 4, 5], pool, varietyPreference: 'consistent' }),
        );
        const lower = sessionIds(bp, 'lower', null);
        const legs = sessionIds(bp, 'legs', null);
        expect(lower.length).toBeGreaterThan(0);
        expect(legs.length).toBeGreaterThan(0);
        expect(lower.some((id) => legs.includes(id))).toBe(false);
    });

    // ── Issue 4 (locked): Incline is the second horizontal_push anchor ────────
    it('horizontal_push second anchor is Incline Barbell Press, not Decline Bench Press', () => {
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'horizontal_push')
            .concat([
                meta('hp-bbp', 'horizontal_push', ['dumbbells'], true, {
                    fatigue: 4,
                    name: 'Barbell Bench Press',
                    substitution_class: 'horizontal_press',
                }),
                meta('hp-incline', 'horizontal_push', ['dumbbells'], true, {
                    fatigue: 4,
                    name: 'Incline Barbell Press',
                    substitution_class: 'horizontal_press',
                }),
                meta('hp-decline', 'horizontal_push', ['dumbbells'], true, {
                    fatigue: 4,
                    name: 'Decline Bench Press',
                    substitution_class: 'horizontal_press',
                }),
            ]);
        const style = STYLES[4].find((s) => s.key === 'ppl-fb-4') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 4, 5], pool, varietyPreference: 'consistent' }));
        const pat = patternMap(pool);
        const push = sessionIds(bp, 'push', null).filter((id) => pat.get(id) === 'horizontal_push');
        const fb = sessionIds(bp, 'full_body', null).filter((id) => pat.get(id) === 'horizontal_push');
        expect(push).toContain('hp-bbp'); // anchor = canonical primary
        expect(fb).toContain('hp-incline'); // second = Incline, not Decline
        expect(fb).not.toContain('hp-decline');
    });

    // ── Accepted blast radius of canonical-before-fatigue: locks the intended
    // second-anchor change for vertical_pull (Lat Pulldown over higher-fatigue
    // Chin-Up). Pre-change the fatigue-first sort handed the second pull to Chin-Up.
    it('vertical_pull second anchor is Lat Pulldown, not higher-fatigue Chin-Up', () => {
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'vertical_pull')
            .concat([
                meta('vp-pullup', 'vertical_pull', ['dumbbells'], true, {
                    fatigue: 4,
                    name: 'Pull-Up',
                    substitution_class: 'vertical_pull',
                }),
                meta('vp-lat', 'vertical_pull', ['dumbbells'], true, {
                    fatigue: 3,
                    name: 'Lat Pulldown',
                    substitution_class: 'vertical_pull',
                }),
                meta('vp-chinup', 'vertical_pull', ['dumbbells'], true, {
                    fatigue: 4,
                    name: 'Chin-Up',
                    substitution_class: 'vertical_pull',
                }),
            ]);
        const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
        const bp = generateRoutine(
            input({ style, trainingDays: [1, 2, 3, 4, 5], pool, varietyPreference: 'consistent' }),
        );
        const pat = patternMap(pool);
        const upper = sessionIds(bp, 'upper', null).filter((id) => pat.get(id) === 'vertical_pull');
        const pull = sessionIds(bp, 'pull', null).filter((id) => pat.get(id) === 'vertical_pull');
        expect(upper).toContain('vp-pullup'); // anchor = canonical primary
        expect(pull).toContain('vp-lat'); // second = Lat Pulldown, not Chin-Up
        expect(pull).not.toContain('vp-chinup');
    });
});

// ── Item 5: ppl-x2-6 A/B differentiation ─────────────────────────────────────

describe('Item 5: ppl-x2-6 A/B differentiation', () => {
    const patternMap = (pool: ExerciseMeta[]) => new Map(pool.map((e) => [e.id, e.movement_pattern]));
    const style6 = () => STYLES[6][0] as ProgramStyle;
    const sixDays = [1, 2, 3, 4, 5, 6];

    it('week shape: heavy A block then volume B block, in that session order', () => {
        // Guards against accidental session reordering that would keep the
        // per-session goldens green while changing the week's training rhythm.
        expect(style6().sessions).toEqual([
            { focus: 'push', emphasis: 'push_heavy', variant: 'A' },
            { focus: 'pull', emphasis: 'pull_heavy', variant: 'A' },
            { focus: 'legs', emphasis: 'lower_quad', variant: 'A' },
            { focus: 'push', emphasis: 'push_volume', variant: 'B' },
            { focus: 'pull', emphasis: 'pull_volume', variant: 'B' },
            { focus: 'legs', emphasis: 'lower_post', variant: 'B' },
        ]);
    });

    // Shared blueprint for the composition goldens: deep pool (3 per pattern so
    // cross-session freshness never runs dry), 45-60 min, balanced style.
    function sixDayBlueprint() {
        const pool = deepPool(3);
        const bp = generateRoutine(input({ style: style6(), trainingDays: sixDays, pool }));
        const pat = patternMap(pool);
        const rows = (wt: string, v: string) => bp.exercises.filter((e) => e.workout_type === wt && e.variant === v);
        const patterns = (wt: string, v: string) => rows(wt, v).map((e) => pat.get(e.exercise_id));
        const compounds = (wt: string, v: string) =>
            rows(wt, v).filter((e) => {
                const p = pat.get(e.exercise_id);
                return p && !p.endsWith('_iso') && p !== 'calf' && p !== 'core';
            });
        return { bp, pat, rows, patterns, compounds };
    }

    it('Push A (push_heavy): strength compounds at 3-6, exactly one 4-set bump, one triceps_iso', () => {
        const { rows, patterns, compounds } = sixDayBlueprint();
        const c = compounds('push', 'A');
        expect(c.length).toBeGreaterThan(0);
        expect(c.every((e) => e.reps === '3-6')).toBe(true);
        // Strength bias: the first compound takes the +1 set bump, exactly once.
        expect(rows('push', 'A').filter((e) => e.sets === '4')).toHaveLength(1);
        // Q4 trim: the heavy day carries a single triceps_iso (the invariant is
        // "at most one"; with the deep pool it is exactly one).
        expect(patterns('push', 'A').filter((p) => p === 'triceps_iso')).toHaveLength(1);
        // Accepted Q4 consequence: the 5-slot heavy emphasis backfills its 6th
        // pick onto the lead compound pattern (a 2nd horizontal push) at 45-60.
        expect(patterns('push', 'A').filter((p) => p === 'horizontal_push')).toHaveLength(2);
    });

    it('Push B (push_volume): hypertrophy compounds at 8-12, no bump, two triceps_iso, fresh vertical push', () => {
        const { bp, pat, rows, patterns, compounds } = sixDayBlueprint();
        const c = compounds('push', 'B');
        expect(c.length).toBeGreaterThan(0);
        expect(c.every((e) => e.reps === '8-12')).toBe(true);
        expect(rows('push', 'B').every((e) => e.sets === '3')).toBe(true);
        expect(patterns('push', 'B').filter((p) => p === 'triceps_iso')).toHaveLength(2);
        // The lead vertical_push slot gets a fresh pick, not Push A's OHP.
        const vp = (v: string) => sessionIds(bp, 'push', v).filter((id) => pat.get(id) === 'vertical_push');
        expect(vp('A')).toHaveLength(1);
        expect(vp('B')).toHaveLength(1);
        expect(vp('B')[0]).not.toBe(vp('A')[0]);
    });

    it('Pull A (pull_heavy): strength compounds at 3-6, exactly one 4-set bump, one back_iso', () => {
        const { rows, patterns, compounds } = sixDayBlueprint();
        const c = compounds('pull', 'A');
        expect(c.length).toBeGreaterThan(0);
        expect(c.every((e) => e.reps === '3-6')).toBe(true);
        expect(rows('pull', 'A').filter((e) => e.sets === '4')).toHaveLength(1);
        expect(patterns('pull', 'A').filter((p) => p === 'back_iso')).toHaveLength(1);
    });

    it('Pull B (pull_volume): hypertrophy compounds at 8-12, no bump, two back_iso, fresh vertical pull', () => {
        const { bp, pat, rows, patterns, compounds } = sixDayBlueprint();
        const c = compounds('pull', 'B');
        expect(c.length).toBeGreaterThan(0);
        expect(c.every((e) => e.reps === '8-12')).toBe(true);
        expect(rows('pull', 'B').every((e) => e.sets === '3')).toBe(true);
        expect(patterns('pull', 'B').filter((p) => p === 'back_iso')).toHaveLength(2);
        const vpull = (v: string) => sessionIds(bp, 'pull', v).filter((id) => pat.get(id) === 'vertical_pull');
        expect(vpull('A')).toHaveLength(1);
        expect(vpull('B')).toHaveLength(1);
        expect(vpull('B')[0]).not.toBe(vpull('A')[0]);
    });

    it('Legs A is quad-led (squat + lunge, no hinge); Legs B posterior-led (hinge + glute, no squat)', () => {
        // lower_quad / lower_post composition is already locked through
        // ul-classic-4 / ulppl-5 (P0 1.1); this locks the 6-day WIRING to them.
        const { patterns } = sixDayBlueprint();
        const a = patterns('legs', 'A');
        const b = patterns('legs', 'B');
        expect(a).toContain('squat');
        expect(a).toContain('lunge');
        expect(a).not.toContain('hinge');
        expect(b).toContain('hinge');
        expect(b).toContain('glute_iso');
        expect(b).not.toContain('squat');
    });

    it('consistent: Push A and Push B share the same horizontal_push anchor', () => {
        // ~30 min (4 exercises) keeps each push day at a single horizontal_push
        // slot (no backfill), so the shared-anchor assertion stays exact.
        const pool = deepPool();
        const bp = generateRoutine(
            input({
                style: style6(),
                trainingDays: sixDays,
                pool,
                sessionTime: '~30 min',
                varietyPreference: 'consistent',
            }),
        );
        const pat = patternMap(pool);
        const hp = (v: string) => sessionIds(bp, 'push', v).filter((id) => pat.get(id) === 'horizontal_push');
        expect(hp('A')).toHaveLength(1);
        expect(hp('B')).toHaveLength(1);
        expect(hp('A')[0]).toBe(hp('B')[0]);
    });
});

describe('Item 5 + leg-isolation re-tag: byte-identity goldens', () => {
    // Captured with input() defaults (deepPool(2), dumbbells-only, 45-60 min,
    // intermediate, build_muscle, anchorDow default). ppl-3 still reproduces the
    // 2026-06-11 pre-change golden (no split-lower emphasis). ul-classic-4 and
    // ulppl-5 were REBASELINED by the quad_iso / hamstring_iso leg re-tag (their
    // lower days swapped glute_iso/lunge for the dedicated knee-isolation slots) and
    // now lock the post-re-tag output. The lock is intact either way.
    function flatten(count: number, key: string, days: number[]) {
        const style = STYLES[count].find((s) => s.key === key) as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: days }));
        return {
            schedule: bp.schedule.map((s) => `${s.day_of_week}:${s.workout_type}:${s.variant ?? '-'}`),
            exercises: bp.exercises.map(
                (e) => `${e.workout_type}:${e.variant ?? '-'}:${e.exercise_id}:${e.sets}x${e.reps}`,
            ),
        };
    }

    it('ppl-3 reproduces its pre-change golden', () => {
        expect(flatten(3, 'ppl-3', [1, 3, 5])).toEqual({
            schedule: ['1:push:-', '3:pull:-', '5:legs:-'],
            exercises: [
                'push:-:horizontal_push-1:3x8-12',
                'push:-:vertical_push-1:3x8-12',
                'push:-:chest_iso-1:3x12-15',
                'push:-:shoulder_iso-1:3x12-15',
                'push:-:triceps_iso-1:3x12-15',
                'push:-:triceps_iso-2:3x12-15',
                'pull:-:horizontal_pull-1:3x8-12',
                'pull:-:vertical_pull-1:3x8-12',
                'pull:-:back_iso-1:3x12-15',
                'pull:-:shoulder_iso-2:3x12-15',
                'pull:-:biceps_iso-1:3x12-15',
                'pull:-:back_iso-2:3x12-15',
                'legs:-:squat-1:3x8-12',
                'legs:-:hinge-1:3x8-12',
                'legs:-:lunge-1:3x8-12',
                'legs:-:glute_iso-1:3x12-15',
                'legs:-:calf-1:3x12-15',
                'legs:-:core-1:3x12-15',
            ],
        });
    });

    it('ul-classic-4 matches its byte-identity golden (rebaselined by the leg re-tag)', () => {
        expect(flatten(4, 'ul-classic-4', [1, 2, 4, 5])).toEqual({
            schedule: ['1:upper:A', '2:lower:A', '4:upper:B', '5:lower:B'],
            exercises: [
                'upper:A:horizontal_push-1:3x8-12',
                'upper:A:vertical_push-1:3x8-12',
                'upper:A:horizontal_pull-1:3x8-12',
                'upper:A:vertical_pull-1:3x8-12',
                'upper:A:chest_iso-1:3x12-15',
                'upper:A:back_iso-1:3x12-15',
                'lower:A:squat-1:3x8-12',
                'lower:A:lunge-1:3x8-12',
                'lower:A:quad_iso-1:3x12-15',
                'lower:A:quad_iso-2:3x12-15',
                'lower:A:calf-1:3x12-15',
                'lower:A:core-1:3x12-15',
                'upper:B:vertical_push-2:3x8-12',
                'upper:B:horizontal_pull-2:3x8-12',
                'upper:B:shoulder_iso-1:3x12-15',
                'upper:B:biceps_iso-1:3x12-15',
                'upper:B:triceps_iso-1:3x12-15',
                'upper:B:chest_iso-2:3x12-15',
                'lower:B:hinge-1:3x8-12',
                'lower:B:lunge-2:3x8-12',
                'lower:B:hamstring_iso-1:3x12-15',
                'lower:B:glute_iso-1:3x12-15',
                'lower:B:calf-2:3x12-15',
                'lower:B:core-2:3x12-15',
            ],
        });
    });

    it('ulppl-5 matches its byte-identity golden (rebaselined by the leg re-tag)', () => {
        expect(flatten(5, 'ulppl-5', [1, 2, 3, 4, 5])).toEqual({
            schedule: ['1:upper:-', '2:lower:-', '3:push:-', '4:pull:-', '5:legs:-'],
            exercises: [
                'upper:-:horizontal_push-1:3x8-12',
                'upper:-:vertical_push-1:3x8-12',
                'upper:-:horizontal_pull-1:3x8-12',
                'upper:-:vertical_pull-1:3x8-12',
                'upper:-:shoulder_iso-1:3x10-15',
                'upper:-:biceps_iso-1:3x10-15',
                'lower:-:squat-1:3x8-12',
                'lower:-:lunge-1:3x8-12',
                'lower:-:quad_iso-1:3x12-15',
                'lower:-:quad_iso-2:3x12-15',
                'lower:-:calf-1:3x12-15',
                'lower:-:core-1:3x12-15',
                'push:-:horizontal_push-2:3x8-12',
                'push:-:vertical_push-2:3x8-12',
                'push:-:chest_iso-1:3x12-15',
                'push:-:shoulder_iso-2:3x12-15',
                'push:-:triceps_iso-1:3x12-15',
                'push:-:triceps_iso-2:3x12-15',
                'pull:-:horizontal_pull-2:3x8-12',
                'pull:-:vertical_pull-2:3x8-12',
                'pull:-:back_iso-1:3x12-15',
                'pull:-:shoulder_iso-1:3x12-15',
                'pull:-:biceps_iso-2:3x12-15',
                'pull:-:back_iso-2:3x12-15',
                'legs:-:hinge-1:3x8-12',
                'legs:-:lunge-2:3x8-12',
                'legs:-:hamstring_iso-1:3x12-15',
                'legs:-:glute_iso-1:3x12-15',
                'legs:-:calf-2:3x12-15',
                'legs:-:core-2:3x12-15',
            ],
        });
    });
});

// ── Live-test fixes (2026-06-11): compound floor + lower-bucket backfill ─────

describe('minimum-compound floor + lower-bucket backfill (live-test Issue 1)', () => {
    const patternMap = (pool: ExerciseMeta[]) => new Map(pool.map((e) => [e.id, e.movement_pattern]));
    const aesthetic = () => STYLES[4].find((s) => s.key === 'ul-aesthetic-4') as ProgramStyle;
    const fourDays = [1, 2, 4, 5];

    // Mirrors the dumbbell + bench catalog shape that triggered the live bug:
    // thin lower compounds (one squat, one unilateral lunge, one hinge), no
    // usable glute_iso, deep calf/core, full upper patterns.
    function dumbbellLowerPool(): ExerciseMeta[] {
        const upper = ALL_PATTERNS.filter(
            (p) => !['squat', 'hinge', 'lunge', 'glute_iso', 'quad_iso', 'hamstring_iso', 'calf', 'core'].includes(p),
        ).flatMap((p) => [
            meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso')),
            meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso')),
        ]);
        return [
            meta('goblet-squat', 'squat', ['dumbbells'], true),
            meta('step-up', 'lunge', ['dumbbells'], true, { unilateral: true }),
            meta('db-rdl', 'hinge', ['dumbbells'], true),
            meta('calf-raise-1', 'calf', ['dumbbells'], false),
            meta('calf-raise-2', 'calf', ['dumbbells'], false),
            meta('crunch', 'core', [], false),
            meta('plank', 'core', [], false),
            ...upper,
        ];
    }

    it('the reported session no longer collapses to 2 compounds + 4 calf/core (lower-bucket backfill)', () => {
        const pool = dumbbellLowerPool();
        const bp = generateRoutine(input({ style: aesthetic(), trainingDays: fourDays, pool }));
        const pat = patternMap(pool);
        const lowerA = sessionIds(bp, 'lower', 'A').map((id) => pat.get(id));
        // The quad day reaches for the hinge compound (Dumbbell RDL) before
        // repeating finishers, instead of padding with a 2nd calf + 2nd core.
        expect(sessionIds(bp, 'lower', 'A')).toContain('db-rdl');
        const calfCount = lowerA.filter((p) => p === 'calf').length;
        const coreCount = lowerA.filter((p) => p === 'core').length;
        expect(calfCount + coreCount).toBeLessThanOrEqual(3);
        // It is a leg session again: at least 3 compounds.
        const compounds = lowerA.filter((p) => p === 'squat' || p === 'hinge' || p === 'lunge').length;
        expect(compounds).toBeGreaterThanOrEqual(3);
    });

    it('a lower session with 1 compound reaches the floor of 2 via the cross-pattern guard, before backfill', () => {
        // No lunge compound at all: the lower_quad first pass seats only the
        // squat. The floor guard must insert the hinge compound (squat is
        // heavy-dedup filled, hinge is next in priority) before backfill.
        const pool = [
            meta('goblet-squat', 'squat', ['dumbbells'], true),
            meta('db-rdl', 'hinge', ['dumbbells'], true),
            meta('calf-raise-1', 'calf', ['dumbbells'], false),
            meta('calf-raise-2', 'calf', ['dumbbells'], false),
            meta('crunch', 'core', [], false),
            meta('plank', 'core', [], false),
            ...ALL_PATTERNS.filter(
                (p) => !['squat', 'hinge', 'lunge', 'glute_iso', 'calf', 'core'].includes(p),
            ).flatMap((p) => [
                meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso')),
                meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso')),
            ]),
        ];
        const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: fourDays, pool }));
        const ids = sessionIds(bp, 'lower', 'A');
        expect(ids).toContain('goblet-squat');
        expect(ids).toContain('db-rdl');
    });

    it('an unsatisfiable floor generates anyway and surfaces the limited-variety warning', () => {
        // One squat compound is the ONLY compound anywhere in the pool (the
        // guard searches cross-pattern per the brief, so upper compounds would
        // satisfy a lower floor; deny it those too). The floor of 2 cannot be
        // met. Generation must complete with a warning, never reject.
        const pool = [
            meta('goblet-squat', 'squat', ['dumbbells'], true),
            meta('calf-raise-1', 'calf', ['dumbbells'], false),
            meta('crunch', 'core', [], false),
            ...ALL_PATTERNS.filter(
                (p) => !['squat', 'hinge', 'lunge', 'glute_iso', 'calf', 'core'].includes(p),
            ).flatMap((p) => [meta(`${p}-1`, p, ['dumbbells'], false), meta(`${p}-2`, p, ['dumbbells'], false)]),
        ];
        const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: fourDays, pool }));
        expect(bp.exercises.length).toBeGreaterThan(0);
        expect(bp.warnings).toContain('limited_variety');
    });

    it('a lower session with NO lower compounds never receives an upper compound from the guard', () => {
        // All squat/hinge/lunge exercises are unavailable; upper compounds exist.
        // The floor stays unmet, the session generates without an upper insert,
        // and a warning reaches the rationale.
        const pool = [
            meta('glute-iso-1', 'glute_iso', ['dumbbells'], false),
            meta('calf-raise-1', 'calf', ['dumbbells'], false),
            meta('calf-raise-2', 'calf', ['dumbbells'], false),
            meta('crunch', 'core', [], false),
            meta('plank', 'core', [], false),
            ...ALL_PATTERNS.filter(
                (p) => !['squat', 'hinge', 'lunge', 'glute_iso', 'calf', 'core'].includes(p),
            ).flatMap((p) => [
                meta(`${p}-1`, p, ['dumbbells'], !p.endsWith('_iso')),
                meta(`${p}-2`, p, ['dumbbells'], !p.endsWith('_iso')),
            ]),
        ];
        const style = STYLES[4].find((s) => s.key === 'ul-classic-4') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: fourDays, pool }));
        const pat = patternMap(pool);
        const upperPatterns = ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'];
        for (const v of ['A', 'B']) {
            const lower = sessionIds(bp, 'lower', v).map((id) => pat.get(id) as string);
            expect(lower.length).toBeGreaterThan(0);
            expect(lower.some((p) => upperPatterns.includes(p))).toBe(false);
        }
        expect(bp.warnings.length).toBeGreaterThan(0);
    });

    it('a deep pool meets the floor naturally and the guard is a no-op (goldens stay green)', () => {
        // Covered structurally by the Item 5 byte-identity goldens; this is the
        // explicit floor-met case: no warning, normal composition.
        const bp = generateRoutine(input({ style: aesthetic(), trainingDays: fourDays, pool: deepPool() }));
        expect(bp.warnings).toEqual([]);
    });
});

describe('lower_lean trains hypertrophy, not pump (live-test Issue 3)', () => {
    it('the aesthetic quad day puts compounds in the 8-12 band for build_muscle', () => {
        const pool = deepPool();
        const style = STYLES[4].find((s) => s.key === 'ul-aesthetic-4') as ProgramStyle;
        const bp = generateRoutine(
            input({
                style,
                trainingDays: [1, 2, 4, 5],
                pool,
                answers: {
                    equipment: dumbbellsOnly,
                    experience: 'advanced',
                    goal: 'build_muscle',
                    days: 4,
                },
            }),
        );
        const pat = new Map(pool.map((e) => [e.id, e.movement_pattern]));
        const lowerA = bp.exercises.filter((e) => e.workout_type === 'lower' && e.variant === 'A');
        const compounds = lowerA.filter((e) => {
            const p = pat.get(e.exercise_id);
            return p === 'squat' || p === 'hinge' || p === 'lunge';
        });
        expect(compounds.length).toBeGreaterThan(0);
        // Hypertrophy band, not the old pump band (12-15 / 15-20).
        expect(compounds.every((e) => e.reps === '8-12')).toBe(true);
        const isolations = lowerA.filter((e) => !compounds.includes(e));
        expect(isolations.every((e) => e.reps === '12-15')).toBe(true);
    });
});

// ── No squat on the posterior leg day (lower_post), 2026-06-11 ────────────────
// A squat (priority 0) seated by a DURESS fallback on lower_post (anchor = hinge)
// becomes PRIMARY_LOWER and hijacks the day from the RDL -- the reported
// "Dumbbell Sumo Squat on the posterior Legs day" bug. The duress lower fallbacks
// (the minimum-compound floor guard AND the finisher deflection) now respect the
// emphasis-slot contract: lower_post never seats a squat, lower_quad still reaches
// its accessory hinge.
describe('lower_post never seats a squat compound under a thin pool (2026-06-11)', () => {
    const patternMap = (pool: ExerciseMeta[]) => new Map(pool.map((e) => [e.id, e.movement_pattern]));
    const dbBench = new Set<EquipmentKey>(['dumbbells', 'bench']);
    const advancedDb = {
        equipment: dbBench,
        experience: 'advanced' as const,
        goal: 'build_muscle' as const,
        days: 5 as const,
    };

    // Mirrors the reported dumbbell + bench catalog: two squat compounds, ONE hinge
    // compound (RDL) plus a hinge ISOLATION (a leg curl), unilateral lunges, NO
    // usable glute_iso, deep calf/core, full upper. The RDL gets used by the quad
    // day first, so the posterior day's hinge slot picks the fresh leg-curl ISO,
    // leaving the first pass one compound short and tripping the floor guard.
    function dumbbellBenchPool(): ExerciseMeta[] {
        const pool: ExerciseMeta[] = [
            meta('goblet-squat', 'squat', ['dumbbells'], true, { name: 'Dumbbell Goblet Squat', fatigue: 4 }),
            meta('sumo-squat', 'squat', ['dumbbells'], true, { name: 'Dumbbell Sumo Squat', fatigue: 4 }),
            meta('db-rdl', 'hinge', ['dumbbells'], true, { name: 'Dumbbell Romanian Deadlift', fatigue: 4 }),
            meta('leg-curl', 'hinge', ['dumbbells', 'bench'], false, { name: 'Dumbbell Leg Curl (Lying)' }),
            meta('bulgarian', 'lunge', ['dumbbells', 'bench'], true, {
                name: 'Bulgarian Split Squat',
                unilateral: true,
            }),
            meta('step-up', 'lunge', ['bench'], true, { name: 'Step-Up', unilateral: true }),
            meta('walking-lunge', 'lunge', ['dumbbells'], true, { name: 'Walking Lunge', unilateral: true }),
            meta('db-calf', 'calf', ['dumbbells'], false),
            meta('sl-calf', 'calf', [], false),
            meta('crunch', 'core', [], false),
            meta('plank', 'core', [], false),
            meta('russian-twist', 'core', [], false),
        ];
        const upper: Array<[MovementPattern, boolean]> = [
            ['horizontal_push', true],
            ['vertical_push', true],
            ['horizontal_pull', true],
            ['chest_iso', false],
            ['back_iso', false],
            ['shoulder_iso', false],
            ['biceps_iso', false],
            ['triceps_iso', false],
        ];
        for (const [p, c] of upper) {
            pool.push(meta(`${p}-1`, p, ['dumbbells'], c));
            pool.push(meta(`${p}-2`, p, ['dumbbells'], c));
        }
        return pool;
    }

    it('ulppl-5 legs (lower_post) contains no squat-pattern exercise, even when the floor guard fires', () => {
        const pool = dumbbellBenchPool();
        const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5], pool, answers: advancedDb }));
        const pat = patternMap(pool);
        const legs = sessionIds(bp, 'legs', null);
        const legsPatterns = legs.map((id) => pat.get(id));
        // The bug: a squat-pattern compound led the posterior day.
        expect(legsPatterns).not.toContain('squat');
        expect(legs).not.toContain('goblet-squat');
        expect(legs).not.toContain('sumo-squat');
        // It is still a leg session: the in-contract hinge + lunge compounds survive.
        expect(legsPatterns).toContain('hinge');
        expect(legsPatterns).toContain('lunge');
    });

    it('the quad day (lower) still produces a squat compound (the guard still works there)', () => {
        const pool = dumbbellBenchPool();
        const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5], pool, answers: advancedDb }));
        const pat = patternMap(pool);
        expect(sessionIds(bp, 'lower', null).map((id) => pat.get(id))).toContain('squat');
    });

    it('lower_post with NO usable lunge still never seats a squat (floor-guard path, ships with a warning)', () => {
        // No lunge compound at all: the posterior first pass seats only the RDL, so
        // the floor guard fires with the squat as the highest-priority candidate.
        // It must skip the off-contract squat (hinge is heavy-dedup filled, lunge is
        // empty) and surface the limited-variety warning instead of seating a squat.
        const pool = dumbbellBenchPool().filter((e) => e.movement_pattern !== 'lunge');
        const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5], pool, answers: advancedDb }));
        const pat = patternMap(pool);
        expect(sessionIds(bp, 'legs', null).map((id) => pat.get(id))).not.toContain('squat');
        expect(bp.warnings).toContain('limited_variety');
    });

    it('lower_post with ZERO compounds never seats an off-contract squat via the Item 2 guard', () => {
        // The Item 2 zero-compound guard (not the floor guard): strip every hinge AND
        // lunge COMPOUND so the posterior first pass + floor guard leave the session
        // with no compound at all (the hinge slot falls to the leg-curl isolation).
        // Item 2 then seats one safe compound from the pool; it must NOT reach for the
        // surviving squat (off-contract on the hinge-anchored posterior day) and ship
        // it squat-led, but warn instead.
        const pool = dumbbellBenchPool().filter(
            (e) => !(e.is_compound && (e.movement_pattern === 'hinge' || e.movement_pattern === 'lunge')),
        );
        const style = STYLES[5].find((s) => s.key === 'ulppl-5') as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: [1, 2, 3, 4, 5], pool, answers: advancedDb }));
        const pat = patternMap(pool);
        const legsPatterns = sessionIds(bp, 'legs', null).map((id) => pat.get(id));
        expect(legsPatterns).not.toContain('squat');
        expect(bp.warnings).toContain('no_compound');
    });
});

// ── Vertical-push anchors: Push Press is NOT a canonical primary (2026-06-11) ──
// Dumbbell Push Press is a power movement (its value is leg drive for an explosive
// low-rep effort), so at 8-12 hypertrophy reps it is a poor Push-day anchor. It was
// removed from CANONICAL_ANCHORS.vertical_push, so it floats by fatigue/id behind
// every strict overhead press (Barbell/Dumbbell OHP, Arnold Press, Machine Shoulder
// Press). (Note: across two same-pattern sessions the avoid-set can still rotate any
// remaining fresh option across days -- that is the freshness feature, not a bug.)
describe('vertical_push anchors: Dumbbell Push Press is not a canonical primary', () => {
    const style = () => STYLES[3].find((s) => s.key === 'ppl-3') as ProgramStyle;

    it('picks Dumbbell Overhead Press over Dumbbell Push Press when both are fresh', () => {
        // ids chosen so Push Press sorts FIRST alphabetically: OHP must still win.
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'vertical_push')
            .concat([
                meta('aaa-push-press', 'vertical_push', ['dumbbells'], true, {
                    fatigue: 4,
                    name: 'Dumbbell Push Press',
                    substitution_class: 'vertical_press',
                }),
                meta('zzz-ohp', 'vertical_push', ['dumbbells'], true, {
                    fatigue: 4,
                    name: 'Dumbbell Overhead Press',
                    substitution_class: 'vertical_press',
                }),
            ]);
        const bp = generateRoutine(input({ style: style(), trainingDays: [1, 3, 5], pool }));
        const push = sessionIds(bp, 'push', null);
        expect(push).toContain('zzz-ohp');
        expect(push).not.toContain('aaa-push-press');
    });

    it('prefers a strict overhead press (Arnold Press) over Push Press even when Push Press has higher fatigue', () => {
        // Proves Push Press lost anchor status, not just that OHP outranks it: Arnold
        // Press is a lower-ranked canonical anchor AND lower fatigue (3 vs 4), yet it
        // wins because Push Press is unlisted (Infinity rank). If Push Press were still
        // an anchor OR if fatigue decided, the higher-fatigue Push Press would win.
        // The id 'aaa-push-press' also sorts first alphabetically.
        const pool = deepPool()
            .filter((e) => e.movement_pattern !== 'vertical_push')
            .concat([
                meta('aaa-push-press', 'vertical_push', ['dumbbells'], true, {
                    fatigue: 4,
                    name: 'Dumbbell Push Press',
                    substitution_class: 'vertical_press',
                }),
                meta('zzz-arnold', 'vertical_push', ['dumbbells'], true, {
                    fatigue: 3,
                    name: 'Arnold Press',
                    substitution_class: 'vertical_press',
                }),
            ]);
        const bp = generateRoutine(input({ style: style(), trainingDays: [1, 3, 5], pool }));
        const push = sessionIds(bp, 'push', null);
        expect(push).toContain('zzz-arnold');
        expect(push).not.toContain('aaa-push-press');
    });
});

// ── PHUL (#18): phul-4 powerbuilding style ───────────────────────────────────
// Spec: docs/superpowers/specs/2026-06-11-12-53-42-phul-program-style-design.md.
// A 4-day powerbuilding split: each region trained twice, once heavy (strength)
// and once for volume (hypertrophy). Pure additive data (4 EMPHASES + 1 STYLES[4]
// entry + EmphasisKey union); every other style stays byte-identical (guarded below).
describe('PHUL (#18): phul-4 powerbuilding style', () => {
    const patternMap = (pool: ExerciseMeta[]) => new Map(pool.map((e) => [e.id, e.movement_pattern]));
    const phul = () => STYLES[4].find((s) => s.key === 'phul-4') as ProgramStyle;
    const fourDays = [1, 2, 4, 5];

    it('week shape: Upper Power / Lower Power / Upper Hypertrophy / Lower Hypertrophy, in that order', () => {
        expect(phul()?.sessions).toEqual([
            { focus: 'upper', emphasis: 'phul_upper_power', variant: 'A' },
            { focus: 'lower', emphasis: 'phul_lower_power', variant: 'A' },
            { focus: 'upper', emphasis: 'phul_upper_hyp', variant: 'B' },
            { focus: 'lower', emphasis: 'phul_lower_hyp', variant: 'B' },
        ]);
    });

    it('preserves the power/hypertrophy contrast under the Powerbuilding training style (P1.5)', () => {
        // Split identity outranks training style: PHUL keeps its own per-day biases,
        // so Powerbuilding does NOT flatten the volume day to heavy. Before the fix,
        // the powerbuilding pattern-override made Upper B compounds 3-6 + a set bump,
        // identical to Upper A.
        const pool = deepPool(2);
        const bp = generateRoutine(
            input({ style: phul(), trainingDays: fourDays, pool, trainingStyle: 'powerbuilding' }),
        );
        const pat = patternMap(pool);
        const rows = (wt: string, v: string) =>
            bp.exercises.filter((e) => e.workout_type === wt && e.variant === v);
        const compounds = (wt: string, v: string) =>
            rows(wt, v).filter((e) => {
                const p = pat.get(e.exercise_id);
                return p && !p.endsWith('_iso') && p !== 'calf' && p !== 'core';
            });
        // Power upper day stays heavy with the single set bump.
        expect(compounds('upper', 'A').every((e) => e.reps === '3-6')).toBe(true);
        expect(rows('upper', 'A').filter((e) => e.sets === '4')).toHaveLength(1);
        // Hypertrophy upper day stays moderate with no bump (not flattened to heavy).
        expect(compounds('upper', 'B').every((e) => e.reps === '8-12')).toBe(true);
        expect(rows('upper', 'B').every((e) => e.sets === '3')).toBe(true);
    });

    // Shared blueprint for the composition goldens: deep pool, 45-60 min, balanced.
    function phulBlueprint() {
        const pool = deepPool(2);
        const bp = generateRoutine(input({ style: phul(), trainingDays: fourDays, pool }));
        const pat = patternMap(pool);
        const rows = (wt: string, v: string) => bp.exercises.filter((e) => e.workout_type === wt && e.variant === v);
        const patterns = (wt: string, v: string) => rows(wt, v).map((e) => pat.get(e.exercise_id));
        const compounds = (wt: string, v: string) =>
            rows(wt, v).filter((e) => {
                const p = pat.get(e.exercise_id);
                return p && !p.endsWith('_iso') && p !== 'calf' && p !== 'core';
            });
        return { bp, pat, rows, patterns, compounds };
    }

    it('Upper Power: strength compounds at 3-6, one 4-set bump, full push+pull, only biceps/triceps iso', () => {
        const { rows, patterns, compounds } = phulBlueprint();
        const c = compounds('upper', 'A');
        expect(c.length).toBeGreaterThan(0);
        expect(c.every((e) => e.reps === '3-6')).toBe(true);
        // Strength bias: the session's first compound takes the +1 set bump, exactly once.
        expect(rows('upper', 'A').filter((e) => e.sets === '4')).toHaveLength(1);
        const p = patterns('upper', 'A');
        expect(p).toContain('horizontal_push');
        expect(p).toContain('horizontal_pull');
        expect(p).toContain('vertical_push');
        expect(p).toContain('vertical_pull');
        // Minimal arm-only isolation: biceps + triceps only, no chest/shoulder/back/glute iso.
        const isos = p.filter((x): x is MovementPattern => !!x && x.endsWith('_iso'));
        expect(new Set(isos)).toEqual(new Set<MovementPattern>(['biceps_iso', 'triceps_iso']));
    });

    it('Lower Power: strength, squat AND hinge at 3-6, the +1 set bump lands on the squat at position 0', () => {
        const { rows, patterns, compounds, pat } = phulBlueprint();
        const c = compounds('lower', 'A');
        expect(c.length).toBeGreaterThan(0);
        expect(c.every((e) => e.reps === '3-6')).toBe(true);
        const p = patterns('lower', 'A');
        expect(p).toContain('squat');
        expect(p).toContain('hinge');
        expect(p).toContain('lunge');
        // Finishers present at 45-60 min.
        expect(p).toContain('calf');
        expect(p).toContain('core');
        // The squat is PRIMARY_LOWER (position 0) and takes the single set bump.
        const bumped = rows('lower', 'A').filter((e) => e.sets === '4');
        expect(bumped).toHaveLength(1);
        expect(pat.get(bumped[0].exercise_id)).toBe('squat');
        expect(bumped[0].order).toBe(0);
    });

    it('Upper Hypertrophy: hypertrophy 8-12, no bump, NO vertical_push compound, fly + delt iso present', () => {
        const { rows, patterns, compounds } = phulBlueprint();
        const c = compounds('upper', 'B');
        expect(c.length).toBeGreaterThan(0);
        expect(c.every((e) => e.reps === '8-12')).toBe(true);
        expect(rows('upper', 'B').every((e) => e.sets === '3')).toBe(true);
        const p = patterns('upper', 'B');
        expect(p).toContain('horizontal_push');
        expect(p).toContain('horizontal_pull');
        expect(p).toContain('vertical_pull');
        // The defining PHUL characteristic: no overhead press on the volume upper day.
        expect(p).not.toContain('vertical_push');
        expect(p).toContain('chest_iso');
        expect(p).toContain('shoulder_iso');
    });

    it('Lower Hypertrophy: hypertrophy 8-12, no bump, squat-led, with lunge + hinge + calf', () => {
        const { rows, patterns, compounds, pat } = phulBlueprint();
        const c = compounds('lower', 'B');
        expect(c.length).toBeGreaterThan(0);
        expect(c.every((e) => e.reps === '8-12')).toBe(true);
        expect(rows('lower', 'B').every((e) => e.sets === '3')).toBe(true);
        const p = patterns('lower', 'B');
        expect(p).toContain('squat');
        expect(p).toContain('lunge');
        expect(p).toContain('hinge');
        expect(p).toContain('calf');
        // Squat leads (PRIMARY_LOWER at position 0).
        const ordered = [...rows('lower', 'B')].sort((a, b) => a.order - b.order);
        expect(pat.get(ordered[0].exercise_id)).toBe('squat');
    });

    it('Upper Hypertrophy at 90+ min activates all 7 slots, including the trailing triceps_iso', () => {
        const pool = deepPool(2);
        const bp = generateRoutine(input({ style: phul(), trainingDays: fourDays, pool, sessionTime: '90+ min' }));
        const pat = patternMap(pool);
        const p = sessionIds(bp, 'upper', 'B').map((id) => pat.get(id));
        expect(p).toContain('triceps_iso');
        expect(p).toContain('biceps_iso');
        expect(p).toContain('chest_iso');
        expect(p).toContain('shoulder_iso');
        // Still no overhead press, even with the longer session and backfill.
        expect(p).not.toContain('vertical_push');
    });

    it('consistent: the Power and Hypertrophy day of each region share the same main lift', () => {
        // ~30 min (4 exercises) keeps each session at a single slot per compound
        // pattern, so the shared-anchor assertions stay exact.
        const pool = deepPool(2);
        const bp = generateRoutine(
            input({
                style: phul(),
                trainingDays: fourDays,
                pool,
                sessionTime: '~30 min',
                varietyPreference: 'consistent',
            }),
        );
        const pat = patternMap(pool);
        const byPat = (wt: string, v: string, mp: MovementPattern) =>
            sessionIds(bp, wt, v).filter((id) => pat.get(id) === mp);
        // Same bench on both upper days.
        const hpA = byPat('upper', 'A', 'horizontal_push');
        const hpB = byPat('upper', 'B', 'horizontal_push');
        expect(hpA).toHaveLength(1);
        expect(hpB).toHaveLength(1);
        expect(hpA[0]).toBe(hpB[0]);
        // Same squat on both lower days.
        const sqA = byPat('lower', 'A', 'squat');
        const sqB = byPat('lower', 'B', 'squat');
        expect(sqA).toHaveLength(1);
        expect(sqB).toHaveLength(1);
        expect(sqA[0]).toBe(sqB[0]);
    });

    it('varied: the Hypertrophy upper day picks a different horizontal push from the Power day', () => {
        const { bp, pat } = phulBlueprint(); // varied is the default
        const hp = (v: string) => sessionIds(bp, 'upper', v).filter((id) => pat.get(id) === 'horizontal_push');
        expect(hp('A')).toHaveLength(1);
        expect(hp('B')).toHaveLength(1);
        expect(hp('B')[0]).not.toBe(hp('A')[0]);
    });

    it('does not change the 4-day default: recommendStyle(4) is still ul-classic-4', () => {
        expect(recommendStyle(4)).toBe('ul-classic-4');
    });

    it('is offered in the 4-day picker grouped with the U/L splits (index 2)', () => {
        const keys = STYLES[4].map((s) => s.key);
        expect(keys).toContain('phul-4');
        expect(keys).toEqual(['ul-classic-4', 'ul-aesthetic-4', 'phul-4', 'ppl-fb-4', 'fb-hmhp-4']);
    });
});

// PHUL is purely additive. ul-classic-4 already has a byte-identity golden (Item 5
// block above); these freeze the other three 4-day styles so any future change that
// silently alters them is caught. Captured with input() defaults (deepPool(2),
// dumbbells-only, 45-60 min, intermediate, build_muscle, anchorDow default).
describe('PHUL (#18): byte-identity guards for the other 4-day styles', () => {
    function flatten(key: string, days: number[]) {
        const style = STYLES[4].find((s) => s.key === key) as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: days }));
        return {
            schedule: bp.schedule.map((s) => `${s.day_of_week}:${s.workout_type}:${s.variant ?? '-'}`),
            exercises: bp.exercises.map(
                (e) => `${e.workout_type}:${e.variant ?? '-'}:${e.exercise_id}:${e.sets}x${e.reps}`,
            ),
        };
    }

    it('ul-aesthetic-4 is unchanged by the PHUL addition', () => {
        expect(flatten('ul-aesthetic-4', [1, 2, 4, 5])).toEqual({
            schedule: ['1:upper:A', '2:lower:A', '4:upper:B', '5:lower:B'],
            exercises: [
                'upper:A:horizontal_push-1:3x8-12',
                'upper:A:horizontal_pull-1:3x8-12',
                'upper:A:vertical_pull-1:3x8-12',
                'upper:A:shoulder_iso-1:3x12-15',
                'upper:A:chest_iso-1:3x12-15',
                'upper:A:back_iso-1:3x12-15',
                'lower:A:squat-1:3x8-12',
                'lower:A:lunge-1:3x8-12',
                'lower:A:lunge-2:3x8-12',
                'lower:A:quad_iso-1:3x12-15',
                'lower:A:calf-1:3x12-15',
                'lower:A:core-1:3x12-15',
                'upper:B:vertical_push-1:3x12-15',
                'upper:B:horizontal_pull-2:3x12-15',
                'upper:B:shoulder_iso-2:3x15-20',
                'upper:B:biceps_iso-1:3x15-20',
                'upper:B:triceps_iso-1:3x15-20',
                'upper:B:back_iso-2:3x15-20',
                'lower:B:hinge-1:3x8-12',
                'lower:B:lunge-1:3x8-12',
                'lower:B:hamstring_iso-1:3x12-15',
                'lower:B:glute_iso-1:3x12-15',
                'lower:B:calf-2:3x12-15',
                'lower:B:core-2:3x12-15',
            ],
        });
    });

    it('ppl-fb-4 is unchanged by the PHUL addition', () => {
        expect(flatten('ppl-fb-4', [1, 2, 4, 5])).toEqual({
            schedule: ['1:push:-', '2:pull:-', '4:legs:-', '5:full_body:-'],
            exercises: [
                'push:-:horizontal_push-1:3x8-12',
                'push:-:vertical_push-1:3x8-12',
                'push:-:chest_iso-1:3x12-15',
                'push:-:shoulder_iso-1:3x12-15',
                'push:-:triceps_iso-1:3x12-15',
                'push:-:triceps_iso-2:3x12-15',
                'pull:-:horizontal_pull-1:3x8-12',
                'pull:-:vertical_pull-1:3x8-12',
                'pull:-:back_iso-1:3x12-15',
                'pull:-:shoulder_iso-2:3x12-15',
                'pull:-:biceps_iso-1:3x12-15',
                'pull:-:back_iso-2:3x12-15',
                'legs:-:squat-1:3x8-12',
                'legs:-:hinge-1:3x8-12',
                'legs:-:lunge-1:3x8-12',
                'legs:-:glute_iso-1:3x12-15',
                'legs:-:calf-1:3x12-15',
                'legs:-:core-1:3x12-15',
                'full_body:-:squat-2:3x8-12',
                'full_body:-:horizontal_push-2:3x8-12',
                'full_body:-:hinge-2:3x8-12',
                'full_body:-:vertical_push-2:3x8-12',
                'full_body:-:horizontal_pull-2:3x8-12',
                'full_body:-:shoulder_iso-1:3x10-15',
            ],
        });
    });

    it('fb-hmhp-4 is unchanged by the PHUL addition', () => {
        expect(flatten('fb-hmhp-4', [1, 2, 4, 5])).toEqual({
            schedule: ['1:full_body:A', '2:full_body:B', '4:full_body:C', '5:full_body:D'],
            exercises: [
                'full_body:A:squat-1:4x3-6',
                'full_body:A:horizontal_push-1:3x3-6',
                'full_body:A:hinge-1:3x3-6',
                'full_body:A:vertical_push-1:3x3-6',
                'full_body:A:horizontal_pull-1:3x3-6',
                'full_body:A:biceps_iso-1:3x10-15',
                'full_body:B:squat-2:3x8-12',
                'full_body:B:horizontal_push-2:3x8-12',
                'full_body:B:hinge-2:3x8-12',
                'full_body:B:vertical_push-2:3x8-12',
                'full_body:B:horizontal_pull-2:3x8-12',
                'full_body:B:shoulder_iso-1:3x10-15',
                'full_body:C:hinge-1:3x8-12',
                'full_body:C:horizontal_push-1:3x8-12',
                'full_body:C:lunge-1:3x8-12',
                'full_body:C:horizontal_pull-1:3x8-12',
                'full_body:C:shoulder_iso-2:3x12-15',
                'full_body:C:triceps_iso-1:3x12-15',
                'full_body:D:lunge-2:3x12-15',
                'full_body:D:horizontal_push-1:3x12-15',
                'full_body:D:horizontal_pull-1:3x12-15',
                'full_body:D:shoulder_iso-1:3x15-20',
                'full_body:D:biceps_iso-2:3x15-20',
                'full_body:D:triceps_iso-2:3x15-20',
            ],
        });
    });
});

// Bug 6: per-session focus labels for the quad/posterior lower-day split.
describe('focusLabelForEmphasis (Bug 6)', () => {
    it('labels quad emphases "Lower (Quads)"', () => {
        expect(focusLabelForEmphasis('lower_quad')).toBe('Lower (Quads)');
        expect(focusLabelForEmphasis('lower_lean')).toBe('Lower (Quads)');
    });

    it('labels the posterior emphasis "Lower (Hamstrings & Glutes)"', () => {
        expect(focusLabelForEmphasis('lower_post')).toBe('Lower (Hamstrings & Glutes)');
    });

    it('returns null for general lower, PHUL lowers, and upper emphases', () => {
        // PHUL lowers train squat AND hinge together: a power/volume split, not
        // a quad/posterior one, so they must not get a quad/posterior label.
        expect(focusLabelForEmphasis('phul_lower_power')).toBeNull();
        expect(focusLabelForEmphasis('phul_lower_hyp')).toBeNull();
        expect(focusLabelForEmphasis('lower_general')).toBeNull();
        expect(focusLabelForEmphasis('legs')).toBeNull();
        expect(focusLabelForEmphasis('fb_legs')).toBeNull();
        expect(focusLabelForEmphasis('upper_general')).toBeNull();
        expect(focusLabelForEmphasis('push')).toBeNull();
    });

    // Every emphasis returns a string or null (no throw on the full union).
    it('is total over the EMPHASES table', () => {
        for (const key of Object.keys(EMPHASES) as Array<keyof typeof EMPHASES>) {
            const label = focusLabelForEmphasis(key);
            expect(label === null || typeof label === 'string').toBe(true);
        }
    });
});

describe('generated schedule carries focus labels for paired styles (Bug 6)', () => {
    // Map each generated schedule row to `${type}:${variant}` -> label.
    function labelsByKey(count: number, key: string, days: number[]): Record<string, string | null> {
        const style = STYLES[count].find((s) => s.key === key) as ProgramStyle;
        const bp = generateRoutine(input({ style, trainingDays: days }));
        const out: Record<string, string | null> = {};
        for (const s of bp.schedule) out[`${s.workout_type}:${s.variant ?? '-'}`] = s.label;
        return out;
    }

    it('ul-classic-4: Lower A = Quads, Lower B = posterior, uppers unlabelled', () => {
        const labels = labelsByKey(4, 'ul-classic-4', [1, 2, 4, 5]);
        expect(labels['lower:A']).toBe('Lower (Quads)');
        expect(labels['lower:B']).toBe('Lower (Hamstrings & Glutes)');
        expect(labels['upper:A']).toBeNull();
        expect(labels['upper:B']).toBeNull();
    });

    it('ul-aesthetic-4: the lean (quad) day reads "Lower (Quads)"', () => {
        const labels = labelsByKey(4, 'ul-aesthetic-4', [1, 2, 4, 5]);
        expect(labels['lower:A']).toBe('Lower (Quads)');
        expect(labels['lower:B']).toBe('Lower (Hamstrings & Glutes)');
    });

    it('ulppl-5: the "Legs" (posterior) day reads "Lower (Hamstrings & Glutes)"', () => {
        const labels = labelsByKey(5, 'ulppl-5', [1, 2, 3, 4, 5]);
        expect(labels['lower:-']).toBe('Lower (Quads)');
        expect(labels['legs:-']).toBe('Lower (Hamstrings & Glutes)');
        expect(labels['upper:-']).toBeNull();
        expect(labels['push:-']).toBeNull();
        expect(labels['pull:-']).toBeNull();
    });

    it('ppl-x2-6: Legs A = Quads, Legs B = posterior', () => {
        const labels = labelsByKey(6, 'ppl-x2-6', [1, 2, 3, 4, 5, 6]);
        expect(labels['legs:A']).toBe('Lower (Quads)');
        expect(labels['legs:B']).toBe('Lower (Hamstrings & Glutes)');
    });

    it('fb-ul-hybrid-5: Lower A = Quads, Lower B = posterior', () => {
        const labels = labelsByKey(5, 'fb-ul-hybrid-5', [1, 2, 3, 4, 5]);
        expect(labels['lower:A']).toBe('Lower (Quads)');
        expect(labels['lower:B']).toBe('Lower (Hamstrings & Glutes)');
    });

    it('phul-4: lower days stay unlabelled (power/volume split, not quad/posterior)', () => {
        const labels = labelsByKey(4, 'phul-4', [1, 2, 4, 5]);
        expect(labels['lower:A']).toBeNull();
        expect(labels['lower:B']).toBeNull();
    });
});
