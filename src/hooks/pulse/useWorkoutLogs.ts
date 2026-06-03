import useSWR from 'swr';
import { useCallback, useRef, useEffect } from 'react';
import { upsertLog, deleteLogRow } from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import type { Logs, LogEntry } from '@/lib/pulse/types';

const LOGS_KEY = '/api/pulse/logs';

// Stable empty default so the `data ?? EMPTY` fallback keeps a constant identity
// across renders (otherwise the useCallback deps below churn every render).
const EMPTY_LOGS: Logs = {};

export function useWorkoutLogs(initialLogs?: Logs, onError?: (msg: string) => void) {
    const { data, mutate, isLoading, error } = useSWR<Logs>(LOGS_KEY, fetcher, {
        fallbackData: initialLogs,
        ...SWR_READ_OPTS,
    });
    const logs = data ?? EMPTY_LOGS;

    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (retryRef.current) clearTimeout(retryRef.current);
        };
    }, []);

    // Run a single-row write with one retry on failure. The optimistic SWR mutate
    // is done by the caller before this; only the server write is retried.
    const runWithRetry = useCallback(
        (op: () => Promise<unknown>) => {
            if (retryRef.current) clearTimeout(retryRef.current);
            op().catch(() => {
                onError?.('Failed to save. Retrying…');
                retryRef.current = setTimeout(
                    () => op().catch(() => onError?.('Save failed. Check your connection.')),
                    3000,
                );
            });
        },
        [onError],
    );

    const updateLog = useCallback(
        (key: string, entry: LogEntry) => {
            mutate({ ...logs, [key]: entry }, false);
            runWithRetry(() => upsertLog(key, entry));
        },
        [logs, mutate, runWithRetry],
    );

    const deleteLog = useCallback(
        (key: string) => {
            const newLogs = { ...logs };
            delete newLogs[key];
            mutate(newLogs, false);
            runWithRetry(() => deleteLogRow(key));
        },
        [logs, mutate, runWithRetry],
    );

    const handleExport = useCallback(() => {
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pulse-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [logs]);

    return { logs, updateLog, deleteLog, handleExport, loading: isLoading, error };
}
