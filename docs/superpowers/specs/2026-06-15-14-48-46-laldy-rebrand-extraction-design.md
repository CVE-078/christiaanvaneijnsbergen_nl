# Laldy rebrand + repo extraction, design

**Date:** 2026-06-15
**Status:** Design approved, ready to plan. Not yet started.
**Validated via:** Claude Code codebase analysis (4 explorer passes) + Perplexity + ChatGPT + Claude.ai review loop, reconciled against code-truth.

## Goal

Two intertwined moves, done as **one focused sprint** in a clean window with nothing else in flight:

1. **Rebrand** the workout app from **Pulse** to **Laldy** (Scots "gie it laldy"; `laldy.app` is bought).
2. **Extract** the app out of the personal-portfolio repo into its **own repo** (a Turborepo monorepo), on its own domain.

This is infrastructure + brand, not moat work. Optimize for lowest-regret and fewest support incidents, then get back to adaptive-coaching work.

## Locked decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Repo | New repo named **`laldy`**, a **Turborepo monorepo** | Set up the structure now (cheap on this churn, expensive later) so a future Expo app can join. Repo = product namespace; layout is transient. |
| Package manager | **pnpm** with `nodeLinker: hoisted` | Future React Native / Expo via the **Obytes starter** (pnpm-based) needs Metro-compatible hoisting; Turborepo + `turbo prune` assume pnpm. Reviewers unanimous. Bun may stay as a script runner. |
| App location | Subdomain **`go.laldy.app`**, routes flattened to that subdomain's root (`/train`, `/plan`, `/progress`, `/profile`, `/library`, `/login`) | Clean PWA root scope on its own origin; clean security/SEO boundary from marketing. (Validated round 1; `go` over `train`/`app` by user.) |
| Marketing | Reserved at apex **`laldy.app`**, **static `noindex` placeholder** for now (`apps/www`), real site deferred | Apex must resolve cleanly anyway; an indexed thin "coming soon" hurts the brand, so `noindex` it. Rehearses the second-project deploy. |
| Deploy | **Two Vercel projects**, one repo, different root directories (`apps/web` → `go.laldy.app`, `apps/www` → `laldy.app`) | Independent deploys/env/rollback. |
| Supabase | **Same project reused**; cookie stays **host-scoped** (default, no code change); update Site URL + redirect allow-list | Data is keyed by account, not origin, so it carries over. |
| Internal naming | **Brand-neutral** (`AppProvider`, `useApp`, `AppContext`, `--color-app-*`, `src/components/app/`, ...). Brand lives ONLY in the ~25 user-facing strings + manifest. | Same find-replace cost as branding it, but decouples code from brand permanently: a future rename touches ~25 strings, not ~1,200 token usages. |
| Dependency upgrade (Next 15→16 etc.) | **Kept OUT of the cutover.** Migrate + cut over on the current stack, soak ~1-2 weeks on real training, then upgrade as a separate fast-follow deploy | Reversed the fold-in after the review loop (unanimous, 2026-06-15). There is only ONE cutover either way (the upgrade deploy to a live app is routine), so folding in buys nothing and stacks a Next major on the same middleware/CSP/cookie surfaces the migration disturbs. Env-coupled bugs surface on deploy boundaries + soak, not in a green suite, so a known-good prod baseline before upgrading is the real safety. |
| Shared `packages/*` | Scaffolded but left **empty** | Don't pre-factor the brain before the Obytes app exists to consume it and reveal the real seam. |

## Code-truth findings (why this is low-risk *now*)

The reason it is low-risk is the **two cooperative users you control**, not that origin swaps are inherently safe. Hold that distinction; the messy parts bite at public-launch scale.

