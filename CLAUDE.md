# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **bun** (`bun.lock` is the source of truth; a `package-lock.json` also exists). Scripts run the same under `npm run`.

- `bun run dev` — start the Next.js dev server (http://localhost:3000)
- `bun run build` — production build
- `bun run lint` — ESLint (`next/core-web-vitals`)
- `bun run typecheck` — `tsc --noEmit`
- `bun run format` / `format:check` — Prettier over `src/**/*.{ts,tsx}`
- `bun run test` — Vitest in watch mode
- `bun run test:run` — Vitest single run (use this in CI / verification)
- `bun run test:ui` — Vitest UI

Run a single test file: `bun run test:run src/components/pulse/__tests__/SetLogger.test.tsx`
Run tests matching a name: `bun run test:run -t "warmup"`

## Tech Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Supabase (auth + Postgres) · SWR · Vitest + Testing Library (jsdom).

Path alias: `@/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.mjs`).

## Two apps in one repo

1. **Marketing site** (`/`) — static personal portfolio. Entry `src/app/page.tsx` composing `src/components/*` (hero, about, experience, header, footer). Poppins font, light theme.
2. **Pulse** (`/pulse`) — a workout-tracking, installable PWA where nearly all the complexity lives. Dark "Slate" theme; Hanken Grotesk + Sora + Big Shoulders Display (loaded via `next/font` in `PulseLayout`). Everything Pulse-related is namespaced under `pulse/` directories.

## Pulse architecture

The big picture (read `docs/superpowers/specs/2026-05-25-pulse-architecture-design.md` for the original design):

**Server → Context → Hooks → Components**, with SWR keeping client data live.

- **Auth & data load** — `src/middleware.ts` (matcher `/pulse/:path*`) calls `updateSession` in `src/lib/supabase/middleware.ts`, which refreshes the Supabase session and redirects unauthenticated users to `/pulse/login`. Routes live under the `(protected)` route group; `src/app/pulse/(protected)/layout.tsx` is a thin server component that only resolves the user (redirect if absent) and renders the shell — it does **not** prefetch data. Data is fetched **client-side** by the SWR hooks (shell-first / instant loading), so the app shell paints immediately and each view shows a skeleton until its slice arrives.
- **Three Supabase clients** — `src/lib/supabase/server.ts` (server components / actions, async, cookie-based), `browser.ts` (client), `middleware.ts` (edge session refresh). Use the right one for the context.
- **PulseLayout → PulseProvider → AppShell** — `PulseLayout` maps the URL pathname to a `View` and supplies `navigate`. `PulseProvider` (`src/components/pulse/PulseProvider.tsx`) composes the hooks and exposes everything through `PulseContext`. Consume state anywhere with `usePulse()` from `src/context/PulseContext.ts` — that file's `PulseContextValue` interface is the canonical contract for what the app can do.
- **Hooks** (`src/hooks/pulse/`) — one hook per data domain: `useWorkoutLogs`, `useProfile`, `useRoutines`, `useNotes`, `useWorkoutSession`, plus UI hooks `useUIState`, `useRestTimer`, `useMediaQuery`, `useLocalStorage`. Each data hook follows the same pattern: `useSWR` keyed on its `/api/pulse/*` endpoint (fetches on mount; expose `loading`/`error`, default to a stable empty value), then **optimistic mutations** — call `mutate(newValue, false)` immediately, await the server action, then `mutate()` to revalidate. A user-scoped `localStorage` SWR cache (`src/lib/pulse/swrCache.ts`, wired in `PulseLayout`, cleared on logout) makes warm visits instant via stale-while-revalidate.
- **Server actions vs API routes** — Mutations go through `'use server'` actions in `src/app/pulse/actions.ts` (and `login/actions.ts`); set logs use the per-row `upsertLog`/`deleteLogRow`, not a bulk save. Reads (and SWR revalidation) go through GET handlers in `src/app/api/pulse/*/route.ts`, which reuse the loaders in `src/lib/pulse/queries.ts`. When you add a data domain you typically touch: the action, the API route, the hook, and the context interface. Set-log/note mutations also pass through an **IndexedDB offline write queue** (`offlineQueue.ts` / `offlineSync.ts`): writes enqueue when offline or on failure and flush FIFO on reconnect/focus, so the optimistic UI stays live offline (Pulse is an installable PWA with a `/pulse`-scoped service worker).
- **Responsive split** — `AppShell` branches on `useMediaQuery('(min-width: 1024px)')`: `DesktopLayout` (sidebar) for desktop, `BottomNav` + topbar for mobile. The same view components render in both.
- **Views** (`src/components/pulse/views/`) — `LogView` (train), `ProgramView` (plan), `HistoryView` + progress charts, `ProfileView`, `LibraryView` (+ `TemplatesTab`). Routed via `src/app/pulse/(protected)/{train,plan,progress,profile,library}`.
- **Guided mode** — `WorkoutModeScreen` (full-screen overlay opened from `LogView`) branches on `useMediaQuery` like the shell: a single-column "Focus" layout on mobile, a two-pane layout (focus pane + session sidebar) on desktop. `SetLogger`, the per-set logger shared with the Train `ExerciseCard`, takes `variant: 'card' | 'editorial'` — `card` is the Train look, `editorial` the guided look; default `card` so Train is unaffected.

