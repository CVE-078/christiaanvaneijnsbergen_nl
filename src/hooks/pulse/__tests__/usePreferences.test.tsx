import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { usePreferences } from '../usePreferences';

const setExercisePreference = vi.fn().mockResolvedValue(undefined);
vi.mock('@/app/pulse/actions', () => ({
    setExercisePreference: (...args: unknown[]) => setExercisePreference(...args),
}));

vi.mock('@/lib/pulse/fetcher', () => ({
    SWR_READ_OPTS: {},
    fetcher: vi.fn(async (key: string) => (key === '/api/pulse/preferences' ? ['ex-1'] : [])),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

describe('usePreferences', () => {
    beforeEach(() => vi.clearAllMocks());

    it('exposes the hidden set from the server', async () => {
        const { result } = renderHook(() => usePreferences(), { wrapper });
        await waitFor(() => expect(result.current.hiddenExerciseIds.has('ex-1')).toBe(true));
    });

    it('optimistically hides and unhides an exercise', async () => {
        const { result } = renderHook(() => usePreferences(), { wrapper });
        await waitFor(() => expect(result.current.hiddenExerciseIds.has('ex-1')).toBe(true));

        await act(async () => {
            await result.current.toggleHideExercise('ex-2', true);
        });
        expect(setExercisePreference).toHaveBeenCalledWith('ex-2', 'hidden');
        expect(result.current.hiddenExerciseIds.has('ex-2')).toBe(true);

        await act(async () => {
            await result.current.toggleHideExercise('ex-1', false);
        });
        expect(setExercisePreference).toHaveBeenCalledWith('ex-1', null);
    });
});
