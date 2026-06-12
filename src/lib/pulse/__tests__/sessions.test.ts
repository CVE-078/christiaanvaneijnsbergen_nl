import { describe, it, expect } from 'vitest';
import { nextVariant } from '../sessions';
import { sessionsByDay } from '../sessions';

describe('nextVariant', () => {
    it('returns A when no history', () => {
        expect(nextVariant(null)).toBe('A');
    });

    it('alternates A to B', () => {
        expect(nextVariant('A')).toBe('B');
    });

    it('alternates B to A', () => {
        expect(nextVariant('B')).toBe('A');
    });
});

describe('sessionsByDay', () => {
    it('keys completed sessions by their tz-local date', () => {
        const map = sessionsByDay(
            [
                {
                    id: 's1',
                    completed_at: '2026-06-09T19:30:00Z',
                    started_at: '2026-06-09T18:45:00Z',
                } as any,
                {
                    id: 's2',
                    completed_at: null,
                    started_at: '2026-06-10T10:00:00Z',
                } as any, // not completed -> excluded
            ],
            'Europe/Amsterdam',
        );
        expect(map.get('2026-06-09')?.[0].id).toBe('s1');
        expect(map.get('2026-06-10')).toBeUndefined();
    });

    it('keys a late-UTC session to the next day when the tz has rolled over', () => {
        // 23:30 UTC is 01:30 the next day in Amsterdam (UTC+2 in June).
        const map = sessionsByDay(
            [
                {
                    id: 's1',
                    completed_at: '2026-06-09T23:30:00Z',
                    started_at: '2026-06-09T22:45:00Z',
                } as any,
            ],
            'Europe/Amsterdam',
        );
        expect(map.get('2026-06-10')?.[0].id).toBe('s1');
        expect(map.get('2026-06-09')).toBeUndefined();
    });
});
