export interface QueuedMutation {
    id?: number;
    type: 'upsertLog' | 'deleteLogRow' | 'saveNote' | 'deleteNote';
    args: unknown[];
    // The user who enqueued this write. Used at flush time to scope replay to the
    // current session so a shared device never lands one account's writes in another.
    userId: string;
    enqueuedAt: string;
}

const DB_NAME = 'pulse-offline';
const STORE = 'mutations';
// Writes that can never succeed on replay (bad input, missing row) are moved here
// instead of being dropped, so one poison write neither stalls the queue nor
// silently loses the user's data. They stay inspectable/recoverable.
const DEADLETTER = 'deadletter';
const hasIDB = () => typeof indexedDB !== 'undefined';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        // v2 adds the deadletter store; the upgrade is additive (existing queued
        // mutations are preserved) and idempotent via the contains() guards.
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE))
                db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
            if (!db.objectStoreNames.contains(DEADLETTER))
                db.createObjectStore(DEADLETTER, { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function enqueue(m: QueuedMutation): Promise<void> {
    if (!hasIDB()) return;
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).add(m);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function allQueued(): Promise<QueuedMutation[]> {
    if (!hasIDB()) return [];
    const db = await openDB();
    const out = await new Promise<QueuedMutation[]>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve((req.result as QueuedMutation[]).sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
        req.onerror = () => reject(req.error);
    });
    db.close();
    return out;
}

export async function remove(id: number): Promise<void> {
    if (!hasIDB()) return;
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function clear(): Promise<void> {
    if (!hasIDB()) return;
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function count(): Promise<number> {
    return (await allQueued()).length;
}

// Move a permanently-failing write to the dead-letter store. Strips the queue id
// so the deadletter store assigns its own; the mutation payload is preserved.
export async function deadLetter(m: QueuedMutation): Promise<void> {
    if (!hasIDB()) return;
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DEADLETTER, 'readwrite');
        tx.objectStore(DEADLETTER).add({ type: m.type, args: m.args, userId: m.userId, enqueuedAt: m.enqueuedAt });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

// Count of dead-lettered writes (writes that could not sync). Lets the UI surface
// "N writes couldn't sync" honestly instead of a pending count that never drains.
export async function deadLetteredCount(): Promise<number> {
    if (!hasIDB()) return 0;
    const db = await openDB();
    const n = await new Promise<number>((resolve, reject) => {
        const tx = db.transaction(DEADLETTER, 'readonly');
        const req = tx.objectStore(DEADLETTER).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return n;
}
