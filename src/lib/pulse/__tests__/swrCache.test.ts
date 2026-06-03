import { describe, it, expect, beforeEach } from 'vitest';
import { makeSWRCacheProvider, clearAllSWRCache } from '../swrCache';

describe('makeSWRCacheProvider', () => {
    beforeEach(() => localStorage.clear());

    it('starts empty when nothing is stored', () => {
        const map = makeSWRCacheProvider('user-1')();
        expect(map.get('/api/pulse/logs')).toBeUndefined();
    });

    it('seeds the map from the user-scoped localStorage key', () => {
        localStorage.setItem('pulse-swr-cache:user-1', JSON.stringify([['k', { data: 42 }]]));
        const map = makeSWRCacheProvider('user-1')();
        expect(map.get('k')).toEqual({ data: 42 });
    });

    it("does not read another user's cache", () => {
        localStorage.setItem('pulse-swr-cache:user-1', JSON.stringify([['k', { data: 1 }]]));
        const map = makeSWRCacheProvider('user-2')();
        expect(map.get('k')).toBeUndefined();
    });

    it('clearAllSWRCache removes every pulse cache key', () => {
        localStorage.setItem('pulse-swr-cache:user-1', '[]');
        localStorage.setItem('pulse-swr-cache:user-2', '[]');
        localStorage.setItem('unrelated', 'keep');
        clearAllSWRCache();
        expect(localStorage.getItem('pulse-swr-cache:user-1')).toBeNull();
        expect(localStorage.getItem('pulse-swr-cache:user-2')).toBeNull();
        expect(localStorage.getItem('unrelated')).toBe('keep');
    });

    it('survives malformed stored JSON', () => {
        localStorage.setItem('pulse-swr-cache:user-1', 'not json');
        expect(() => makeSWRCacheProvider('user-1')()).not.toThrow();
    });
});
