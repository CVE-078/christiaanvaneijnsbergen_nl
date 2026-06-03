import useSWR from 'swr';
import { useCallback } from 'react';
import { saveNote as serverSaveNote, deleteNote as serverDeleteNote } from '@/app/pulse/actions';
import { fetcher } from '@/lib/pulse/fetcher';
import type { Notes } from '@/lib/pulse/types';

const NOTES_KEY = '/api/pulse/notes';

export function useNotes(initialNotes: Notes) {
    const { data, mutate } = useSWR<Notes>(NOTES_KEY, fetcher, {
        fallbackData: initialNotes,
        revalidateOnFocus: false,
        revalidateIfStale: false,
    });
    const notes = data ?? initialNotes;

    const saveNote = useCallback(
        async (week: number, routineExerciseId: string, note: string): Promise<void> => {
            const key = `${week}-${routineExerciseId}`;
            mutate({ ...notes, [key]: note }, false);
            await serverSaveNote(week, routineExerciseId, note);
        },
        [notes, mutate],
    );

    const deleteNote = useCallback(
        async (week: number, routineExerciseId: string): Promise<void> => {
            const key = `${week}-${routineExerciseId}`;
            const updated = { ...notes };
            delete updated[key];
            mutate(updated, false);
            await serverDeleteNote(week, routineExerciseId);
        },
        [notes, mutate],
    );

    return { notes, saveNote, deleteNote };
}
