import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnline } from '../useOnline';

describe('useOnline', () => {
    it('defaults to true (navigator.onLine in jsdom)', () => {
        const { result } = renderHook(() => useOnline());
        expect(result.current).toBe(true);
    });

    it('reflects the offline event', () => {
        const { result } = renderHook(() => useOnline());
        act(() => {
            window.dispatchEvent(new Event('offline'));
        });
        expect(result.current).toBe(false);
    });

    it('reflects the online event', () => {
        const { result } = renderHook(() => useOnline());
        act(() => {
            window.dispatchEvent(new Event('offline'));
        });
        expect(result.current).toBe(false);
        act(() => {
            window.dispatchEvent(new Event('online'));
        });
        expect(result.current).toBe(true);
    });
});
