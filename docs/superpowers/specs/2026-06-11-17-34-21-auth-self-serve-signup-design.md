# Self-serve auth lifecycle, design (2026-06-11)

**Goal:** let other people sign up and use Pulse without the owner hand-creating accounts in Supabase. This is a soft public launch: open self-serve signup with required email verification, so the lifecycle must be complete enough that the owner is not the support desk.

**Branch:** `feature/auth-self-serve` (off `main`). Related but separate: the schema-in-VCS baseline (`feature/schema-vcs-baseline`, in review) supplies the base `profiles` table this work adds a trigger to; auth does not depend on that branch being merged first, but the FK-cascade verification below overlaps it.

**Out of scope (deferred, not dropped):** billing / paid tiers; legal pages (privacy policy, ToS, cookie consent), deferred by owner decision, close before a *wide* public push given EU/NL; operational floor (error tracking, backups, staging); the formal a11y sweep (new forms are built accessible by default, no sweep run); CAPTCHA on signup (strong fast-follow, see Abuse).

---

## 1. Scope and flows

The flows in this cut are below. The current state is login-only (`/pulse/login`, `signInWithPassword`), with a fragile lazy profile-row insert in the login action and a middleware that bounces every unauthenticated `/pulse/*` to login except `/pulse/login`.

| Flow | Entry | Mechanism | Outcome |
|---|---|---|---|
| Signup | `/pulse/signup` | `auth.signUp({ email, password, options: { emailRedirectTo } })` | "Check your email" state; no session yet (confirmation required) |
| Email verification | confirmation email link | Route Handler `/pulse/auth/confirm` runs `auth.verifyOtp({ type: 'signup', token_hash })` | session established, redirect into the app |
| Login | `/pulse/login` (exists) | `signInWithPassword` (unchanged) | session, redirect to `/pulse/train` |
| Forgot / reset password | `/pulse/forgot-password` → email → `/pulse/auth/confirm` → `/pulse/reset-password` | `resetPasswordForEmail({ redirectTo })`, then `verifyOtp({ type: 'recovery', token_hash })`, then `updateUser({ password })` | password changed, session active |
| Change password (logged in) | Profile → security | `updateUser({ password })` (reuses the reset form) | password changed |
| Delete account | Profile → danger zone | server action via service-role admin client: `auth.admin.deleteUser(sessionUserId)` | auth user + cascaded data removed, signed out |

**Design principle:** every new screen mirrors the existing login page (Server Component + server action, Slate theme tokens, the same `FIELD` input styling, `role="alert"` error block, accessible labels). No new design language, no client-side auth library.

---

## 2. Email verification mechanism (the key architectural choice)

