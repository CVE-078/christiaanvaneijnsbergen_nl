import useSWR from 'swr';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import type { DecisionEventRow } from '@/lib/pulse/types';

const DECISIONS_KEY = '/api/pulse/decisions';

// Stable empty default so consumers keep a constant dependency identity until the
// fetch resolves.
const EMPTY: DecisionEventRow[] = [];

// Read-only feed of the unified decision log (newest first). Decision events are
// written best-effort at set-save (see PulseProvider.logSet) and as ramp-back
// acceptances, so this hook only reads; it has no mutators.
export function useDecisionEvents() {
    const { data, isLoading, error } = useSWR<DecisionEventRow[]>(DECISIONS_KEY, fetcher, SWR_READ_OPTS);
    return { decisions: data ?? EMPTY, loading: isLoading, error };
}
