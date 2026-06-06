import useSWR from 'swr';
import { useCallback } from 'react';
import { runMutation } from '@/lib/pulse/offlineSync';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import type { Notes } from '@/lib/pulse/types';

const NOTES_KEY = '/api/pulse/notes';

// Stable empty default so the `data ?? EMPTY` fallback keeps a constant identity
// across renders (otherwise the useCallback deps below churn every render).
const EMPTY_NOTES: Notes = {};

// `userId` stamps each queued write so offline notes replay only under their
// owner's session on flush (see offlineSync.flushQueue).
export function useNotes(userId: string) {
    const { data, mutate, isLoading, error } = useSWR<Notes>(NOTES_KEY, fetcher, SWR_READ_OPTS);
    const notes = data ?? EMPTY_NOTES;

    const saveNote = useCallback(
        async (week: number, routineExerciseId: string, note: string): Promise<void> => {
            const key = `${week}-${routineExerciseId}`;
            mutate({ ...notes, [key]: note }, false);
            await runMutation('saveNote', [week, routineExerciseId, note], userId);
        },
        [notes, mutate, userId],
    );

    const deleteNote = useCallback(
        async (week: number, routineExerciseId: string): Promise<void> => {
            const key = `${week}-${routineExerciseId}`;
            const updated = { ...notes };
            delete updated[key];
            mutate(updated, false);
            await runMutation('deleteNote', [week, routineExerciseId], userId);
        },
        [notes, mutate, userId],
    );

    return { notes, saveNote, deleteNote, loading: isLoading, error };
}
