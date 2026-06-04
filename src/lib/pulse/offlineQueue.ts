export interface QueuedMutation {
    id?: number;
    type: 'upsertLog' | 'deleteLogRow' | 'saveNote' | 'deleteNote';
    args: unknown[];
    enqueuedAt: string;
}

const DB_NAME = 'pulse-offline';
const STORE = 'mutations';
const hasIDB = () => typeof indexedDB !== 'undefined';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE))
                db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
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
