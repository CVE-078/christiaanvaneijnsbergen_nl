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

const USER_A = 'user-a';
const USER_B = 'user-b';

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
    it('enqueues with the owning user id and does not call the action when offline', async () => {
        setOnline(false);
        await runMutation('upsertLog', ['1-x-0', { kg: 80, reps: 8, rir: 2, saved: true }], USER_A);
        expect(enqueue).toHaveBeenCalledTimes(1);
        expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_A, type: 'upsertLog' }));
        expect(upsertLog).not.toHaveBeenCalled();
    });

    it('calls the action once and does not enqueue when online and successful', async () => {
        setOnline(true);
        await runMutation('upsertLog', ['1-x-0', { kg: 80, reps: 8, rir: 2, saved: true }], USER_A);
        expect(upsertLog).toHaveBeenCalledTimes(1);
        expect(enqueue).not.toHaveBeenCalled();
    });

    it('enqueues with the owning user id when the online action rejects', async () => {
        setOnline(true);
        vi.mocked(upsertLog).mockRejectedValueOnce(new Error('network'));
        await runMutation('upsertLog', ['1-x-0', { kg: 80, reps: 8, rir: 2, saved: true }], USER_A);
        expect(upsertLog).toHaveBeenCalledTimes(1);
        expect(enqueue).toHaveBeenCalledTimes(1);
        expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_A }));
    });
});

describe('flushQueue', () => {
    it("replays only the current user's items, removes each, and reports counts", async () => {
        const a1: QueuedMutation = { id: 1, type: 'upsertLog', args: ['a', {}], enqueuedAt: 'x', userId: USER_A };
        const a2: QueuedMutation = { id: 2, type: 'upsertLog', args: ['b', {}], enqueuedAt: 'x', userId: USER_A };
        vi.mocked(allQueued).mockResolvedValueOnce([a1, a2]).mockResolvedValueOnce([]);
        const res = await flushQueue(USER_A);
        expect(upsertLog).toHaveBeenCalledTimes(2);
        expect(remove).toHaveBeenCalledWith(1);
        expect(remove).toHaveBeenCalledWith(2);
        expect(res).toEqual({ flushed: 2, remaining: 0 });
    });

    it("never replays or removes another user's queued writes", async () => {
        const a1: QueuedMutation = { id: 1, type: 'upsertLog', args: ['a', {}], enqueuedAt: 'x', userId: USER_A };
        const b1: QueuedMutation = { id: 2, type: 'upsertLog', args: ['b', {}], enqueuedAt: 'x', userId: USER_B };
        const a2: QueuedMutation = { id: 3, type: 'upsertLog', args: ['c', {}], enqueuedAt: 'x', userId: USER_A };
        // After A's two items flush, B's item is left queued, never touched.
        vi.mocked(allQueued).mockResolvedValueOnce([a1, b1, a2]).mockResolvedValueOnce([b1]);
        const res = await flushQueue(USER_A);
        expect(upsertLog).toHaveBeenCalledTimes(2);
        expect(remove).toHaveBeenCalledWith(1);
        expect(remove).toHaveBeenCalledWith(3);
        expect(remove).not.toHaveBeenCalledWith(2);
        expect(res).toEqual({ flushed: 2, remaining: 1 });
    });

    it("stops on the first failure of the current user's items and does not replay the rest", async () => {
        const a1: QueuedMutation = { id: 1, type: 'upsertLog', args: ['a', {}], enqueuedAt: 'x', userId: USER_A };
        const a2: QueuedMutation = { id: 2, type: 'upsertLog', args: ['b', {}], enqueuedAt: 'x', userId: USER_A };
        vi.mocked(allQueued).mockResolvedValueOnce([a1, a2]).mockResolvedValueOnce([a1, a2]);
        vi.mocked(upsertLog).mockRejectedValueOnce(new Error('still offline'));
        const res = await flushQueue(USER_A);
        expect(upsertLog).toHaveBeenCalledTimes(1);
        expect(remove).not.toHaveBeenCalled();
        expect(res.flushed).toBe(0);
    });
});
