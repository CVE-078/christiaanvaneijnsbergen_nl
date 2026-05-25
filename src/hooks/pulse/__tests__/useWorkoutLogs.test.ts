import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('swr', () => ({ default: vi.fn() }));
vi.mock('@/app/pulse/actions', () => ({
    saveLogs: vi.fn().mockResolvedValue(undefined),
}));

import useSWR from 'swr';
import { saveLogs } from '@/app/pulse/actions';
import { useWorkoutLogs } from '../useWorkoutLogs';
import type { Logs, LogEntry } from '@/lib/pulse/types';

const mockMutate = vi.fn();

beforeEach(() => {
    vi.mocked(useSWR).mockReturnValue({ data: {}, mutate: mockMutate } as ReturnType<typeof useSWR>);
    mockMutate.mockClear();
    vi.mocked(saveLogs).mockClear();
});

describe('useWorkoutLogs', () => {
    it('returns logs from SWR data', () => {
        const logs: Logs = { '1-push-0-0': { kg: 60, reps: 10, rir: 2, saved: true } };
        vi.mocked(useSWR).mockReturnValue({ data: logs, mutate: mockMutate } as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useWorkoutLogs({}));
        expect(result.current.logs).toEqual(logs);
    });

    it('falls back to initialLogs when SWR data is undefined', () => {
        vi.mocked(useSWR).mockReturnValue({ data: undefined, mutate: mockMutate } as ReturnType<typeof useSWR>);
        const initialLogs: Logs = { '1-push-0-0': { kg: 60, reps: 10, rir: 2, saved: true } };
        const { result } = renderHook(() => useWorkoutLogs(initialLogs));
        expect(result.current.logs).toEqual(initialLogs);
    });

    it('updateLog calls mutate optimistically then calls saveLogs', async () => {
        const { result } = renderHook(() => useWorkoutLogs({}));
        const entry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };

        await act(async () => {
            result.current.updateLog('1-push-0-0', entry);
        });

        expect(mockMutate).toHaveBeenCalledWith({ '1-push-0-0': entry }, false);
        expect(saveLogs).toHaveBeenCalledWith({ '1-push-0-0': entry });
    });

    it('deleteLog removes the key, calls mutate optimistically then saveLogs', async () => {
        const logs: Logs = { '1-push-0-0': { kg: 60, reps: 10, rir: 2, saved: true } };
        vi.mocked(useSWR).mockReturnValue({ data: logs, mutate: mockMutate } as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useWorkoutLogs(logs));

        await act(async () => {
            result.current.deleteLog('1-push-0-0');
        });

        expect(mockMutate).toHaveBeenCalledWith({}, false);
        expect(saveLogs).toHaveBeenCalledWith({});
    });

    it('sets saveError to retry message when saveLogs throws', async () => {
        vi.mocked(saveLogs).mockRejectedValueOnce(new Error('Network error'));
        const { result } = renderHook(() => useWorkoutLogs({}));

        await act(async () => {
            result.current.updateLog('1-push-0-0', { kg: 80, reps: 8, rir: 2, saved: true });
        });

        expect(result.current.saveError).toBe('Failed to save. Retrying…');
    });

    it('saveError starts as null', () => {
        const { result } = renderHook(() => useWorkoutLogs({}));
        expect(result.current.saveError).toBeNull();
    });
});
