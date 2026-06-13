import { describe, it, expect } from 'vitest';
import {
    getPhase,
    getRIR,
    buildBlockArc,
    estimateSessionMinutes,
    logKey,
    parseLogKey,
    parseMaxSets,
    buildHistory,
    weekHasData,
    calcE1RM,
    computePRMap,
    computeStreak,
    computeSuggestion,
    computeProgression,
    computeVolumeByTypeAndWeek,
    computeE1RMHistory,
    computeBestSets,
    computeExerciseHistory,
    computeLastSession,
    computeLastSessionMap,
    computeWarmupSets,
    computeShareStats,
    isSetPR,
    computePerMuscleVolume,
    computeVolumeProgress,
    computeRecoveryFlags,
    computePlates,
    sessionTypeFor,
    computeWeeksWithData,
    swapKey,
    resolveExercise,
    swapCandidates,
    rankSubstitutes,
    computeStrengthByWeek,
    computeRecompSignal,
    computeRecompTrend,
    recompStatus,
    recompDetail,
    recompLines,
    toLengthDisplay,
    toCm,
    priorityAdjustedTargets,
    priorityFocusLine,
    weekInBlock,
    volumeForWeek,
    computePlateau,
    recentDrop,
    shouldDeload,
    deloadTarget,
    liftTrend,
    computeSessionTargets,
    decisionForExercise,
    computeSessionTonnage,
    sessionDecisions,
    composeCoachRead,
    computeSessionSummary,
    resolveEquipmentPrefill,
    equipmentKey,
    matchingProfileId,
    exerciseReason,
    recoverySummaryWord,
    formatProgramStatus,
} from '../utils';
import type { EquipmentProfile } from '../types';
import { buildProgram, PROGRAM_LENGTHS } from '../data';
import type {
    Logs,
    RoutineExercise,
    WorkoutType,
    WorkoutSession,
    BodyweightEntry,
    BodyMeasurement,
    DbExercise,
} from '../types';

describe('computePlateau', () => {
    const h = (...e1rms: number[]) => e1rms.map((e1rm, i) => ({ week: i + 1, e1rm }));

    it('needs more than recentWeeks of history', () => {
        expect(computePlateau(h(100, 100, 100), 3)).toBe(false); // only 3 points
    });

    it('flags a stall when the last 3 weeks set no new high', () => {
        expect(computePlateau(h(100, 105, 110, 108, 109, 110), 3)).toBe(true);
    });

    it('is not a stall when a recent week beats the prior best', () => {
        expect(computePlateau(h(100, 105, 110, 108, 109, 112), 3)).toBe(false);
    });
});

describe('auto-deload', () => {
    const h = (...e1rms: number[]) => e1rms.map((e1rm, i) => ({ week: i + 1, e1rm }));
    const prev = (kg: number, reps = 8) => ({ kg, reps, rir: 1, saved: true });

    describe('recentDrop', () => {
        it('detects a real (>=3%) drop within the window', () => {
            expect(recentDrop(h(100, 105, 110, 99))).toBe(true);
        });
        it('ignores small fluctuations under the threshold', () => {
            expect(recentDrop(h(100, 105, 110, 108))).toBe(false); // ~2% dip
        });
        it('ignores a drop that has scrolled out of the window', () => {
            expect(recentDrop(h(100, 90, 100, 105, 110))).toBe(false); // drop was 4 weeks ago
        });
    });

    describe('shouldDeload', () => {
        it('deloads on a clean stall', () => {
            expect(shouldDeload(h(100, 105, 110, 108, 109, 110))).toBe(true);
        });
        it('does not deload again while rebuilding from a recent deload', () => {
            expect(shouldDeload(h(100, 105, 110, 110, 110, 99))).toBe(false);
        });
        it('re-arms once the deload has scrolled out of the rebuild window', () => {
            expect(shouldDeload(h(100, 105, 110, 110, 99, 104, 108, 109))).toBe(true);
        });
        it('does not deload when the lift is still progressing', () => {
            expect(shouldDeload(h(100, 105, 110, 112, 114, 116))).toBe(false);
        });
    });

    describe('deloadTarget', () => {
        it('drops to ~90% on the 2.5 grid and resets reps to the bottom of the range', () => {
            expect(deloadTarget(prev(100, 8), '8-12')).toEqual({ kg: 90, reps: 8 });
        });
        it('rounds to the nearest 2.5 kg', () => {
            expect(deloadTarget(prev(102.5), '10-15')).toEqual({ kg: 92.5, reps: 10 });
        });
        it('floors at MIN_KG', () => {
            expect(deloadTarget(prev(1), '8-12')).toEqual({ kg: 0.5, reps: 8 });
        });
        it('falls back to the previous reps when the range has no number', () => {
            expect(deloadTarget(prev(100, 6), '')).toEqual({ kg: 90, reps: 6 });
        });
        it('returns null without a previous entry', () => {
            expect(deloadTarget(undefined, '8-12')).toBeNull();
        });
    });

    describe('liftTrend', () => {
        it('returns null for a new lift with too little history', () => {
            expect(liftTrend(h(100))).toBeNull();
        });
        it('flags deload on a clean stall (mirrors shouldDeload)', () => {
            expect(liftTrend(h(100, 105, 110, 108, 109, 110))).toBe('deload');
        });
        it('flags stalled (not deload) while rebuilding from a recent drop', () => {
            expect(liftTrend(h(100, 105, 110, 110, 110, 99))).toBe('stalled');
        });
        it('flags progressing when the lift is climbing', () => {
            expect(liftTrend(h(100, 105, 110, 112, 114, 116))).toBe('progressing');
        });
        it('flags progressing on a short climbing history before a plateau can be judged', () => {
            expect(liftTrend(h(100, 105))).toBe('progressing');
        });
        it('returns null when flat with too little history to call a stall', () => {
            expect(liftTrend(h(100, 100, 100))).toBeNull();
        });
    });
});

describe('computeSessionTargets', () => {
    const RE = '11111111-1111-4111-8111-111111111111';
    const mkRE = (over: Partial<RoutineExercise> = {}): RoutineExercise => ({
        id: RE,
        routine_id: 'r1',
        exercise_id: 'e1',
        workout_type: 'push',
        variant: null,
        order: 0,
        sets: '3',
        reps: '8-12',
        starting_weight_kg: null,
        superset_group_id: null,
        exercise: {
            id: 'e1',
            name: 'Bench Press',
            category: 'chest',
            default_sets: '3',
            default_reps: '8-12',
            user_id: null,
            equipment: ['barbell'],
        },
        ...over,
    });

    it('falls back to the starting weight in week 1 (no prior set)', () => {
        const rows = computeSessionTargets([mkRE({ starting_weight_kg: 60 })], {}, 1);
        expect(rows[0]).toMatchObject({
            routineExerciseId: RE,
            name: 'Bench Press',
            sets: '3',
            reps: '8-12',
            bodyweight: false,
            weightKg: 60,
        });
    });

    it('is null when there is no prior set and no starting weight', () => {
        expect(computeSessionTargets([mkRE()], {}, 1)[0].weightKg).toBeNull();
    });

    it('mirrors computeSuggestion off the prior week top set', () => {
        const prev = { kg: 80, reps: 10, rir: 5, saved: true };
        const logs: Logs = { [logKey(2, RE, 0)]: prev };
        expect(computeSessionTargets([mkRE()], logs, 3)[0].weightKg).toBe(computeSuggestion(prev, 3));
    });

    it('ignores an unsaved prior set and falls back to the starting weight', () => {
        const logs: Logs = { [logKey(2, RE, 0)]: { kg: 80, reps: 10, rir: 5, saved: false } };
        expect(computeSessionTargets([mkRE({ starting_weight_kg: 60 })], logs, 3)[0].weightKg).toBe(60);
    });

    it('flags a bodyweight exercise from its (empty) equipment', () => {
        const bw = mkRE({
            exercise: {
                id: 'e2',
                name: 'Pull-Up',
                category: 'back',
                default_sets: '3',
                default_reps: '8-12',
                user_id: null,
                equipment: [],
            },
        });
        expect(computeSessionTargets([bw], {}, 1)[0].bodyweight).toBe(true);
    });
});

describe('decisionForExercise', () => {
    const RE = '11111111-1111-4111-8111-111111111111';
    const stalled = [100, 105, 110, 108, 109, 110].map((e1rm, i) => ({ week: i + 1, e1rm }));
    const climbing = [100, 105, 110, 112, 114, 116].map((e1rm, i) => ({ week: i + 1, e1rm }));
    const base = { routineExerciseId: RE, repsRange: '8-12' };

    it('logs a deload event (plateau) when the lift is stalled', () => {
        // getRIR is irrelevant on the deload branch; deloadTarget(100,'8-12') -> 90.
        const d = decisionForExercise({
            ...base,
            week: 6,
            e1rmHistory: stalled,
            previousEntry: { kg: 100, reps: 8, rir: 1, saved: true },
        });
        expect(d).toEqual({
            type: 'deload',
            trigger: 'plateau',
            affectedArea: RE,
            week: 6,
            magnitude: { fromKg: 100, toKg: 90 },
            confidence: null,
        });
    });

    it('logs a progression event (targets_hit) on a weight advance, top of range, RIR met', () => {
        // week 5 -> getRIR(4) = 2; rir 2 >= 2 and reps 12 >= hi 12 -> +2.5 kg, reps reset to 8.
        const d = decisionForExercise({
            ...base,
            week: 5,
            e1rmHistory: climbing,
            previousEntry: { kg: 100, reps: 12, rir: 2, saved: true },
        });
        expect(d).toEqual({
            type: 'progression',
            trigger: 'targets_hit',
            affectedArea: RE,
            week: 5,
            magnitude: { fromKg: 100, toKg: 102.5, fromReps: 12, toReps: 8 },
            confidence: null,
        });
    });

    it('logs a progression event on a rep advance, mid-range, RIR met', () => {
        // week 5 -> getRIR(4) = 2; rir 2 >= 2 and reps 9 < hi 12 -> same kg, +1 rep.
        const d = decisionForExercise({
            ...base,
            week: 5,
            e1rmHistory: climbing,
            previousEntry: { kg: 100, reps: 9, rir: 2, saved: true },
        });
        expect(d).toEqual({
            type: 'progression',
            trigger: 'targets_hit',
            affectedArea: RE,
            week: 5,
            magnitude: { fromKg: 100, toKg: 100, fromReps: 9, toReps: 10 },
            confidence: null,
        });
    });

    it('deload takes precedence over progression when the lift is both stalled and at target RIR', () => {
        const d = decisionForExercise({
            ...base,
            week: 6,
            e1rmHistory: stalled,
            previousEntry: { kg: 100, reps: 12, rir: 3, saved: true },
        });
        expect(d?.type).toBe('deload');
    });

    it('logs nothing when the set was harder than planned (a back-off, not a progression)', () => {
        // rir 0 < target 2 -> computeProgression reduces weight; not a tracked decision.
        const d = decisionForExercise({
            ...base,
            week: 5,
            e1rmHistory: climbing,
            previousEntry: { kg: 100, reps: 8, rir: 0, saved: true },
        });
        expect(d).toBeNull();
    });

    it('logs nothing on week 1 (no prior session to decide from)', () => {
        expect(decisionForExercise({ ...base, week: 1, e1rmHistory: [], previousEntry: undefined })).toBeNull();
    });
});

