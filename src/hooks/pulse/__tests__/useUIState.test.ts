import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUIState } from '../useUIState';

beforeEach(() => {
    localStorage.clear();
});

describe('useUIState', () => {
    it('activeWeek defaults to 1', () => {
        const { result } = renderHook(() => useUIState());
        expect(result.current.activeWeek).toBe(1);
    });

    it('setActiveWeek updates activeWeek and persists to localStorage', () => {
        const { result } = renderHook(() => useUIState());
        act(() => result.current.setActiveWeek(7));
        expect(result.current.activeWeek).toBe(7);
        expect(localStorage.getItem('pulse_week')).toBe('7');
    });

    it('restores activeWeek from localStorage on mount', () => {
        localStorage.setItem('pulse_week', '5');
        const { result } = renderHook(() => useUIState());
        expect(result.current.activeWeek).toBe(5);
    });

    it('preserves a week beyond the first block (programs repeat)', () => {
        localStorage.setItem('pulse_week', '30');
        const { result } = renderHook(() => useUIState());
        expect(result.current.activeWeek).toBe(30);
    });

    it('clamps junk / absurd weeks back to 1', () => {
        localStorage.setItem('pulse_week', '99999');
        const { result } = renderHook(() => useUIState());
        expect(result.current.activeWeek).toBe(1);
    });

    it('activeTab defaults to push', () => {
        const { result } = renderHook(() => useUIState());
        expect(result.current.activeTab).toBe('push');
    });

    it('setActiveTab updates the active tab', () => {
        const { result } = renderHook(() => useUIState());
        act(() => result.current.setActiveTab('legs'));
        expect(result.current.activeTab).toBe('legs');
    });
});
