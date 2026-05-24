# 2026-05-25 — Pulse App: Codebase Audit

Scope: full review of the `/pulse` route as of branch `feature/profiles-bodyweight` (commit `4d67701`).
Reviewed files: all components, server actions, lib utilities, DB schema, middleware, login flow, and dependencies.

---

## 1. Architecture Overview

```
src/
  app/pulse/
    page.tsx             Server Component — fetches user data, renders TrackerClient
    actions.ts           Server Actions — all mutations (saveLogs, updateProfile, logBodyWeight, deleteBodyWeight, logout)
    login/
      page.tsx           Login form (Server Component)
      actions.ts         Login server action
      SubmitButton.tsx   Client Component using useFormStatus

  components/weight-tracker/
    TrackerClient.tsx    Root Client Component — nav, global state, persistence orchestration
    ExerciseCard.tsx     Collapsible exercise row
    SetLogger.tsx        Individual set row (input or saved view)
    WorkoutTabs.tsx      Push/Pull/Legs tab bar
    RestTimer.tsx        Countdown timer
    WeekSelector.tsx     Phase-grouped week picker (used in ProgramView only)
    views/
      LogView.tsx        Week selector + exercise cards
      ProgramView.tsx    Read-only program overview
      HistoryView.tsx    Past sessions list
      ProfileView.tsx    Identity, unit toggle, body weight chart

  lib/weight-tracker/
    types.ts             All TypeScript interfaces
    utils.ts             Pure functions (toDisplay, toKg, computePRMap, etc.)
    theme.ts             Design constants
    data.ts              Static program data (PHASES, WORKOUTS, SCHEDULE, WEEK_NOTES)
    validation.ts        validateLogs runtime type guard

  lib/supabase/
    server.ts            SSR Supabase client (Server Components + Server Actions)
    browser.ts           Browser Supabase client (Client Components — unused in Pulse currently)
    middleware.ts        updateSession — session refresh + /pulse redirect

  middleware.ts          Applies updateSession to /pulse/:path*
```

The architecture is clean and follows Next.js App Router conventions correctly. The server/client split is well-executed.

---

## 2. Security Findings

### HIGH

