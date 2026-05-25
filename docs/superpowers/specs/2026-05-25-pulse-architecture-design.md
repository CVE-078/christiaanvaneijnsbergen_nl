# Pulse — Architecture Refactor Spec (Phase 1 of 2)

**Date:** 2026-05-25
**Scope:** Rename `weight-tracker` → `pulse` everywhere; introduce SWR data layer, React Context, and custom hooks. Inline styles are NOT migrated here — that is Phase 2.

---

## 1. Goals

- Rename all `weight-tracker` directories, imports, and internal identifiers to `pulse`
- Replace the monolithic `TrackerClient` state blob with a `PulseProvider` + typed context
- Extract five purpose-built hooks from `TrackerClient`
- Add three read-only API routes so SWR can keep client data fresh
- Wire SWR with `fallbackData` from the server component for zero-flash mounts and optimistic mutations
- No behaviour changes — all existing features work identically after this refactor

---

## 2. Rename Scope

| Before | After |
|--------|-------|
| `src/components/weight-tracker/` | `src/components/pulse/` |
| `src/lib/weight-tracker/` | `src/lib/pulse/` |
| `@/lib/weight-tracker/...` imports | `@/lib/pulse/...` |
| `@/components/weight-tracker/...` imports | `@/components/pulse/...` |
| Any `weightTracker` / `weight_tracker` identifiers in comments/variables | `pulse` |

CSS class names (`.pulse-desktop-nav`, `.pulse-hamburger`) are already correctly named — no change.
Route path `/pulse` and Supabase table names (`set_logs`, `profiles`, `bodyweight_logs`) are unchanged.

---

## 3. Directory Structure

```
src/
├── app/
│   ├── pulse/
│   │   ├── page.tsx              (server component — unchanged logic, imports updated)
│   │   ├── layout.tsx            (unchanged)
│   │   ├── actions.ts            (server actions — imports updated)
│   │   ├── loading.tsx           (unchanged)
│   │   ├── error.tsx             (unchanged)
│   │   └── login/
│   └── api/
│       └── pulse/                (NEW — SWR read endpoints)
│           ├── logs/route.ts
│           ├── profile/route.ts
│           └── bodyweight/route.ts
│
├── components/
│   └── pulse/                    (renamed from weight-tracker)
│       ├── TrackerClient.tsx     (slimmed: wraps PulseProvider + view router only)
│       ├── PulseProvider.tsx     (NEW: composes hooks, provides PulseContext)
│       ├── ExerciseCard.tsx
│       ├── SetLogger.tsx
│       ├── RestTimer.tsx
│       ├── WorkoutTabs.tsx
│       ├── WeekSelector.tsx
│       ├── views/
│       │   ├── LogView.tsx
│       │   ├── ProgramView.tsx
│       │   ├── HistoryView.tsx
│       │   └── ProfileView.tsx
│       └── __tests__/
│
├── context/
│   └── PulseContext.ts           (NEW: typed context + usePulse() hook)
│
├── hooks/
│   └── pulse/                    (NEW)
│       ├── useWorkoutLogs.ts
│       ├── useProfile.ts
│       ├── useUIState.ts
│       ├── useRestTimer.ts
│       └── useLocalStorage.ts
│
└── lib/
    └── pulse/                    (renamed from weight-tracker)
        ├── types.ts
        ├── theme.ts
        ├── data.ts
        ├── utils.ts
        └── validation.ts
```

---

## 4. Data Layer

### 4.1 Flow

```
page.tsx (server component)
  └── parallel fetch: set_logs + profiles + bodyweight_logs
      └── PulseProvider receives { initialLogs, initialProfile, initialBodyweightLogs }
          ├── useSWR('/api/pulse/logs',       fetcher, { fallbackData: initialLogs })
          ├── useSWR('/api/pulse/profile',    fetcher, { fallbackData: initialProfile })
          └── useSWR('/api/pulse/bodyweight', fetcher, { fallbackData: initialBodyweightLogs })
```

The server component (`page.tsx`) continues to fetch all data on first load — no change to initial page speed or SSR. SWR is seeded with that data via `fallbackData`, so components never see a loading state on mount.

### 4.2 SWR Config

| Key | `revalidateOnFocus` | Rationale |
|-----|---------------------|-----------|
| `/api/pulse/logs` | `false` | High-frequency optimistic mutations would conflict with background refetch |
| `/api/pulse/profile` | `true` | Low-frequency, safe to refresh when tab regains focus |
| `/api/pulse/bodyweight` | `true` | Low-frequency, safe to refresh |

### 4.3 API Routes (read-only)

All three routes are `GET` only, auth-gated via the Supabase session cookie. They mirror the queries already in `page.tsx`.

**`GET /api/pulse/logs`**
- Query: `set_logs` table filtered by `user_id`
- Returns: `Logs` object (same shape as `page.tsx` builds today)
- Auth: 401 if no session

**`GET /api/pulse/profile`**
- Query: `profiles` table, single row by `user_id`
- Returns: `Profile` (`{ display_name, unit }`)
- Auth: 401 if no session

**`GET /api/pulse/bodyweight`**
- Query: `bodyweight_logs` table filtered by `user_id`, ordered descending, limit 90
- Returns: `BodyweightEntry[]`
- Auth: 401 if no session

### 4.4 Mutations

All mutations remain as **server actions** in `src/app/pulse/actions.ts` — no change to `saveLogs`, `updateProfile`, `logBodyWeight`, `deleteBodyWeight`. After each mutation, the relevant SWR key is updated optimistically via `mutate()` before the server action resolves, then revalidated after.

