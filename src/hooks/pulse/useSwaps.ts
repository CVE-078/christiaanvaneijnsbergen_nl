import useSWR from 'swr';
import { useCallback } from 'react';
import { setExerciseSwap, clearExerciseSwap } from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import { swapKey } from '@/lib/pulse/utils';
import type { Swaps, SwapReason } from '@/lib/pulse/types';

const SWAPS_KEY = '/api/pulse/swaps';

// Stable empty default so the `data ?? EMPTY` fallback keeps a constant identity
// across renders (otherwise the useCallback deps below churn every render).
const EMPTY_SWAPS: Swaps = {};

export function useSwaps() {
    const { data, mutate, isLoading, error } = useSWR<Swaps>(SWAPS_KEY, fetcher, SWR_READ_OPTS);
    const swaps = data ?? EMPTY_SWAPS;

    const setSwap = useCallback(
        async (week: number, routineExerciseId: string, exerciseId: string, reason?: SwapReason): Promise<void> => {
            mutate({ ...swaps, [swapKey(week, routineExerciseId)]: exerciseId }, false);
            await setExerciseSwap(routineExerciseId, week, exerciseId, reason);
            mutate();
        },
        [swaps, mutate],
    );

    const clearSwap = useCallback(
        async (week: number, routineExerciseId: string): Promise<void> => {
            const updated = { ...swaps };
            delete updated[swapKey(week, routineExerciseId)];
            mutate(updated, false);
            await clearExerciseSwap(routineExerciseId, week);
            mutate();
        },
        [swaps, mutate],
    );

    return { swaps, setSwap, clearSwap, loading: isLoading, error };
}
