import { describe, it, expect } from 'vitest';
import { getPhase, getRIR, logKey, parseMaxSets, buildHistory, rirColor, rirBgColor } from '../utils';
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
    const pushSession = history.find(s => s.type === 'push');
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

describe('rirColor', () => {
  it('returns red for RIR 0', () => expect(rirColor(0)).toBe('#f43f5e'));
  it('returns orange for RIR 1', () => expect(rirColor(1)).toBe('#f97316'));
  it('returns yellow for RIR 2', () => expect(rirColor(2)).toBe('#facc15'));
  it('returns green for RIR 3+', () => {
    expect(rirColor(3)).toBe('#4ade80');
    expect(rirColor(10)).toBe('#4ade80');
  });
});

describe('rirBgColor', () => {
  it('appends 22 to rirColor', () => {
    expect(rirBgColor(0)).toBe('#f43f5e22');
    expect(rirBgColor(3)).toBe('#4ade8022');
  });
});
