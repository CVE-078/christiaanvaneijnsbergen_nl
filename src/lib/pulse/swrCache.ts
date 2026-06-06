// User-scoped, localStorage-backed SWR cache. Seeding the SWR Map from storage
// makes a returning user render last-known data instantly (stale), then SWR
// revalidates in the background. Keyed per user id so a shared device never
// leaks another account's cached data; cleared on logout.
const PREFIX = 'pulse-swr-cache:';

// Only the warm-start domains the protected layout reloads with initial* props
// are worth persisting. Serializing the entire SWR cache (transient request
// state, derived keys, etc.) on every tab-hide is wasteful, these six keys are
// the ones that give a returning user an instant stale render.
const WARM_KEYS = [
    '/api/pulse/logs',
    '/api/pulse/profile',
    '/api/pulse/bodyweight',
    '/api/pulse/exercises',
    '/api/pulse/routines',
    '/api/pulse/notes',
];

// Throttle window so a burst of visibilitychange/beforeunload events (e.g. a
// quick tab switch back and forth) doesn't re-stringify repeatedly.
const PERSIST_THROTTLE_MS = 2000;

// SWR's cache provider expects a Map of internal State entries; the loose value
// type matches the canonical SWR localStorage-persistence recipe and keeps it
// structurally compatible with SWR's Cache type.
type SWRCacheMap = Map<string, any>;

export function makeSWRCacheProvider(userId: string): () => SWRCacheMap {
    return () => {
        const storageKey = `${PREFIX}${userId}`;
        let map: SWRCacheMap;
        try {
            const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
            map = new Map(raw ? (JSON.parse(raw) as [string, unknown][]) : []);
        } catch {
            map = new Map();
        }

        let lastPersist = 0;
        const writeWarmKeys = () => {
            try {
                const entries: [string, unknown][] = [];
                for (const key of WARM_KEYS) {
                    if (map.has(key)) entries.push([key, map.get(key)]);
                }
                localStorage.setItem(storageKey, JSON.stringify(entries));
            } catch {
                // storage full / unavailable (private mode), cache is best-effort
            }
        };

        const persist = () => {
            const now = Date.now();
            if (now - lastPersist < PERSIST_THROTTLE_MS) return;
            lastPersist = now;
            writeWarmKeys();
        };

        if (typeof window !== 'undefined') {
            // beforeunload is the final chance to persist, so always write (bypass
            // the throttle) rather than risk dropping the page's last state.
            window.addEventListener('beforeunload', () => {
                lastPersist = Date.now();
                writeWarmKeys();
            });
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') persist();
            });
        }

        return map;
    };
}

export function clearAllSWRCache(): void {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(PREFIX)) localStorage.removeItem(key);
        }
    } catch {
        // ignore, nothing to clear if storage is unavailable
    }
}
