// User-scoped, localStorage-backed SWR cache. Seeding the SWR Map from storage
// makes a returning user render last-known data instantly (stale), then SWR
// revalidates in the background. Keyed per user id so a shared device never
// leaks another account's cached data; cleared on logout.
const PREFIX = 'pulse-swr-cache:';

type SWRCacheMap = Map<string, unknown>;

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

        const persist = () => {
            try {
                localStorage.setItem(storageKey, JSON.stringify(Array.from(map.entries())));
            } catch {
                // storage full / unavailable (private mode) — cache is best-effort
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', persist);
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
        // ignore — nothing to clear if storage is unavailable
    }
}
