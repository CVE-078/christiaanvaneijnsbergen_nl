import { upsertLog, deleteLogRow, saveNote, deleteNote } from '@/app/pulse/actions';
import { enqueue, allQueued, remove, type QueuedMutation } from './offlineQueue';

type MutationType = QueuedMutation['type'];

function nowIso(): string {
    return new Date().toISOString();
}

const ACTIONS: Record<MutationType, (args: unknown[]) => Promise<unknown>> = {
    upsertLog: (a) => upsertLog(a[0] as string, a[1] as Parameters<typeof upsertLog>[1]),
    deleteLogRow: (a) => deleteLogRow(a[0] as string),
    saveNote: (a) => saveNote(a[0] as number, a[1] as string, a[2] as string),
    deleteNote: (a) => deleteNote(a[0] as number, a[1] as string),
};

// Run a mutation, queuing it to IndexedDB when offline or on network failure.
// The caller applies the optimistic SWR mutate first; this never throws.
export async function runMutation(type: MutationType, args: unknown[]): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await enqueue({ type, args, enqueuedAt: nowIso() });
        return;
    }
    try {
        await ACTIONS[type](args);
    } catch {
        await enqueue({ type, args, enqueuedAt: nowIso() });
    }
}

// Replay queued mutations FIFO; stop on the first failure (still offline).
export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
    const items = await allQueued();
    let flushed = 0;
    for (const m of items) {
        try {
            await ACTIONS[m.type](m.args);
            if (m.id != null) await remove(m.id);
            flushed++;
        } catch {
            break;
        }
    }
    const remaining = (await allQueued()).length;
    return { flushed, remaining };
}