## Domain model (Pulse)

- **Types** — `src/lib/pulse/types.ts` is the single source for all Pulse types.
- **Pure logic** — `src/lib/pulse/utils.ts` holds the testable pure functions: `computeStreak`, `computePRMap`, `computeLastSession`, `computeWarmupSets`, `computeShareStats`, `nextVariant`, the program helpers `getPhase` / `getRIR` / `volumeForWeek` / `computeProgression`, and the plateau/deload trio `computePlateau` / `shouldDeload` / `deloadTarget`. Prefer adding pure functions here (easy to unit-test) over logic in components. Other lib modules: `data.ts` (`buildProgram(weeks)` — the periodized block tables), `adherence.ts` (calendar/completion-paced engine), `generation.ts` (routine generation), `recommendation.ts` (onboarding template match), `strength.ts`, `offlineQueue.ts` / `offlineSync.ts` (offline write queue), `templateFilters.ts`, `csv.ts` (history export), `historyBundle.ts`, plus `sessions.ts`, `validation.ts`, `constants.ts`.
- **Log key format** — set logs are keyed `"week-routineExerciseId-setIdx"` where the middle segment is a UUID (contains dashes). Parse with `indexOf('-')` / `lastIndexOf('-')`, not `split` (see `actions.ts`). Notes are keyed `"week-routineExerciseId"`.
- **Periodized program** — a routine carries `program_weeks` (8/10/12/16, default 12). `buildProgram(weeks)` in `data.ts` defines one repeating **block** (12 = the legacy tables); `getPhase` / `getRIR` / `volumeForWeek` are block-length-aware and **wrap** (`weekInBlock`) so the program repeats indefinitely and deloads at each block end. It is also **completion-paced and calendar-aware**: a routine's `program_anchor` + the user's `timezone` let `adherence.ts` attribute completed sessions to program weeks, slide the timeline forward on missed sessions, and surface a non-destructive **ramp-back** nudge after a gap (decisions persist in the append-only `program_adjustments` table). Stalled main lifts auto-deload — `shouldDeload` / `deloadTarget` prefill ~90% of the last weight in `SetLogger`. Workout types: `push/pull/legs` are legacy; granular types (`chest/back/shoulders/arms`) fall back to their parent.
- **A–D variants** — `WorkoutVariant` is `'A' | 'B' | 'C' | 'D'` (widened from A/B so multi-session full-body styles fit). `routine_exercises` and `routine_schedule` both carry a `variant` column; `routine_schedule.variant` **pins each scheduled day to a session** (e.g. Monday = Upper A), so day-select jumps straight to that tab in `PulseProvider`. `WorkoutTabs` sorts/labels A→D by string compare (no per-letter logic); `routineExercisesByTabKey` is computed in the provider.
- **Routine generation** — `src/lib/pulse/generation.ts` builds routines from a **program style** (a named `(focus, emphasis, variant)` sequence per training day, keyed by session count in `STYLES`). Each session uses an **emphasis profile** (`EMPHASES`: a `bias` + ordered movement-pattern slots); repeated focuses (two Upper days, three Full-Body days) get different emphases so they vary by design, not by accident. The shared engine filters the pool by selected equipment, fills slots with a routine-wide **avoid-set** (cross-session variation, no within-session dupes), sets rep ranges via `repRange(bias, isCompound, goal)`, and for `~30 min` sessions pairs antagonist exercises into **auto-supersets**. `recommendStyle(count)` picks the default style; `RoutineSetupFlow` shows a style-picker step when a count has more than one style. Equipment correctness lives in the `2026-06-04-exercise-equipment-correction.sql` seed (explicit per-exercise `equipment`, incl. the `pull_up_bar` key).

