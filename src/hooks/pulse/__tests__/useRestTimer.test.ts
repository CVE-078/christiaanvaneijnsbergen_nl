import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRestTimer } from '../useRestTimer';

describe('useRestTimer', () => {
    it('timerTrigger starts at 0', () => {
        const { result } = renderHook(() => useRestTimer());
        expect(result.current.timerTrigger).toBe(0);
    });

    it('fireTrigger increments timerTrigger by 1', () => {
        const { result } = renderHook(() => useRestTimer());
        act(() => result.current.fireTrigger());
        expect(result.current.timerTrigger).toBe(1);
    });

    it('fireTrigger increments on repeated calls', () => {
        const { result } = renderHook(() => useRestTimer());
        act(() => result.current.fireTrigger());
        act(() => result.current.fireTrigger());
        act(() => result.current.fireTrigger());
        expect(result.current.timerTrigger).toBe(3);
    });
});
