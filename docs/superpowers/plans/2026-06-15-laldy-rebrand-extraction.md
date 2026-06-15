# Laldy rebrand + extraction, implementation plan

> Executable checklist for the spec `docs/superpowers/specs/2026-06-15-14-48-46-laldy-rebrand-extraction-design.md`. Read the spec first. One sprint, one cutover, extraction-proven-green-before-rename. **Do not start until the user says go.**

**Destination repo:** `/Users/christiaan/Documents/Workspace/laldy` (fresh, README only, `main`).
**Source repo:** `christiaanvaneijnsbergen_nl` (this repo); the app currently at `/pulse`.

## Status legend
`TODO` not started · `WIP` in progress · `DONE` implemented + verified + committed · `BLOCKED` waiting on user/manual.

## Conventions for this sprint
- **pnpm** is the workspace manager (`nodeLinker: hoisted`). Bun is not used in `laldy`.
- Each phase ends GREEN: `pnpm --filter web typecheck` + `pnpm --filter web test` (the ~1,610-suite) + `pnpm --filter web build`, plus the named manual checks.
- Discrete commits per phase (and 4a vs 4b split), so a regression points at one change.
- The brand "Laldy" appears ONLY in user-facing strings + the manifest (Phase 4). Everything else is brand-neutral.

---

# Phase 0, Scaffold the monorepo
**Goal:** an empty-but-correct Turborepo in `laldy` that builds and lints, no app code yet.

