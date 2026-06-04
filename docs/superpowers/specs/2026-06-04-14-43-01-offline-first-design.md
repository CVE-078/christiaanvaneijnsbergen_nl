# Offline-first logging — design

Date: 2026-06-04
Status: Approved (pre-implementation)

## Goal

Make Pulse usable in a gym with unreliable wifi: (B) set-log and note writes survive going offline and sync on reconnect, and (A) the app installs and opens with zero signal. Phase 1 (instant stale reads via `swrCache`) already exists; this is phase 2.

## Decisions (locked)

- **Offline write scope:** set logs (`upsertLog` / `deleteLogRow`) and notes (`saveNote` / `deleteNote`). Other mutations stay online-only. The queue is built extensible so more types can join later.
- **Queue storage:** IndexedDB (durable, async, room to grow).
- **PWA:** hand-rolled service worker + web manifest, scoped to `/pulse`. No new dependency.

## Architecture

Two independent subsystems.

### Subsystem B — Offline write queue

**Queue store** — `src/lib/pulse/offlineQueue.ts`: a minimal IndexedDB wrapper. One DB `pulse-offline`, one object store `mutations` with `autoIncrement` key. Entry shape:
```ts
interface QueuedMutation {
    id?: number; // auto-increment, assigned by IndexedDB
    type: 'upsertLog' | 'deleteLogRow' | 'saveNote' | 'deleteNote';
    args: unknown[]; // arguments for the matching server action
    enqueuedAt: string; // ISO timestamp (passed in; never call Date in pure code paths under test)
}
```
API: `enqueue(m): Promise<void>`, `allQueued(): Promise<QueuedMutation[]>` (ordered by id asc), `remove(id): Promise<void>`, `clear(): Promise<void>`, `count(): Promise<number>`. Guard for `typeof indexedDB === 'undefined'` (SSR/tests without fake-indexeddb) by no-op/empty returns.

**Online state** — `src/hooks/pulse/useOnline.ts`: returns `navigator.onLine` (default `true` on server), subscribed to `online`/`offline` events.

**Queue-aware runner + flush** — `src/lib/pulse/offlineSync.ts`:
- `MUTATION_ACTIONS` maps each `type` to its server action (`upsertLog`, `deleteLogRow`, `saveNote`, `deleteNote` from `@/app/pulse/actions`).
- `runMutation(type, args)`: if `navigator.onLine === false` → `enqueue` and return. Else attempt the action; on rejection (network error) → `enqueue`. (The caller has already applied the optimistic SWR `mutate`.)
- `flushQueue(): Promise<{ flushed: number; remaining: number }>`: read `allQueued`, replay each in id order via its action; `remove` on success; on the first failure stop (still offline) and return remaining. Idempotent replay: upserts are last-write-wins, deletes idempotent, FIFO preserves intent.

**Hook integration:**
- `useWorkoutLogs`: replace `runWithRetry(() => upsertLog(...))` / `deleteLogRow` with `runMutation('upsertLog', [key, entry])` / `runMutation('deleteLogRow', [key])`. Keep the optimistic `mutate(...)` exactly as is.
- `useNotes`: wrap `saveNote` / `deleteNote` calls in `runMutation('saveNote', [week, reId, note])` / `runMutation('deleteNote', [week, reId])`, keeping the optimistic `mutate`.

**Flush triggers** — a `useOfflineSync` hook (used once in `PulseProvider`): flush on mount, on the `online` event, and on `window` focus; after a clean flush (`remaining === 0`) revalidate the `logs` and `notes` SWR keys (via `mutate('/api/pulse/logs')` / `mutate('/api/pulse/notes')` using `useSWRConfig`) so server truth reconciles. Logs and notes are already `swrCache` warm keys, so optimistic writes survive a reload before sync.

**Pending indicator** — `usePendingSyncCount()` (polls `count()` on an interval + after `online`/visibility changes) feeding a subtle badge/line shown when offline or count > 0 (e.g. "3 changes pending sync"). Placement: the train screen header area.

**Ordering / conflict** — FIFO by auto-increment id; idempotent server actions; last-write-wins per log/note key. A delete enqueued after an upsert replays after it (delete wins). Acceptable and documented.

### Subsystem A — PWA shell