describe('periodized blocks', () => {
    it('buildProgram(12) is the canonical 4-phase / 12-week block', () => {
        const p = buildProgram(12);
        expect(p.phases).toHaveLength(4);
        expect(p.volume).toHaveLength(12);
        expect(buildProgram(999)).toBe(buildProgram(12)); // unknown length falls back to 12
    });

    it('every supported length covers exactly its weeks and ends on a deload (lowest-volume week)', () => {
        for (const n of PROGRAM_LENGTHS) {
            const p = buildProgram(n);
            expect(p.volume).toHaveLength(n);
            const weeks = p.phases.flatMap((ph) => ph.weeks);
            expect(weeks).toEqual(Array.from({ length: n }, (_, i) => i + 1));
            const last = p.volume[n - 1].sets;
            expect(last).toBe(Math.min(...p.volume.map((v) => v.sets))); // block ends on a deload
        }
    });

    it('weekInBlock wraps the repeating program', () => {
        expect(weekInBlock(1, 12)).toBe(1);
        expect(weekInBlock(12, 12)).toBe(12);
        expect(weekInBlock(13, 12)).toBe(1); // block 2, week 1
        expect(weekInBlock(20, 8)).toBe(4);
    });

    it('getPhase/getRIR/volumeForWeek repeat across block boundaries', () => {
        expect(getPhase(13, 12).label).toBe(getPhase(1, 12).label);
        expect(getRIR(13, 12)).toBe(getRIR(1, 12));
        expect(volumeForWeek(13, 12)).toBe(volumeForWeek(1, 12));
    });

    it('defaults to the 12-week block, preserving legacy behavior', () => {
        expect(getRIR(1)).toBe(getRIR(1, 12));
        expect(getPhase(7).subtitle).toBe('Overreach');
    });
});

describe('priorityAdjustedTargets', () => {
    const base = {
        chest: [10, 16] as [number, number],
        biceps: [8, 14] as [number, number],
        legs: [12, 18] as [number, number],
    };

    it('is the identity for a null priority', () => {
        expect(priorityAdjustedTargets(base, null)).toEqual(base);
    });

    it('bumps only the prioritized muscle band', () => {
        const out = priorityAdjustedTargets(base, 'chest');
        expect(out.chest).toEqual([12, 18]);
        expect(out.legs).toEqual([12, 18]); // unchanged
        expect(out.biceps).toEqual([8, 14]); // unchanged
    });

    it('arms bumps both biceps and triceps where present', () => {
        const out = priorityAdjustedTargets({ ...base, triceps: [8, 14] }, 'arms');
        expect(out.biceps).toEqual([10, 16]);
        expect(out.triceps).toEqual([10, 16]);
        expect(out.chest).toEqual([10, 16]); // unchanged
    });
});

describe('priorityFocusLine', () => {
    it('returns null when there is no priority tilt', () => {
        expect(priorityFocusLine(null)).toBeNull();
    });
    it('names the prioritized muscle with a capitalized label', () => {
        expect(priorityFocusLine('glutes')).toBe('Glutes volume raised, your training priority.');
        expect(priorityFocusLine('back')).toBe('Back volume raised, your training priority.');
    });
    it('has no em dash (project copy rule)', () => {
        expect(priorityFocusLine('chest')).not.toContain('—');
    });
});

describe('toLengthDisplay / toCm', () => {
    it('is the identity for cm', () => {
        expect(toLengthDisplay(81, 'cm')).toBe(81);
        expect(toCm(81, 'cm')).toBe(81);
    });

    it('converts cm to inches for display, rounded to 0.1', () => {
        expect(toLengthDisplay(2.54, 'in')).toBe(1);
        expect(toLengthDisplay(81, 'in')).toBe(31.9); // 81 / 2.54 = 31.889…
    });

    it('parses an inch input back to cm, rounded to 0.01', () => {
        expect(toCm(1, 'in')).toBe(2.54);
        expect(toCm(31.9, 'in')).toBe(81.03);
    });

    it('round-trips within rounding tolerance', () => {
        const cm = 99;
        const back = toCm(toLengthDisplay(cm, 'in'), 'in');
        expect(Math.abs(back - cm)).toBeLessThan(0.1);
    });
});

describe('getPhase', () => {
    it('returns Phase 1 for weeks 1–3', () => {
        expect(getPhase(1).label).toBe('Phase 1');
        expect(getPhase(2).label).toBe('Phase 1');
        expect(getPhase(3).label).toBe('Phase 1');
    });

    it('returns Phase 2 for weeks 4–6', () => {
        expect(getPhase(4).label).toBe('Phase 2');
        expect(getPhase(6).label).toBe('Phase 2');
    });

    it('returns Phase 3 for weeks 7–9', () => {
        expect(getPhase(7).label).toBe('Phase 3');
        expect(getPhase(9).label).toBe('Phase 3');
    });

    it('returns Phase 4 for weeks 10–12', () => {
        expect(getPhase(10).label).toBe('Phase 4');
        expect(getPhase(12).label).toBe('Phase 4');
    });

    it('wraps weeks beyond the block (the program repeats)', () => {
        // week 99 in a 12-week block → week 3 → Phase 1; week 13 → week 1 → Phase 1.
        expect(getPhase(99).label).toBe('Phase 1');
        expect(getPhase(13).label).toBe('Phase 1');
    });
});

describe('getRIR', () => {
    it('returns correct RIR per phase week position', () => {
        expect(getRIR(1)).toBe(3); // Phase 1 week 1 → RIR[0]
        expect(getRIR(2)).toBe(3); // Phase 1 week 2 → RIR[1]
        expect(getRIR(3)).toBe(2); // Phase 1 week 3 → RIR[2]
        expect(getRIR(4)).toBe(2); // Phase 2 week 1
        expect(getRIR(6)).toBe(1); // Phase 2 week 3
        expect(getRIR(9)).toBe(0); // Phase 3 week 3
        expect(getRIR(12)).toBe(3); // Deload
    });
});

describe('buildBlockArc', () => {
    it('returns one entry per week for each supported block length', () => {
        expect(buildBlockArc(8)).toHaveLength(8);
        expect(buildBlockArc(10)).toHaveLength(10);
        expect(buildBlockArc(12)).toHaveLength(12);
        expect(buildBlockArc(16)).toHaveLength(16);
    });

    it('carries the real volume, RIR and phase for the 12-week block', () => {
        const arc = buildBlockArc(12);
        expect(arc.map((w) => w.volume)).toEqual([12, 14, 16, 14, 16, 18, 16, 18, 20, 18, 20, 10]);
        expect(arc.map((w) => w.rir)).toEqual([3, 3, 2, 2, 2, 1, 1, 1, 0, 1, 0, 3]);
        expect(arc[0].phase.subtitle).toBe('Accumulation'); // week 1
        expect(arc[5].phase.subtitle).toBe('Intensification'); // week 6
        expect(arc[8].phase.subtitle).toBe('Overreach'); // week 9
        expect(arc[11].phase.subtitle).toBe('Peak & Deload'); // week 12
    });

    it('flags only the end deload (lowest volume) in the 12-week block', () => {
        const deloads = buildBlockArc(12)
            .filter((w) => w.isDeload)
            .map((w) => w.week);
        expect(deloads).toEqual([12]);
    });

    it('flags both the mid-block and end deload in the 16-week block', () => {
        const deloads = buildBlockArc(16)
            .filter((w) => w.isDeload)
            .map((w) => w.week);
        expect(deloads).toEqual([8, 16]);
    });
});

describe('estimateSessionMinutes', () => {
    it('is 0 for an empty session', () => {
        expect(estimateSessionMinutes([])).toBe(0);
    });

    it('estimates more time for compound-heavy than isolation-heavy work, rounded to 5', () => {
        const compound = estimateSessionMinutes([
            { sets: 4, is_compound: true },
            { sets: 4, is_compound: true },
        ]);
        const iso = estimateSessionMinutes([
            { sets: 4, is_compound: false },
            { sets: 4, is_compound: false },
        ]);
        expect(compound).toBeGreaterThan(iso);
        expect(compound % 5).toBe(0);
        expect(iso % 5).toBe(0);
    });

    it('treats a missing is_compound flag as isolation rest', () => {
        expect(estimateSessionMinutes([{ sets: 3 }])).toBe(estimateSessionMinutes([{ sets: 3, is_compound: false }]));
    });
});

describe('logKey', () => {
    it('returns hyphen-delimited string with UUID in middle', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        expect(logKey(1, uuid, 0)).toBe(`1-${uuid}-0`);
        expect(logKey(12, uuid, 3)).toBe(`12-${uuid}-3`);
        expect(logKey(7, uuid, 1)).toBe(`7-${uuid}-1`);
    });
});

describe('parseLogKey', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';

    it('parses a well-formed key into its parts', () => {
        expect(parseLogKey(`1-${uuid}-0`)).toEqual({
            week: 1,
            routineExerciseId: uuid,
            setIdx: 0,
        });
        expect(parseLogKey(`12-${uuid}-3`)).toEqual({
            week: 12,
            routineExerciseId: uuid,
            setIdx: 3,
        });
    });

    it('round-trips with logKey', () => {
        expect(parseLogKey(logKey(7, uuid, 2))).toEqual({
            week: 7,
            routineExerciseId: uuid,
            setIdx: 2,
        });
    });

    it('returns null when there is no dash', () => {
        expect(parseLogKey('nodash')).toBeNull();
    });

    it('returns null when there is only one dash', () => {
        expect(parseLogKey(`1-${uuid}`)).toBeNull();
    });

    it('returns null when the middle segment is not a valid UUID', () => {
        expect(parseLogKey('1-not-a-uuid-0')).toBeNull();
    });

    it('returns null when the week segment is not numeric', () => {
        expect(parseLogKey(`x-${uuid}-0`)).toBeNull();
    });

    it('returns null when the setIdx segment is not numeric', () => {
        expect(parseLogKey(`1-${uuid}-x`)).toBeNull();
    });
});

describe('parseMaxSets', () => {
    it('takes the last number from a range', () => {
        expect(parseMaxSets('3–4')).toBe(4);
        expect(parseMaxSets('2–3')).toBe(3);
    });

    it('handles a single number', () => {
        expect(parseMaxSets('4')).toBe(4);
    });

    it('falls back to 3 for unparseable input', () => {
        expect(parseMaxSets('invalid')).toBe(3);
        expect(parseMaxSets('')).toBe(3);
    });
});

describe('buildHistory', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

    it('returns empty array for empty logs', () => {
        expect(buildHistory({})).toEqual([]);
    });

    it('ignores entries where saved is false', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 10, rir: 3, saved: false },
        };
        expect(buildHistory(logs)).toEqual([]);
    });

    it('groups saved entries by week', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 10, rir: 3, saved: true },
            [`1-${UUID_A}-1`]: { kg: 62, reps: 8, rir: 2, saved: true },
            [`1-${UUID_B}-0`]: { kg: 50, reps: 12, rir: 3, saved: true },
        };
        const history = buildHistory(logs);
        expect(history).toHaveLength(1);
        expect(history[0].week).toBe(1);
        expect(history[0].sets).toHaveLength(3);
    });

    it('sorts sessions descending by week', () => {
        const logs: Logs = {
            [`3-${UUID_A}-0`]: { kg: 70, reps: 8, rir: 2, saved: true },
            [`1-${UUID_A}-0`]: { kg: 60, reps: 10, rir: 3, saved: true },
        };
        const history = buildHistory(logs);
        expect(history[0].week).toBe(3);
        expect(history[1].week).toBe(1);
    });
});

