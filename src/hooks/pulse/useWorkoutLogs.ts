import useSWR from 'swr';
import { useCallback } from 'react';
import { runMutation } from '@/lib/pulse/offlineSync';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import type { Logs, LogEntry } from '@/lib/pulse/types';

const LOGS_KEY = '/api/pulse/logs';

// Stable empty default so the `data ?? EMPTY` fallback keeps a constant identity
// across renders (otherwise the useCallback deps below churn every render).
const EMPTY_LOGS: Logs = {};

// `onError` is retained for signature compatibility with existing callers. Failed
// writes are now durably queued to IndexedDB and replayed on reconnect (see
// offlineSync), so it is no longer invoked here. `userId` stamps each queued write
// so a shared device never replays it into another account on flush.
export function useWorkoutLogs(userId: string, _onError?: (msg: string) => void) {
    const { data, mutate, isLoading, error } = useSWR<Logs>(LOGS_KEY, fetcher, SWR_READ_OPTS);
    const logs = data ?? EMPTY_LOGS;

    const updateLog = useCallback(
        (key: string, entry: LogEntry) => {
            mutate({ ...logs, [key]: entry }, false);
            runMutation('upsertLog', [key, entry], userId);
        },
        [logs, mutate, userId],
    );

    const deleteLog = useCallback(
        (key: string) => {
            const newLogs = { ...logs };
            delete newLogs[key];
            mutate(newLogs, false);
            runMutation('deleteLogRow', [key], userId);
        },
        [logs, mutate, userId],
    );

    return { logs, updateLog, deleteLog, loading: isLoading, error };
}
