import { describe, it, expect } from 'vitest';
import {
    STYLES,
    EMPHASES,
    volumeFor,
    repRange,
    recommendStyle,
    resolveStyle,
    generateRoutine,
    applyTemplateVolume,
    buildRationale,
    genderDefault,
    resolvePriority,
    tiltEmphasis,
    resolveBias,
    resolveRepRange,
    POWERBUILDING_HEAVY_PATTERNS,
} from '@/lib/pulse/generation';
import type { ExerciseMeta, GenerationInput } from '@/lib/pulse/generation';
import type { EquipmentKey, MovementPattern, ExerciseCategory, ProgramStyle, Bias, TrainingStyle } from '@/lib/pulse/types';

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
        expect(repRange('strength', true)).toBe('6-10');
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
        expect(repRange('strength', true, 'lose_fat')).toBe('8-12');
        expect(repRange('hypertrophy', false, 'lose_fat')).toBe('15-20');
    });
});

describe('resolveBias', () => {
    // The full 4x4 remap table from the spec. Rows = session bias, cols = style.
    const TABLE: Record<Bias, Record<TrainingStyle, Bias>> = {
        strength: { balanced: 'strength', strength: 'strength', bodybuilding: 'hypertrophy', powerbuilding: 'strength' },
        balanced: { balanced: 'balanced', strength: 'strength', bodybuilding: 'hypertrophy', powerbuilding: 'strength' },
        hypertrophy: { balanced: 'hypertrophy', strength: 'strength', bodybuilding: 'hypertrophy', powerbuilding: 'strength' },
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
    it('powerbuilding gives the hypertrophy range to accessories (rows, isolation, lunge)', () => {
        for (const p of ['horizontal_pull', 'biceps_iso', 'lunge'] as MovementPattern[]) {
            const isCompound = p === 'horizontal_pull' || p === 'lunge';
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

    it('tiltEmphasis front-loads a priority pattern already in the slots', () => {
        const lower = EMPHASES.lower_quad; // slots: squat, lunge, hinge, glute_iso, calf, core
        const tilted = tiltEmphasis(lower, 'glutes');
        // glute_iso + hinge (the glutes patterns present) move to the front, in
        // PRIORITY_PATTERNS order, preserving the rest.
        expect(tilted.slots.slice(0, 2)).toEqual(['glute_iso', 'hinge']);
        expect(tilted.slots).toHaveLength(lower.slots.length);
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
): ExerciseMeta {
    return { id, movement_pattern: pattern, equipment, is_compound: compound, category: 'chest' as ExerciseCategory };
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
];

function deepPool(): ExerciseMeta[] {
    const pool: ExerciseMeta[] = [];
    for (const p of ALL_PATTERNS) {
        // compounds for the big patterns, isolation for *_iso / calf / core
        const compound = !p.endsWith('_iso') && p !== 'calf' && p !== 'core';
        pool.push(meta(`${p}-1`, p, ['dumbbells'], compound));
        pool.push(meta(`${p}-2`, p, ['dumbbells'], compound));
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
            days: '4',
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
        const bp = generateRoutine(input());
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
    it('a strength-bias full-body compound gets 6-10; a pump-bias day uses the pump table', () => {
        // fb-hmhp-4: day A strength, day D pump.
        const bp = generateRoutine(
            input({
                style: STYLES[4].find((s) => s.key === 'fb-hmhp-4') as ProgramStyle,
            }),
        );
        const dayA = bp.exercises.filter((e) => e.variant === 'A');
        expect(dayA.some((e) => e.reps === '6-10')).toBe(true); // strength compound
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
                    days: '4',
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
            days: '4',
        } as unknown as import('../recommendation').OnboardingAnswers;
        expect(buildRationale(answers, '45–60 min', style)).toBe(
            'Aesthetic Upper / Lower for intermediate lifters · 4 days/week · build muscle · 45–60 min sessions. Upper-body priority with extra isolation and a leaner lower.',
        );
    });
    it('maps goals to friendly labels', () => {
        const a = (g: string) =>
            ({
                equipment: new Set(),
                experience: 'beginner',
                goal: g,
                days: '2-3',
            }) as unknown as import('../recommendation').OnboardingAnswers;
        expect(buildRationale(a('lose_fat'), '~30 min', style)).toContain('lose fat');
        expect(buildRationale(a('general_fitness'), '~30 min', style)).toContain('general fitness');
    });
    const answers = {
        equipment: new Set(),
        experience: 'intermediate',
        goal: 'build_muscle',
        days: '4',
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