- **Zero cross-imports** between the portfolio and the app, in either direction. The app is already a self-contained island.
- **Data carries over** untouched: it lives in Supabase keyed by user account, not origin. Same project → same data, config-only change.
- **Client storage is origin-scoped** (localStorage, SWR cache, IndexedDB queue, SW cache). The new origin starts empty; no migration is possible or needed; storage keys can be renamed freely.
- **Auth is email/password only** (verified): `signInWithPassword`, `signUp` + `verifyOtp` confirm, `resetPasswordForEmail` + `verifyOtp`, `updateUser` password change. **No OAuth, no magic links.** Redirects use dynamic `${origin}` (e.g. `resetPasswordForEmail` → `${origin}/pulse/auth/confirm`), so they auto-adapt to the new origin once the path is flattened.
- **Cookies** use the standard `@supabase/ssr` `getAll`/`setAll` pattern with **no `httpOnly`** and **no explicit domain** → already host-scoped. No cookie code change needed.
- **Offline queue already exposes the drain signal**: `offlineQueue.count()` (pending) + `deadLetteredCount()` (poison writes, which are dead-lettered so they never stall the drain) + `PendingSyncBadge`. So "queue = 0" is provable per device.

## Scope

### A. Rebrand, user-facing (~25 strings, must change)
- **PWA manifest** (`public/manifest.webmanifest`): `name` + `short_name` `"Pulse"` → `"Laldy"`; plus `scope`/`start_url` (see §C).
- **Page titles** (4): app layout `'Pulse'`; `'Pulse Login'`; `'Create your Pulse account'`; `'Reset your Pulse password'`.
- **`Pulse.` wordmark** in 6 surfaces: `DesktopLayout`, `AppShell`, `AuthShell`, `loading.tsx`, `login/page.tsx`, and **`ShareImageCard`** (goes out on social shares).
- **Copy**: `OnboardingModal` intro ("Pulse adapts as you train…"), `account-deleted` thank-you, 2 sign-out `aria-label`s, ~6 help strings in `RoutineSetupFlow` / `TuneYourPlanPanel` / `ProfileView`, and the share filename `pulse-session.png`.
- **Supabase auth email templates** (dashboard-side): rebrand "Pulse" → "Laldy" separately.
- The portfolio site does **not** reference Pulse, so nothing there to change.

### B. Rebrand, internal (brand-neutral, optional-but-doing-it)
Mechanical prefix/symbol swap during the import-path churn. Do NOT also re-semanticize the token taxonomy (scope creep).
- **Dirs**: `src/{app,components,hooks,lib}/pulse/` → `.../app/` (and `src/app/api/pulse/` → flatten, see §C). ~340 files.
- **Tokens**: `--color-pulse-*` → `--color-app-*`, `--font-pulse*` → `--font-app*`. ~1,190 class usages auto-follow via Tailwind `@theme`. (The runtime-themeable accent stays themeable; only the var name changes.)
- **Symbols**: `PulseProvider`→`AppProvider`, `usePulse`→`useApp`, `PulseContext`/`PulseContextValue`→`AppContext`/`AppContextValue`, `PulseLayout`→`AppLayout`, etc. ~65 import sites.
- **Storage keys**: `pulse-*` / `pulse:*` / `pulse-offline` / `pulse-shell-v*` → neutral `app-*`. Free to rename (new origin = empty storage).

### C. Extraction (move / copy-not-move / split / stays)
- **MOVE** to `apps/web`: `src/app/pulse/**`, `src/app/api/pulse/**`, `src/components/pulse/**`, `src/hooks/pulse/**`, `src/lib/pulse/**`, `src/context/PulseContext.ts`, `src/lib/supabase/**`, `public/manifest.webmanifest`, `public/sw.js`, `public/icons/pulse.svg`, `docs/migrations/**`, `scripts/migrate-kv-to-supabase.ts`.
- **SPLIT** (2 tangled files): `src/app/layout.tsx` (portfolio keeps Poppins/analytics root; the app's new root layout is today's `src/app/pulse/layout.tsx` with Hanken Grotesk / Sora / Big Shoulders); `src/app/globals.css` (portfolio color tokens stay behind; the app `@theme` block moves).
- **COPY-not-move** (tooling, both repos need a version): `tsconfig.json`, `postcss.config.mjs`, `prettier.config.cjs`, eslint config, `vitest.config.mjs`, `next.config.mjs`, the relevant `package.json` deps, `src/lib/origin.ts`.
- **STAYS** in the portfolio: `page.tsx`, marketing components, `experience.tsx`, `me.png`, `not-found.tsx`, and `middleware.ts` (then delete its `/pulse` matcher + the now-unused Supabase deps from the portfolio).
- **Dep split**: app-only = `@supabase/ssr`, `@supabase/supabase-js`, `swr`, `html-to-image`; portfolio-only = `@vercel/analytics`; rest shared.

