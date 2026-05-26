import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

function mockMatchMedia(matches: boolean) {
    const listeners: Array<(e: { matches: boolean }) => void> = [];
    const mql = {
        matches,
        addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
        removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
            const i = listeners.indexOf(fn);
            if (i !== -1) listeners.splice(i, 1);
        },
        dispatch: (m: boolean) => listeners.forEach((fn) => fn({ matches: m })),
    };
    Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockReturnValue(mql) });
    return mql;
}

describe('useMediaQuery', () => {
    it('returns true after mount when media matches', () => {
        mockMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
        expect(result.current).toBe(true);
    });

    it('returns false after mount when media does not match', () => {
        mockMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
        expect(result.current).toBe(false);
    });

    it('updates when the media query changes', () => {
        const mql = mockMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
        expect(result.current).toBe(false);
        act(() => mql.dispatch(true));
        expect(result.current).toBe(true);
    });
});
