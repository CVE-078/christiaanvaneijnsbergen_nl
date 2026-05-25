import useSWR from 'swr';
import { useCallback, useRef, useState, useEffect } from 'react';
import { saveLogs } from '@/app/pulse/actions';
import type { Logs, LogEntry } from '@/lib/pulse/types';

const LOGS_KEY = '/api/pulse/logs';

async function fetchLogs(url: string): Promise<Logs> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json() as Promise<Logs>;
}

export function useWorkoutLogs(initialLogs: Logs) {
    const { data, mutate } = useSWR<Logs>(LOGS_KEY, fetchLogs, {
        fallbackData: initialLogs,
        revalidateOnFocus: false,
    });
    const logs = data ?? initialLogs;

    const [saveError, setSaveError] = useState<string | null>(null);
    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (retryRef.current) clearTimeout(retryRef.current);
        };
    }, []);

    const persist = useCallback(
        (newLogs: Logs) => {
            mutate(newLogs, false);
            setSaveError(null);
            if (retryRef.current) clearTimeout(retryRef.current);

            saveLogs(newLogs).catch(() => {
                setSaveError('Failed to save. Retrying…');
                retryRef.current = setTimeout(
                    () =>
                        saveLogs(newLogs).catch(() =>
                            setSaveError('Save failed. Check your connection.'),
                        ),
                    3000,
                );
            });
        },
        [mutate],
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

    return { logs, saveError, updateLog, deleteLog, handleExport };
}
