import { upsertLog, deleteLogRow, saveNote, deleteNote } from '@/app/pulse/actions';
import { enqueue, allQueued, remove, deadLetter, type QueuedMutation } from './offlineQueue';

type MutationType = QueuedMutation['type'];

function nowIso(): string {
    return new Date().toISOString();
}

const ACTIONS: Record<MutationType, (args: unknown[]) => Promise<unknown>> = {
    upsertLog: (a) =>
        upsertLog(
            a[0] as string,
            a[1] as Parameters<typeof upsertLog>[1],
            a[2] as string | null | undefined,
            a[3] as string | null | undefined,
        ),
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

// A queued write fails *permanently* when replaying it can never succeed: the
// input is invalid or the target row is gone (the server actions throw
// 'Invalid …' / '… not found' for these). Everything else, network loss, a
// transient server error, and auth-expiry (a re-login fixes it), is *transient*
// and retried later. Auth-expiry ('Unauthorized') is deliberately transient: the
// queue only ever holds the current user's own writes (flushQueue scopes by
// userId), so an ownership 'Unauthorized' on replay is effectively impossible,
// leaving session expiry as the only realistic cause. Mis-classifying it as
// permanent would dead-letter writes a simple re-login would have flushed.
export function isPermanentFailure(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return /invalid|not found/i.test(message);
}

// Replay the given user's queued mutations FIFO. A *transient* failure stops the
// pass and leaves the rest queued for the next flush (online/focus). A *permanent*
// failure is dead-lettered and skipped so one poison write can't stall every write
// behind it (head-of-line blocking), the failure mode that otherwise drives a
// user to reinstall and lose all unsynced data. Writes owned by a different user
// are left untouched: never replayed (the server stamps auth.uid() at write time,
// so they'd land in the wrong account) and never dropped (that would lose their
// owner's unsynced data). They flush when their owner next signs in.
export async function flushQueue(
    userId: string,
): Promise<{ flushed: number; remaining: number; deadLettered: number }> {
    const items = await allQueued();
    let flushed = 0;
    let deadLettered = 0;
    for (const m of items) {
        if (m.userId !== userId) continue;
        try {
            await ACTIONS[m.type](m.args);
            if (m.id != null) await remove(m.id);
            flushed++;
        } catch (e) {
            if (isPermanentFailure(e)) {
                await deadLetter(m);
                if (m.id != null) await remove(m.id);
                deadLettered++;
                continue;
            }
            break;
        }
    }
    const remaining = (await allQueued()).length;
    return { flushed, remaining, deadLettered };
}
