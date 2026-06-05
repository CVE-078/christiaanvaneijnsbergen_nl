import useSWR from 'swr';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import type { WorkoutSession } from '@/lib/pulse/types';

const SESSIONS_KEY = '/api/pulse/sessions';

// Stable empty default so `data ?? EMPTY` keeps a constant identity across
// renders (the provider memoizes the derived program position off this array).
const EMPTY: WorkoutSession[] = [];

// Read-only feed of the user's workout sessions (the date spine for adherence).
// Sessions are created/completed via useWorkoutSession; revalidate via
// refreshSessions after completing one so the derived position stays live.
export function useSessions() {
    const { data, mutate, isLoading, error } = useSWR<WorkoutSession[]>(SESSIONS_KEY, fetcher, SWR_READ_OPTS);
    return { sessions: data ?? EMPTY, refreshSessions: mutate, loading: isLoading, error };
}
