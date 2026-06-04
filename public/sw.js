// Pulse service worker — shell + static asset caching, scoped to /pulse.
const VERSION = 'pulse-shell-v1';
const SHELL = ['/pulse/train'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))),
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/')) return; // SWR + localStorage cache own data freshness

    if (req.mode === 'navigate' && url.pathname.startsWith('/pulse')) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
                    return res;
                })
                .catch(() => caches.match(req).then((hit) => hit || caches.match('/pulse/train'))),
        );
        return;
    }

    if (url.pathname.startsWith('/_next/static/') || /\.(?:woff2?|ttf|otf)$/.test(url.pathname)) {
        event.respondWith(
            caches.match(req).then((hit) => hit || fetch(req).then((res) => {
                const copy = res.clone();
                caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
                return res;
            })),
        );
    }
});
