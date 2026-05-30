import { describe, it, expect } from 'vitest';
import {
    getPhase,
    getRIR,
    logKey,
    parseMaxSets,
    buildHistory,
    weekHasData,
    calcE1RM,
    computePRMap,
    computeStreak,
    computeSuggestion,
    computeVolumeByTypeAndWeek,
    computeE1RMHistory,
    computeBestSets,
    computeLastSession,
    computeWarmupSets,
    computeShareStats,
} from '../utils';
import type { Logs, RoutineExercise, WorkoutType, WorkoutSession } from '../types';

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

    it('falls back to Phase 1 for out-of-range weeks', () => {
        expect(getPhase(0).label).toBe('Phase 1');
        expect(getPhase(99).label).toBe('Phase 1');
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

describe('logKey', () => {
    it('returns hyphen-delimited string with UUID in middle', () => {
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        expect(logKey(1, uuid, 0)).toBe(`1-${uuid}-0`);
        expect(logKey(12, uuid, 3)).toBe(`12-${uuid}-3`);
        expect(logKey(7, uuid, 1)).toBe(`7-${uuid}-1`);
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
            [`1-${UUID_A}-1`]: { kg: 62, reps: 8,  rir: 2, saved: true },
            [`1-${UUID_B}-0`]: { kg: 50, reps: 12, rir: 3, saved: true },
        };
        const history = buildHistory(logs);
        expect(history).toHaveLength(1);
        expect(history[0].week).toBe(1);
        expect(history[0].sets).toHaveLength(3);
    });

    it('sorts sessions descending by week', () => {
        const logs: Logs = {
            [`3-${UUID_A}-0`]: { kg: 70, reps: 8,  rir: 2, saved: true },
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
            [`1-${UUID_A}-0`]: { kg: 60, reps: 8,  rir: 3, saved: true },
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
            exercise: { id: 'ex-1', name: 'Bench Press', category: 'chest', default_sets: '3', default_reps: '8', user_id: null },
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
            exercise: { id: 'ex-2', name: 'Overhead Press', category: 'shoulders', default_sets: '3', default_reps: '12', user_id: null },
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