### Routing / PWA / infra changes for the new origin
- Manifest: `scope` `/pulse` → `/` (set explicitly), `start_url` `/pulse/train` → `/train`.
- `sw.js`: `SHELL ['/pulse/train']` → `['/train']`, the `/pulse` navigate-prefix check → root, `VERSION` → neutral `app-shell-v1` (safe; `activate` already purges non-matching caches).
- `middleware.ts` matcher `'/pulse/:path*'` → flattened protected paths; `authPaths.ts` (5 public paths) updated.
- ~29 `redirect('/pulse/...')` + ~40 `/api/pulse/*` fetch keys + ~24 `<Link>`/`router.push` paths → drop the `/pulse` prefix.
- **CSP re-audit** (`buildCsp` in supabase middleware): on the new origin it scopes to `/`; confirm `connect-src`/`wss` cover the Supabase host and `worker-src`/`manifest-src` resolve. Keep the dev-only `'unsafe-eval'`.

## Sequence (discrete, individually-verified commits; one migration sprint, one cutover; the dependency upgrade is a SEPARATE fast-follow)

Each step green (typecheck + full ~1,600-test suite) before the next, so a red suite points at one change.

1. **Provision DNS + SSL** for both `go.laldy.app` and `laldy.app` early (propagation is the slow, error-prone part; don't let cutover day be the first time certs are exercised). The placeholder page itself comes late (step 8).
2. **Scaffold** the `laldy` Turborepo (pnpm, `nodeLinker: hoisted`): `apps/web`, `apps/www`, empty `packages/{lib,ui}`, `turbo.json`. Pin `apps/web` to the **current** versions (Next 15 etc.); the upgrade is a separate fast-follow, NOT part of this sprint.
3. **Move** the app into `apps/web` on **current names + current `/pulse` routes**; fix import paths (`@/*` carries over); split `layout.tsx` + `globals.css`. Get green. (Prove the move in isolation.)
4. **Flatten** routes `/pulse` → root, in discrete sub-commits each gated: (4a) routes only, (4b) manifest + PWA scope/`start_url`, (4c) middleware matcher + `authPaths`, (4d) CSP. After the flatten, run a **CSP-violation console smoke test** across every route (strict CSP fails silently when an asset path isn't covered).
5. **Internal neutral rename** (tool-driven, trusted by typecheck + suite; but eyeball a few tests that assert on names/tokens so green isn't vacuous, the test + code can be renamed the same wrong way).
6. **User-facing brand sweep** (hand-reviewed): the ~25 strings + manifest name. (Splitting 5/6 keeps 25 meaningful edits from drowning in a 1,190-usage token rename.)
7. **Rehearse on a Vercel preview** URL: install the PWA, go offline, log a set, reconnect, confirm it flushes to Supabase under the right account; run the full auth round-trip. Add the preview origin to the Supabase redirect allow-list (a stable alias or a wildcard) so the auth round-trip actually runs. This is the prod-like test green unit tests can't reach.
8. **Cutover** (see checklist), then the **apex placeholder** (`apps/www`, `noindex`).
9. **Soak ~1-2 weeks on real training.** Then, as a SEPARATE deploy, the dependency upgrade (see "Fast-follow" below).

Keep the old origin live + in the Supabase allow-list as **rollback** until `go.laldy.app` is confirmed end-to-end. Note: Supabase **Site URL is a single global value**, so flipping it points auth emails at the new origin; a true rollback reverts Site URL + the allow-list to the old origin, not just the frontend. Set a decommission date for the old origin after which stranded-write risk is gone.

## Cutover checklist (manual; the part unit tests can't cover)
1. **Back up the Supabase project** before any auth-config edit (free insurance).
2. Add `go.laldy.app` to the Supabase **redirect allow-list** *without removing* the old origin yet.
3. Confirm `go.laldy.app` serves **clean HTTPS** (cert propagated) before flipping anything.
4. Pick a window when **neither user is mid-session**. On every device that has ever logged: confirm `count() === 0 && deadLetteredCount() === 0` (PendingSyncBadge reads zero).
5. Deploy `apps/web` to `go.laldy.app`. Manually verify: PWA install from new origin, offline-log-reconnect-flush, login, password reset, signup confirm.
6. Flip Supabase **Site URL** to `go.laldy.app`. Both users log in fresh (sessions are origin-scoped; data intact).
7. **Decommission the old `/pulse`**: remove `/pulse` + the now-unused Supabase deps + the matcher from the portfolio. **No tombstone build** (user call, 2026-06-15): at this user count both of you simply reinstall the PWA from the new origin and clear the old service worker in devtools if it lingers. (A "moved" notice / 301 is the public-scale version; not worth it for two known users.)
8. Prune the old origin from the Supabase allow-list once the new origin is confirmed.

## Risks (ranked) + mitigations
1. **Auth/domain config drift** (highest likelihood). Mitigated by: no OAuth/magic-link surface, dynamic `${origin}` redirects, host-default cookies, allow-list-both-then-prune, and the manual auth round-trip in step 6. Test signup-confirm + password-reset + login + password-change explicitly, not just "login works".
2. **Silent loss of unsynced offline writes** (only true data-loss path). Mitigated by the provable `count + deadLetteredCount = 0` per device, a no-mid-session window, and keeping the old flush path alive until both devices provably drain. Watch the post-cutover case: an offline write made on the old origin after a device is switched can't flush; coordination, not code.
3. **Old service worker zombies** pinning the two installs to dead `/pulse` URLs. Mitigated by both users reinstalling from the new origin (and clearing the old SW in devtools if it lingers). No tombstone build at this user count.
4. **Coupled-change debugging pain.** Mitigated by discrete verified commits, the split Phase 4, and by keeping the dependency upgrade OUT of the cutover entirely (separate fast-follow), so the cutover changes only migration variables. Env-coupled bugs surface on deploy boundaries + the soak, not in a green suite.

## Fast-follow: dependency upgrade (SEPARATE deploy, after the ~1-2 week soak)
Done on the already-live `go.laldy.app` (a routine deploy, not a cutover), once the migration has run on real training. Three isolated passes, each verified green, plus the Next-16-specific prep:
- **Codemod pre-pass:** run `@next/codemod` first to auto-fix the bulk of the API changes.
- **Pass 1, low-risk group:** `swr`, `vitest` (2.x→3.x major), `eslint`/`eslint-config-next`, `typescript`, `prettier`, `prettier-plugin-tailwindcss`, `react-icons`, `@types/*`, `jsdom`, `postcss`, Tailwind minors.
- **Pass 2, Next 15→16:** via codemods. **`middleware.ts` is replaced by `proxy.ts`** (Node runtime), so the CSP/session-refresh middleware moves; verify it doesn't rely on Edge-only APIs. Watch caching-default changes (fetch goes no-cache-by-default), Turbopack-as-default, and RSC behaviour. The server client already `await`s `cookies()`, so that part is handled. Audit `'use client'` scope.
- **Pass 3, Supabase libs:** bump `@supabase/ssr` + `@supabase/supabase-js` against the upgraded Next; **verify `@supabase/ssr` supports Next 16** before starting; verify auth + data flows end-to-end. Never stack with Pass 2.
- Rehearse the upgraded stack on a preview, then deploy. Roll back to the pre-upgrade deploy if needed (same architecture, clean diff).

## Deferred / out of scope
- Populating `packages/lib` / `packages/ui`: when the Obytes Expo app starts (gated behind the validation + native-reopen bar).
- The real marketing site: the apex stays a `noindex` placeholder until there's a launch to point it at.
- iOS 7-day IndexedDB eviction TTL on the offline queue: a pre-existing PWA-hardening item, not migration-specific.

## Manual steps (user)
- Create the `laldy` GitHub repo + two Vercel projects (root dirs `apps/web` → `go.laldy.app`, `apps/www` → `laldy.app`).
- DNS: `go` CNAME → Vercel; apex → Vercel.
- Supabase dashboard: Site URL + redirect allow-list; rebrand the auth email templates; snapshot before editing.
- Cutover coordination (queue drain, reinstall the PWA from the new URL on both devices).
