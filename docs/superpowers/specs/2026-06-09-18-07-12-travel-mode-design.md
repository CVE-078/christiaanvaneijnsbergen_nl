# Travel mode (#322), design

**Status:** approved 2026-06-09. Branch `feature/travel-mode`. Roadmap item Tier 2 #322 (follow-on to equipment profiles #6).

Reviewed by Claude.ai (science/UX) and Perplexity (architecture/maintainability); the reconciliation is folded in below (see "Reconciliation record").

## Goal

Let a user mark a saved equipment profile as a **temporary overlay** that is in use for a trip and then **auto-reverts** to their normal set, so they can quick-generate a travel routine without re-entering gear and without getting stuck on the reduced set after they return. Equipment profiles already exist (named, reusable sets, one stable active/default pointer). Travel mode is the time-boxed overlay the original `equipment_profiles` migration explicitly anticipated ("`expires_at` here plus auto-revert to the saved default set").

## Approach: overlay, not a new default

A travel profile is an **overlay** on top of the stable default, never a replacement for it.

- `profiles.active_equipment_profile_id` stays the **default** (the set you revert to). Travel never touches it.
- A profile carries a nullable `expires_at`. While `expires_at` is in the future (by user-tz calendar day), that profile is the **effective** set.
- Once the day passes, the overlay is simply ignored at read time and the effective set falls back to the default. No write happens at expiry, no cron, offline-safe.

Rejected alternatives: a separate `travel_equipment_profile_id` pointer (redundant once `expires_at` marks the overlay) and storing a remembered "previous active" (the untouched default already is the revert target).

## Constraint that shapes everything: no background job

This app is serverless + SWR with hand-applied migrations and **no cron**. Expiry is therefore **computed at read time**, not enforced by a job. This is what makes auto-revert trivial: a past-`expires_at` profile is inert; resolution falls through to the default.

## Data model

### Migration (`docs/migrations/<ts>-equipment-profile-expiry.sql`)
```sql
alter table equipment_profiles
  add column if not exists expires_at timestamptz;

-- One travel overlay per user, enforced at the DB. Partial: only rows that
-- carry an expiry are constrained, so non-travel profiles are unaffected.
-- Backstops concurrent startTravel; also serves as the overlay lookup index.
create unique index if not exists equipment_profiles_one_overlay_per_user
  on equipment_profiles (user_id)
  where expires_at is not null;
```
RLS already covers the new column. No separate perf index (the partial unique index is the lookup index; scale is two users / dozens of rows).

### Type (`src/lib/pulse/types.ts`)
`EquipmentProfile` gains `expires_at: string | null`. Existing rows are `null` and behave exactly as today. The loader select, the API route, and the action return mappings all add `expires_at`.

