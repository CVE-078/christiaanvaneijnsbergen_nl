import useSWR from 'swr';
import { useCallback } from 'react';
import { pauseProgram as serverPause, resumeProgram as serverResume } from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import type { ProgramPause } from '@/lib/pulse/types';

const PAUSES_KEY = '/api/pulse/pauses';

// Stable empty default so the provider's position memo keeps a constant
// dependency identity across renders.
const EMPTY: ProgramPause[] = [];

export function useProgramPauses() {
    const { data, mutate, isLoading, error } = useSWR<ProgramPause[]>(PAUSES_KEY, fetcher, SWR_READ_OPTS);
    const pauses = data ?? EMPTY;

    // Open a pause for the routine. No-op if one is already active (the action is
    // idempotent at the DB; we also guard the optimistic update so it stays clean).
    const pauseProgram = useCallback(
        async (routineId: string): Promise<void> => {
            if (pauses.some((p) => p.routine_id === routineId && p.resumed_at === null)) return;
            const nowIso = new Date().toISOString();
            const optimistic: ProgramPause = {
                id: `optimistic-pause-${routineId}`,
                routine_id: routineId,
                paused_at: nowIso,
                resumed_at: null,
                reason: null,
                created_at: nowIso,
            };
            mutate([...pauses, optimistic], false);
            await serverPause(routineId);
            mutate();
        },
        [pauses, mutate],
    );

    // Close the active pause for the routine.
    const resumeProgram = useCallback(
        async (routineId: string): Promise<void> => {
            const nowIso = new Date().toISOString();
            mutate(
                pauses.map((p) =>
                    p.routine_id === routineId && p.resumed_at === null ? { ...p, resumed_at: nowIso } : p,
                ),
                false,
            );
            await serverResume(routineId);
            mutate();
        },
        [pauses, mutate],
    );

    return { pauses, pauseProgram, resumeProgram, loading: isLoading, error };
}
