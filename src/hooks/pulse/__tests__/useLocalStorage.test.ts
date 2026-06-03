import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

beforeEach(() => {
    localStorage.clear();
});

describe('useLocalStorage', () => {
    it('returns the default value when localStorage is empty', () => {
        const { result } = renderHook(() => useLocalStorage('test-key', 42));
        expect(result.current[0]).toBe(42);
    });

    it('persists the updated value to localStorage', () => {
        const { result } = renderHook(() => useLocalStorage('test-key', 0));
        act(() => result.current[1](99));
        expect(localStorage.getItem('test-key')).toBe('99');
    });

    it('reads an existing value from localStorage', () => {
        localStorage.setItem('test-key', '123');
        const { result } = renderHook(() => useLocalStorage('test-key', 0));
        expect(result.current[0]).toBe(123);
    });

    it('returns the default when localStorage contains invalid JSON', () => {
        localStorage.setItem('test-key', 'not-json{{{');
        const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'));
        expect(result.current[0]).toBe('fallback');
    });

    it('uses the default value on first render before reading localStorage', () => {
        localStorage.setItem('test-key', '123');
        let firstValue: number | undefined;
        renderHook(() => {
            const [v] = useLocalStorage('test-key', 0);
            if (firstValue === undefined) firstValue = v;
            return v;
        });
        // First render must match the SSR default to avoid a hydration mismatch.
        expect(firstValue).toBe(0);
    });
});
