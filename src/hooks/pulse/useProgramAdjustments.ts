import useSWR from 'swr';
import { useCallback } from 'react';
import { acceptReentryDeload as serverAccept, dismissReentry as serverDismiss } from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import type { ProgramAdjustment, AdjustmentKind } from '@/lib/pulse/types';

const ADJUSTMENTS_KEY = '/api/pulse/adjustments';

// Stable empty default so the provider's regen-suggestion memo keeps a constant
// dependency identity across renders.
const EMPTY: ProgramAdjustment[] = [];

export function useProgramAdjustments() {
    const { data, mutate, isLoading, error } = useSWR<ProgramAdjustment[]>(ADJUSTMENTS_KEY, fetcher, SWR_READ_OPTS);
    const adjustments = data ?? EMPTY;

    // Optimistic next state: one decision per (routine, week), so replace any
    // existing decision for that week with the new one.
    const withDecision = useCallback(
        (routineId: string, weekInteger: number, kind: AdjustmentKind): ProgramAdjustment[] => {
            const optimistic: ProgramAdjustment = {
                id: `optimistic-${kind}-${weekInteger}`,
                routine_id: routineId,
                kind,
                effective_week: weekInteger,
                created_at: new Date().toISOString(),
                payload: {},
            };
            const others = adjustments.filter(
                (a) => !(a.routine_id === routineId && a.effective_week === weekInteger),
            );
            return [...others, optimistic];
        },
        [adjustments],
    );

    const acceptReentryDeload = useCallback(
        async (routineId: string, weekInteger: number, daysAway?: number): Promise<void> => {
            mutate(withDecision(routineId, weekInteger, 'reentry_deload'), false);
            await serverAccept(routineId, weekInteger, daysAway);
            mutate();
        },
        [withDecision, mutate],
    );

    const dismissReentry = useCallback(
        async (routineId: string, weekInteger: number): Promise<void> => {
            mutate(withDecision(routineId, weekInteger, 'reentry_dismissed'), false);
            await serverDismiss(routineId, weekInteger);
            mutate();
        },
        [withDecision, mutate],
    );

    return { adjustments, acceptReentryDeload, dismissReentry, loading: isLoading, error };
}
