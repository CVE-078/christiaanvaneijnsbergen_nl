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
// The caller applies the optimistic SWR mutate first; this never throws. Each
// queued write is stamped with its owning userId so flushQueue can scope replay
// to the current session.
export async function runMutation(type: MutationType, args: unknown[], userId: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await enqueue({ type, args, userId, enqueuedAt: nowIso() });
        return;
    }
    try {
        await ACTIONS[type](args);
    } catch {
        await enqueue({ type, args, userId, enqueuedAt: nowIso() });
    }
}

// Replay the given user's queued mutations FIFO; stop on the first failure (still
// offline). Writes owned by a different user are left untouched — never replayed
// (the server stamps auth.uid() at write time, so replaying them under another
// session would land them in the wrong account) and never dropped (which would
// lose their owner's unsynced data). They flush when their owner next signs in.
export async function flushQueue(userId: string): Promise<{ flushed: number; remaining: number }> {
    const items = await allQueued();
    let flushed = 0;
    for (const m of items) {
        if (m.userId !== userId) continue;
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