Supabase email links are verified server-side with **`token_hash` + `verifyOtp`** in a Route Handler, NOT a client-side `?code=` PKCE exchange. Rationale: the link is opened in a fresh browser context (often a different device or the mail app's webview) where no PKCE `code_verifier` cookie exists, so the SSR-correct pattern is the `token_hash` route. This is the canonical Supabase Next.js SSR recipe.

`GET /pulse/auth/confirm` (Route Handler, `route.ts`):
1. Read `token_hash` and `type` (`signup` | `recovery` | `email_change`) from the query string, plus an optional `next` redirect target.
2. Create the server client, call `verifyOtp({ type, token_hash })`. On success a session cookie is set.
3. Redirect: `signup`/`email_change` → `next` or `/pulse/train`; `recovery` → `/pulse/reset-password`.
4. On failure → `/pulse/login?error=expired` (one friendly "link expired or already used, request a new one" message; do not leak which).

`emailRedirectTo` / `redirectTo` for signup and reset both point at `/pulse/auth/confirm` on the app's own origin. The origin must be whitelisted in Supabase Auth's redirect allow-list (dashboard config, hand-off).

---

## 3. Routes and components

```
src/app/pulse/
  login/                      (exists; add "Create account" + "Forgot password?" links)
  signup/
    page.tsx                  Server Component, email + password + confirm-password
    actions.ts                'use server' signUp
    SubmitButton.tsx          (reuse pattern from login)
  forgot-password/
    page.tsx                  email field
    actions.ts                'use server' resetPasswordForEmail (no enumeration)
  reset-password/
    page.tsx                  new-password form (requires an active recovery session)
    actions.ts                'use server' updateUser({ password })
  auth/
    confirm/
      route.ts                Route Handler: verifyOtp + redirect
```

Shared pieces:
- A small `PasswordFields` component (password + confirm, min-length hint, mismatch validation) reused by signup, reset-password, and the in-Profile change-password form.
- Account security lives in `ProfileView`: a "Change password" control (reuses `PasswordFields` + `updateUser`) and a confirm-gated "Delete account" in a visually distinct danger zone.

**Password policy:** minimum 8 characters, enforced both client-side (form) and by Supabase Auth's configured minimum (dashboard). No complexity theater beyond length for v1.

**Email enumeration:** `/pulse/forgot-password` always returns the same neutral confirmation regardless of whether the email exists. Signup surfaces Supabase's "user already registered" as a generic "If you already have an account, log in or reset your password" rather than confirming the address exists.

---

## 4. Middleware change

Generalize the single `isLoginPage` check into a pure, unit-tested helper:

```ts
// public auth paths reachable without a session
export function isPublicAuthPath(pathname: string): boolean
// true for: /pulse/login, /pulse/signup, /pulse/forgot-password, /pulse/auth/confirm
```

`/pulse/reset-password` is NOT public: the recovery link runs through `/pulse/auth/confirm`, which establishes a recovery session before redirecting there, so the user is authenticated by the time they reach the new-password form. The CSP is unchanged (all new routes are under `/pulse`, same Supabase host already whitelisted in `connect-src`). The existing `middleware.test.ts` gains cases for each public path and a protected path.

---

## 5. Profile row creation: replace the lazy insert with a DB trigger

Today `login/actions.ts` does a select-then-insert to create a missing `profiles` row. This is fragile (only runs on the password-login path) and will not cover signup/confirm. Replace it with a Postgres trigger:

```sql
-- on auth.users insert, create the profile row with defaults
create function public.handle_new_user() ... -- inserts id, unit='kg', onboarding_completed=false
create trigger on_auth_user_created after insert on auth.users ...
```

One reliable path for every account-creation route. The lazy insert in `login/actions.ts` is then removed. New migration (full-timestamp filename). The trigger writes only the base `profiles` columns, which is why it aligns with the schema-baseline work.

---

## 6. Account deletion (security-sensitive)

Deleting an `auth.users` row requires the **service-role key**, which must never reach the browser.

- New `src/lib/supabase/admin.ts`: a server-only client built from `SUPABASE_SERVICE_ROLE_KEY` (new env var, server-only, never `NEXT_PUBLIC_`). Add a guard so it throws if imported where the key is absent.
- One server action `deleteAccount()`:
  1. Resolve the session user via the normal cookie-based server client (`getUser`).
  2. Call `adminClient.auth.admin.deleteUser(user.id)` using **the session user's own id only**, never an id taken from the request body. This is the authorization boundary.
  3. Sign out / clear cookies, redirect to a "your account was deleted" confirmation.
- **Data cascade:** removal of the user's `set_logs`, `exercise_notes`, `bodyweight_logs`, `workout_routines`, `body_measurements`, etc. relies on `ON DELETE CASCADE` from `auth.users` (directly or transitively). The schema-baseline reconstruction flagged these FKs as `-- VERIFY`. **The implementation plan must verify each user-data table's FK actually cascades from `auth.users`**, and add a migration for any that do not, before this action is considered safe. A delete that leaves orphaned rows is a data-leak and GDPR problem.

---

## 7. Email deliverability (owner hand-off, blocks the flow)

Required-confirmation means signup and reset are useless if email does not arrive. Supabase's built-in sender is rate-capped (single-digits/hour) and spam-foldered, so it is not viable for real users.

- **Hand-off:** wire a transactional provider (recommended: **Resend**) as Supabase Auth custom SMTP, with **SPF, DKIM, and DMARC** configured on the sending domain.
- App code is provider-agnostic (Supabase sends the mail); this is Supabase dashboard config + DNS records on the owner's domain.
- Customize the Supabase Auth email templates (confirmation, recovery) to Pulse branding and confirm the `{{ .ConfirmationURL }}` points through `/pulse/auth/confirm`.
- Add the app origin to Supabase Auth's redirect allow-list.

This is documented as a required hand-off in the plan; the code can be built and unit-verified without it, but the manual end-to-end test depends on it.

---

## 8. Abuse protection

- Rely on Supabase Auth's built-in rate limits (per-IP signup, email-send caps) for v1.
- **Flag as strong fast-follow:** CAPTCHA (Cloudflare Turnstile) on signup, since open signup invites bots. It is a Supabase Auth toggle + a small client widget, not a rebuild. Out of this cut by scope, called out so it is a decision, not an oversight.
- No new per-route mutation rate limiting in this cut (the broader operational floor item).

---

## 9. Error handling and UX states

- Signup success → a persistent "Check your email to confirm" screen with a **resend confirmation** action (calls `auth.resend({ type: 'signup' })`), itself rate-aware.
- Expired/used confirmation or recovery link → single neutral message + a path to request a new one.
- Login error stays as-is ("Invalid email or password").
- Reset success → confirmation + redirect to the app (session is active).
- Delete → explicit double-confirm (type-to-confirm or a checkbox + confirm button), then a final "deleted" screen.
- All forms: `role="alert"` errors, `aria-invalid`/`aria-describedby` wired (matching the login page), keyboard operable, labelled inputs.

---

## 10. Testing

Per the codebase convention, server actions that hit Supabase are NOT unit-tested (no action harness). Coverage targets the pure and presentational layers:
- **Unit:** `isPublicAuthPath` (every public path + protected paths); the `/pulse/auth/confirm` handler's param parsing and redirect-target resolution (pure helper extracted from the route); the password-match/min-length validation helper.
- **Component:** render tests for signup, forgot-password, reset-password forms and the Profile danger zone (fields present, error states, disabled/submit states) following existing Testing Library patterns.
- **Middleware:** extend `middleware.test.ts` for the new public paths.
- **Manual end-to-end:** signup → real confirmation email → login → forgot → reset → change password → delete, run against a real Supabase project once email is wired (hand-off dependency).

---

## 11. New env vars and config

- `SUPABASE_SERVICE_ROLE_KEY` (server-only; add to `.env.local` and the deploy env; never `NEXT_PUBLIC_`).
- Supabase dashboard: enable email confirmations; set min password length; add the app origin to the redirect allow-list; configure custom SMTP (Resend); customize email templates.

---

## 12. Open verification points for the plan

Confirm against current Supabase `@supabase/ssr` docs during planning (the patterns are stable but worth pinning):
1. `verifyOtp({ type, token_hash })` is the recommended Route-Handler verification (vs `exchangeCodeForSession`), and the `type` values for signup vs recovery.
2. `auth.admin.deleteUser` signature and that it requires the service-role client.
3. Whether `auth.resend` covers the "resend confirmation" case in the installed SDK version.
4. Exact `auth.users → public.*` cascade state in the live DB (Section 6), the single most important pre-implementation check.

---

## Summary of deliverables

New routes (signup, forgot-password, reset-password, auth/confirm), login-page links, a reusable `PasswordFields`, Profile change-password + delete-account, a service-role admin client + `deleteAccount` action, a `profiles` auto-create trigger migration, FK-cascade verification (+ migration if needed), the `isPublicAuthPath` middleware refactor, and tests for the pure/presentational layers. Hand-offs: Resend SMTP + DNS, Supabase Auth config, `SUPABASE_SERVICE_ROLE_KEY`. Deferred: billing, legal pages, CAPTCHA, operational floor, formal a11y sweep.