- [ ] In `laldy`, scaffold a Turborepo + pnpm monorepo: `apps/web` (Next.js 15, App Router, TS strict, Tailwind v4), `apps/www` (minimal Next or static), empty `packages/{lib,ui}`, `packages/{eslint-config,typescript-config}`, `turbo.json`, root `package.json`.
- [ ] `pnpm-workspace.yaml` with `packages: [apps/*, packages/*]` and **`nodeLinker: hoisted`** (Metro/Expo-ready).
- [ ] **User:** provision DNS + SSL early for both `go.laldy.app` and `laldy.app` (propagation is the slow, error-prone part; don't let cutover day be the first cert exercise). The placeholder page itself comes later (Phase 6).
- [ ] Pin `apps/web` to the SAME versions this repo uses (Next 15, React 19, Tailwind v4, vitest, etc.). The full upgrade to the current stack is a **separate fast-follow deploy** after the migration soaks (see "Fast-follow" at the end); do NOT scaffold on latest and port onto it (that couples the move with the upgrade and makes regressions unbisectable).
- [ ] `apps/web` carries over the build/test tooling from this repo: `tsconfig.json` (with the `@/*` → `apps/web/src/*` alias), `vitest.config.mjs`, `postcss.config.mjs`, eslint + prettier config, `next.config.mjs` (global security headers; keep the CSP-in-middleware split).
- [ ] **Gate:** `pnpm install`, `pnpm build`, `pnpm lint` green at the workspace root.

---

# Phase 1, Move the app verbatim (current names + `/pulse` routes)
**Goal:** the app runs in `apps/web` unchanged, suite green. Prove the MOVE in isolation before changing anything.

- [ ] Copy the MOVE set into `apps/web/src` (paths preserved): `app/pulse/**`, `app/api/pulse/**`, `components/pulse/**`, `hooks/pulse/**`, `lib/pulse/**`, `context/PulseContext.ts`, `lib/supabase/**`. Plus `public/manifest.webmanifest`, `public/sw.js`, `public/icons/pulse.svg`.
- [ ] Move `docs/migrations/**` and `scripts/migrate-kv-to-supabase.ts` into `laldy` (e.g. `apps/web/docs/migrations` or a top-level `db/`; pick one and note it).
- [ ] **Split `app/layout.tsx`:** `apps/web`'s root layout is today's `app/pulse/layout.tsx` content (Hanken Grotesk + Sora + Big Shoulders via `next/font`, app metadata), now at the app root. The portfolio's Poppins/analytics root layout stays behind.
- [ ] **Split `globals.css`:** `apps/web/src/app/globals.css` carries ONLY the app `@theme` block (the `--color-pulse-*` / `--font-pulse*` tokens, untouched names for now). The portfolio color tokens stay behind.
- [ ] Copy `lib/origin.ts` (shared util).
- [ ] `apps/web/package.json` deps: app-only (`@supabase/ssr`, `@supabase/supabase-js`, `swr`, `html-to-image`) + shared (next, react, tailwind, vitest, testing-library, etc.). NOT `@vercel/analytics`.
- [ ] `apps/web/.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (no secrets). Point local `.env.local` at the SAME Supabase project.
- [ ] Confirm the `@/*` alias resolves in both `tsconfig.json` and `vitest.config.mjs` under `apps/web`.
- [ ] **Gate:** typecheck + the full suite + `pnpm --filter web build` green. `pnpm --filter web dev` serves the app at `/pulse/*` locally. Smoke: log in (against the real Supabase project), log a set, generate a routine, install the PWA locally.
- [ ] Commit: `feat(web): move the app into apps/web on current routes`.

---

# Phase 2, Flatten routes `/pulse` → root + infra
**Goal:** the app lives at the origin root, PWA/middleware/CSP updated. Split into gated sub-steps so an auth/CSP break points at ONE change.

- [ ] **2A, routes only:** move `app/pulse/(protected)/*` + the auth/login/signup/etc. routes up to root routes (`/train`, `/plan`, `/progress`, `/profile`, `/library`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/confirm`, `/account-deleted`); `app/api/pulse/*` → `app/api/*`. Update the ~29 `redirect('/pulse/...')`, ~40 `/api/pulse/*` fetch/SWR keys, ~24 `<Link>`/`router.push` paths, `navigation.ts` deep-link helpers, and `authPaths.ts`. Gate: typecheck + suite + build; every nav path resolves at root.
- [ ] **2B, manifest + PWA scope:** `scope` `/pulse` → `/` (explicit), `start_url` `/pulse/train` → `/train`; `sw.js` `SHELL ['/pulse/train']` → `['/train']` + navigate-prefix check → root (bump `VERSION`, renamed in Phase 3). Gate: SW registers at `/`, manifest installs.
- [ ] **2C, middleware matcher:** `middleware.ts` matcher `'/pulse/:path*'` → protect all app routes at root (everything except public auth paths + `_next` + static). Gate: unauthenticated redirect → `/login`, authed access works. (Stays `middleware.ts` on Next 15; the `proxy.ts` rename is the fast-follow upgrade, NOT now, that's deliberate, to keep it off the cutover.)
- [ ] **2D, CSP:** re-audit `buildCsp` on root scope; `connect-src`/`wss` cover the Supabase host, `worker-src`/`manifest-src` resolve, keep dev-only `'unsafe-eval'`. Gate: load EVERY route and watch the console for **CSP violations** (strict CSP fails silently when a path isn't covered); auth + SW registration clean.
- [ ] Commits: one per sub-step (`feat(web): flatten routes`, `feat(web): rescope manifest + SW`, `feat(web): rescope middleware matcher`, `feat(web): re-audit CSP for root origin`).

---

# Phase 3, Brand-neutral internal rename (4a)
**Goal:** mechanical, tool-driven, trusted by typecheck + suite. NO brand strings here.

- [ ] **Dirs:** `src/{app,components,hooks,lib}/pulse/` → `.../app/` (resolve the `app/app` clash sensibly, e.g. `components/app`, `lib/app`; the route `app/` dir is Next's, leave it). Fix imports.
- [ ] **Tokens:** `--color-pulse-*` → `--color-app-*`, `--font-pulse*` → `--font-app*` in `globals.css`; the ~1,190 `*-pulse-*` Tailwind class usages follow (find-replace `pulse-` token segments). Accent stays runtime-themeable (only the var name changes).
- [ ] **Symbols:** `PulseProvider`→`AppProvider`, `usePulse`→`useApp`, `PulseContext`/`PulseContextValue`→`AppContext`/`AppContextValue`, `PulseLayout`→`AppLayout`, `PulseRootLayout`→`AppRootLayout`, and any other `Pulse*` symbol. Fix all ~65 import sites + test references.
- [ ] **Storage keys:** `pulse-swr-cache:` → `app-swr-cache:`, `pulse:*` → `app:*`, `pulse_timer_idx` → `app_timer_idx`, IndexedDB `pulse-offline` → `app-offline`, SW `VERSION` → `app-shell-v1`. (Free: new origin = empty storage.) Update the matching tests.
- [ ] **Gate:** typecheck + suite + build green (this phase's correctness is exactly what the suite proves). Grep `pulse` (case-insensitive) and confirm only intended remnants (user-facing strings handled in Phase 4) remain. **Eyeball a few tests that assert on names/tokens** so green isn't vacuous (a test + its code renamed the same wrong way still passes).
- [ ] Commit: `refactor(web): rename internal pulse-* identifiers to brand-neutral app-*`.

---

# Phase 4, User-facing brand sweep (4b)
**Goal:** the ~25 user-facing strings + manifest say "Laldy". Hand-reviewed, separate commit.

- [ ] **Manifest:** `name` + `short_name` `"Pulse"` → `"Laldy"`. Rename `public/icons/pulse.svg` → `laldy.svg` (or a real Laldy icon) + update the manifest `src`.
- [ ] **Page titles (4):** app layout `'Pulse'` → `'Laldy'`; `'Pulse Login'`; `'Create your Pulse account'`; `'Reset your Pulse password'`.
- [ ] **Wordmark (6):** `Pulse.` → `Laldy.` in `DesktopLayout`, `AppShell`, `AuthShell`, `loading.tsx`, `login/page.tsx`, `ShareImageCard`.
- [ ] **Copy:** `OnboardingModal` intro, `account-deleted` thank-you, 2 sign-out `aria-label`s, the ~6 help strings in `RoutineSetupFlow` / `TuneYourPlanPanel` / `ProfileView`, share filename `pulse-session.png` → `laldy-session.png`. Update tests asserting these strings.
- [ ] **Gate:** typecheck + suite + build green; eyeball every surface in `pnpm --filter web dev`.
- [ ] Commit: `feat(web): rebrand user-facing copy Pulse to Laldy`.

---

# Phase 5, Preview rehearsal + cutover
**Goal:** prove the prod transition (on the CURRENT stack) before the real DNS flip; keep a rollback.

- [ ] **User:** push `laldy` to GitHub; create the Vercel project (root dir `apps/web`); point `go.laldy.app` at it. Deploy to a Vercel PREVIEW URL first.
- [ ] **User:** add the preview origin to the Supabase redirect allow-list (a stable alias or a wildcard) so the auth round-trip can actually run on the preview.
- [ ] **Rehearse on the preview URL:** install the PWA, go offline, log a set, reconnect, confirm it flushes into Supabase under the right account; full auth round-trip (login, signup+confirm, password reset, password change).
- [ ] **User:** back up the Supabase project. Add `go.laldy.app` to the redirect allow-list WITHOUT removing the old origin. Rebrand the Supabase auth email templates.
- [ ] Confirm `go.laldy.app` serves clean HTTPS (cert propagated).
- [ ] **Cutover window (no one mid-session):** on every device that ever logged, confirm pending sync = 0 (`offlineQueue.count()` + `deadLetteredCount()` both 0; PendingSyncBadge clear).
- [ ] Promote `apps/web` to `go.laldy.app`. Manual verify on the live origin: PWA install, offline-log-reconnect-flush, full auth round-trip.
- [ ] **User:** flip Supabase Site URL → `go.laldy.app`. Both users log in fresh (sessions are origin-scoped; data intact). **Rollback note:** Site URL is a single global, so a true rollback reverts Site URL + the allow-list to the old origin, not just the frontend.
- [ ] **User:** both reinstall the PWA from `go.laldy.app` (clear the old SW in devtools if it lingers). NO tombstone build.
- [ ] **User:** prune the old origin from the allow-list once the new origin is confirmed; set a decommission date for the old origin (after which stranded-write risk is gone).

---

# Phase 6, Apex placeholder + portfolio cleanup
- [ ] `apps/www`: a single static `noindex` page (logo + one line; no email capture unless it'll actually be mailed). Vercel project root `apps/www` → `laldy.app`.
- [ ] In the portfolio repo (`christiaanvaneijnsbergen_nl`): delete `app/pulse`, `app/api/pulse`, `components/pulse`, `hooks/pulse`, `lib/pulse`, `lib/supabase`, `context/PulseContext.ts`, the PWA manifest/SW/icon, the `/pulse` middleware matcher (or `middleware.ts` if now unused), and the app-only deps (`@supabase/*`, `swr`, `html-to-image`). Keep the portfolio green.
- [ ] **Gate:** portfolio builds + lints clean with no dangling Pulse imports.
- [ ] Commit (portfolio): `chore: remove the extracted app (now Laldy at go.laldy.app)`.

---

# Fast-follow, Full dependency upgrade (SEPARATE deploy, after a ~1-2 week soak)
**Goal:** `laldy` on the current stack, deployed to the already-live `go.laldy.app` (a routine deploy, NOT a cutover), once the migration has run on real training. Three isolated passes + Next-16 prep; each green before the next.

- [ ] Produce an upgrade plan table (dep / current / latest / risk).
- [ ] **Codemod pre-pass:** run `@next/codemod` to auto-fix the bulk of the API changes.
- [ ] **Pass 1 (low-risk):** `swr`, `vitest` (2.x→3.x major), `eslint` + `eslint-config-next`, `typescript`, `prettier`, `prettier-plugin-tailwindcss`, `react-icons`, `@types/*`, `jsdom`, `postcss`, Tailwind minors. Gate: typecheck + suite + build.
- [ ] **Pass 2 (Next 15→16):** via codemods. **Rename `middleware.ts` → `proxy.ts`** (Node runtime); move the CSP/session-refresh logic, verify no Edge-only APIs. Watch caching defaults (fetch no-cache-by-default), Turbopack-as-default, RSC behaviour. The server client already `await`s `cookies()`. Audit `'use client'` scope. Gate: typecheck + suite + build + manual core flows (auth, log a set, generation, offline, PWA install).
- [ ] **Pass 3 (Supabase):** **first verify `@supabase/ssr` supports Next 16**, then bump `@supabase/ssr` + `@supabase/supabase-js`. Never stack with Pass 2. Treat a pre-1.0 minor as breaking. Gate: typecheck + suite + build + auth + data flows end-to-end.
- [ ] Rehearse the upgraded stack on a preview, then deploy to `go.laldy.app`. Record anything NOT upgraded (and why); no features / copy / refactors beyond what the upgrade requires. Roll back to the pre-upgrade deploy if needed (same architecture, clean diff).

---

## Deferred (NOT this sprint, not the fast-follow)
- Populating `packages/lib` / `packages/ui`: when the Obytes Expo app (`apps/native`) starts, gated behind the native-reopen bar.
- The real marketing site (apex stays a `noindex` placeholder).
- iOS 7-day IndexedDB-eviction TTL on the offline queue (pre-existing PWA hardening).

## Review
Reviewed via the Perplexity + ChatGPT + Claude.ai loop (2026-06-15); the unanimous verdict to keep the dependency upgrade OUT of the cutover (separate fast-follow) is incorporated, along with the split Phase 2, the CSP-violation smoke test, early DNS provisioning, the Site-URL rollback nuance, the preview-origin allow-list entry, and eyeballing the rename tests. Execute phase-by-phase with a green gate at each.