**Manifest** — `public/manifest.webmanifest`: `name "Pulse"`, `short_name "Pulse"`, `start_url "/pulse/train"`, `scope "/pulse"`, `display "standalone"`, `background_color`/`theme_color` from the Slate palette (dark bg, coral accent), `icons` (192 + 512 PNG; add assets under `public/assets/` if missing — use a simple coral "P" mark). Linked via the Pulse layout `<head>` (Next `metadata` or a `<link rel="manifest">`). CSP: add `manifest-src 'self'`.

**Service worker** — `public/sw.js` (plain JS at origin root). Registered client-side from the Pulse layout (`useEffect`, guarded on `'serviceWorker' in navigator` and production) with `navigator.serviceWorker.register('/sw.js', { scope: '/pulse' })` — a narrower scope from a root-served SW is always permitted and confines control to `/pulse` (marketing site untouched). Behavior:
- `install`: precache a versioned cache (`pulse-shell-v1`) with the app shell entry (`/pulse/train`) and an offline fallback. `skipWaiting()`.
- `activate`: delete caches not matching the current version; `clients.claim()`.
- `fetch`:
  - navigation requests (`request.mode === 'navigate'`) under `/pulse`: network-first, fall back to the cached shell when offline.
  - `/_next/static/*` and fonts: cache-first (stale-while-revalidate acceptable).
  - `/api/*`: pass through to network (do NOT cache — SWR + swrCache own data).
- CSP: add `worker-src 'self'` to `buildCsp` (otherwise `script-src 'strict-dynamic'` blocks SW registration via the worker-src fallback).

**Registration component** — a small `'use client'` effect (e.g. `src/components/pulse/ServiceWorkerRegister.tsx`) rendered in the Pulse layout. No-op in dev to avoid caching churn.

## Files

**Create:** `src/lib/pulse/offlineQueue.ts`, `src/lib/pulse/offlineSync.ts`, `src/hooks/pulse/useOnline.ts`, `src/hooks/pulse/useOfflineSync.ts`, `public/manifest.webmanifest`, `public/sw.js`, `src/components/pulse/ServiceWorkerRegister.tsx`, plus a `usePendingSyncCount` hook and a pending-sync badge component; tests for the queue, runner, and flush.
**Modify:** `src/hooks/pulse/useWorkoutLogs.ts`, `src/hooks/pulse/useNotes.ts`, `src/components/pulse/PulseProvider.tsx` (use `useOfflineSync`), `src/components/pulse/PulseLayout.tsx` (SW register + manifest link), `src/lib/supabase/middleware.ts` (`buildCsp`: add `worker-src 'self'`, `manifest-src 'self'`).

## Testing

- Unit-test the queue module with `fake-indexeddb` (add as a dev dependency) or a thin in-memory mock injected into the module: `enqueue`/`allQueued` ordering, `remove`, `clear`, `count`.
- `runMutation`: offline → enqueues, never throws; online success → calls action, no enqueue; online failure → enqueues.
- `flushQueue`: replays in order, removes on success, stops on failure leaving the rest queued; returns counts.
- `useOnline`: reflects `navigator.onLine` and event changes.
- Existing `useWorkoutLogs`/`useNotes` tests keep passing (optimistic `mutate` unchanged).

The service worker and manifest cannot be exercised headlessly; verify by `bun run build` succeeding and the SW file being valid JS, and flag a manual browser/offline + install check for ship time.

## Ordered slices (decomposition)

1. **B-core** — `offlineQueue` + `useOnline` + `offlineSync` (`runMutation`/`flushQueue`) + `useOfflineSync` wired into `useWorkoutLogs`, `useNotes`, `PulseProvider`; unit tests. Ships offline logging on its own.
2. **B-UX** — `usePendingSyncCount` + pending-sync badge.
3. **A-manifest** — manifest + icons + CSP `manifest-src` + layout link (installable).
4. **A-SW** — `public/sw.js` + `ServiceWorkerRegister` + CSP `worker-src` + cache lifecycle.
5. **Docs + verification** — roadmap update; full `typecheck` / `test:run` / `lint` / `build`.

## Out of scope (v1)

- Queuing mutations other than logs/notes.
- Background Sync API (use online-event + focus + mount flush instead).
- Conflict UI / merge (last-write-wins is sufficient at current scale).
- Offline caching of API responses in the SW (SWR + swrCache already cover reads).
