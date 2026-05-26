import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUIState } from '../useUIState';

beforeEach(() => {
    localStorage.clear();
});

describe('useUIState', () => {
    it('starts on the log view', () => {
        const { result } = renderHook(() => useUIState());
        expect(result.current.view).toBe('log');
    });

    it('navigate changes the view', () => {
        const { result } = renderHook(() => useUIState());
        act(() => result.current.navigate('profile'));
        expect(result.current.view).toBe('profile');
    });

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

    it('activeWeek from localStorage is clamped to 1–12 range', () => {
        localStorage.setItem('pulse_week', '99');
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