| # | Finding | Location | Recommendation |
|---|---------|----------|----------------|
| S1 | **No rate limiting on login** | `login/actions.ts` | Add brute-force protection. Options: Supabase Auth rate limiting (already on by default in Supabase — verify it's enabled in project settings), or middleware-level IP throttling via Vercel Edge config. |
| S2 | **`display_name` not length-limited** | `actions.ts:updateProfile` | Enforce `display_name.length <= 50` (or similar) before upsert. DB has no check constraint. A 10,000-char name is technically storable. |
| S3 | **`logBodyWeight` does no server-side validation** | `actions.ts:logBodyWeight` | Add explicit guard: `if (typeof weightKg !== 'number' || weightKg < 0.5 || weightKg > 500) throw new Error('Invalid weight')`. The DB check constraint catches it, but errors bubble differently. |

### MEDIUM

| # | Finding | Location | Recommendation |
|---|---------|----------|----------------|
| S4 | **`deleteBodyWeight` accepts arbitrary string as UUID** | `actions.ts:deleteBodyWeight` | Validate UUID format before querying: `if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error(...)`. SQL injection is prevented by parameterized queries but malformed IDs waste a round-trip. |
| S5 | **`login` action leaks auth error type via redirect param** | `login/actions.ts` | `?error=1` is fine. Confirm it never exposes whether an email exists vs wrong password — currently it doesn't (good). |
| S6 | **Supabase keys exposed client-side** | All Supabase files | `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design; RLS is the protection layer. Confirm all tables have RLS enabled and policies are restrictive — currently they are. This is correct architecture. |

### LOW / INFO

| # | Finding | Location | Recommendation |
|---|---------|----------|----------------|
| S7 | **No `Content-Security-Policy` header** | Vercel / `next.config` | Add CSP via Next.js headers config. Pulse doesn't load external scripts, so a strict CSP is achievable. |
| S8 | **`robots: { index: false }` only on login page** | `login/page.tsx` | The main `/pulse` page has no metadata — add noindex there too since it's a personal auth-gated app. |

---

## 3. Performance Findings

### HIGH

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| P1 | **3 sequential DB calls in page.tsx** | `page.tsx:16–60` | `set_logs`, `profiles`, and `bodyweight_logs` fetches are sequential (three separate awaits). On cold start this adds ~150–300ms. **Fix:** wrap in `Promise.all`. |
| P2 | **N+1 deletes in `saveLogs`** | `actions.ts:60–69` | Deletes removed sets one at a time in a for loop. With 20+ deletions this sends 20 separate DB requests. **Fix:** batch delete with `.in('id', [...])` or use a compound filter. |

### MEDIUM

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| P3 | **`revalidate = 0` disables all caching** | `page.tsx:7` | Every page load hits the DB. Correct for a personal tracker (data changes every session), but documented here for awareness. No fix needed. |
| P4 | **`computePRMap` called in both LogView and HistoryView** | Both views | The same `logs` object is mapped twice when both views are mounted. Since they never render simultaneously, this is not a real issue. Document as a non-problem. |
| P5 | **No Suspense / loading.tsx for pulse route** | `app/pulse/` | On slow connections the page is blank during server render. Add a `loading.tsx` with a minimal skeleton to improve perceived performance. |

### LOW

| # | Finding | Location | Impact |
|---|---------|----------|--------|
| P6 | **`@vercel/kv` in production dependencies** | `package.json` | Unused package adds install time and surface area. Remove. |
| P7 | **`prettier-plugin-tailwindcss` in devDeps** | `package.json` | Tailwind is not used in Pulse. Remove from devDeps or confirm it's needed for portfolio pages. |

---

## 4. Code Quality & DRY/SOLID

### Issues

| # | Finding | Severity | Detail |
|---|---------|----------|--------|
| C1 | **Duplicated week selector UI** | Medium | `LogView` contains its own inline week tabs (scrollable, with dots) distinct from the `WeekSelector` component used in `ProgramView`. These are two different designs for the same data, which is intentional UX but creates two codepaths to maintain. If the design is intentional, document it; if not, unify. |
| C2 | **`WORKOUTS` typed as `Record<string, Workout>`** | Low | Should be `Record<WorkoutType, Workout>` for type safety. Currently accessing `WORKOUTS['invalid']` compiles without error. |
| C3 | **Implicit `any` in `actions.ts` and `page.tsx`** | Low | `row` in the delete filter and `r` in the bodyweight map lack explicit types. Add `as { week: number; workout_type: string; ex_idx: number; set_idx: number }` and `as { id: string; logged_at: string; weight_kg: number }` respectively. |
| C4 | **`useEffect` dep suppression in SetLogger** | Low | The `useEffect` for unit changes suppresses the exhaustive-deps warning. The comment explains the intent but the rule `// eslint-disable-line` doesn't distinguish between intentional omission and accident. Use the two-line form to be explicit. |
| C5 | **SVG gradient ID `bw-fill` is global** | Low | Multiple instances of `ProfileView` (impossible currently, but still) would conflict. Prefix with a unique key or use CSS variables. Not a real risk today. |
| C6 | **`TrackerClient.tsx` is 327 lines** | Low | Single responsibility is strained — it handles nav, persistence, error display, state, and rendering. At current scale it's acceptable. At Phase 4+ with more state, extract a `usePulseState` hook. |
| C7 | **`buildHistory` sort order** | Low | History sessions are sorted by `week` descending, but within the same week by `type` alphabetically (`legs` < `pull` < `push`). This is arbitrary. Document or sort by type insertion order. |

### Strengths

- **Validation boundary**: `validateLogs` is a proper runtime type guard applied at both server action entry and page render boundary. Correct.
- **Key format**: `"${week}-${type}-${exIdx}-${setIdx}"` is stable, human-readable, and consistent across all components. Good design.
- **`computeSuggestion`**: Handles all four RIR comparison cases cleanly. No magic numbers.
- **`getRIR` fix**: The `idx !== -1` guard prevents the stale-phase RIR bug correctly.
- **Theme constants**: Fully centralized; no inline hex values in components except the gradient stops in `ProfileView` (minor).
- **Server actions return minimal data**: Actions don't return full DB rows unnecessarily (except `logBodyWeight` which needs the ID — correct).

---

## 5. UX / UI Findings

| # | Finding | Severity | Detail |
|---|---------|----------|--------|
| U1 | **No loading skeleton** | Medium | Cold page load shows nothing while server fetches. `loading.tsx` with animated placeholders would help. |
| U2 | **No feedback when display name is saved** | Medium | ProfileView saves on blur/Enter with no confirmation. User has no visual signal the save succeeded. |
| U3 | **No empty state in Log view** | Low | First-time user opening the app sees an exercise list with no context. A brief onboarding message ("Tap an exercise to log your first set") would help. |
| U4 | **HistoryView shows no calendar dates** | Low | Sessions show "Week 3" but no actual date. Users often want to know "when did I last train?" |
| U5 | **RestTimer duration not persisted across reloads** | Low | The timer reverts to 90s on page reload. Minor but inconsistent with other persisted state (week, logs). |
| U6 | **No visual distinction for a fully-completed exercise** | Low | ExerciseCard doesn't signal "all sets done" distinctly. The progress blocks partially indicate this but it's subtle. |
| U7 | **Export with no import** | Low | Users can export JSON but can't import it back. Useful for backup/restore. |
| U8 | **`ProfileView`: unit toggle does not re-derive suggestion values in open SetLogger inputs** | Medium | Changing unit in Profile while Log view is mounted would correctly re-sync inputs (via the `useEffect` in SetLogger), but only if the user switches back to Log view and the components are still mounted. Since views are conditionally rendered (`view === 'log'`), un-mounting and re-mounting happens — initial state re-derives correctly from `toDisplay(entry.kg, unit)`. **This is actually correct.** No action needed, but worth documenting. |
| U9 | **`ProfileView` date uses client timezone** | Low | `new Date().toLocaleDateString('en-CA')` is client-local. Supabase stores `current_date` as server UTC. A user in UTC+8 past midnight would log for "tomorrow" locally vs "today" server-side. Fix: derive the date server-side or use ISO date comparison. |

---

## 6. Test Coverage

Tests exist for:
- `SetLogger` — 12 test cases covering rendering, save, edit, cancel, delete, PR badge, suggestions
- `WeekSelector` — basic rendering
- `WorkoutTabs` — basic rendering
- `utils.ts` — utility functions

**Gaps:**
- `ExerciseCard` — no tests
- `ProfileView` — no tests
- `HistoryView` — no tests
- `actions.ts` (server actions) — no integration tests
- `validateLogs` — no dedicated unit tests (though covered implicitly via action tests if they existed)

**Infra issue:** `vitest` types are installed but not referenced in `tsconfig.json`'s `types` array, causing `Cannot find module 'vitest'` TS errors. This does not prevent tests from running but causes false IDE errors. Fix: add `"types": ["vitest/globals"]` to `tsconfig.json` or ensure the vitest config has `globals: true`.

---

## 7. Database / Schema

| # | Finding | Detail |
|---|---------|--------|
| D1 | **RLS enabled on all 3 tables** | Correct. `set_logs`, `profiles`, `bodyweight_logs` all have `auth.uid() = user_id/id` policies. |
| D2 | **No `display_name` length constraint** | DB has no `CHECK (char_length(display_name) <= 50)`. Rely on application-layer validation (see S2). |
| D3 | **`bodyweight_logs.logged_at` is `date` not `timestamptz`** | Correct for the use case (one entry per day), but means timezone handling must be explicit in the application layer. |
| D4 | **No index on `set_logs(user_id, week)`** | The primary query pattern filters by `user_id` (via RLS + eq). RLS applies `auth.uid() = user_id` which effectively makes every query user-scoped, but an explicit index on `(user_id, week)` would accelerate the common "load week X" pattern as the dataset grows. |
| D5 | **No `updated_at` trigger** | `set_logs.updated_at` and `profiles.updated_at` are set manually in application code. A DB trigger would ensure consistency even for direct SQL edits. Minor for a personal app. |

---

## 8. Dependency Audit

| Package | Status | Note |
|---------|--------|------|
| `@supabase/ssr@^0.10.3` | Current | In use correctly |
| `@supabase/supabase-js@^2.106.1` | Current | In use |
| `@vercel/analytics@^1.5.0` | Current | Portfolio use |
| `@vercel/kv@^3.0.0` | **Unused** | Should be removed |
| `next@15.1.11` | Current | Minor version behind — 15.x.x is stable |
| `react@^19.0.0` / `react-dom` | Current | Async transitions used correctly |
| `prettier-plugin-tailwindcss` | Likely unused in Pulse | Confirm if needed for portfolio |
| `react-icons@^5.5.0` | devDep | Not used in Pulse — used in portfolio? |
| `vitest@^4.1.7` | devDep | Tests work but TS type resolution broken (see §6) |

---

## 9. Summary Table

| Area | Severity | Count | Priority Actions |
|------|----------|-------|-----------------|
| Security | High | 3 | Rate limiting, display_name validation, bodyweight server validation |
| Security | Medium | 2 | UUID validation, metadata noindex |
| Performance | High | 2 | Parallelize DB queries, batch deletes |
| Performance | Medium | 1 | Add loading.tsx skeleton |
| Code Quality | Medium | 1 | Fix WORKOUTS type, clean implicit `any` |
| UX/UI | Medium | 2 | Name-save feedback, loading skeleton |
| Tests | Medium | — | Fix vitest TS config; add ExerciseCard/ProfileView tests |
| Database | Low | 2 | Add display_name length constraint; add index on set_logs(user_id, week) |
| Dependencies | Low | 1 | Remove @vercel/kv |

---

## 10. Quick Wins (can be done before Phase 4)

1. Parallelize the 3 DB calls in `page.tsx` with `Promise.all`
2. Add `display_name` length validation in `updateProfile`
3. Add `weightKg` validation in `logBodyWeight`
4. Fix `WORKOUTS` type to `Record<WorkoutType, Workout>`
5. Fix implicit `any` in `actions.ts` and `page.tsx`
6. Add `loading.tsx` for the pulse route
7. Remove `@vercel/kv` from dependencies
8. Fix vitest TS types in `tsconfig.json`
9. Add `noindex` metadata to the main pulse page
