import useSWR from 'swr';
import { useCallback, useMemo } from 'react';
import { setExercisePreference as serverSetExercisePreference } from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';

const PREFERENCES_KEY = '/api/pulse/preferences';
const EMPTY = { hidden: [] as string[], favorite: [] as string[] };

export function usePreferences() {
    const { data, mutate, isLoading, error } = useSWR<{ hidden: string[]; favorite: string[] }>(
        PREFERENCES_KEY,
        fetcher,
        SWR_READ_OPTS,
    );
    const prefs = data ?? EMPTY;
    const hiddenExerciseIds = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);
    const favoriteExerciseIds = useMemo(() => new Set(prefs.favorite), [prefs.favorite]);

    const toggleHideExercise = useCallback(
        async (exerciseId: string, hidden: boolean): Promise<void> => {
            // Mutually exclusive: hiding clears any favorite locally.
            const next = hidden
                ? { hidden: [...new Set([...prefs.hidden, exerciseId])], favorite: prefs.favorite.filter((id) => id !== exerciseId) }
                : { ...prefs, hidden: prefs.hidden.filter((id) => id !== exerciseId) };
            mutate(next, false);
            await serverSetExercisePreference(exerciseId, hidden ? 'hidden' : null);
            mutate();
        },
        [prefs, mutate],
    );

    const toggleFavorite = useCallback(
        async (exerciseId: string, favorite: boolean): Promise<void> => {
            const next = favorite
                ? { hidden: prefs.hidden.filter((id) => id !== exerciseId), favorite: [...new Set([...prefs.favorite, exerciseId])] }
                : { ...prefs, favorite: prefs.favorite.filter((id) => id !== exerciseId) };
            mutate(next, false);
            await serverSetExercisePreference(exerciseId, favorite ? 'favorite' : null);
            mutate();
        },
        [prefs, mutate],
    );

    return { hiddenExerciseIds, favoriteExerciseIds, toggleHideExercise, toggleFavorite, loading: isLoading, error };
}
