import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../offlineQueue', () => ({
    enqueue: vi.fn().mockResolvedValue(undefined),
    allQueued: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/app/pulse/actions', () => ({
    upsertLog: vi.fn().mockResolvedValue(undefined),
    deleteLogRow: vi.fn().mockResolvedValue(undefined),
    saveNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
}));

import { enqueue, allQueued, remove, type QueuedMutation } from '../offlineQueue';
import { upsertLog } from '@/app/pulse/actions';
import { runMutation, flushQueue } from '../offlineSync';

function setOnline(value: boolean) {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

beforeEach(() => {
    vi.mocked(enqueue).mockClear();
    vi.mocked(allQueued).mockClear().mockResolvedValue([]);
    vi.mocked(remove).mockClear();
    vi.mocked(upsertLog).mockClear().mockResolvedValue(undefined);
});

afterEach(() => {
    setOnline(true);
});

describe('runMutation', () => {
    it('enqueues and does not call the action when offline', async () => {
        setOnline(false);
        await runMutation('upsertLog', ['1-x-0', { kg: 80, reps: 8, rir: 2, saved: true }]);
        expect(enqueue).toHaveBeenCalledTimes(1);
        expect(upsertLog).not.toHaveBeenCalled();
    });

    it('calls the action once and does not enqueue when online and successful', async () => {
        setOnline(true);
        await runMutation('upsertLog', ['1-x-0', { kg: 80, reps: 8, rir: 2, saved: true }]);
        expect(upsertLog).toHaveBeenCalledTimes(1);
        expect(enqueue).not.toHaveBeenCalled();
    });

    it('enqueues when the online action rejects', async () => {
        setOnline(true);
        vi.mocked(upsertLog).mockRejectedValueOnce(new Error('network'));
        await runMutation('upsertLog', ['1-x-0', { kg: 80, reps: 8, rir: 2, saved: true }]);
        expect(upsertLog).toHaveBeenCalledTimes(1);
        expect(enqueue).toHaveBeenCalledTimes(1);
    });
});

describe('flushQueue', () => {
    it('replays all items, removes each, and reports counts', async () => {
        const m1: QueuedMutation = { id: 1, type: 'upsertLog', args: ['a', {}], enqueuedAt: 'x' };
        const m2: QueuedMutation = { id: 2, type: 'upsertLog', args: ['b', {}], enqueuedAt: 'x' };
        vi.mocked(allQueued).mockResolvedValueOnce([m1, m2]).mockResolvedValueOnce([]);
        const res = await flushQueue();
        expect(upsertLog).toHaveBeenCalledTimes(2);
        expect(remove).toHaveBeenCalledWith(1);
        expect(remove).toHaveBeenCalledWith(2);
        expect(res).toEqual({ flushed: 2, remaining: 0 });
    });

    it('stops on the first failure and does not replay the rest', async () => {
        const m1: QueuedMutation = { id: 1, type: 'upsertLog', args: ['a', {}], enqueuedAt: 'x' };
        const m2: QueuedMutation = { id: 2, type: 'upsertLog', args: ['b', {}], enqueuedAt: 'x' };
        vi.mocked(allQueued).mockResolvedValueOnce([m1, m2]).mockResolvedValueOnce([m1, m2]);
        vi.mocked(upsertLog).mockRejectedValueOnce(new Error('still offline'));
        const res = await flushQueue();
        expect(upsertLog).toHaveBeenCalledTimes(1);
        expect(remove).not.toHaveBeenCalled();
        expect(res.flushed).toBe(0);
    });
});