describe('calcE1RM', () => {
    it('returns kg unchanged for 0 reps', () => {
        expect(calcE1RM(100, 0)).toBeCloseTo(100);
    });
    it('applies Epley formula correctly', () => {
        expect(calcE1RM(60, 10)).toBeCloseTo(80); // 60 * (1 + 10/30)
        expect(calcE1RM(100, 5)).toBeCloseTo(116.67);
    });
});

describe('computePRMap', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

    it('returns empty map for empty logs', () => {
        expect(computePRMap({})).toEqual({});
    });
    it('finds best e1RM per exercise across weeks', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`2-${UUID_A}-0`]: { kg: 65, reps: 6, rir: 2, saved: true },
        };
        const map = computePRMap(logs);
        expect(map[UUID_A]).toBeGreaterThan(calcE1RM(60, 8));
        expect(map[UUID_A]).toBeCloseTo(calcE1RM(65, 6));
    });
    it('ignores unsaved entries', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 200, reps: 20, rir: 0, saved: false },
        };
        expect(computePRMap(logs)).toEqual({});
    });
    it('keeps separate keys per exercise', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`1-${UUID_B}-0`]: { kg: 40, reps: 12, rir: 3, saved: true },
        };
        const map = computePRMap(logs);
        expect(map[UUID_A]).toBeDefined();
        expect(map[UUID_B]).toBeDefined();
        expect(map[UUID_A]).not.toBeCloseTo(map[UUID_B]);
    });
});

describe('computeStreak', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';

    it('returns 0 for empty logs', () => {
        expect(computeStreak({})).toBe(0);
    });
    it('counts consecutive weeks from the most recent', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`2-${UUID_A}-0`]: { kg: 62, reps: 8, rir: 3, saved: true },
            [`3-${UUID_A}-0`]: { kg: 65, reps: 8, rir: 2, saved: true },
        };
        expect(computeStreak(logs)).toBe(3);
    });
    it('stops at the first gap', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`3-${UUID_A}-0`]: { kg: 65, reps: 8, rir: 2, saved: true },
        };
        expect(computeStreak(logs)).toBe(1);
    });
    it('ignores unsaved entries when counting', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`2-${UUID_A}-0`]: { kg: 62, reps: 8, rir: 3, saved: false },
            [`3-${UUID_A}-0`]: { kg: 65, reps: 8, rir: 2, saved: true },
        };
        expect(computeStreak(logs)).toBe(1);
    });
});

describe('computeSuggestion', () => {
    it('returns null when no previous entry', () => {
        expect(computeSuggestion(undefined, 3)).toBeNull();
    });
    it('returns null for week 1 (no previous week)', () => {
        expect(computeSuggestion({ kg: 60, reps: 8, rir: 3, saved: true }, 1)).toBeNull();
    });
    it('suggests +2.5 when previous RIR exceeded the target', () => {
        // week 2: prevTarget = getRIR(1) = 3, rir = 4 > 3
        expect(computeSuggestion({ kg: 60, reps: 8, rir: 4, saved: true }, 2)).toBe(62.5);
    });
    it('suggests same weight when previous RIR matched the target', () => {
        // week 2: prevTarget = 3, rir = 3
        expect(computeSuggestion({ kg: 60, reps: 8, rir: 3, saved: true }, 2)).toBe(60);
    });
    it('suggests -2.5 when previous RIR was below the target', () => {
        // week 2: prevTarget = 3, rir = 2 < 3
        expect(computeSuggestion({ kg: 60, reps: 8, rir: 2, saved: true }, 2)).toBe(57.5);
    });
    it('never suggests below 0.5 kg', () => {
        expect(computeSuggestion({ kg: 2, reps: 8, rir: 1, saved: true }, 2)).toBe(0.5);
    });
});

describe('computeProgression', () => {
    it('returns null on week 1 or with no previous entry', () => {
        expect(computeProgression(undefined, '8-12', 3)).toBeNull();
        expect(computeProgression({ kg: 60, reps: 8, rir: 3, saved: true }, '8-12', 1)).toBeNull();
    });

    it('adds a rep when mid-range and the set met target RIR', () => {
        // week 2 → targetRIR = getRIR(1) = 3; rir 3 >= 3, reps 8 < hi 12 → same kg, reps+1
        expect(computeProgression({ kg: 60, reps: 8, rir: 3, saved: true }, '8-12', 2)).toEqual({
            kg: 60,
            reps: 9,
        });
    });

    it('adds weight and resets reps to the bottom when the top of the range is reached', () => {
        // rir 3 >= 3, reps 12 >= hi 12 → +2.5 kg, reps reset to lo 8
        expect(computeProgression({ kg: 60, reps: 12, rir: 3, saved: true }, '8-12', 2)).toEqual({
            kg: 62.5,
            reps: 8,
        });
    });

    it('adds weight when the set was easier than target at the top of the range', () => {
        // rir 4 > 3, reps 12 >= 12 → +2.5, reps 8
        expect(computeProgression({ kg: 60, reps: 12, rir: 4, saved: true }, '8-12', 2)).toEqual({
            kg: 62.5,
            reps: 8,
        });
    });

    it('deloads weight and resets reps when the set was harder than target', () => {
        // rir 2 < 3 → kg-2.5, reps reset to lo 8
        expect(computeProgression({ kg: 60, reps: 8, rir: 2, saved: true }, '8-12', 2)).toEqual({
            kg: 57.5,
            reps: 8,
        });
    });

    it('clamps the deload to MIN_KG', () => {
        expect(computeProgression({ kg: 2, reps: 8, rir: 1, saved: true }, '8-12', 2)).toEqual({
            kg: 0.5,
            reps: 8,
        });
    });

    it('bodyweight: progresses by reps and keeps the load, never adding weight', () => {
        // rir met → one more rep, no hi cap (you cannot add load to bodyweight)
        expect(computeProgression({ kg: 0, reps: 12, rir: 3, saved: true }, '8-12', 2, true)).toEqual({
            kg: 0,
            reps: 13,
        });
        // any added load is preserved, still rep progression
        expect(computeProgression({ kg: 10, reps: 8, rir: 3, saved: true }, '8-12', 2, true)).toEqual({
            kg: 10,
            reps: 9,
        });
        // harder than target eases reps to the range bottom; the load never drops
        expect(computeProgression({ kg: 0, reps: 10, rir: 1, saved: true }, '8-12', 2, true)).toEqual({
            kg: 0,
            reps: 8,
        });
    });

    it('treats a single-number rep target as linear weight progression', () => {
        // lo === hi === 8; reps 8 >= 8 and rir met → weight bump
        expect(computeProgression({ kg: 60, reps: 8, rir: 3, saved: true }, '8', 2)).toEqual({
            kg: 62.5,
            reps: 8,
        });
    });

    it('falls back to last-session reps when the range string has no numbers', () => {
        // no numbers → lo = hi = previous reps (8); reps 8 >= 8 → weight bump (backward compatible)
        expect(computeProgression({ kg: 60, reps: 8, rir: 3, saved: true }, '', 2)).toEqual({
            kg: 62.5,
            reps: 8,
        });
    });
});

describe('weekHasData', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';

    it('returns true when a saved entry exists for the week', () => {
        const logs: Logs = { [`3-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 2, saved: true } };
        expect(weekHasData(3, logs)).toBe(true);
    });
    it('returns false when no saved entries exist for the week', () => {
        expect(weekHasData(3, {})).toBe(false);
    });
    it('returns false when entry exists but is not saved', () => {
        const logs: Logs = { [`3-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 2, saved: false } };
        expect(weekHasData(3, logs)).toBe(false);
    });
});

describe('computeVolumeByTypeAndWeek', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

    function re(id: string, workout_type: WorkoutType): RoutineExercise {
        return {
            id,
            routine_id: 'r1',
            exercise_id: 'e1',
            workout_type,
            variant: null,
            order: 0,
            sets: '3',
            reps: '8',
            starting_weight_kg: null,
            superset_group_id: null,
            exercise: {
                id: 'e1',
                name: 'Bench Press',
                category: 'chest',
                default_sets: '3',
                default_reps: '8',
                user_id: null,
            },
        };
    }

    it('returns empty record for empty logs', () => {
        expect(computeVolumeByTypeAndWeek({}, [])).toEqual({});
    });

    it('ignores unsaved entries', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: false },
        };
        expect(computeVolumeByTypeAndWeek(logs, [re(UUID_A, 'push')])).toEqual({});
    });

    it('counts one set per saved entry, grouped by workout type', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`1-${UUID_A}-1`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`1-${UUID_B}-0`]: { kg: 40, reps: 12, rir: 3, saved: true },
        };
        const result = computeVolumeByTypeAndWeek(logs, [re(UUID_A, 'push'), re(UUID_B, 'pull')]);
        expect(result[1]).toEqual({ push: 2, pull: 1 });
    });

    it('separates weeks correctly', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`2-${UUID_A}-0`]: { kg: 62, reps: 8, rir: 3, saved: true },
        };
        const result = computeVolumeByTypeAndWeek(logs, [re(UUID_A, 'push')]);
        expect(result[1]).toEqual({ push: 1 });
        expect(result[2]).toEqual({ push: 1 });
    });

    it('skips entries whose routineExerciseId is not in the supplied list', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
        };
        expect(computeVolumeByTypeAndWeek(logs, [])).toEqual({});
    });
});

