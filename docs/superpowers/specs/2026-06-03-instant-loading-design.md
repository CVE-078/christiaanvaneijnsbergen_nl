# Instant Loading (PWA perceived performance) — Design

**Date:** 2026-06-03
**Status:** Approved (design)

## Goal

Make Pulse render instantly with skeleton feedback instead of blocking a cold load
on the server-side six-query `Promise.all` in `(protected)/layout.tsx`. Returning
users see their last-known data immediately; first-time visitors see skeletons that
fill in as each data domain arrives.

This is **phase 1 of offline-first**: it establishes the persisted, user-scoped SWR
cache that the later service-worker / offline-mutation work builds on. It is NOT a
quick win; it removes the blocking-layout anti-pattern and replaces it with a
stale-while-revalidate cache, which is the read-scaling lever for a PWA.

## Scope

**In scope:** shell-first rendering, client-side SWR fetching with loading states,
per-view skeletons, a user-scoped `localStorage`-backed SWR cache.

**Out of scope (phase 2, the "offline-first logging" roadmap item):** service worker,
installable manifest, offline mutation queue / background sync. The persisted cache
here is forward-compatible with all of that.

## Why this approach

The app is already a client-interactive SWR app (optimistic mutations everywhere).
Streaming RSC (the alternative) fights that grain and advances nothing toward
offline. Client SWR + a persisted cache matches the existing model and compounds
into phase 2.

## Current state

- `src/app/pulse/(protected)/layout.tsx` is a server component that `await`s
  `Promise.all([loadLogs, loadProfile, loadBodyweight, loadExercises, loadRoutines,
  loadNotes])` before rendering, then passes the results as `initial*` props to
  `PulseLayout` -> `PulseProvider`. Because the blocking work is in the **layout**,
  a route-segment `loading.tsx` cannot show on a cold load (a layout suspends its
  whole subtree). `revalidate = 0` forces this dynamic fetch every cold load.
- Each data hook (`useWorkoutLogs`, `useProfile`, `useRoutines`, `useNotes`) is
  `useSWR(key, fetcher, { fallbackData: initial*, revalidateIfStale: false,
  revalidateOnFocus: false })`. The six `/api/pulse/*` GET routes already exist and
  reuse the same `queries.ts` loaders, so client fetching hits identical logic.

## Architecture

### 1. Shell-first layout

`(protected)/layout.tsx` keeps the cheap `getUser` (needed for the redirect and the
user's email/id) but **drops the six-query `Promise.all`**. It renders `PulseProvider`
immediately with no `initial*` data, passing only `email` and `userId`. The
`queries.ts` loaders are untouched (still used by the API routes).

### 2. Client-side SWR with loading state

- Make the `initial*` parameters of `useWorkoutLogs`, `useProfile`, `useRoutines`,
  `useNotes` **optional** (default `undefined`). Drop `fallbackData`; set
  `revalidateIfStale: true` so SWR fetches on mount. Keep `revalidateOnFocus: false`
  and add a `dedupingInterval` so navigation does not refetch churn.
- Each hook returns its SWR `isLoading` and `error`. The provider aggregates these
  into a `loading` object and an `errors` object exposed on `PulseContextValue`:

  ```ts
  loading: { profile: boolean; logs: boolean; routines: boolean;
             exercises: boolean; bodyweight: boolean; notes: boolean };
  ```

- The provider's derived memos (`routineExercisesByType`, `routineExercisesByTabKey`,
  `activeRoutine`, `prMap`, `streak`, ...) must tolerate `undefined`/empty inputs
  while loading (default to `[]` / `{}`), so nothing crashes pre-data. This is the
  main implementation care-point.

### 3. Per-view skeletons

A small `Skeleton` primitive (factored from the existing `loading.tsx` shimmer +
Slate tokens) and per-view skeleton layouts. Each view reads the relevant
`loading.*` flag(s) from context and renders its skeleton instead of empty/zero
states until data is present:

- `LogView` / `ProgramView` / `HistoryView`: `loading.routines || loading.logs`.
- `ProfileView`: `loading.profile || loading.bodyweight`.
- `LibraryView`: `loading.exercises || loading.routines`.

The skeleton mirrors each view's real layout (header, week strip, exercise rows)
so the fill-in is not a jarring reflow.

### 4. Persisted, user-scoped SWR cache

Wrap the client tree in `<SWRConfig value={{ provider: makeCacheProvider(userId) }}>`
at the `PulseLayout`/`PulseProvider` boundary. `makeCacheProvider`:

- Seeds a `Map` from `localStorage["pulse-swr-cache:" + userId]` on creation, so a
  returning user renders last-known data instantly (stale), then SWR revalidates in
  the background (stale-while-revalidate). First-ever visit: empty cache -> skeletons.
- Persists the map back to `localStorage` on `visibilitychange`/`beforeunload`.
- **Keyed per user id**, and **cleared on logout** (the `logout` action / sign-out
  button clears `pulse-swr-cache:*`), so a shared device never shows another
  account's cached training data.

### Data flow

Cold first visit: layout renders shell -> SWR fetches `/api/pulse/*` -> `loading.*`
true -> views show skeletons -> data arrives -> content. Warm visit: persisted cache
hydrates SWR synchronously -> content shows instantly -> SWR revalidates in the
background and patches any changes.

## Error handling

- A hook's SWR `error` surfaces through `errors.*` on context. Each view renders a
  small inline error state with a "Retry" affordance that calls the hook's `mutate()`
  to refetch. Mutation (write) errors keep the existing toast + retry behaviour.
- Auth is still enforced by middleware and the layout `getUser` redirect; a 401 from
  an API route triggers the normal redirect to login.

## Testing

- **Hooks:** each returns `loading: true` with no data on first render, then the
  fetched data with `loading: false` (mock the fetcher).
- **Views:** render the skeleton when the relevant `loading.*` flag is true; render
  content when data is present; render the error state + Retry when `errors.*` is set.
- **Cache provider:** seeds from `localStorage` for the given user; writes back;
  uses a per-user key; a different user id does not read the previous user's cache;
  logout clears the key.

## Out of scope / future (phase 2)

- Service worker + app-shell precache (makes the shell load with no network).
- Installable manifest.
- Offline mutation queue + background sync.

All build directly on the persisted cache introduced here.
