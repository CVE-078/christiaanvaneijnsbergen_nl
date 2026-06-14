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
    fetcher: vi.fn(async (key: string) =>
        key === '/api/pulse/preferences' ? { hidden: ['a'], favorite: ['b'] } : {},
    ),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

describe('usePreferences', () => {
    beforeEach(() => vi.clearAllMocks());

    it('exposes the hidden set from the server', async () => {
        const { result } = renderHook(() => usePreferences(), { wrapper });
        await waitFor(() => expect(result.current.hiddenExerciseIds.has('a')).toBe(true));
    });

    it('exposes the favorite set from the server', async () => {
        const { result } = renderHook(() => usePreferences(), { wrapper });
        await waitFor(() => expect(result.current.favoriteExerciseIds.has('b')).toBe(true));
    });

    it('toggleHideExercise calls the server action with the correct args', async () => {
        const { result } = renderHook(() => usePreferences(), { wrapper });
        await waitFor(() => expect(result.current.hiddenExerciseIds.has('a')).toBe(true));

        await act(async () => {
            await result.current.toggleHideExercise('ex-2', true);
        });
        expect(setExercisePreference).toHaveBeenCalledWith('ex-2', 'hidden');

        await act(async () => {
            await result.current.toggleHideExercise('a', false);
        });
        expect(setExercisePreference).toHaveBeenCalledWith('a', null);
    });

    it('toggleFavorite calls the server action with the correct preference', async () => {
        const { result } = renderHook(() => usePreferences(), { wrapper });
        await waitFor(() => expect(result.current.favoriteExerciseIds.has('b')).toBe(true));

        await act(() => result.current.toggleFavorite('a', true));
        expect(setExercisePreference).toHaveBeenCalledWith('a', 'favorite');
    });

    it('toggling favorite on a hidden exercise clears it from hidden (mutual exclusivity)', async () => {
        const { result } = renderHook(() => usePreferences(), { wrapper });
        await waitFor(() => expect(result.current.hiddenExerciseIds.has('a')).toBe(true));

        // Apply optimistic update without awaiting the full async (including revalidation).
        // This verifies the immediate local state change before the server re-fetch.
        let resolveAction!: () => void;
        setExercisePreference.mockImplementationOnce(
            () =>
                new Promise<void>((res) => {
                    resolveAction = res;
                }),
        );

        act(() => {
            void result.current.toggleFavorite('a', true);
        });

        // Optimistic update should have fired synchronously inside act
        await waitFor(() => {
            expect(result.current.hiddenExerciseIds.has('a')).toBe(false);
            expect(result.current.favoriteExerciseIds.has('a')).toBe(true);
        });

        // Let the server action resolve so the test teardown is clean
        await act(async () => {
            resolveAction();
        });
    });
});
