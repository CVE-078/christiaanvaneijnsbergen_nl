import { describe, it, expect } from 'vitest';
import { decisionCopy, groupDecisionsByWeek } from '@/lib/pulse/decisionCopy';
import type { DecisionEventRow } from '@/lib/pulse/types';

const RE = '11111111-1111-4111-8111-111111111111';

function row(over: Partial<DecisionEventRow>): DecisionEventRow {
    return {
        id: 'evt-1',
        routine_id: 'rt-1',
        type: 'deload',
        trigger: 'plateau',
        affectedArea: RE,
        week: 6,
        magnitude: {},
        confidence: null,
        created_at: '2026-06-06T10:00:00.000Z',
        ...over,
    };
}

describe('decisionCopy', () => {
    it('describes a deload with the exercise name', () => {
        const c = decisionCopy(
            row({ type: 'deload', trigger: 'plateau', magnitude: { fromKg: 70, toKg: 62.5 } }),
            'Barbell Row',
        );
        expect(c.kind).toBe('deload');
        expect(c.headline).toBe('Barbell Row deloaded');
        expect(c.why).toMatch(/stalled/i);
        expect(c.next).toMatch(/lighter/i);
    });

    it('falls back to a generic headline when the lift name is unknown', () => {
        const c = decisionCopy(row({ type: 'deload' }), null);
        expect(c.headline).toBe('Lift deloaded');
    });

    it('describes a weight progression (top of range)', () => {
        const c = decisionCopy(
            row({
                type: 'progression',
                trigger: 'targets_hit',
                magnitude: { fromKg: 80, toKg: 82.5, fromReps: 12, toReps: 8 },
            }),
            'Bench Press',
        );
        expect(c.kind).toBe('progression');
        expect(c.headline).toBe('Bench Press progressed');
        expect(c.next).toMatch(/heavier/i);
    });

    it('describes a rep progression (same weight, +1 rep)', () => {
        const c = decisionCopy(
            row({
                type: 'progression',
                trigger: 'targets_hit',
                magnitude: { fromKg: 80, toKg: 80, fromReps: 9, toReps: 10 },
            }),
            'Bench Press',
        );
        expect(c.next).toMatch(/rep/i);
        expect(c.next).not.toMatch(/heavier/i);
    });

    it('describes a ramp-back with the days away when known', () => {
        const c = decisionCopy(
            row({
                type: 'ramp_back',
                trigger: 'gap',
                affectedArea: '',
                magnitude: { volumeFactor: 0.6, rirBonus: 1, daysAway: 11 },
            }),
            null,
        );
        expect(c.kind).toBe('ramp_back');
        expect(c.headline).toBe('Ramp-back week added');
        expect(c.why).toContain('11 days');
        // The ease is RIR-only today (the volume cut is not yet wired, Tier 2 #7),
        // so the copy must not promise reduced volume.
        expect(c.next).toMatch(/easier RIR/i);
        expect(c.next).not.toMatch(/volume/i);
    });

    it('describes a manual lighten distinctly from a gap-driven ramp-back', () => {
        const c = decisionCopy(
            row({
                type: 'ramp_back',
                trigger: 'manual',
                affectedArea: '',
                magnitude: { volumeFactor: 0.6, rirBonus: 1 },
            }),
            null,
        );
        expect(c.kind).toBe('ramp_back');
        expect(c.headline).toMatch(/lighter|easier/i);
        expect(c.why).toMatch(/chose|you went/i);
        expect(c.why).not.toMatch(/break|days/i);
        expect(c.next).toMatch(/progression continues/i);
    });

    it('describes a ramp-back generically when days away is absent', () => {
        const c = decisionCopy(
            row({ type: 'ramp_back', trigger: 'gap', affectedArea: '', magnitude: { volumeFactor: 0.6, rirBonus: 1 } }),
            null,
        );
        expect(c.why).not.toMatch(/\d+ days/);
        expect(c.why).toMatch(/break/i);
    });
});

describe('groupDecisionsByWeek', () => {
    it('groups consecutive events by week, preserving newest-first order', () => {
        const events = [
            row({ id: 'a', week: 6 }),
            row({ id: 'b', week: 6 }),
            row({ id: 'c', week: 5 }),
            row({ id: 'd', week: 4 }),
        ];
        const groups = groupDecisionsByWeek(events);
        expect(groups.map((g) => g.week)).toEqual([6, 5, 4]);
        expect(groups[0].events.map((e) => e.id)).toEqual(['a', 'b']);
        expect(groups[1].events).toHaveLength(1);
    });

    it('returns an empty array for no events', () => {
        expect(groupDecisionsByWeek([])).toEqual([]);
    });
});