## Styling

Tailwind v4 with theme tokens defined inline via `@theme` in `src/app/globals.css` (no `tailwind.config`). Pulse uses custom tokens: colors `pulse-bg`, `pulse-surface`, `pulse-surface-2`, `pulse-border`, `pulse-accent`, `pulse-text`, `pulse-dim`, `pulse-muted`, etc., and fonts `font-pulse` (Hanken Grotesk), `font-pulse-body` (Sora), `font-pulse-display` (Big Shoulders Display — big numerals/labels). Use these tokens rather than hardcoded hex. The **accent is user-themeable**: the accent picker overrides `--color-pulse-accent` at runtime, so derive accent shades from that var or `color-mix` on it (Tailwind v4 opacity utilities like `bg-pulse-accent/10` compile to `color-mix(… var(--color-pulse-accent) …)` and cascade automatically — never hardcode the coral hex). `prettier-plugin-tailwindcss` sorts classes.

## Security headers

`next.config.mjs` sets global security headers and a strict CSP scoped to `/pulse/*` that whitelists the Supabase host for `connect-src`/`wss`. If you add an external origin (CDN, API, font host) the Pulse pages talk to, update the CSP there or requests will be blocked.

## Database migrations

SQL migrations are hand-written and tracked in `docs/migrations/*.sql` (dated). There is no automated migration runner in this repo — apply them against Supabase manually. `scripts/migrate-kv-to-supabase.ts` is a one-off data backfill.

## Docs

`docs/roadmap.md` tracks shipped Pulse features, the re-tiered roadmap, and a **"Status & next session"** block at the top with the ordered next actions. `docs/superpowers/{plans,specs,designs}/` hold the design specs, implementation plans, and HTML design mockups that drove each feature, useful context before extending an area.

**Roadmap workflow (follow on every implementation; commit at each end):**

- **Start.** On the feature branch, mark the item *In progress* in `docs/roadmap.md`: set the `In progress:` line in the "Status & next session" block to the item name and the branch. Commit this before writing implementation code (`docs(roadmap): start <item>`). This first commit also confirms you are on a branch, not `main`.
- **Finish.** Move the item to **Shipped** (relocate or strike its tier-table row, add a dated Shipped bullet under "Reference & archive"), clear the `In progress:` line back to `(none)`, and bring `docs/roadmap.md` and this `CLAUDE.md` current with the codebase: the Status block (where things stand, next-up order), the test count, and any architecture/section the change touched. Commit the sync on the same branch as the final step. Keeping both docs accurate is part of "done", not optional.

**Generation engine — design reference:** Phase 0 (data foundations) is **complete** (2026-06-06): the muscle bridge, expanded exercise metadata, fractional per-muscle volume, and session-linked logging + the unified `DecisionEvent` log all shipped. Before any further generation work (Phase 1+: training-style personalization, movement restrictions, equipment profiles) read `docs/superpowers/designs/2026-06-06-00-30-19-generation-engine-v2-audit.md` (architecture audit) and `docs/superpowers/designs/2026-06-06-00-54-52-phase0-source-material.md` (the canonical MovementPattern → muscle map, exercise-metadata schema, `DecisionEvent` taxonomy, substitution classes, golden tests). The decision stands: keep the slot-first generator and layer a data bridge + richer metadata on top; do not rewrite the engine.
