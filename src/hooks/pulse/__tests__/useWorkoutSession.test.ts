import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkoutSession } from '../useWorkoutSession';

describe('useWorkoutSession.saveSessionDebrief', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    });
    afterEach(() => vi.unstubAllGlobals());

    it('PATCHes the session with the rpe and note body', async () => {
        const { result } = renderHook(() => useWorkoutSession());
        await act(async () => {
            await result.current.saveSessionDebrief('sess-1', { rpe: 7, note: 'felt good' });
        });
        expect(fetch).toHaveBeenCalledWith(
            '/api/pulse/sessions/sess-1',
            expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ rpe: 7, note: 'felt good' }),
            }),
        );
    });

    it('throws when the response is not ok', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        const { result } = renderHook(() => useWorkoutSession());
        await expect(result.current.saveSessionDebrief('sess-1', { rpe: 5, note: null })).rejects.toThrow();
    });
});