Pattern:
```ts
// optimistic update first
mutate(optimisticValue, false)
// server action
await saveLogs(newLogs)
// revalidate from server
mutate()
```

---

## 5. Context + Hooks

### 5.1 `PulseContext` (`src/context/PulseContext.ts`)

Typed context with a `usePulse()` consumer hook. Throws if used outside `PulseProvider`.

```ts
interface PulseContextValue {
  // Data
  logs: Logs
  profile: Profile
  bodyweightLogs: BodyweightEntry[]
  isLoading: boolean
  saveError: string | null

  // Computed (memoized in PulseProvider)
  streak: number
  prMap: PRMap

  // Log mutations
  updateLog: (key: string, entry: LogEntry) => void
  deleteLog: (key: string) => void
  handleExport: () => void

  // Profile mutations
  updateProfile: (displayName: string | null, unit: Unit) => Promise<void>
  logBodyWeight: (weightKg: number) => Promise<BodyweightEntry>
  deleteBodyWeight: (id: string) => Promise<void>

  // UI state
  view: View
  navigate: (view: View) => void
  activeWeek: number
  setActiveWeek: (week: number) => void
  activeTab: WorkoutType
  setActiveTab: (tab: WorkoutType) => void

  // Timer
  timerTrigger: number
  fireTrigger: () => void
}
```

### 5.2 Hooks

**`useLocalStorage<T>(key: string, defaultValue: T)`** (`src/hooks/pulse/useLocalStorage.ts`)
Generic hook. Reads from localStorage on mount; writes on every value change. SSR-safe (returns `defaultValue` until mounted). Used internally by `useUIState`.

**`useUIState()`** (`src/hooks/pulse/useUIState.ts`)
Owns: `view`, `navigate`, `activeWeek`, `setActiveWeek`, `activeTab`, `setActiveTab`.
`activeWeek` and `activeTab` are persisted via `useLocalStorage`. `navigate` sets view and is the single point of view transitions.

**`useWorkoutLogs(initialLogs: Logs)`** (`src/hooks/pulse/useWorkoutLogs.ts`)
Owns: SWR cache for logs, `updateLog`, `deleteLog`, `saveError`, retry logic on save failure, `handleExport`.
Uses `useSWR('/api/pulse/logs', fetcher, { fallbackData: initialLogs, revalidateOnFocus: false })`.
`updateLog` applies optimistic mutation then calls `saveLogs` server action.
`saveError` is set on action failure and cleared after 5 seconds (replaces the current `retryTimeout` pattern).

**`useProfile(initialProfile: Profile, initialBodyweightLogs: BodyweightEntry[])`** (`src/hooks/pulse/useProfile.ts`)
Owns: SWR caches for profile and bodyweight, `updateProfile`, `logBodyWeight`, `deleteBodyWeight`.

**`useRestTimer()`** (`src/hooks/pulse/useRestTimer.ts`)
Owns: `timerTrigger` counter and `fireTrigger` increment function. Extracted verbatim from TrackerClient.

### 5.3 `PulseProvider` (`src/components/pulse/PulseProvider.tsx`)

`'use client'` component. Accepts `initialLogs`, `initialProfile`, `initialBodyweightLogs`, `children`. Composes all five hooks, memoizes `streak` and `prMap`, and provides `PulseContext.Provider`.

### 5.4 `TrackerClient` after refactor (`src/components/pulse/TrackerClient.tsx`)

Slims from 413 lines to ~30. Accepts the same four props (`initialLogs`, `initialProfile`, `initialBodyweightLogs`, `email`) to keep `page.tsx` unchanged. Wraps `PulseProvider` and renders the view router based on `usePulse().view`.

---

## 6. Type Additions to `lib/pulse/types.ts`

Two types must be added during this refactor (they are referenced by context and hooks):

```ts
// Navigation view identifier
export type View = 'log' | 'program' | 'history' | 'profile';

// PR map: best E1RM (number) per exercise key (workoutType-exIdx)
export type PRMap = Record<string, number>;
```

`View` was previously an inline union in `TrackerClient`. `PRMap` is the return type of `computePRMap` in `utils.ts`, made explicit here.

---

## 7. Dependency: SWR

SWR is not currently installed. It must be added before hooks are written:

```bash
npm install swr
```

No other new dependencies are needed.

---

## 8. What Does Not Change

- All server actions in `src/app/pulse/actions.ts` — logic unchanged, only imports updated
- `page.tsx` server component — data fetch logic unchanged, only imports updated
- All view components (`LogView`, `ProgramView`, `HistoryView`, `ProfileView`) — replace prop drilling with `usePulse()` calls, but logic unchanged
- Existing component tests — updated to import from `@/components/pulse/` and wrap renders in a `PulseProvider` test helper
- Supabase tables, RLS policies, schema — untouched
- Inline styles — untouched (Phase 2)
- The redesign plan (`2026-05-25-pulse-redesign.md`) — will be rewritten after Phase 2

---

## 9. Testing Strategy

- Unit tests for each hook using `renderHook` + MSW to mock API routes
- `PulseProvider` test helper exported for component tests: `renderWithPulse(ui, overrides?)` — wraps with provider, accepts partial context overrides
- Existing component tests updated to use `renderWithPulse` instead of rendering components in isolation with props
- API route tests: simple GET request → mock Supabase → assert response shape

---

## 10. Out of Scope

- Tailwind CSS migration (Phase 2)
- Redesign visual changes (post Phase 2)
- New features
- Supabase schema changes
- Authentication flow changes
