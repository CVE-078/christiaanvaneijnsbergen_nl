import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('swr', () => ({ default: vi.fn() }));
vi.mock('@/app/pulse/actions', () => ({
    upsertLog: vi.fn().mockResolvedValue(undefined),
    deleteLogRow: vi.fn().mockResolvedValue(undefined),
}));

import useSWR from 'swr';
import { upsertLog, deleteLogRow } from '@/app/pulse/actions';
import { useWorkoutLogs } from '../useWorkoutLogs';
import type { Logs, LogEntry } from '@/lib/pulse/types';

const mockMutate = vi.fn();

beforeEach(() => {
    vi.mocked(useSWR).mockReturnValue({ data: {}, mutate: mockMutate } as unknown as ReturnType<typeof useSWR>);
    mockMutate.mockClear();
    vi.mocked(upsertLog).mockClear();
    vi.mocked(deleteLogRow).mockClear();
});

describe('useWorkoutLogs', () => {
    it('returns logs from SWR data', () => {
        const logs: Logs = { '1-push-0-0': { kg: 60, reps: 10, rir: 2, saved: true } };
        vi.mocked(useSWR).mockReturnValue({ data: logs, mutate: mockMutate } as unknown as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useWorkoutLogs());
        expect(result.current.logs).toEqual(logs);
    });

    it('defaults to empty logs when SWR data is undefined', () => {
        vi.mocked(useSWR).mockReturnValue({ data: undefined, mutate: mockMutate } as unknown as ReturnType<
            typeof useSWR
        >);
        const { result } = renderHook(() => useWorkoutLogs());
        // With no resolved SWR data the hook reports empty (client-fetch model).
        expect(result.current.logs).toEqual({});
    });

    it('updateLog calls mutate optimistically then upserts the single row', async () => {
        const { result } = renderHook(() => useWorkoutLogs());
        const entry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };

        await act(async () => {
            result.current.updateLog('1-push-0-0', entry);
        });

        expect(mockMutate).toHaveBeenCalledWith({ '1-push-0-0': entry }, false);
        expect(upsertLog).toHaveBeenCalledWith('1-push-0-0', entry);
    });

    it('deleteLog removes the key, calls mutate optimistically then deletes the single row', async () => {
        const logs: Logs = { '1-push-0-0': { kg: 60, reps: 10, rir: 2, saved: true } };
        vi.mocked(useSWR).mockReturnValue({ data: logs, mutate: mockMutate } as unknown as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useWorkoutLogs());

        await act(async () => {
            result.current.deleteLog('1-push-0-0');
        });

        expect(mockMutate).toHaveBeenCalledWith({}, false);
        expect(deleteLogRow).toHaveBeenCalledWith('1-push-0-0');
    });

    it('does not throw when the upsert fails (write is durably queued by runMutation)', async () => {
        // Failed writes are now queued to IndexedDB and replayed on reconnect, so the
        // hook no longer surfaces an error or calls onError; it must simply not throw.
        vi.mocked(upsertLog).mockRejectedValueOnce(new Error('Network error'));
        const onError = vi.fn();
        const { result } = renderHook(() => useWorkoutLogs(onError));

        await expect(
            act(async () => {
                result.current.updateLog('1-push-0-0', { kg: 80, reps: 8, rir: 2, saved: true });
            }),
        ).resolves.not.toThrow();
        expect(onError).not.toHaveBeenCalled();
    });
});
