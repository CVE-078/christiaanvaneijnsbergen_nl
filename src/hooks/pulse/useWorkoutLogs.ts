import useSWR from 'swr';
import { useCallback, useRef, useEffect } from 'react';
import { saveLogs } from '@/app/pulse/actions';
import { fetcher } from '@/lib/pulse/fetcher';
import type { Logs, LogEntry } from '@/lib/pulse/types';

const LOGS_KEY = '/api/pulse/logs';

export function useWorkoutLogs(initialLogs: Logs, onError?: (msg: string) => void) {
    const { data, mutate } = useSWR<Logs>(LOGS_KEY, fetcher, {
        fallbackData: initialLogs,
        revalidateOnFocus: false,
        revalidateIfStale: false,
    });
    const logs = data ?? initialLogs;

    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (retryRef.current) clearTimeout(retryRef.current);
        };
    }, []);

    const persist = useCallback(
        (newLogs: Logs) => {
            mutate(newLogs, false);
            if (retryRef.current) clearTimeout(retryRef.current);

            saveLogs(newLogs).catch(() => {
                onError?.('Failed to save. Retrying…');
                retryRef.current = setTimeout(
                    () => saveLogs(newLogs).catch(() => onError?.('Save failed. Check your connection.')),
                    3000,
                );
            });
        },
        [mutate, onError],
    );

    const updateLog = useCallback(
        (key: string, entry: LogEntry) => {
            persist({ ...logs, [key]: entry });
        },
        [logs, persist],
    );

    const deleteLog = useCallback(
        (key: string) => {
            const newLogs = { ...logs };
            delete newLogs[key];
            persist(newLogs);
        },
        [logs, persist],
    );

    function handleExport() {
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pulse-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return { logs, updateLog, deleteLog, handleExport };
}