describe('computeE1RMHistory', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

    it('returns empty array for empty logs', () => {
        expect(computeE1RMHistory({}, UUID_A)).toEqual([]);
    });

    it('only includes entries for the requested routineExerciseId', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`1-${UUID_B}-0`]: { kg: 80, reps: 5, rir: 2, saved: true },
        };
        const result = computeE1RMHistory(logs, UUID_A);
        expect(result).toHaveLength(1);
        expect(result[0].week).toBe(1);
        expect(result[0].e1rm).toBeCloseTo(calcE1RM(60, 8));
    });

    it('picks best e1RM per week when multiple sets exist', () => {
        const logs: Logs = {
            [`2-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`2-${UUID_A}-1`]: { kg: 65, reps: 6, rir: 2, saved: true },
        };
        const result = computeE1RMHistory(logs, UUID_A);
        expect(result).toHaveLength(1);
        expect(result[0].e1rm).toBeCloseTo(calcE1RM(65, 6));
    });

    it('returns entries sorted ascending by week', () => {
        const logs: Logs = {
            [`3-${UUID_A}-0`]: { kg: 70, reps: 6, rir: 2, saved: true },
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`2-${UUID_A}-0`]: { kg: 65, reps: 7, rir: 3, saved: true },
        };
        const result = computeE1RMHistory(logs, UUID_A);
        expect(result.map((p) => p.week)).toEqual([1, 2, 3]);
    });

    it('ignores unsaved entries', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: false },
        };
        expect(computeE1RMHistory(logs, UUID_A)).toEqual([]);
    });
});

describe('computeBestSets', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

    it('returns empty record for empty logs', () => {
        expect(computeBestSets({})).toEqual({});
    });

    it('returns the set with the highest e1RM per exercise', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`2-${UUID_A}-0`]: { kg: 65, reps: 6, rir: 2, saved: true },
        };
        const result = computeBestSets(logs);
        expect(result[UUID_A]).toBeDefined();
        expect(result[UUID_A].kg).toBe(65);
        expect(result[UUID_A].week).toBe(2);
        expect(result[UUID_A].e1rm).toBeCloseTo(calcE1RM(65, 6));
    });

    it('ignores unsaved entries', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 200, reps: 20, rir: 0, saved: false },
        };
        expect(computeBestSets(logs)).toEqual({});
    });

    it('tracks separate best sets per exercise', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: true },
            [`1-${UUID_B}-0`]: { kg: 40, reps: 12, rir: 3, saved: true },
        };
        const result = computeBestSets(logs);
        expect(result[UUID_A].kg).toBe(60);
        expect(result[UUID_B].kg).toBe(40);
    });
});

describe('computeLastSession', () => {
    const UUID_A = 'aaaaaaaa-0000-4000-8000-000000000001';
    const UUID_B = 'bbbbbbbb-0000-4000-8000-000000000002';

    it('returns null when logs are empty', () => {
        expect(computeLastSession({}, UUID_A, 2)).toBeNull();
    });

    it('returns null when currentWeek is 1 (no previous weeks possible)', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 80, reps: 8, rir: 2, saved: true },
        };
        expect(computeLastSession(logs, UUID_A, 1)).toBeNull();
    });

    it('returns null when only the current week has data for this exercise', () => {
        const logs: Logs = {
            [`2-${UUID_A}-0`]: { kg: 80, reps: 8, rir: 2, saved: true },
        };
        expect(computeLastSession(logs, UUID_A, 2)).toBeNull();
    });

    it('returns the previous week session data', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 80, reps: 8, rir: 2, saved: true },
            [`1-${UUID_A}-1`]: { kg: 80, reps: 8, rir: 2, saved: true },
            [`1-${UUID_A}-2`]: { kg: 75, reps: 10, rir: 3, saved: true },
        };
        const result = computeLastSession(logs, UUID_A, 2);
        expect(result).toEqual({ kg: 80, reps: 8, setCount: 3 });
    });

    it('picks the most recent previous week when multiple weeks have data', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 10, rir: 3, saved: true },
            [`3-${UUID_A}-0`]: { kg: 80, reps: 8, rir: 2, saved: true },
        };
        const result = computeLastSession(logs, UUID_A, 4);
        expect(result).toEqual({ kg: 80, reps: 8, setCount: 1 });
    });

    it('ignores unsaved sets', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 80, reps: 8, rir: 2, saved: false },
        };
        expect(computeLastSession(logs, UUID_A, 2)).toBeNull();
    });

    it('ignores data for other exercises', () => {
        const logs: Logs = {
            [`1-${UUID_B}-0`]: { kg: 80, reps: 8, rir: 2, saved: true },
        };
        expect(computeLastSession(logs, UUID_A, 2)).toBeNull();
    });

    it('returns null if all previous-week sets for this exercise are unsaved', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 80, reps: 8, rir: 2, saved: false },
            [`1-${UUID_A}-1`]: { kg: 80, reps: 8, rir: 2, saved: false },
        };
        expect(computeLastSession(logs, UUID_A, 2)).toBeNull();
    });
});

describe('computeLastSessionMap', () => {
    const UUID_A = 'aaaaaaaa-0000-4000-8000-000000000001';
    const UUID_B = 'bbbbbbbb-0000-4000-8000-000000000002';

    it('builds the same per-exercise result as computeLastSession in one pass', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 10, rir: 3, saved: true },
            [`3-${UUID_A}-0`]: { kg: 80, reps: 8, rir: 2, saved: true },
            [`3-${UUID_A}-1`]: { kg: 80, reps: 7, rir: 1, saved: true },
            [`2-${UUID_B}-0`]: { kg: 40, reps: 12, rir: 3, saved: true },
        };
        const map = computeLastSessionMap(logs, 4);
        expect(map.get(UUID_A)).toEqual(computeLastSession(logs, UUID_A, 4));
        expect(map.get(UUID_A)).toEqual({ kg: 80, reps: 8, setCount: 2 });
        expect(map.get(UUID_B)).toEqual({ kg: 40, reps: 12, setCount: 1 });
    });

    it('excludes the current and later weeks and unsaved sets', () => {
        const logs: Logs = {
            [`2-${UUID_A}-0`]: { kg: 80, reps: 8, rir: 2, saved: true }, // current week, excluded
            [`1-${UUID_A}-0`]: { kg: 70, reps: 9, rir: 2, saved: false }, // unsaved, excluded
        };
        expect(computeLastSessionMap(logs, 2).has(UUID_A)).toBe(false);
    });
});

describe('computeWarmupSets', () => {
    it('returns empty array for weight below 40 kg', () => {
        expect(computeWarmupSets(39.5, 'kg')).toEqual([]);
        expect(computeWarmupSets(0, 'kg')).toEqual([]);
    });

    it('returns 3 sets for exactly 40 kg', () => {
        expect(computeWarmupSets(40, 'kg')).toHaveLength(3);
    });

    it('returns 3 sets at 50/65/80 percent for 100 kg working weight', () => {
        const sets = computeWarmupSets(100, 'kg');
        expect(sets).toHaveLength(3);
        expect(sets[0]).toEqual({ percent: 50, displayWeight: 50, reps: 5 });
        expect(sets[1]).toEqual({ percent: 65, displayWeight: 65, reps: 3 });
        expect(sets[2]).toEqual({ percent: 80, displayWeight: 80, reps: 1 });
    });

    it('rounds each step to the nearest 2.5 kg', () => {
        // 50% of 101 = 50.5 → 50.0, 65% of 101 = 65.65 → 65.0, 80% of 101 = 80.8 → 80.0
        const sets = computeWarmupSets(101, 'kg');
        expect(sets[0].displayWeight).toBe(50);
        expect(sets[1].displayWeight).toBe(65);
        expect(sets[2].displayWeight).toBe(80);
    });

    it('rounds lbs values to the nearest 5', () => {
        // 100 kg: 50% = 50 kg → 110.2 lbs → 110, 65% = 65 kg → 143.3 lbs → 145, 80% = 80 kg → 176.4 lbs → 175
        const sets = computeWarmupSets(100, 'lbs');
        expect(sets[0].displayWeight).toBe(110);
        expect(sets[1].displayWeight).toBe(145);
        expect(sets[2].displayWeight).toBe(175);
    });
});

describe('computeShareStats', () => {
    const RE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
    const RE_ID_2 = 'bbbbbbbb-0000-4000-8000-000000000002';

    const session: WorkoutSession = {
        id: 'sess-1',
        user_id: 'u1',
        routine_id: 'r1',
        workout_type: 'push',
        variant: null,
        started_at: '2026-05-30T10:00:00.000Z',
        completed_at: null,
        session_rpe: null,
        session_note: null,
    };
    const completedAt = '2026-05-30T10:47:00.000Z';

    const exercises: RoutineExercise[] = [
        {
            id: RE_ID,
            routine_id: 'r1',
            exercise_id: 'ex-1',
            workout_type: 'push',
            variant: null,
            order: 0,
            sets: '3',
            reps: '8',
            starting_weight_kg: null,
            superset_group_id: null,
            exercise: {
                id: 'ex-1',
                name: 'Bench Press',
                category: 'chest',
                default_sets: '3',
                default_reps: '8',
                user_id: null,
            },
        },
        {
            id: RE_ID_2,
            routine_id: 'r1',
            exercise_id: 'ex-2',
            workout_type: 'push',
            variant: null,
            order: 1,
            sets: '3',
            reps: '12',
            starting_weight_kg: null,
            superset_group_id: null,
            exercise: {
                id: 'ex-2',
                name: 'Overhead Press',
                category: 'shoulders',
                default_sets: '3',
                default_reps: '12',
                user_id: null,
            },
        },
    ];

    const logs: Logs = {
        [`3-${RE_ID}-0`]: { kg: 100, reps: 8, rir: 2, saved: true },
        [`3-${RE_ID}-1`]: { kg: 100, reps: 7, rir: 2, saved: true },
        [`3-${RE_ID}-2`]: { kg: 97.5, reps: 8, rir: 2, saved: true },
        [`3-${RE_ID_2}-0`]: { kg: 60, reps: 10, rir: 2, saved: true },
    };

    it('computes workoutLabel from workout_type', () => {
        const stats = computeShareStats(session, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.workoutLabel).toBe('Push Day');
    });

    it('appends variant to workoutLabel when session has a variant', () => {
        const variantSession = { ...session, variant: 'A' as const };
        const stats = computeShareStats(variantSession, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.workoutLabel).toBe('Push Day · Variant A');
    });

    it('handles full_body workout type', () => {
        const s = { ...session, workout_type: 'full_body' };
        const stats = computeShareStats(s, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.workoutLabel).toBe('Full Body');
    });

    it('computes duration in minutes', () => {
        const stats = computeShareStats(session, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.durationMin).toBe(47);
    });

    it('returns 0 duration for invalid timestamps', () => {
        const bad = { ...session, started_at: 'not-a-date' };
        const stats = computeShareStats(bad, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.durationMin).toBe(0);
    });

    it('counts total saved sets for this week and these exercises only', () => {
        const logsWithNoise: Logs = {
            ...logs,
            [`2-${RE_ID}-0`]: { kg: 95, reps: 8, rir: 3, saved: true },
            [`3-${RE_ID}-3`]: { kg: 100, reps: 8, rir: 2, saved: false },
        };
        const stats = computeShareStats(session, completedAt, exercises, logsWithNoise, {}, 3, 'kg');
        expect(stats.totalSets).toBe(4);
    });

    it('returns up to 3 top lifts sorted by e1RM descending', () => {
        const stats = computeShareStats(session, completedAt, exercises, logs, {}, 3, 'kg');
        expect(stats.topLifts).toHaveLength(2);
        expect(stats.topLifts[0].name).toBe('Bench Press');
        expect(stats.topLifts[1].name).toBe('Overhead Press');
    });

    it('picks the best set per exercise (not one row per set)', () => {
        const stats = computeShareStats(session, completedAt, exercises, logs, {}, 3, 'kg');
        const bench = stats.topLifts.find((l) => l.name === 'Bench Press')!;
        expect(bench.reps).toBe(8);
        expect(bench.displayWeight).toBe(100);
    });

    it('marks isPR true when the best set e1RM matches the prMap entry', () => {
        const prMap = { [RE_ID]: calcE1RM(100, 8) };
        const stats = computeShareStats(session, completedAt, exercises, logs, prMap, 3, 'kg');
        const bench = stats.topLifts.find((l) => l.name === 'Bench Press')!;
        expect(bench.isPR).toBe(true);
    });

    it('marks isPR false when e1RM is below the prMap entry', () => {
        const prMap = { [RE_ID]: calcE1RM(120, 8) };
        const stats = computeShareStats(session, completedAt, exercises, logs, prMap, 3, 'kg');
        const bench = stats.topLifts.find((l) => l.name === 'Bench Press')!;
        expect(bench.isPR).toBe(false);
    });

    it('counts prCount across all exercises not just topLifts slice', () => {
        const prMap = {
            [RE_ID]: calcE1RM(100, 8),
            [RE_ID_2]: calcE1RM(60, 10),
        };
        const stats = computeShareStats(session, completedAt, exercises, logs, prMap, 3, 'kg');
        expect(stats.prCount).toBe(2);
    });

    it('returns displayWeight in lbs when unit is lbs', () => {
        const stats = computeShareStats(session, completedAt, exercises, logs, {}, 3, 'lbs');
        const bench = stats.topLifts.find((l) => l.name === 'Bench Press')!;
        expect(bench.displayWeight).toBeCloseTo(220.5, 0);
    });
});

describe('isSetPR', () => {
    const prMap = { 'ex-1': 100 }; // best e1rm for ex-1 is 100
    it('is true when the set e1rm meets the exercise best', () => {
        // calcE1RM(80,10) ~= 106.7 > 100
        expect(isSetPR(80, 10, 'ex-1', prMap)).toBe(true);
    });
    it('is false when below the best', () => {
        // calcE1RM(50,5) ~= 58.3 < 100
        expect(isSetPR(50, 5, 'ex-1', prMap)).toBe(false);
    });
    it('is false when there is no recorded best (>0 guard)', () => {
        expect(isSetPR(80, 10, 'ex-unknown', prMap)).toBe(false);
    });
    it('is false for non-positive weight or reps', () => {
        expect(isSetPR(0, 10, 'ex-1', prMap)).toBe(false);
        expect(isSetPR(80, 0, 'ex-1', prMap)).toBe(false);
    });
});

describe('computePerMuscleVolume', () => {
    // parseLogKey requires the middle segment to be a valid UUID, so use real
    // UUIDs for the routineExercise ids the keys reference.
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const UUID_B = '550e8400-e29b-41d4-a716-446655440001';
    // routineExercise -> exercise.category mapping
    const res = [
        { id: UUID_A, exercise: { category: 'chest' } },
        { id: UUID_B, exercise: { category: 'back' } },
    ] as unknown as RoutineExercise[];
    const logs: Logs = {
        [logKey(3, UUID_A, 0)]: { kg: 20, reps: 10, rir: 2, saved: true },
        [logKey(3, UUID_A, 1)]: { kg: 20, reps: 10, rir: 2, saved: true },
        [logKey(3, UUID_B, 0)]: { kg: 30, reps: 8, rir: 1, saved: true },
        [logKey(2, UUID_A, 0)]: { kg: 20, reps: 10, rir: 2, saved: true }, // other week, ignored
        [logKey(3, UUID_A, 2)]: { kg: 20, reps: 10, rir: 2, saved: false }, // unsaved, ignored
    };
    it('counts saved sets per category for the given week', () => {
        const out = computePerMuscleVolume(logs, res, 3);
        expect(out.chest).toBe(2);
        expect(out.back).toBe(1);
    });
    it('returns 0 for categories with no sets that week', () => {
        const out = computePerMuscleVolume(logs, res, 3);
        expect(out.legs ?? 0).toBe(0);
    });
    it('credits bucketed pattern secondaries on top of the 1.0 primary', () => {
        const fres = [
            { id: UUID_A, exercise: { category: 'chest', movement_pattern: 'horizontal_push' } },
        ] as unknown as RoutineExercise[];
        const flogs: Logs = {
            [logKey(3, UUID_A, 0)]: { kg: 60, reps: 8, rir: 2, saved: true },
            [logKey(3, UUID_A, 1)]: { kg: 60, reps: 8, rir: 2, saved: true },
        };
        const out = computePerMuscleVolume(flogs, fres, 3);
        expect(out.chest).toBe(2); // primary 1.0 x2
        expect(out.triceps).toBe(1); // secondary 0.5 x2
        expect(out.shoulders).toBe(1); // secondary 0.5 x2
    });
    it('falls back to primary-only when the exercise has no movement_pattern', () => {
        const out = computePerMuscleVolume(logs, res, 3);
        expect(out.triceps ?? 0).toBe(0); // res fixtures carry no pattern
    });
});

describe('computeVolumeProgress', () => {
    const targets = { chest: [12, 18], back: [12, 18], biceps: [8, 14] } as Partial<
        Record<import('../types').ExerciseCategory, [number, number]>
    >;
    it('returns a row per targeted muscle with actual, range, and to-go, lagging first', () => {
        const rows = computeVolumeProgress({ chest: 14, biceps: 2 }, targets);
        expect(rows.map((r) => r.category)).toEqual(['back', 'biceps', 'chest']); // toGo 12, 6, 0
        expect(rows.find((r) => r.category === 'chest')).toMatchObject({ actual: 14, min: 12, max: 18, toGo: 0 });
        expect(rows.find((r) => r.category === 'biceps')).toMatchObject({ actual: 2, toGo: 6 });
        expect(rows.find((r) => r.category === 'back')).toMatchObject({ actual: 0, toGo: 12 });
    });
    it('clamps to-go at zero when the floor is met or exceeded', () => {
        const rows = computeVolumeProgress({ chest: 20 }, { chest: [12, 18] } as typeof targets);
        expect(rows[0].toGo).toBe(0);
    });
});

describe('computeRecoveryFlags', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const UUID_B = '550e8400-e29b-41d4-a716-446655440001';
    const res = [
        { id: UUID_A, exercise: { category: 'chest' } },
        { id: UUID_B, exercise: { category: 'back' } },
    ] as unknown as RoutineExercise[];
    const targets = { chest: [4, 8], back: [4, 8] } as Partial<
        Record<import('../types').ExerciseCategory, [number, number]>
    >;

    it('flags under when sets are below min (including 0 sets)', () => {
        // 2 chest sets (below min 4), 0 back sets
        const logs: Logs = {
            [logKey(3, UUID_A, 0)]: { kg: 20, reps: 10, rir: 2, saved: true },
            [logKey(3, UUID_A, 1)]: { kg: 20, reps: 10, rir: 2, saved: true },
        };
        const out = computeRecoveryFlags(logs, res, 3, targets);
        expect(out.chest?.status).toBe('under');
        expect(out.back?.status).toBe('under');
        // detail: 2 of 4 chest sets logged -> 2 to go; back has none logged -> 4 to go
        expect(out.chest).toMatchObject({ sets: 2, toGo: 2, min: 4, max: 8 });
        expect(out.back).toMatchObject({ sets: 0, toGo: 4, avgRir: null });
    });

    it('flags overreaching when sets exceed max', () => {
        const logs: Logs = {};
        for (let i = 0; i < 9; i++) logs[logKey(3, UUID_A, i)] = { kg: 20, reps: 10, rir: 2, saved: true };
        const out = computeRecoveryFlags(logs, res, 3, targets);
        expect(out.chest?.status).toBe('overreaching');
    });

    it('flags high_fatigue when in range with avgRir <= 0.5', () => {
        const logs: Logs = {};
        for (let i = 0; i < 5; i++) logs[logKey(3, UUID_A, i)] = { kg: 20, reps: 10, rir: 0, saved: true };
        const out = computeRecoveryFlags(logs, res, 3, targets);
        expect(out.chest?.status).toBe('high_fatigue');
        expect(out.chest?.avgRir).toBe(0);
    });

    it('flags optimal when in range with avgRir > 0.5', () => {
        const logs: Logs = {};
        for (let i = 0; i < 5; i++) logs[logKey(3, UUID_A, i)] = { kg: 20, reps: 10, rir: 2, saved: true };
        const out = computeRecoveryFlags(logs, res, 3, targets);
        expect(out.chest?.status).toBe('optimal');
    });

    it('ignores other weeks and unsaved sets', () => {
        const logs: Logs = {
            [logKey(3, UUID_A, 0)]: { kg: 20, reps: 10, rir: 2, saved: true },
            [logKey(2, UUID_A, 1)]: { kg: 20, reps: 10, rir: 2, saved: true },
            [logKey(3, UUID_A, 2)]: { kg: 20, reps: 10, rir: 2, saved: false },
        };
        const out = computeRecoveryFlags(logs, res, 3, targets);
        // only 1 saved set this week -> below min -> under
        expect(out.chest?.status).toBe('under');
    });

    it('counts fractional secondaries and keeps avgRir a true RIR average', () => {
        const fres = [
            { id: UUID_A, exercise: { category: 'chest', movement_pattern: 'horizontal_push' } },
        ] as unknown as RoutineExercise[];
        const ftargets = { chest: [4, 8], triceps: [1, 3] } as Partial<
            Record<import('../types').ExerciseCategory, [number, number]>
        >;
        const logs: Logs = {};
        for (let i = 0; i < 4; i++) logs[logKey(3, UUID_A, i)] = { kg: 60, reps: 8, rir: 1, saved: true };
        const out = computeRecoveryFlags(logs, fres, 3, ftargets);
        expect(out.chest?.sets).toBe(4); // primary 1.0 x4
        expect(out.triceps?.sets).toBe(2); // secondary 0.5 x4
        expect(out.triceps?.status).toBe('optimal'); // 2 within [1,3]
        // avgRir divides by the per-category RIR COUNT (4), not the fractional volume (2)
        expect(out.triceps?.avgRir).toBe(1);
    });
});

describe('computePlates', () => {
    it('barbell: returns per-side plates for an achievable weight', () => {
        // 60 kg on a 20 kg bar -> 20 kg per side -> [20]
        expect(computePlates(60, 'barbell')).toEqual({ perSide: [20], achievable: true, remainderKg: 0 });
    });
    it('barbell: greedy multi-plate breakdown', () => {
        // 100 kg -> 40 per side -> [25,15]
        expect(computePlates(100, 'barbell')).toEqual({ perSide: [25, 15], achievable: true, remainderKg: 0 });
    });
    it('barbell: marks unachievable remainder', () => {
        // 61 kg -> 20.5 per side -> [20] with 0.5 remainder
        const r = computePlates(61, 'barbell');
        expect(r.achievable).toBe(false);
        expect(r.remainderKg).toBeCloseTo(0.5, 5);
    });
    it('returns achievable=false below the bar/handle weight', () => {
        expect(computePlates(10, 'barbell').achievable).toBe(false);
        expect(computePlates(2, 'dumbbell').achievable).toBe(false);
    });
    it('dumbbell: uses the handle weight', () => {
        // 12.5 kg dumbbell on 2.5 handle -> 5 per side -> [5]
        expect(computePlates(12.5, 'dumbbell')).toEqual({ perSide: [5], achievable: true, remainderKg: 0 });
    });
});

// ── groupExercises ────────────────────────────────────────────────────────────
import { groupExercises } from '@/lib/pulse/utils';
import type { ExerciseItem } from '@/lib/pulse/types';

function makeRE(id: string, order: number, superset_group_id: string | null = null) {
    return {
        id,
        routine_id: 'r1',
        exercise_id: id,
        workout_type: 'chest' as const,
        order,
        sets: '3',
        reps: '8-12',
        starting_weight_kg: null,
        rest_seconds: null,
        variant: null,
        superset_group_id,
        exercise: { id, name: id, category: 'chest' as const, default_sets: '3', default_reps: '8-12', user_id: null },
    };
}

describe('groupExercises', () => {
    it('returns single exercises unchanged', () => {
        const exercises = [makeRE('a', 1), makeRE('b', 2)];
        const result = groupExercises(exercises);
        expect(result).toHaveLength(2);
        expect(Array.isArray(result[0])).toBe(false);
        expect(Array.isArray(result[1])).toBe(false);
    });

    it('groups adjacent exercises with the same superset_group_id into a pair', () => {
        const gid = 'group-1';
        const exercises = [makeRE('a', 1, gid), makeRE('b', 2, gid), makeRE('c', 3)];
        const result = groupExercises(exercises);
        expect(result).toHaveLength(2);
        expect(Array.isArray(result[0])).toBe(true);
        const pair = result[0] as [(typeof exercises)[0], (typeof exercises)[0]];
        expect(pair[0].id).toBe('a');
        expect(pair[1].id).toBe('b');
        expect(Array.isArray(result[1])).toBe(false);
    });

    it('does not group a solo exercise that has a superset_group_id with no adjacent match', () => {
        const exercises = [makeRE('a', 1, 'group-1'), makeRE('b', 2)];
        const result = groupExercises(exercises);
        expect(result).toHaveLength(2);
        expect(Array.isArray(result[0])).toBe(false);
        expect(Array.isArray(result[1])).toBe(false);
    });

    it('handles multiple pairs in the same list', () => {
        const g1 = 'g1',
            g2 = 'g2';
        const exercises = [makeRE('a', 1, g1), makeRE('b', 2, g1), makeRE('c', 3, g2), makeRE('d', 4, g2)];
        const result = groupExercises(exercises);
        expect(result).toHaveLength(2);
        expect(Array.isArray(result[0])).toBe(true);
        expect(Array.isArray(result[1])).toBe(true);
    });

    it('renders the third member of a 3+ group as a single (never a triplet)', () => {
        const g = 'g1';
        const exercises = [makeRE('a', 1, g), makeRE('b', 2, g), makeRE('c', 3, g)];
        const result = groupExercises(exercises);
        expect(result).toHaveLength(2);
        expect(Array.isArray(result[0])).toBe(true);
        expect(Array.isArray(result[1])).toBe(false);
        expect((result[1] as (typeof exercises)[0]).id).toBe('c');
    });

    it('treats non-adjacent rows of the same group as three singles', () => {
        const g = 'g1';
        const exercises = [makeRE('a', 1, g), makeRE('b', 2), makeRE('c', 3, g)];
        const result = groupExercises(exercises);
        expect(result).toHaveLength(3);
        expect(result.every((r) => !Array.isArray(r))).toBe(true);
    });

    it('groups a pair that sits after a leading single', () => {
        const g = 'g1';
        const exercises = [makeRE('a', 1), makeRE('b', 2, g), makeRE('c', 3, g)];
        const result = groupExercises(exercises);
        expect(result).toHaveLength(2);
        expect(Array.isArray(result[0])).toBe(false);
        const pair = result[1] as [(typeof exercises)[0], (typeof exercises)[0]];
        expect(pair[0].id).toBe('b');
        expect(pair[1].id).toBe('c');
    });

    it('returns an empty array for empty input', () => {
        expect(groupExercises([])).toEqual([]);
    });
});

// ── computeSessionTonnage ─────────────────────────────────────────────────────
const T4_UUID_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const T4_UUID_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const T4_UUID_C = 'cccccccc-0000-4000-8000-000000000003';
const T4_UUID_D = 'dddddddd-0000-4000-8000-000000000004';

describe('computeSessionTonnage', () => {
    const ex = (id: string) => ({ id, exercise: { name: id } }) as any;
    it('sums kg*reps over saved sets for the session exercises in the week', () => {
        const logs = {
            [`1-${T4_UUID_A}-0`]: { kg: 100, reps: 5, rir: 2, saved: true },
            [`1-${T4_UUID_A}-1`]: { kg: 100, reps: 5, rir: 2, saved: true },
            [`1-${T4_UUID_B}-0`]: { kg: 50, reps: 10, rir: 2, saved: true },
            [`2-${T4_UUID_A}-0`]: { kg: 999, reps: 9, rir: 2, saved: true },
            [`1-${T4_UUID_C}-0`]: { kg: 80, reps: 8, rir: 2, saved: true },
        } as any;
        expect(computeSessionTonnage([ex(T4_UUID_A), ex(T4_UUID_B)], logs, 1, 'kg')).toBe(1500);
    });
    it('includes drop sets and ignores unsaved sets', () => {
        const logs = {
            [`1-${T4_UUID_A}-0`]: { kg: 100, reps: 5, rir: 2, saved: true, drops: [{ kg: 80, reps: 5 }] },
            [`1-${T4_UUID_A}-1`]: { kg: 100, reps: 5, rir: 2, saved: false },
        } as any;
        expect(computeSessionTonnage([ex(T4_UUID_A)], logs, 1, 'kg')).toBe(900);
    });
});

// ── sessionDecisions ──────────────────────────────────────────────────────────
describe('sessionDecisions', () => {
    const d = (over: Partial<any>) =>
        ({
            type: 'progression',
            trigger: 'targets_hit',
            affectedArea: 'a',
            week: 1,
            magnitude: {},
            confidence: null,
            id: 'x',
            routine_id: 'r',
            created_at: '',
            ...over,
        }) as any;
    it('buckets by type, scoped to the week and the session exercises', () => {
        const decisions = [
            d({ type: 'progression', affectedArea: 'a', week: 1 }),
            d({ type: 'deload', affectedArea: 'b', week: 1 }),
            d({ type: 'progression', affectedArea: 'c', week: 1 }),
            d({ type: 'progression', affectedArea: 'a', week: 2 }),
            d({ type: 'ramp_back', affectedArea: '', week: 1 }),
        ];
        const out = sessionDecisions(decisions, 1, new Set(['a', 'b']));
        expect(out.progressions.map((x) => x.affectedArea)).toEqual(['a']);
        expect(out.deloads.map((x) => x.affectedArea)).toEqual(['b']);
        expect(out.rampBack).toHaveLength(1);
    });
});

// ── composeCoachRead ──────────────────────────────────────────────────────────
describe('composeCoachRead', () => {
    it('ramp-back wins over everything', () => {
        expect(composeCoachRead({ prCount: 2, progressionCount: 3, deloadCount: 1, rampBack: true })).toMatch(
            /ramp-back/i,
        );
    });
    it('celebrates PRs and progressions with the deload clause', () => {
        const s = composeCoachRead({ prCount: 1, progressionCount: 3, deloadCount: 1, rampBack: false });
        expect(s).toMatch(/new PR/i);
        expect(s).toMatch(/progressed 3 lifts/i);
        expect(s).toMatch(/backed off/i);
    });
    it('frames a deload-only session as a smart call', () => {
        expect(composeCoachRead({ prCount: 0, progressionCount: 0, deloadCount: 1, rampBack: false })).toMatch(
            /smart/i,
        );
    });
    it('falls back to steady on-plan when nothing happened', () => {
        expect(composeCoachRead({ prCount: 0, progressionCount: 0, deloadCount: 0, rampBack: false })).toMatch(
            /steady/i,
        );
    });
});

// ── computeSessionSummary ─────────────────────────────────────────────────────
const T7_UUID_A = 'aaaaaaaa-1111-4111-8111-111111111111';

describe('computeSessionSummary', () => {
    const session = {
        id: 's',
        user_id: 'u',
        routine_id: 'r',
        workout_type: 'push',
        variant: 'A',
        started_at: '2026-05-30T10:00:00Z',
        completed_at: null,
        session_rpe: null,
        session_note: null,
    } as any;
    const exFull = (id: string, cat: string) =>
        ({ id, sets: '3', reps: '8-12', exercise: { name: id, category: cat } }) as any;
    it('composes stats, tonnage, muscles, decisions and a coach read', () => {
        const exercises = [exFull(T7_UUID_A, 'chest')];
        const logs = { [`1-${T7_UUID_A}-0`]: { kg: 100, reps: 10, rir: 2, saved: true } } as any;
        const prMap = {} as any;
        const decisions = [
            {
                type: 'progression',
                trigger: 'targets_hit',
                affectedArea: T7_UUID_A,
                week: 1,
                magnitude: {},
                confidence: null,
                id: 'd1',
                routine_id: 'r',
                created_at: '',
            },
        ] as any;
        const out = computeSessionSummary(session, '2026-05-30T11:00:00Z', exercises, logs, prMap, 1, 'kg', decisions);
        expect(out.workoutLabel).toMatch(/Variant A/);
        expect(out.tonnage).toBe(1000);
        expect(out.muscles[0].category).toBe('chest');
        expect(out.decisions.progressions).toHaveLength(1);
        expect(out.coachRead).toMatch(/progressed 1 lift/i);
    });
});

describe('computeStrengthByWeek', () => {
    const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
    const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

    it('returns empty array for empty logs', () => {
        expect(computeStrengthByWeek({})).toEqual([]);
    });

    it('ignores unsaved entries', () => {
        const logs: Logs = {
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8, rir: 3, saved: false },
        };
        expect(computeStrengthByWeek(logs)).toEqual([]);
    });

    it('sums best E1RM across slots per week, ascending, with week 2 higher than week 1', () => {
        const logs: Logs = {
            // week 1: A best = calcE1RM(60,0)=60, B best = calcE1RM(30,0)=30 → 90
            [`1-${UUID_A}-0`]: { kg: 60, reps: 0, rir: 3, saved: true },
            [`1-${UUID_A}-1`]: { kg: 50, reps: 0, rir: 3, saved: true }, // not best for A
            [`1-${UUID_B}-0`]: { kg: 30, reps: 0, rir: 3, saved: true },
            // week 2: A best = 70, B best = 40 → 110
            [`2-${UUID_A}-0`]: { kg: 70, reps: 0, rir: 2, saved: true },
            [`2-${UUID_B}-0`]: { kg: 40, reps: 0, rir: 2, saved: true },
        };
        const result = computeStrengthByWeek(logs);
        expect(result).toHaveLength(2);
        expect(result[0].week).toBe(1);
        expect(result[1].week).toBe(2);
        expect(result[0].total).toBeCloseTo(90);
        expect(result[1].total).toBeCloseTo(110);
        expect(result[1].total).toBeGreaterThan(result[0].total);
    });
});

describe('computeRecompSignal', () => {
    function bw(logged_at: string, weight_kg: number): BodyweightEntry {
        return { id: logged_at, logged_at, weight_kg };
    }
    function meas(measured_at: string, waist_cm: number | null): BodyMeasurement {
        return { id: measured_at, measured_at, waist_cm, hips_cm: null, chest_cm: null, arms_cm: null };
    }

    it('flags a strong recomp: strength up, weight steady, waist down', () => {
        const out = computeRecompSignal({
            bodyweight: [bw('2026-01-01', 80), bw('2026-02-01', 80)],
            measurements: [meas('2026-01-01', 85), meas('2026-02-01', 82)],
            strengthByWeek: [
                { week: 1, total: 100 },
                { week: 4, total: 110 },
            ],
        });
        expect(out.strength).toBe('up');
        expect(out.weight).toBe('flat');
        expect(out.waist).toBe('down');
        expect(out.isRecomping).toBe(true);
        expect(out.verdict.startsWith("You're recomping")).toBe(true);
        expect(out.waistDeltaCm).toBeCloseTo(-3);
        expect(out.strengthDeltaPct).toBeCloseTo(10);
    });

    it('returns all none and a prompt verdict for empty inputs', () => {
        const out = computeRecompSignal({ bodyweight: [], measurements: [], strengthByWeek: [] });
        expect(out.weight).toBe('none');
        expect(out.strength).toBe('none');
        expect(out.waist).toBe('none');
        expect(out.isRecomping).toBe(false);
        expect(out.verdict).toBe('Keep logging to see your recomp trend.');
        expect(out.weightDeltaKg).toBeNull();
        expect(out.strengthDeltaPct).toBeNull();
        expect(out.waistDeltaCm).toBeNull();
    });

    it('reports gaining when strength up and weight up', () => {
        const out = computeRecompSignal({
            bodyweight: [bw('2026-01-01', 80), bw('2026-02-01', 84)],
            measurements: [],
            strengthByWeek: [
                { week: 1, total: 100 },
                { week: 4, total: 110 },
            ],
        });
        expect(out.strength).toBe('up');
        expect(out.weight).toBe('up');
        expect(out.isRecomping).toBe(false);
        expect(out.verdict.startsWith('Gaining')).toBe(true);
    });
});

describe('recompStatus', () => {
    // Build a readout with only the fields recompStatus reads.
    type Tr = 'up' | 'down' | 'flat' | 'none';
    const ro = (weight: Tr, strength: Tr, waist: Tr, isRecomping = false) =>
        ({ weight, strength, waist, isRecomping }) as ReturnType<typeof computeRecompSignal>;

    it('returns null when there is no data', () => {
        expect(recompStatus(ro('none', 'none', 'none'))).toBeNull();
    });
    it('reads Recomping (good) when confirmed', () => {
        expect(recompStatus(ro('down', 'up', 'down', true))).toEqual({ word: 'Recomping', tone: 'good' });
    });
    it('reads Recomping (good) when strength up and weight steady, even without waist', () => {
        expect(recompStatus(ro('flat', 'up', 'none'))).toEqual({ word: 'Recomping', tone: 'good' });
    });
    it('reads Gaining (neutral) when strength and weight both rise', () => {
        expect(recompStatus(ro('up', 'up', 'none'))).toEqual({ word: 'Gaining', tone: 'neutral' });
    });
    it('reads Cutting (neutral) when weight drops without strength gains', () => {
        expect(recompStatus(ro('down', 'flat', 'none'))).toEqual({ word: 'Cutting', tone: 'neutral' });
    });
    it('reads Watch (warn) when strength dips while weight rises', () => {
        expect(recompStatus(ro('up', 'down', 'none'))).toEqual({ word: 'Watch', tone: 'warn' });
    });
});

describe('recompDetail', () => {
    it('strips the redundant leading clause when it restates the pill word', () => {
        expect(recompDetail("You're recomping, gaining strength while losing fat.", 'Recomping')).toBe(
            'Gaining strength while losing fat.',
        );
    });
    it('strips a colon-separated lead and keeps the rest verbatim', () => {
        expect(
            recompDetail(
                'Gaining: strength up but weight up too. Tighten nutrition if fat loss is the goal.',
                'Gaining',
            ),
        ).toBe('Strength up but weight up too. Tighten nutrition if fat loss is the goal.');
    });
    it('leaves the sentence intact when the lead does not restate the pill word', () => {
        const v = 'Strength dipping while weight rises, then stalls.';
        expect(recompDetail(v, 'Watch')).toBe(v);
    });
    it('returns the verdict unchanged when there is no status word', () => {
        const v = 'Keep logging to see your recomp trend.';
        expect(recompDetail(v, null)).toBe(v);
    });
});

describe('recompLines', () => {
    const ro = (over: Partial<ReturnType<typeof computeRecompSignal>>) =>
        ({
            weight: 'flat',
            strength: 'up',
            waist: 'down',
            isRecomping: true,
            verdict: '',
            weightDeltaKg: null,
            strengthDeltaPct: null,
            waistDeltaCm: null,
            ...over,
        }) as ReturnType<typeof computeRecompSignal>;

    it('supplies an affirmation description for the single-sentence recomping verdict', () => {
        const out = recompLines(ro({ verdict: "You're recomping, gaining strength while losing fat." }));
        expect(out.headline).toBe('Gaining strength while losing fat.');
        expect(out.description).toBe("This is the hardest result to get, and you're getting it.");
    });
    it('splits a two-sentence verdict into headline + its own next-step', () => {
        const out = recompLines(
            ro({
                weight: 'up',
                strength: 'up',
                waist: 'none',
                isRecomping: false,
                verdict: 'Gaining: strength up but weight up too. Tighten nutrition if fat loss is the goal.',
            }),
        );
        expect(out.headline).toBe('Strength up but weight up too.');
        expect(out.description).toBe('Tighten nutrition if fat loss is the goal.');
    });
    it('splits the Watch verdict into a headline and a next-step description', () => {
        const out = recompLines(
            ro({
                weight: 'up',
                strength: 'down',
                waist: 'none',
                isRecomping: false,
                verdict: 'Strength dipping while weight rises. Check recovery before adding load.',
            }),
        );
        expect(out.headline).toBe('Strength dipping while weight rises.');
        expect(out.description).toBe('Check recovery before adding load.');
    });
    it('returns no description for a single-sentence verdict with no status (no data)', () => {
        const out = recompLines(
            ro({
                weight: 'none',
                strength: 'none',
                waist: 'none',
                isRecomping: false,
                verdict: 'Keep logging to see your recomp trend.',
            }),
        );
        expect(out.headline).toBe('Keep logging to see your recomp trend.');
        expect(out.description).toBeNull();
    });
});

describe('computeRecompTrend', () => {
    const bw = (logged_at: string, weight_kg: number): BodyweightEntry => ({ id: logged_at, logged_at, weight_kg });

    it('returns empty series and null deltas for empty inputs', () => {
        expect(computeRecompTrend({ bodyweight: [], strengthSeries: [] })).toEqual({
            weight: [],
            strength: [],
            weightDeltaKg: null,
            strengthDelta: null,
        });
    });

    it('sorts bodyweight ascending (input is newest-first) and computes the kg delta', () => {
        // newest-first input, as queries.ts returns it
        const out = computeRecompTrend({
            bodyweight: [bw('2026-03-01', 80.2), bw('2026-02-01', 81), bw('2026-01-01', 82)],
            strengthSeries: [],
        });
        expect(out.weight).toEqual([82, 81, 80.2]);
        expect(out.weightDeltaKg).toBeCloseTo(-1.8);
    });

    it('orders strength by week ascending and computes the score delta', () => {
        const out = computeRecompTrend({
            bodyweight: [],
            strengthSeries: [
                { week: 4, score: 59 },
                { week: 1, score: 48 },
                { week: 2, score: 51 },
            ],
        });
        expect(out.strength).toEqual([48, 51, 59]);
        expect(out.strengthDelta).toBe(11);
    });

    it('leaves a single-point series with a null delta', () => {
        const out = computeRecompTrend({
            bodyweight: [bw('2026-01-01', 80)],
            strengthSeries: [{ week: 1, score: 50 }],
        });
        expect(out.weight).toEqual([80]);
        expect(out.weightDeltaKg).toBeNull();
        expect(out.strengthDelta).toBeNull();
    });
});

describe('computeWeeksWithData', () => {
    const UUID = '550e8400-e29b-41d4-a716-446655440000';

    it('returns the set of weeks with at least one saved set', () => {
        const logs: Logs = {
            [`1-${UUID}-0`]: { kg: 60, reps: 8, rir: 2, saved: true },
            [`3-${UUID}-0`]: { kg: 60, reps: 8, rir: 2, saved: true },
            [`2-${UUID}-0`]: { kg: 60, reps: 8, rir: 2, saved: false },
        };
        const weeks = computeWeeksWithData(logs);
        expect(weeks.has(1)).toBe(true);
        expect(weeks.has(3)).toBe(true);
        expect(weeks.has(2)).toBe(false);
        expect(weeks.size).toBe(2);
    });

    it('returns an empty set for empty logs', () => {
        expect(computeWeeksWithData({}).size).toBe(0);
    });
});

describe('sessionTypeFor', () => {
    it('rolls push/pull/legs up to full_body when the routine only schedules full_body', () => {
        const s: WorkoutType[] = ['full_body'];
        expect(sessionTypeFor('push', s)).toBe('full_body');
        expect(sessionTypeFor('pull', s)).toBe('full_body');
        expect(sessionTypeFor('legs', s)).toBe('full_body');
        expect(sessionTypeFor('chest', s)).toBe('full_body');
        expect(sessionTypeFor('full_body', s)).toBe('full_body');
    });

    it('keeps upper/lower distinct and rolls granular types into them', () => {
        const s: WorkoutType[] = ['upper', 'lower'];
        expect(sessionTypeFor('upper', s)).toBe('upper');
        expect(sessionTypeFor('lower', s)).toBe('lower');
        expect(sessionTypeFor('push', s)).toBe('upper');
        expect(sessionTypeFor('chest', s)).toBe('upper');
        expect(sessionTypeFor('legs', s)).toBe('lower');
    });

    it('leaves push/pull/legs as themselves in a PPL routine', () => {
        const s: WorkoutType[] = ['push', 'pull', 'legs'];
        expect(sessionTypeFor('push', s)).toBe('push');
        expect(sessionTypeFor('pull', s)).toBe('pull');
        expect(sessionTypeFor('legs', s)).toBe('legs');
        expect(sessionTypeFor('chest', s)).toBe('push');
    });

    it('falls back to the exercise type when the routine has no schedule', () => {
        expect(sessionTypeFor('chest', [])).toBe('chest');
        expect(sessionTypeFor('full_body', [])).toBe('full_body');
    });
});

describe('swapKey', () => {
    it('joins week and routine exercise id with a dash', () => {
        expect(swapKey(3, 'abc-123')).toBe('3-abc-123');
    });
});

describe('resolveExercise', () => {
    const original = {
        id: 'e1',
        name: 'Leg Press',
        category: 'legs',
        default_sets: '3',
        default_reps: '10',
        user_id: null,
    };
    const sub = {
        id: 'e2',
        name: 'Hack Squat',
        category: 'legs',
        default_sets: '3',
        default_reps: '10',
        user_id: null,
    };
    const re = { id: 'slot1', exercise: original } as unknown as import('../types').RoutineExercise;
    const byId = new Map([
        [original.id, original],
        [sub.id, sub],
    ]) as Map<string, import('../types').DbExercise>;

    it('returns the substitute when a swap exists for the week/slot', () => {
        const swaps = { '4-slot1': 'e2' };
        expect(resolveExercise(re, 4, swaps, byId).name).toBe('Hack Squat');
    });
    it('returns the original when no swap exists', () => {
        expect(resolveExercise(re, 4, {}, byId).name).toBe('Leg Press');
    });
    it('falls back to the original when the substitute is missing from the lookup', () => {
        const swaps = { '4-slot1': 'gone' };
        expect(resolveExercise(re, 4, swaps, byId).name).toBe('Leg Press');
    });
});

describe('swapCandidates', () => {
    const mk = (id: string, name: string, mp: string | null, eq: string[]) =>
        ({
            id,
            name,
            category: 'chest',
            default_sets: '3',
            default_reps: '8',
            user_id: null,
            movement_pattern: mp,
            equipment: eq,
        }) as unknown as import('../types').DbExercise;

    const original = mk('o', 'Barbell Bench', 'horizontal_push', ['barbell', 'bench']);
    const dbBench = mk('a', 'Dumbbell Bench', 'horizontal_push', ['dumbbell', 'bench']);
    const machine = mk('b', 'Machine Press', 'horizontal_push', ['machine']);
    const pushup = mk('c', 'Push-Up', 'horizontal_push', []);
    const row = mk('d', 'Row', 'horizontal_pull', ['dumbbell']);

    it('returns same-movement-pattern exercises, excluding the original', () => {
        const out = swapCandidates(original, [original, dbBench, machine, row], { excludeIds: new Set() });
        expect(out.map((e) => e.id)).toEqual(['a', 'b']);
    });
    it('excludes ids in excludeIds (hidden / already in session)', () => {
        const out = swapCandidates(original, [dbBench, machine], { excludeIds: new Set(['a']) });
        expect(out.map((e) => e.id)).toEqual(['b']);
    });
    it('drops exercises with no movement pattern', () => {
        const noMp = mk('x', 'Mystery', null, []);
        const out = swapCandidates(original, [pushup, noMp], { excludeIds: new Set() });
        expect(out.map((e) => e.id)).toEqual(['c']);
    });
    it('ranks higher equipment overlap first regardless of input order', () => {
        // machine (0 overlap) passed before dbBench (1 overlap: shares "bench")
        const out = swapCandidates(original, [machine, dbBench], { excludeIds: new Set() });
        expect(out.map((e) => e.id)).toEqual(['a', 'b']); // dbBench first by overlap
    });
});

describe('rankSubstitutes', () => {
    const ex = (id: string, over: Partial<DbExercise> = {}): DbExercise => ({
        id,
        name: id,
        category: 'chest',
        default_sets: '3',
        default_reps: '8',
        user_id: null,
        movement_pattern: 'horizontal_push',
        equipment: [],
        is_compound: true,
        substitution_class: null,
        contraindications: [],
        ...over,
    });
    const original = ex('orig', { substitution_class: 'horizontal_press', equipment: ['barbell', 'bench'] });

    it('same substitution_class wins over a different class regardless of reason/equipment', () => {
        const sameClass = ex('same', { substitution_class: 'horizontal_press', equipment: [] });
        const diffClass = ex('diff', { substitution_class: 'other', equipment: ['barbell', 'bench'] });
        for (const reason of [undefined, 'pain', 'no_equipment', 'crowded'] as const) {
            expect(rankSubstitutes(original, [diffClass, sameClass], reason)[0].id).toBe('same');
        }
    });

    it('preference (no reason) prefers most equipment overlap within a class tier', () => {
        const more = ex('more', { equipment: ['barbell', 'bench'] });
        const less = ex('less', { equipment: ['dumbbells'] });
        expect(rankSubstitutes(original, [less, more]).map((e) => e.id)).toEqual(['more', 'less']);
    });

    it('no_equipment / crowded prefer the fewest shared equipment keys', () => {
        const shares = ex('shares', { equipment: ['barbell'] });
        const none = ex('none', { equipment: ['dumbbells'] });
        expect(rankSubstitutes(original, [shares, none], 'no_equipment').map((e) => e.id)).toEqual(['none', 'shares']);
        expect(rankSubstitutes(original, [shares, none], 'crowded').map((e) => e.id)).toEqual(['none', 'shares']);
    });

    it('pain prefers the fewest contraindication flags', () => {
        const flagged = ex('flagged', { contraindications: ['shoulder'] });
        const clean = ex('clean', { contraindications: [] });
        expect(rankSubstitutes(original, [flagged, clean], 'pain').map((e) => e.id)).toEqual(['clean', 'flagged']);
    });

    it('name is the deterministic tiebreak regardless of input order', () => {
        const a = ex('a-ex', { name: 'Alpha', equipment: ['barbell', 'bench'] });
        const b = ex('b-ex', { name: 'Beta', equipment: ['barbell', 'bench'] });
        expect(rankSubstitutes(original, [b, a]).map((e) => e.name)).toEqual(['Alpha', 'Beta']);
    });

    it('degrades gracefully when substitution_class is absent', () => {
        const noClassOrig = ex('o2', { substitution_class: null, equipment: ['barbell'] });
        const x = ex('x', { equipment: ['barbell'] });
        const y = ex('y', { equipment: [] });
        expect(rankSubstitutes(noClassOrig, [y, x]).map((e) => e.id)).toEqual(['x', 'y']); // overlap desc
    });
});

// Equipment-profile generation helpers (Branch B)
const prof = (id: string, equipment: EquipmentProfile['equipment'], created_at: string): EquipmentProfile => ({
    id,
    name: id,
    equipment,
    created_at,
    expires_at: null,
});
// The loader returns created_at desc, so the most-recent is first.
const homeProfile = prof('home', ['dumbbells', 'bench'], '2026-06-09T02:00:00Z');
const gymProfile = prof('gym', ['barbell', 'machines'], '2026-06-09T01:00:00Z');

describe('equipmentKey', () => {
    it('is order-independent', () => {
        expect(equipmentKey(['bench', 'dumbbells'])).toBe(equipmentKey(['dumbbells', 'bench']));
    });
});

describe('matchingProfileId', () => {
    it('returns the id of the profile whose equipment set-equals the selection', () => {
        expect(matchingProfileId([homeProfile, gymProfile], new Set(['bench', 'dumbbells']))).toBe('home');
    });
    it('returns null when nothing matches', () => {
        expect(matchingProfileId([homeProfile, gymProfile], new Set(['cables']))).toBeNull();
    });
    it('returns null for no profiles', () => {
        expect(matchingProfileId([], new Set(['dumbbells']))).toBeNull();
    });
});

describe('resolveEquipmentPrefill', () => {
    it('returns the active profile when set and present', () => {
        expect(resolveEquipmentPrefill([homeProfile, gymProfile], 'gym')).toEqual(['barbell', 'machines']);
    });
    it('falls back to the most-recent (first) when none active', () => {
        expect(resolveEquipmentPrefill([homeProfile, gymProfile], null)).toEqual(['dumbbells', 'bench']);
    });
    it('falls back to the most-recent when the active id is stale (deleted)', () => {
        expect(resolveEquipmentPrefill([homeProfile, gymProfile], 'deleted-id')).toEqual(['dumbbells', 'bench']);
    });
    it("returns empty when there are no profiles (today's behavior)", () => {
        expect(resolveEquipmentPrefill([], null)).toEqual([]);
        expect(resolveEquipmentPrefill([], 'anything')).toEqual([]);
    });
});

describe('exerciseReason', () => {
    it('derives pattern, role, and the top muscles for a compound', () => {
        // horizontal_push → chest 0.55, triceps 0.25, shoulders 0.2; top two kept.
        expect(exerciseReason({ movement_pattern: 'horizontal_push', is_compound: true })).toBe(
            'Horizontal push · compound · chest, triceps',
        );
    });

    it('labels isolation lifts and single-muscle patterns', () => {
        expect(exerciseReason({ movement_pattern: 'biceps_iso', is_compound: false })).toBe(
            'Biceps isolation · isolation · biceps',
        );
        expect(exerciseReason({ movement_pattern: 'squat', is_compound: true })).toBe(
            'Squat · compound · legs, glutes',
        );
    });

    it('returns null when there is no movement pattern (user-created exercise)', () => {
        expect(exerciseReason({ movement_pattern: null, is_compound: false })).toBeNull();
        expect(exerciseReason({})).toBeNull();
    });
});

describe('computeExerciseHistory (logging-time "what did I do last time", #13)', () => {
    const set = (kg: number, reps: number) => ({ kg, reps, rir: 2, saved: true });
    // Real UUID rids (parseLogKey validates the id segment as a UUID); the dashes
    // also prove note-key parsing splits on the first dash only.
    const rid = '11111111-1111-4111-8111-111111111111';
    const other = '22222222-2222-4222-8222-222222222222';
    const logs = {
        [`1-${rid}-0`]: set(100, 5),
        [`1-${rid}-1`]: set(100, 5),
        [`2-${rid}-0`]: set(105, 5),
        // an unsaved set and another exercise that must not leak in
        [`2-${rid}-1`]: { kg: 110, reps: 5, rir: 2, saved: false },
        [`2-${other}-0`]: set(200, 5),
    };
    const notes = { [`1-${rid}`]: 'felt heavy', [`2-${rid}`]: 'moved better', [`2-${other}`]: 'nope' };

    it('returns an empty read when the exercise has never been logged', () => {
        const h = computeExerciseHistory({}, rid, 3, {});
        expect(h.lastSession).toBeNull();
        expect(h.best).toBeNull();
        expect(h.trend).toBe('none');
        expect(h.e1rmDeltaPct).toBeNull();
        expect(h.previousNote).toBeNull();
    });

    it('composes last session, best set, trend, and the previous note for this exercise', () => {
        const h = computeExerciseHistory(logs, rid, 3, notes);
        // Last session = the most recent prior week (week 2), one saved set.
        expect(h.lastSession).toEqual({ kg: 105, reps: 5, setCount: 1 });
        // Best set = the heaviest by e1RM (week 2's 105x5 beats week 1's 100x5).
        expect(h.best).not.toBeNull();
        expect(h.best!.kg).toBe(105);
        expect(h.best!.reps).toBe(5);
        // Trend across the last two logged weeks: 105 > 100 -> up, positive delta.
        expect(h.trend).toBe('up');
        expect(h.e1rmDeltaPct).toBeGreaterThan(0);
        // Previous note = the latest prior week's note for THIS exercise (not 'other').
        expect(h.previousNote).toBe('moved better');
    });

    it('ignores the current and future weeks for last session and notes', () => {
        // currentWeek = 2 -> only week 1 counts as prior.
        const h = computeExerciseHistory(logs, rid, 2, notes);
        expect(h.lastSession).toEqual({ kg: 100, reps: 5, setCount: 2 });
        expect(h.previousNote).toBe('felt heavy');
        // Only one prior week of e1RM data -> no trend.
        expect(h.trend).toBe('none');
        expect(h.e1rmDeltaPct).toBeNull();
    });

    it('reports a downward trend when the last logged week regressed', () => {
        const regressed = { [`1-${rid}-0`]: set(120, 5), [`2-${rid}-0`]: set(100, 5) };
        const h = computeExerciseHistory(regressed, rid, 3, {});
        expect(h.trend).toBe('down');
        expect(h.e1rmDeltaPct).toBeLessThan(0);
    });
});

describe('recoverySummaryWord', () => {
    it('returns Fresh when all entries are optimal or empty', () => {
        expect(recoverySummaryWord({})).toBe('Fresh');
        expect(recoverySummaryWord({ chest: { status: 'optimal' } as any })).toBe('Fresh');
    });

    it('counts entries whose status is not optimal', () => {
        expect(recoverySummaryWord({ chest: { status: 'high_fatigue' } as any })).toBe('1 flag');
        expect(
            recoverySummaryWord({
                chest: { status: 'high_fatigue' } as any,
                back: { status: 'under' } as any,
            }),
        ).toBe('2 flags');
    });
});

describe('formatProgramStatus', () => {
    it('formats an on_track position', () => {
        const s = formatProgramStatus({ status: 'on_track', calendarWeek: 6, weekInteger: 6 } as any, 12);
        expect(s.statusLabel).toBe('On track');
        expect(s.weekLabel).toBe('Week 6 of 12');
        expect(s.progress).toBeCloseTo(0.5);
    });

    it('maps status labels correctly', () => {
        expect(formatProgramStatus({ status: 'behind', weekInteger: 3 } as any, 12).statusLabel).toBe('Behind');
        expect(formatProgramStatus({ status: 'lapsed', weekInteger: 3 } as any, 12).statusLabel).toBe('Lapsed');
        expect(formatProgramStatus({ status: 'paused', weekInteger: 3 } as any, 12).statusLabel).toBe('Paused');
    });

    it('reports position relative to the block once it repeats', () => {
        // weekInteger 15 in a 12-week block is cycle 2, week 3.
        const s = formatProgramStatus({ status: 'on_track', weekInteger: 15 } as any, 12);
        expect(s.weekLabel).toBe('Week 3 of 12');
        expect(s.progress).toBeCloseTo(0.25);
        // Next deload is still the block's recovery week, not a stale past week.
        expect(s.nextDeloadWeek).toBe(12);
    });
});