### Semantics of `expires_at`
It is a **calendar-day** revert marker, not a precise instant. It stores noon-UTC of the return day (noon is DST/offset-safe: it maps to the same calendar date in the user's tz). All comparisons go through the existing `dayIndex(iso, tz)` helper, so DST transitions never cause an off-by-one.

## Pure logic (`src/lib/pulse/utils.ts`), TDD-first

All functions are pure and take an injected `now` + `tz` (matching `adherence.ts`'s "no ambient clock" rule). `dayIndex` is imported from `adherence.ts`.

- `isTravelActive(p, nowIso, tz): boolean`. Returns `p.expires_at != null && dayIndex(nowIso, tz) < dayIndex(p.expires_at, tz)`. Boundary: equality (`==`) is **inactive** (you are reverted on the return day). Documented in JSDoc.
- `activeTravelProfile(profiles, nowIso, tz): EquipmentProfile | null`. The active overlay; if more than one somehow exists, the one with the latest `expires_at` (most remaining). Documented as a defensive net the unique index makes unreachable.
- `defaultProfile(profiles, activeId, nowIso, tz): EquipmentProfile | null`. The revert target: the `activeId` profile if it is not the overlay, else the most-recent non-overlay by **`created_at DESC`** (loader order, so `profiles[0]` skipping the overlay), else `null`.
- `resolveEquipmentPrefill(profiles, activeId, nowIso?, tz?): EquipmentKey[]`. **Overlay if active, else today's logic verbatim.** When `nowIso`/`tz` are omitted (existing 2-arg callers and tests), overlay resolution is skipped, so the result is byte-identical to today. A golden identity test pins this. A comment plus a dedicated test assert the overlay equipment wins, as a regression guard against future inline equipment resolution in the engine.
- `travelDaysLeft(p, nowIso, tz): number`. Returns `dayIndex(p.expires_at, tz) - dayIndex(nowIso, tz)` (>= 1 while active).
- `travelReturnDate(p, tz): string` and `travelEndedRecently(p, nowIso, tz): boolean` (`0 <= dayIndex(now) - dayIndex(expires_at) < ENDED_NUDGE_DAYS`), for the post-expiry pill.
- `computeTravelExpiry(nowIso, tz, days): string`. Noon-UTC of `(dayIndex(now,tz) + days)`: `new Date((dayIndex(now,tz) + days) * 86400000 + 12*3600000).toISOString()`. Used by both the day-chips and the custom-date path (a custom date uses its own day index).

Constants (`src/lib/pulse/constants.ts`): `MAX_TRAVEL_DAYS = 90`, `TRAVEL_DAY_PRESETS = [3, 7, 14]`, `ENDED_NUDGE_DAYS = 14`.

## Server actions (`src/app/pulse/actions/equipment.ts`)

No server-action unit-test harness (actions hit Supabase); coverage lives in the hook/component tests with mocked actions.

- `startTravel(profileId: string, expiresAt: string): Promise<void>`
  - Validate `profileId` (uuid), and `expiresAt` parses and its `dayIndex` is in `(today, today + MAX_TRAVEL_DAYS]` in the user's tz.
  - Ownership-check the target profile.
  - **Guard the revert target:** require a distinct default to revert to (the user has at least one non-overlay profile that is not the target). Otherwise throw a friendly error ("Create a home set first so travel mode can switch back").
  - **Atomic set-and-clear** in one statement: `update equipment_profiles set expires_at = case when id = $target then $ts else null end where user_id = $user`. This satisfies the one-overlay invariant atomically; the partial unique index backstops concurrency. Does **not** touch `active_equipment_profile_id`.
  - `revalidatePath('/pulse')`.
- `endTravel(): Promise<void>`. Runs `update equipment_profiles set expires_at = null where user_id = $user and expires_at is not null`. Clearing to `null` (not `now()`) keeps the column clean and doubles as the post-expiry nudge dismiss. `revalidatePath('/pulse')`.

## Hook (`src/hooks/pulse/useEquipmentProfiles.ts`)

Add `startTravel(id, expiresAt)` and `endTravel()`, following the existing optimistic pattern: `mutate(patch, false)` (patch `expires_at` on the target, clear it on the others) then `try { server } finally { await mutate() }`. The `finally` revalidate rolls a failed write back to server truth; the calling component shows a toast on catch (as `activate`/`remove` already do). No `PROFILE_KEY` mutation (the default pointer is unchanged).

## Context (`PulseContext`)

Expose `startTravel` / `endTravel` through `PulseContextValue` (the canonical contract), wired in `PulseProvider`.

## UI

### Manager (`EquipmentProfilesEditor`)
Badge rule (complete):
- overlay (travel active) → `✈ In use · {N} days left · reverts to {default}`
- default while travel is on → muted `Default`
- default with no travel → `Active` (unchanged from today)
- any other profile → no badge

Controls:
- Each non-default, non-overlay row gets a **"Use until…"** action → inline control with `TRAVEL_DAY_PRESETS` chips (3 / 7 / 14) plus a **custom date** (reuse the program-anchor date-picker idiom from the setup flow), showing the resulting return date and "reverts to {default}". Confirm → `startTravel(id, computeTravelExpiry(...))`.
- The active overlay row shows the ✈ badge, an **"End travel"** button (`endTravel`), and re-running "Use until…" on it **extends** the trip (just updates `expires_at`).
- When the user has no distinct travel set (only the default, or fewer than two profiles), show a **"Going away? Create a travel set"** affordance that opens the create form pre-named "Travel". This is the new-user path so travel mode is never a dead end.
- Deleting the active overlay ends travel (effective falls back to the default). Inline hint on that row: "Deleting ends travel mode". No blocking modal (the app avoids `confirm()`).

### Train pill (`LogView`)
A calm one-line pill driven by `usePulse()` (equipment profiles + active id + `profile.timezone` + current time). Two states:
- **Active travel:** `✈ Travel mode · reverts to {default} in {N} days`. Tap → Profile equipment manager (informational).
- **Ended (post-expiry nudge):** shown while `travelEndedRecently` is true. `✈ Travel ended · regenerate your {default} routine?` with **Regenerate** (→ the generation flow, the action the user actually needs) and **Dismiss** (→ `endTravel`, which clears the lingering `expires_at`). Auto-hides after `ENDED_NUDGE_DAYS`.

This is the payoff moment: the expiry is otherwise invisible exactly when it matters (back home, still on travel gear).

## Generation consumption

The engine is unchanged. Travel only changes what **pre-fills the equipment step**: `resolveEquipmentPrefill` is now overlay-aware, so `RoutineSetupFlow` and `TuneYourPlanPanel` seed from the travel set while it is active and from the default after it reverts. Travel does **not** silently regenerate the active routine (that is smart-substitution #8 territory). The "Filled from your X profile" hint reflects the effective set.

## Edge cases

- **Single-profile / no distinct default:** "Create a travel set" affordance + `startTravel` guard (covered above).
- **Deleting the overlay or the default mid-travel:** both resolve cleanly via the fallback chain; deleting the overlay ends travel, deleting the default `SET NULL`s the pointer and `defaultProfile` falls to most-recent non-overlay.
- **Stale past `expires_at`:** inert (read-time calendar comparison); the next `startTravel` clears it via the CASE update, or the user dismisses the ended-pill (which `endTravel`s).
- **Boundary `dayIndex(now) == dayIndex(expires_at)`:** inactive (reverted on the return day).
- **Concurrent `startTravel`:** the partial unique index rejects a second non-null overlay.
- **DST:** all math is calendar-day via `dayIndex(iso, tz)`; noon-UTC storage keeps the return day stable.

## Out of scope (v1)

Live exercise-swapping of an in-flight routine; recurring/auto travel detection; per-trip history; travel-usage analytics (no analytics layer yet, and a date-based event does not dedupe in the week-keyed `DecisionEvent` log, same call as program-pause #14 v1). CSP and i18n untouched (no new origin; plain-English copy, no em dashes).

## Testing

- **Pure (Vitest):** `isTravelActive` (incl. boundary), `activeTravelProfile` (incl. multi-overlay tiebreak), `defaultProfile` (incl. overlay-is-active-id, no-default), `resolveEquipmentPrefill` overlay path + **golden identity** (no `expires_at` → byte-identical) + engine-change guard, `travelDaysLeft`, `computeTravelExpiry` (incl. a DST-transition date), `travelEndedRecently`.
- **Component (Testing Library):** manager "Use until…" → chips → `startTravel` called with the right expiry; badge states; "End travel" → `endTravel`; "Create a travel set" path for a single-profile user; extend via re-run. Train pill active + ended states and their CTAs. Actions are mocked.
- Run the **full** suite after the feature (a new required `expires_at` field ripples into `EquipmentProfile` fixtures across hook/component tests). Typecheck clean.

## Reconciliation record (reviews)

**Conflict resolved by composition:** Perplexity's partial unique index and Claude's atomic write are not alternatives. `startTravel` uses a single CASE `UPDATE` (atomic set-and-clear) AND a partial unique index (concurrency backstop); since every other row goes to `null`, only one row is ever non-null, so the swap never trips the index.

**Adopted:** DB-enforced + atomic one-overlay; tz/boundary precision via existing `dayIndex` (no new dep); single-profile new-user path; post-expiry nudge pill; `defaultProfile` `created_at DESC` tiebreak; `activeTravelProfile` latest-`expires_at` defensive tiebreak; `endTravel` clears to `null`; complete badge rule; engine-change regression guard; optimistic rollback via the existing SWR finally-revalidate pattern; extend-by-re-run; overlay-deletion ends travel with an inline hint.

**Dismissed (with reason):** separate non-unique perf index (redundant; tiny scale); 90-day limit as env var (product constant in `constants.ts`); `date-fns-tz` (reuse `dayIndex`); travel analytics (no analytics yet; week-keyed log mismatch); auto-create default placeholder (clutter; explicit affordance + guard instead).
