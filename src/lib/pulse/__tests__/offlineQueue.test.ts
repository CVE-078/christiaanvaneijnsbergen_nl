import { describe, it, expect } from 'vitest';
import { enqueue, allQueued, remove, clear, count } from '../offlineQueue';

// jsdom has no indexedDB, so the module's `hasIDB()` guard short-circuits every
// operation. We assert the guarded behavior here; real IndexedDB is verified in-browser.
describe('offlineQueue (no IndexedDB guard)', () => {
    it('enqueue resolves without throwing', async () => {
        await expect(
            enqueue({ type: 'upsertLog', args: ['1-x-0', {}], enqueuedAt: '2026-06-04T00:00:00.000Z' }),
        ).resolves.toBeUndefined();
    });

    it('allQueued returns an empty array', async () => {
        await expect(allQueued()).resolves.toEqual([]);
    });

    it('count returns 0', async () => {
        await expect(count()).resolves.toBe(0);
    });

    it('remove resolves without throwing', async () => {
        await expect(remove(1)).resolves.toBeUndefined();
    });

    it('clear resolves without throwing', async () => {
        await expect(clear()).resolves.toBeUndefined();
    });
});
