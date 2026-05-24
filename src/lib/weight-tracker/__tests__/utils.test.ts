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
} from '../utils';
import type { Logs } from '../types';

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
    it('returns hyphen-delimited string', () => {
        expect(logKey(1, 'push', 0, 0)).toBe('1-push-0-0');
        expect(logKey(12, 'legs', 5, 3)).toBe('12-legs-5-3');
        expect(logKey(7, 'pull', 2, 1)).toBe('7-pull-2-1');
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
    it('returns empty array for empty logs', () => {
        expect(buildHistory({})).toEqual([]);
    });

    it('ignores entries where saved is false', () => {
        const logs: Logs = {
            '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: false },
        };
        expect(buildHistory(logs)).toEqual([]);
    });

    it('groups saved entries by week+type', () => {
        const logs: Logs = {
            '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: true },
            '1-push-0-1': { kg: 62, reps: 8, rir: 2, saved: true },
            '1-pull-0-0': { kg: 50, reps: 12, rir: 3, saved: true },
        };
        const history = buildHistory(logs);
        expect(history).toHaveLength(2);
        const pushSession = history.find((s) => s.type === 'push');
        expect(pushSession?.week).toBe(1);
        expect(pushSession?.sets).toHaveLength(2);
    });

    it('sorts sessions descending by week', () => {
        const logs: Logs = {
            '3-push-0-0': { kg: 70, reps: 8, rir: 2, saved: true },
            '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: true },
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
    it('returns empty map for empty logs', () => {
        expect(computePRMap({})).toEqual({});
    });
    it('finds best e1RM per exercise across weeks', () => {
        const logs: Logs = {
            '1-push-0-0': { kg: 60, reps: 8, rir: 3, saved: true },
            '2-push-0-0': { kg: 65, reps: 6, rir: 2, saved: true },
        };
        const map = computePRMap(logs);
        expect(map['push-0']).toBeGreaterThan(calcE1RM(60, 8));
        expect(map['push-0']).toBeCloseTo(calcE1RM(65, 6));
    });
    it('ignores unsaved entries', () => {
        const logs: Logs = {
            '1-push-0-0': { kg: 200, reps: 20, rir: 0, saved: false },
        };
        expect(computePRMap(logs)).toEqual({});
    });
    it('keeps separate keys per exercise', () => {
        const logs: Logs = {
            '1-push-0-0': { kg: 60, reps: 8, rir: 3, saved: true },
            '1-push-1-0': { kg: 40, reps: 12, rir: 3, saved: true },
        };
        const map = computePRMap(logs);
        expect(map['push-0']).toBeDefined();
        expect(map['push-1']).toBeDefined();
        expect(map['push-0']).not.toBeCloseTo(map['push-1']);
    });
});

describe('computeStreak', () => {
    it('returns 0 for empty logs', () => {
        expect(computeStreak({})).toBe(0);
    });
    it('counts consecutive weeks from the most recent', () => {
        const logs: Logs = {
            '1-push-0-0': { kg: 60, reps: 8, rir: 3, saved: true },
            '2-push-0-0': { kg: 62, reps: 8, rir: 3, saved: true },
            '3-push-0-0': { kg: 65, reps: 8, rir: 2, saved: true },
        };
        expect(computeStreak(logs)).toBe(3);
    });
    it('stops at the first gap', () => {
        const logs: Logs = {
            '1-push-0-0': { kg: 60, reps: 8, rir: 3, saved: true },
            '3-push-0-0': { kg: 65, reps: 8, rir: 2, saved: true },
        };
        expect(computeStreak(logs)).toBe(1);
    });
    it('ignores unsaved entries when counting', () => {
        const logs: Logs = {
            '1-push-0-0': { kg: 60, reps: 8, rir: 3, saved: true },
            '2-push-0-0': { kg: 62, reps: 8, rir: 3, saved: false },
            '3-push-0-0': { kg: 65, reps: 8, rir: 2, saved: true },
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
    it('returns true when a saved entry exists for the week', () => {
        const logs: Logs = { '3-push-0-0': { kg: 60, reps: 8, rir: 2, saved: true } };
        expect(weekHasData(3, logs)).toBe(true);
    });
    it('returns false when no saved entries exist for the week', () => {
        expect(weekHasData(3, {})).toBe(false);
    });
    it('returns false when entry exists but is not saved', () => {
        const logs: Logs = { '3-push-0-0': { kg: 60, reps: 8, rir: 2, saved: false } };
        expect(weekHasData(3, logs)).toBe(false);
    });
});
