import { describe, it, expect } from 'vitest';
import {
    isTravelActive,
    activeTravelProfile,
    defaultProfile,
    resolveEquipmentPrefill,
    travelDaysLeft,
    travelReturnDate,
    travelEndedRecently,
    computeTravelExpiry,
} from '@/lib/pulse/utils';
import type { EquipmentProfile } from '@/lib/pulse/types';

const TZ = 'Europe/Amsterdam';
const p = (over: Partial<EquipmentProfile>): EquipmentProfile => ({
    id: 'a',
    name: 'A',
    equipment: ['dumbbells'],
    created_at: '2026-01-01T00:00:00Z',
    expires_at: null,
    ...over,
});
// Most-recent first, matching the loader order (created_at desc).
const home = p({ id: 'home', name: 'Home', equipment: ['barbell', 'bench'], created_at: '2026-01-02T00:00:00Z' });
const travel = p({ id: 'travel', name: 'Hotel', equipment: ['dumbbells'], created_at: '2026-06-09T00:00:00Z' });
const NOW = '2026-06-09T10:00:00Z';

describe('isTravelActive', () => {
    it('true while expiry is a future calendar day', () => {
        expect(isTravelActive({ ...travel, expires_at: '2026-06-16T12:00:00Z' }, NOW, TZ)).toBe(true);
    });
    it('false on the return day itself (boundary == is inactive)', () => {
        expect(isTravelActive({ ...travel, expires_at: '2026-06-09T12:00:00Z' }, NOW, TZ)).toBe(false);
    });
    it('false for null expiry', () => {
        expect(isTravelActive(travel, NOW, TZ)).toBe(false);
    });
});

describe('activeTravelProfile', () => {
    it('returns the future-expiry overlay', () => {
        const t = { ...travel, expires_at: '2026-06-16T12:00:00Z' };
        expect(activeTravelProfile([home, t], NOW, TZ)?.id).toBe('travel');
    });
    it('null when none active', () => {
        expect(activeTravelProfile([home, travel], NOW, TZ)).toBeNull();
    });
    it('prefers the latest expiry if two somehow coexist', () => {
        const t1 = p({ id: 't1', expires_at: '2026-06-12T12:00:00Z' });
        const t2 = p({ id: 't2', expires_at: '2026-06-20T12:00:00Z' });
        expect(activeTravelProfile([t1, t2], NOW, TZ)?.id).toBe('t2');
    });
});

describe('defaultProfile', () => {
    const t = { ...travel, expires_at: '2026-06-16T12:00:00Z' };
    it('is the activeId profile when it is not the overlay', () => {
        expect(defaultProfile([home, t], 'home', NOW, TZ)?.id).toBe('home');
    });
    it('falls back to most-recent non-overlay when activeId is the overlay', () => {
        expect(defaultProfile([home, t], 'travel', NOW, TZ)?.id).toBe('home');
    });
    it('null when only the overlay exists', () => {
        expect(defaultProfile([t], 'travel', NOW, TZ)).toBeNull();
    });
});

describe('resolveEquipmentPrefill travel-awareness', () => {
    const t = { ...travel, expires_at: '2026-06-16T12:00:00Z' };
    it('returns the overlay equipment while travel is active (engine-change guard)', () => {
        expect(resolveEquipmentPrefill([home, t], 'home', NOW, TZ)).toEqual(['dumbbells']);
    });
    it('falls back to default after expiry', () => {
        const expired = { ...travel, expires_at: '2026-06-01T12:00:00Z' };
        expect(resolveEquipmentPrefill([home, expired], 'home', NOW, TZ)).toEqual(['barbell', 'bench']);
    });
    it('GOLDEN: with no expiry and no now/tz, byte-identical to legacy 2-arg behavior', () => {
        expect(resolveEquipmentPrefill([home, travel], 'home')).toEqual(['barbell', 'bench']);
        expect(resolveEquipmentPrefill([home, travel], null)).toEqual(['barbell', 'bench']); // profiles[0]
        expect(resolveEquipmentPrefill([], null)).toEqual([]);
    });
});

describe('travelDaysLeft / returnDate / endedRecently', () => {
    const t = { ...travel, expires_at: '2026-06-16T12:00:00Z' };
    it('counts calendar days left', () => {
        expect(travelDaysLeft(t, NOW, TZ)).toBe(7);
    });
    it('formats the return date in tz', () => {
        expect(travelReturnDate(t, TZ)).toBe('2026-06-16');
    });
    it('endedRecently true within the nudge window after expiry', () => {
        const justEnded = { ...travel, expires_at: '2026-06-08T12:00:00Z' };
        expect(travelEndedRecently(justEnded, NOW, TZ)).toBe(true);
        const longGone = { ...travel, expires_at: '2026-04-01T12:00:00Z' };
        expect(travelEndedRecently(longGone, NOW, TZ)).toBe(false);
        expect(travelEndedRecently(t, NOW, TZ)).toBe(false); // still active, not "ended"
    });
});

describe('computeTravelExpiry', () => {
    it('returns noon-UTC of (today + days) so the return day is stable', () => {
        const iso = computeTravelExpiry(NOW, TZ, 7);
        expect(travelDaysLeft({ ...travel, expires_at: iso }, NOW, TZ)).toBe(7);
        expect(new Date(iso).toISOString()).toContain('T12:00:00');
    });
    it('handles a DST-spring date without off-by-one', () => {
        // CET->CEST is 2026-03-29. A 7-day trip starting 2026-03-26 (10:00 UTC =
        // 11:00 local, unambiguously the 26th) crosses the DST jump and must land
        // on 2026-04-02, not 04-01 or 04-03.
        const iso = computeTravelExpiry('2026-03-26T10:00:00Z', TZ, 7);
        expect(travelReturnDate({ ...travel, expires_at: iso }, TZ)).toBe('2026-04-02');
    });
});
