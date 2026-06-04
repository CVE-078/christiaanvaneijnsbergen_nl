import useSWR from 'swr';
import { useCallback, useMemo } from 'react';
import { setExercisePreference as serverSetExercisePreference } from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';

const PREFERENCES_KEY = '/api/pulse/preferences';

// Stable empty default so the `data ?? EMPTY` fallback keeps a constant identity
// across renders (otherwise the memo/useCallback deps churn every render).
const EMPTY: string[] = [];

export function usePreferences() {
    const { data, mutate, isLoading, error } = useSWR<string[]>(PREFERENCES_KEY, fetcher, SWR_READ_OPTS);
    const hiddenIds = data ?? EMPTY;

    const hiddenExerciseIds = useMemo(() => new Set(hiddenIds), [hiddenIds]);

    const toggleHideExercise = useCallback(
        async (exerciseId: string, hidden: boolean): Promise<void> => {
            const next = hidden
                ? [...new Set([...hiddenIds, exerciseId])]
                : hiddenIds.filter((id) => id !== exerciseId);
            mutate(next, false);
            await serverSetExercisePreference(exerciseId, hidden ? 'hidden' : null);
        },
        [hiddenIds, mutate],
    );

    return { hiddenExerciseIds, toggleHideExercise, loading: isLoading, error };
}
