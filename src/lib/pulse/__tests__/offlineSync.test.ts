import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../offlineQueue', () => ({
    enqueue: vi.fn().mockResolvedValue(undefined),
    allQueued: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
    deadLetter: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/app/pulse/actions', () => ({
    upsertLog: vi.fn().mockResolvedValue(undefined),
    deleteLogRow: vi.fn().mockResolvedValue(undefined),
    saveNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
}));

import { enqueue, allQueued, remove, deadLetter, type QueuedMutation } from '../offlineQueue';
import { upsertLog } from '@/app/pulse/actions';
import { runMutation, flushQueue, isPermanentFailure } from '../offlineSync';

const USER_A = 'user-a';
const USER_B = 'user-b';

function setOnline(value: boolean) {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

beforeEach(() => {
    vi.mocked(enqueue).mockClear();
    vi.mocked(allQueued).mockClear().mockResolvedValue([]);
    vi.mocked(remove).mockClear();
    vi.mocked(deadLetter).mockClear().mockResolvedValue(undefined);
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

describe('isPermanentFailure', () => {
    it('classifies validation / not-found rejections as permanent (replay can never succeed)', () => {
        expect(isPermanentFailure(new Error('Invalid data'))).toBe(true);
        expect(isPermanentFailure(new Error('Invalid id'))).toBe(true);
        expect(isPermanentFailure(new Error('Routine not found'))).toBe(true);
        expect(isPermanentFailure(new Error('Not found'))).toBe(true);
    });

    it('classifies network, server-blip, and auth-expiry as transient (retry later)', () => {
        expect(isPermanentFailure(new Error('Failed to fetch'))).toBe(false);
        expect(isPermanentFailure(new Error('Failed to save'))).toBe(false);
        // Auth-expiry: the queue only holds the current user's own writes, so a
        // replay 'Unauthorized' means the session lapsed, which a re-login fixes.
        expect(isPermanentFailure(new Error('Unauthorized'))).toBe(false);
        expect(isPermanentFailure(new TypeError('NetworkError when attempting to fetch'))).toBe(false);
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
        expect(res).toEqual({ flushed: 2, remaining: 0, deadLettered: 0 });
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
        expect(res).toEqual({ flushed: 2, remaining: 1, deadLettered: 0 });
    });

    it('stops on a TRANSIENT failure and retains the rest for retry (no data loss)', async () => {
        const a1: QueuedMutation = { id: 1, type: 'upsertLog', args: ['a', {}], enqueuedAt: 'x', userId: USER_A };
        const a2: QueuedMutation = { id: 2, type: 'upsertLog', args: ['b', {}], enqueuedAt: 'x', userId: USER_A };
        vi.mocked(allQueued).mockResolvedValueOnce([a1, a2]).mockResolvedValueOnce([a1, a2]);
        vi.mocked(upsertLog).mockRejectedValueOnce(new Error('Failed to fetch'));
        const res = await flushQueue(USER_A);
        expect(upsertLog).toHaveBeenCalledTimes(1);
        expect(remove).not.toHaveBeenCalled();
        expect(deadLetter).not.toHaveBeenCalled();
        expect(res).toEqual({ flushed: 0, remaining: 2, deadLettered: 0 });
    });

    it('dead-letters a PERMANENT failure and continues past it (no head-of-line stall)', async () => {
        const poison: QueuedMutation = { id: 1, type: 'upsertLog', args: ['bad', {}], enqueuedAt: 'x', userId: USER_A };
        const good: QueuedMutation = { id: 2, type: 'upsertLog', args: ['good', {}], enqueuedAt: 'x', userId: USER_A };
        vi.mocked(allQueued).mockResolvedValueOnce([poison, good]).mockResolvedValueOnce([]);
        vi.mocked(upsertLog).mockRejectedValueOnce(new Error('Invalid data')).mockResolvedValueOnce(undefined);
        const res = await flushQueue(USER_A);
        // The poison write did NOT stall the queue: the good write behind it still flushed.
        expect(upsertLog).toHaveBeenCalledTimes(2);
        expect(deadLetter).toHaveBeenCalledWith(poison);
        expect(remove).toHaveBeenCalledWith(1); // poison removed from the main queue
        expect(remove).toHaveBeenCalledWith(2); // good write flushed and removed
        expect(res).toEqual({ flushed: 1, remaining: 0, deadLettered: 1 });
    });

    it('treats auth-expiry (Unauthorized) as transient — stops, retains, does not dead-letter', async () => {
        const a1: QueuedMutation = { id: 1, type: 'upsertLog', args: ['a', {}], enqueuedAt: 'x', userId: USER_A };
        const a2: QueuedMutation = { id: 2, type: 'upsertLog', args: ['b', {}], enqueuedAt: 'x', userId: USER_A };
        vi.mocked(allQueued).mockResolvedValueOnce([a1, a2]).mockResolvedValueOnce([a1, a2]);
        vi.mocked(upsertLog).mockRejectedValueOnce(new Error('Unauthorized'));
        const res = await flushQueue(USER_A);
        expect(upsertLog).toHaveBeenCalledTimes(1);
        expect(deadLetter).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
        expect(res).toEqual({ flushed: 0, remaining: 2, deadLettered: 0 });
    });
});
