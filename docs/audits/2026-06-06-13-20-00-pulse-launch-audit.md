# Pulse codebase audit — triaged findings (2026-06-06)

**Method:** full read of the Pulse surface (server actions, API routes, auth/session, validation, offline queue, RLS migrations, CSP, secrets) plus a quality/perf review of the logic and React layers. Tree audited: `main` @ `83c49cd` (fractional-volume PR #58 merged; clean working tree). Verification after fixes: `tsc --noEmit` clean, full suite **725 passed / 67 files** (was 721; +4 new offline-queue tests).

**Discipline:** only **Bucket 1 (security + data-integrity)** is fixed in this pass. Buckets 2 (quality) and 3 (performance) are a triaged backlog, not a to-do list — fixed opportunistically (when already in the file) or deferred. A solo dev with two users does not refactor working code or optimize for absent load.

---

## Bucket 1 — Launch-blocking (security + data-integrity)

### Fixed in this pass (branch `fix/audit-launch-blocking`, tests green)

1. **Offline-queue head-of-line stall (poison pill).** `offlineSync.flushQueue` previously `break`-ed on the first replay failure, so one permanently-failing write (bad input, since-deleted row) blocked **every** write queued behind it forever — a silently-growing pending count whose only user "fix" is reinstall, which wipes IndexedDB and all unsynced data. **Fix:** `isPermanentFailure` classifies the thrown error; permanent (`/invalid|not found/`) → dead-letter (new IndexedDB `deadletter` store, preserved not dropped) and skip; transient (network, server blip, **auth-expiry**) → stop and retry next flush. Auth-expiry (`Unauthorized`) is deliberately transient: the queue only holds the current user's own writes, so a replay `Unauthorized` means a lapsed session a re-login fixes. `flushQueue` now returns `deadLettered` and `deadLetteredCount()` is exposed for an honest UI surface. Files: `offlineQueue.ts`, `offlineSync.ts`, `__tests__/offlineSync.test.ts` (+4 cases). _Risk closed: the exact Runna "stuck sync → reinstall → data loss" failure mode._

2. **`cloneTemplate` unvalidated write-path inputs.** `cloneTemplate` trusted client `trainingDays` / `sessionTime` / `experience` while its sibling `generateAndSaveRoutine` validates them. An out-of-range `trainingDays` writes a junk `routine_schedule.day_of_week`. **Fix:** added the same guards (days integer 0–6, `sessionTime` and `experience` whitelisted). Self-data-only, low severity, but it is the named Bucket 1 category (input validation on a write path) and a 4-line guard mirroring a tested sibling. File: `actions/routines.ts`.

### Verified safe — do NOT re-audit

- **Server-action authorization (every action, not sampled).** `routines.ts`, `profile.ts`, `session.ts` (`upsertLog`/`deleteLogRow`), `notes.ts`, `swaps.ts`, `exercises.ts`, `adjustments.ts`: each calls `getUserOrThrow` and then either scopes the query by `.eq('user_id', user.id)` or runs an `assertOwns*` check (`_shared.ts`). No client-supplied id is trusted. Exercise references confirm global-or-owned. `reorderRoutineExercises` scopes updates by the owned `routine_id`. 
- **API-route authorization.** `sessions` POST/PATCH and `supersets` POST/DELETE all resolve the session user (`getUserOrUnauthorized`) and verify routine/row ownership before mutating (`workout_routines!inner(user_id)` checks; `.eq('user_id', …)` on PATCH).
- **Set-log integrity / PR poisoning.** `validateLogEntry` bounds kg (0–500), reps (1–100 int), rir (0–10 int), drops (≤6, same bounds); `LOG_KEY_RE` is strict (week 1–52, UUID v4, setIdx 0–9). `upsertLog` is keyed on `(user_id, week, routine_exercise_id, set_idx)` so a duplicate replays as the same row — a fat-finger or duplicate can't poison PRs (PRs derive from bounded E1RM) or corrupt logs. `parseDecimalInput` mis-parses are caught by the same downstream bounds.
- **Auth/session.** `getUserOrThrow`/`getUserOrUnauthorized` use `supabase.auth.getUser()` (server-validated), not the spoofable `getSession()`. Middleware refreshes session and redirects unauthenticated `/pulse/*` to login.
- **Reads are server-mediated, not client-direct.** The browser Supabase client is imported nowhere in `src`; SWR hooks fetch via `/api/pulse/*` server routes that filter by the authenticated `user.id` (`queries.ts` loaders). RLS is defense-in-depth, not the sole guard.
- **Secrets.** Only `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach any client path. No service-role key anywhere.
- **CSP** (`lib/supabase/middleware.ts`, per-request nonce): `script-src 'self' 'nonce-…' 'strict-dynamic'`, `connect-src` whitelists only the Supabase host (+wss), `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action 'self'`. Global headers (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy) in `next.config.mjs`.
- **Offline cross-user replay.** Queued writes carry `userId`; `flushQueue` replays only the current user's writes and never drops another user's (confirmed; unchanged by this pass).

### Flagged, NOT fixed (forward constraints — record next to auth findings)

- **RLS policy definitions are not fully in version control.** Migrations enable RLS across the user-data tables, but the policy bodies are not all reproducible from `docs/migrations` (some were applied directly in Supabase; prod was verified owner-scoped earlier — 16 tables `relrowsecurity=true`). Runtime guard holds (RLS-on without a policy denies all, and the app works), but it is a **drift/reproducibility risk**: a future table could enable RLS without a correct owner policy and nothing in the repo would catch it. **Disposition:** before public launch, dump the live policies into a tracked migration and add a checklist item to do so for every new user-data table (especially child tables that must scope through a parent, e.g. `routine_exercises` → `workout_routines.user_id`). Not a vulnerability today; a pre-launch hygiene gate.
- **Cross-device auth boundary (forward constraint for the unbuilt auth lifecycle).** Today's only auth entry is `signInWithPassword` with normal per-device session persistence — no link carries a session, so nothing to fix. When signup / reset / cross-device continuity get built, hold the boundary already recorded in the roadmap launch-floor: continuity via owner-bound persistent sessions (or owner-emailed single-use magic-link / QR device-pairing), **never a link that carries authentication**.

---

## Bucket 2 — Quality (SOLID / DRY / KISS). FILE, do not fix now.

| # | Location | Principle / issue | Cost | Disposition |
|---|----------|-------------------|------|-------------|
| Q1 | `utils.ts` (864 loc) | God-module: ~9 unrelated domains (week math, conversion, log-key parsing, strength, per-muscle attribution, plate calc, recomp, superset grouping). | Maintainability: changes/tests pull the whole file. Fix M (split into `week.ts`/`parsing.ts`/`conversion.ts`/`stats.ts`). | file-opportunistic (split a domain out when you next touch it) |
| Q2 | `utils.ts:606` + `historyBundle.ts:~89` | DRY: fractional per-muscle accumulation duplicated (intentionally byte-aligned, guarded by a test). | Divergence risk if the bucketing rule changes. Fix S (extract `accumulateFractionalVolume`). | file-opportunistic |
| Q3 | `queries.ts:156` | Type safety: `as unknown as RoutineWithExercises[]` masks the Supabase join shape. | Hides a shape mismatch from the type checker. Fix S. | file-opportunistic |
| Q4 | `generation.ts` (688 loc) | Large; emphasis/slot-fill/superset/volume interleaved. | Harder to extend/test in isolation. Fix M. | file-deferred (well tested as a pipeline) |
| Q5 | `utils.ts` (computeStreak/computeWeeksWithData) | Inline `split('-')` log-key parsing bypasses `parseLogKey`. | Parsing not centralized; format change misses these. Fix S. | file-opportunistic |
| Q6 | `utils.ts` | Magic numbers scattered (warmup 40/50/65/80, 2.5, 0.5) vs `constants.ts`. | Tuning means hunting. Fix S. | file-opportunistic |
| Q7 | `SetLogger.tsx:113` | `useEffect` exhaustive-deps suppressed; unit-change re-sync can hold stale kg/reps if `editing`/`entry` change unexpectedly. | Real but low-probability stale-closure (unit change mid-edit is rare). Fix S (split into two effects). | file-opportunistic |
| Q8 | `WorkoutModeScreen.tsx` (overlay) | A11y: full-screen overlay lacks `role="dialog"`/`aria-modal`; some action buttons miss `aria-label`. | Screen-reader users can't perceive the modal. Fix S. | file-opportunistic (launch-quality, not launch-blocking) |
| Q9 | `WorkoutModeScreen.tsx` (ExerciseActions) vs `ExerciseCard.tsx` | DRY: note edit/view/save state machine duplicated. | Two copies drift. Fix M (`useNoteEditor` hook). | file-opportunistic |
| Q10 | `SetLogger.tsx` `type` prop + `ExerciseCard` `type="push"` hardcoded | Dead/incorrect prop (unused in SetLogger). | Confusing, no runtime effect. Fix S. | file-opportunistic |
| Q11 | `ExerciseCard.tsx` (memo) | Known item already in roadmap "Later": `savedCount`/derived values recompute per render. | Maintainability/minor perf. | file-deferred (already tracked) |
| Q12 | pure-logic test coverage | **Checked per request:** `adherence`, `generation`, `muscleMap`, `historyBundle`, `utils`, `strength`, `validation` all have tests; Phase 0 fractional math covered (muscleMap/historyBundle/utils). **No coverage gap opened by Phase 0.** | — | no action (confirmed healthy) |
| Q13 | engine portability | **Checked per request:** the pure brain (`adherence`/`generation`/`muscleMap`/`utils`/`data`/`strength`/…) has zero web deps; coupling is confined to correctly-infra files (`auth`/`queries`/`offlineQueue`/`offlineSync`/`swrCache`). New `isPermanentFailure` is pure. **No web-dependency creep into the engine.** | — | no action (confirmed clean) |

---

## Bucket 3 — Performance. FILE, do not fix now (one exception checked).

- **Core-loop check (the one exception that matters at 2 users).** Assessed from code (not a real-device profile): set logging is an optimistic SWR `mutate` + single-row `upsert` (no synchronous heavy compute on the log path); the rest timer is wall-clock-anchored and survives lock (already hardened). **Nothing genuinely broken → no Bucket 1 core-loop fix.** Candidate to watch: `PulseProvider` exposes one coarse context value (not split stable-vs-volatile), so any state change re-renders all `usePulse()` consumers. At two users / small routines this is fine; **if** mid-workout jank shows up on a real device, this memoization is the first suspect. File-deferred with that note.
- **Deferred (premature at current scale):** `PulseProvider` context-value memoization / context splitting; `ExerciseCard` `savedCount` `useMemo`; inline-object/`Array.from` allocations in `SetLogger`/`WorkoutModeScreen`; list virtualization; bundle-size work. All file-deferred until there's real load or a measured problem.

---

## Explicitly dropped — do not resurface in a future audit

- **`compareTabKeys` lexicographic A→D sort** — correct by construction for the `'A'|'B'|'C'|'D'` union; not fragile in practice.
- **CSP `style-src 'unsafe-inline'`** — required by Tailwind/inline styles; low risk under the strict nonce'd `script-src`. Only revisit if moving to nonce'd styles.
- **Micro-memoization of cheap pure calls** (e.g. `useMemo(groupExercises, [exercises])`) — keep for safety or drop; not worth a pass.
- **Program-coherence score / heavy fatigue modeling / list virtualization** — premature for a deterministic generator at two users; already deprioritized on the roadmap.

---

### Summary

Bucket 1 came back clean except two items, both now fixed and tested: the offline-queue poison-pill (the real launch-blocker, a silent-data-loss path) and a `cloneTemplate` input guard. The authorization layer is genuinely solid action-by-action; secrets, CSP, validation bounds, and set-log idempotency are sound; reads are server-mediated with RLS as defense-in-depth. The one operational gap to close before public launch is capturing RLS policies in version control. Everything in Buckets 2 and 3 is a backlog, not due now.
