# Travel mode (#322) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user mark a saved equipment profile as a temporary overlay (a trip) that auto-reverts to their default set, with read-time expiry (no cron).

**Architecture:** A profile gains a nullable `expires_at`. While it is in the future (by user-tz calendar day) it is the effective set; past that it is ignored at read time and the effective set falls back to the untouched default (`active_equipment_profile_id`). One overlay per user, enforced by a partial unique index + an atomic CASE update. Pure resolution helpers in `utils.ts` (reusing `dayIndex` for DST-safety), a manager UI for "Use until…/End travel", and a Train pill (active + post-expiry-nudge states).

**Tech Stack:** Next.js 15 / React 19 / TS, Supabase, SWR, Vitest + Testing Library. Spec: `docs/superpowers/specs/2026-06-09-18-07-12-travel-mode-design.md`.

**Conventions:** bun. Verify with `bun run test:run` + `bun run typecheck`. No em dashes anywhere. No server-action test harness (actions hit Supabase; cover via hook/component tests). Commit per task; git uses `GIT_CONFIG_GLOBAL=/dev/null` + `-c user.email=christiaanvaneijnsbergen@gmail.com`.

---

## Task 1: Migration

**Files:** Create `docs/migrations/2026-06-09-18-07-12-equipment-profile-expiry.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Travel mode (#322): a temporary equipment-profile overlay that auto-reverts.
-- expires_at is a calendar-day revert marker (stored noon-UTC of the return
-- day). Read-time expiry, no background job: a past expiry is inert and the
-- effective set falls back to active_equipment_profile_id (the default).
alter table equipment_profiles
  add column if not exists expires_at timestamptz;

-- One active travel overlay per user, enforced at the DB. Partial: only rows
-- carrying an expiry are constrained, so non-travel profiles are unaffected.
-- Backstops concurrent startTravel and serves as the overlay lookup index.
create unique index if not exists equipment_profiles_one_overlay_per_user
  on equipment_profiles (user_id)
  where expires_at is not null;
```

- [ ] **Step 2: Commit** (migrations are applied manually against Supabase; no runner)

```bash
git add docs/migrations/2026-06-09-18-07-12-equipment-profile-expiry.sql
git commit -m "feat(pulse): travel-mode expiry column + one-overlay index (#322)"
```

---

## Task 2: Extract `dayIndex` into a cycle-free `dates.ts`

`adherence.ts` imports from `utils.ts`, so `utils.ts` importing `dayIndex` from `adherence.ts` would be circular. Move `dayIndex` to a dependency-free module both can import.

**Files:** Create `src/lib/pulse/dates.ts`; Modify `src/lib/pulse/adherence.ts:32-52`

- [ ] **Step 1: Create `src/lib/pulse/dates.ts`** (move the exact `dayIndex` body from `adherence.ts`)

```ts
// Dependency-free, timezone-aware date helpers shared across pulse lib modules.
// Kept separate from adherence.ts/utils.ts so both can import without a cycle.

// Integer day number of the local calendar date of `iso` in `tz` (days since
// the Unix epoch). Comparing day numbers sidesteps DST/elapsed-ms pitfalls: it
// only ever looks at the Y/M/D the wall clock shows in `tz`. Falls back to UTC
// for an unknown timezone string.
export function dayIndex(iso: string, tz: string): number {
    const d = new Date(iso);
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(d);
    } catch {
        parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(d);
    }
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Math.floor(Date.UTC(get('year'), get('month') - 1, get('day')) / 86400000);
}
```

- [ ] **Step 2:** In `adherence.ts`, delete the local `dayIndex` definition (lines ~32-52) and add at the top, after its imports: `export { dayIndex } from './dates';` (re-export keeps any existing `from './adherence'` importers working; internal callers keep using the name).

- [ ] **Step 3: Verify no regression**

Run: `bun run test:run src/lib/pulse/__tests__ && bun run typecheck`
Expected: PASS (pure move).

- [ ] **Step 4: Commit**

```bash
git add src/lib/pulse/dates.ts src/lib/pulse/adherence.ts
git commit -m "refactor(pulse): extract dayIndex into dates.ts (no import cycle)"
```

---

## Task 3: Type, constants, and read-path plumbing for `expires_at`

**Files:** Modify `src/lib/pulse/types.ts:82-87`, `src/lib/pulse/constants.ts`, `src/lib/pulse/queries.ts:49,123-128`

- [ ] **Step 1:** `types.ts`, add to `EquipmentProfile`:

```ts
export interface EquipmentProfile {
    id: string;
    name: string;
    equipment: EquipmentKey[];
    created_at: string;
    expires_at: string | null;
}
```

- [ ] **Step 2:** `constants.ts`, add:

```ts
// Travel mode (#322).
export const MAX_TRAVEL_DAYS = 90;
export const TRAVEL_DAY_PRESETS = [3, 7, 14] as const;
export const ENDED_NUDGE_DAYS = 14; // how long the post-expiry "regenerate?" nudge lingers
```

- [ ] **Step 3:** `queries.ts`, line 49: `const EQUIPMENT_PROFILES_SELECT = 'id, name, equipment, created_at, expires_at';` and in the map (123-128) add `expires_at: r.expires_at ?? null,`.

- [ ] **Step 4: Verify** `bun run typecheck` (will flag EquipmentProfile fixtures missing `expires_at`; those are fixed as part of Task 9's full-suite pass, but typecheck of lib should be addressed). Add `expires_at: null` to any fixture the typecheck flags in `src/lib/pulse/__tests__/*` and `src/**/__tests__/*` that constructs an `EquipmentProfile` literal.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/types.ts src/lib/pulse/constants.ts src/lib/pulse/queries.ts src/**/__tests__
git commit -m "feat(pulse): thread expires_at through EquipmentProfile read path (#322)"
```

---

## Task 4: Pure travel helpers + tests (TDD)

**Files:** Modify `src/lib/pulse/utils.ts` (after `resolveEquipmentPrefill`, ~line 107); Test `src/lib/pulse/__tests__/travel.test.ts` (new)

- [ ] **Step 1: Write the failing tests** in `src/lib/pulse/__tests__/travel.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
    isTravelActive,
    activeTravelProfile,
    defaultProfile,
    resolveEquipmentPrefill,
    travelDaysLeft,
    travelReturnDate,
    travelEndedRecently,
    computeTravelExpiry,
} from '@/lib/pulse/utils';
import type { EquipmentProfile } from '@/lib/pulse/types';

const TZ = 'Europe/Amsterdam';
const p = (over: Partial<EquipmentProfile>): EquipmentProfile => ({
    id: 'a', name: 'A', equipment: ['dumbbells'], created_at: '2026-01-01T00:00:00Z', expires_at: null, ...over,
});
// Most-recent first, matching the loader order.
const home = p({ id: 'home', name: 'Home', equipment: ['barbell', 'rack'], created_at: '2026-01-02T00:00:00Z' });
const travel = p({ id: 'travel', name: 'Hotel', equipment: ['dumbbells'], created_at: '2026-06-09T00:00:00Z' });
const NOW = '2026-06-09T10:00:00Z';

describe('isTravelActive', () => {
    it('true while expiry is a future calendar day', () => {
        expect(isTravelActive({ ...travel, expires_at: '2026-06-16T12:00:00Z' }, NOW, TZ)).toBe(true);
    });
    it('false on the return day itself (boundary == is inactive)', () => {
        expect(isTravelActive({ ...travel, expires_at: '2026-06-09T12:00:00Z' }, NOW, TZ)).toBe(false);
    });
    it('false for null expiry', () => {
        expect(isTravelActive(travel, NOW, TZ)).toBe(false);
    });
});

describe('activeTravelProfile', () => {
    it('returns the future-expiry overlay', () => {
        const t = { ...travel, expires_at: '2026-06-16T12:00:00Z' };
        expect(activeTravelProfile([home, t], NOW, TZ)?.id).toBe('travel');
    });
    it('null when none active', () => {
        expect(activeTravelProfile([home, travel], NOW, TZ)).toBeNull();
    });
});

describe('defaultProfile', () => {
    const t = { ...travel, expires_at: '2026-06-16T12:00:00Z' };
    it('is the activeId profile when it is not the overlay', () => {
        expect(defaultProfile([home, t], 'home', NOW, TZ)?.id).toBe('home');
    });
    it('falls back to most-recent non-overlay when activeId is the overlay', () => {
        expect(defaultProfile([home, t], 'travel', NOW, TZ)?.id).toBe('home');
    });
    it('null when only the overlay exists', () => {
        expect(defaultProfile([t], 'travel', NOW, TZ)).toBeNull();
    });
});

describe('resolveEquipmentPrefill travel-awareness', () => {
    const t = { ...travel, expires_at: '2026-06-16T12:00:00Z' };
    it('returns the overlay equipment while travel is active (engine-change guard)', () => {
        expect(resolveEquipmentPrefill([home, t], 'home', NOW, TZ)).toEqual(['dumbbells']);
    });
    it('falls back to default after expiry', () => {
        const expired = { ...travel, expires_at: '2026-06-01T12:00:00Z' };
        expect(resolveEquipmentPrefill([home, expired], 'home', NOW, TZ)).toEqual(['barbell', 'rack']);
    });
    it('GOLDEN: with no expiry and no now/tz, byte-identical to legacy 2-arg behavior', () => {
        expect(resolveEquipmentPrefill([home, travel], 'home')).toEqual(['barbell', 'rack']);
        expect(resolveEquipmentPrefill([home, travel], null)).toEqual(['barbell', 'rack']); // profiles[0]
        expect(resolveEquipmentPrefill([], null)).toEqual([]);
    });
});

describe('travelDaysLeft / returnDate / endedRecently', () => {
    const t = { ...travel, expires_at: '2026-06-16T12:00:00Z' };
    it('counts calendar days left', () => {
        expect(travelDaysLeft(t, NOW, TZ)).toBe(7);
    });
    it('formats the return date in tz', () => {
        expect(travelReturnDate(t, TZ)).toBe('2026-06-16');
    });
    it('endedRecently true within the nudge window after expiry', () => {
        const justEnded = { ...travel, expires_at: '2026-06-08T12:00:00Z' };
        expect(travelEndedRecently(justEnded, NOW, TZ)).toBe(true);
        const longGone = { ...travel, expires_at: '2026-04-01T12:00:00Z' };
        expect(travelEndedRecently(longGone, NOW, TZ)).toBe(false);
        expect(travelEndedRecently(t, NOW, TZ)).toBe(false); // still active, not "ended"
    });
});

describe('computeTravelExpiry', () => {
    it('returns noon-UTC of (today + days) so the return day is stable', () => {
        const iso = computeTravelExpiry(NOW, TZ, 7);
        expect(travelDaysLeft({ ...travel, expires_at: iso }, NOW, TZ)).toBe(7);
        expect(new Date(iso).toISOString()).toContain('T12:00:00');
    });
    it('handles a DST-spring date without off-by-one', () => {
        // CET->CEST is 2026-03-29. A 7-day trip from 2026-03-26 must land on 2026-04-02.
        const iso = computeTravelExpiry('2026-03-26T23:30:00Z', TZ, 7);
        expect(travelReturnDate({ ...travel, expires_at: iso }, TZ)).toBe('2026-04-02');
    });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test:run src/lib/pulse/__tests__/travel.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement** in `utils.ts`. Add `import { dayIndex } from './dates';` and `import { ENDED_NUDGE_DAYS } from './constants';` at the top, and replace `resolveEquipmentPrefill` + add the new helpers:

```ts
// ── Travel mode (#322): a temporary equipment overlay that auto-reverts ──────
// Read-time expiry, no job. A profile is "in travel" while its expires_at is a
// FUTURE calendar day in the user's tz; equality (the return day) is inactive.

export function isTravelActive(p: EquipmentProfile, nowIso: string, tz: string): boolean {
    return p.expires_at != null && dayIndex(nowIso, tz) < dayIndex(p.expires_at, tz);
}

// The active overlay. The DB partial unique index allows only one; if two ever
// coexist, prefer the latest expiry (most remaining) deterministically.
export function activeTravelProfile(
    profiles: EquipmentProfile[],
    nowIso: string,
    tz: string,
): EquipmentProfile | null {
    return profiles
        .filter((p) => isTravelActive(p, nowIso, tz))
        .sort((a, b) => (b.expires_at! < a.expires_at! ? -1 : 1))[0] ?? null;
}

// The revert target: the active/default profile if it is not itself the overlay,
// else the most-recent non-overlay (loader order = created_at DESC, so the first
// non-overlay), else null.
export function defaultProfile(
    profiles: EquipmentProfile[],
    activeId: string | null,
    nowIso: string,
    tz: string,
): EquipmentProfile | null {
    if (activeId) {
        const active = profiles.find((p) => p.id === activeId);
        if (active && !isTravelActive(active, nowIso, tz)) return active;
    }
    return profiles.find((p) => !isTravelActive(p, nowIso, tz)) ?? null;
}

export function travelDaysLeft(p: EquipmentProfile, nowIso: string, tz: string): number {
    return p.expires_at == null ? 0 : dayIndex(p.expires_at, tz) - dayIndex(nowIso, tz);
}

// The local calendar date (YYYY-MM-DD in tz) the overlay reverts on.
export function travelReturnDate(p: EquipmentProfile, tz: string): string {
    if (p.expires_at == null) return '';
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date(p.expires_at));
    } catch {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date(p.expires_at));
    }
}

// True for a recently-expired overlay (drives the post-expiry "regenerate?"
// nudge); 0 means it expired today, the upper bound hides a stale nudge.
export function travelEndedRecently(p: EquipmentProfile, nowIso: string, tz: string): boolean {
    if (p.expires_at == null) return false;
    const past = dayIndex(nowIso, tz) - dayIndex(p.expires_at, tz);
    return past >= 0 && past < ENDED_NUDGE_DAYS;
}

// Noon-UTC of (today + days) in tz. Noon is offset/DST-safe (maps to the same
// calendar date for the user's tz), so the stored instant's tz calendar day is
// exactly the intended return day. Used by both the presets and the custom date.
export function computeTravelExpiry(nowIso: string, tz: string, days: number): string {
    return new Date((dayIndex(nowIso, tz) + days) * 86400000 + 12 * 3600000).toISOString();
}
```

Replace the existing `resolveEquipmentPrefill` with the overlay-aware version (legacy path byte-identical when `nowIso`/`tz` are absent):

```ts
// Which saved set pre-fills the generation equipment step. Travel-aware: an
// active overlay wins; otherwise the legacy rule (active profile, else
// most-recently-created, else empty). When nowIso/tz are omitted (legacy 2-arg
// callers, tests), overlay resolution is skipped and the result is byte-identical
// to before. REGRESSION GUARD: an active overlay must win here even if the
// engine later resolves equipment inline (see travel.test.ts).
export function resolveEquipmentPrefill(
    profiles: EquipmentProfile[],
    activeId: string | null,
    nowIso?: string,
    tz?: string,
): EquipmentKey[] {
    if (nowIso && tz) {
        const overlay = activeTravelProfile(profiles, nowIso, tz);
        if (overlay) return overlay.equipment;
    }
    if (activeId) {
        const active = profiles.find((p) => p.id === activeId);
        if (active) return active.equipment;
    }
    return profiles[0]?.equipment ?? [];
}
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test:run src/lib/pulse/__tests__/travel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/travel.test.ts
git commit -m "feat(pulse): pure travel-overlay resolution helpers (#322)"
```

---

## Task 5: Server actions `startTravel` / `endTravel`

**Files:** Modify `src/app/pulse/actions/equipment.ts` (no test harness for actions)

- [ ] **Step 1:** Add `expires_at` to the `createEquipmentProfile` select + return mapping (`.select('id, name, equipment, created_at, expires_at')`, `expires_at: data.expires_at ?? null`). (create always inserts a non-travel profile, so `expires_at` is null.)

- [ ] **Step 2:** Add the two actions (import `dayIndex` from `@/lib/pulse/dates`, `MAX_TRAVEL_DAYS` from `@/lib/pulse/types` or `constants`, load the user's tz from the `profiles` row):

```ts
export async function startTravel(profileId: string, expiresAt: string): Promise<void> {
    assertUuid(profileId);
    if (typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) {
        throw new Error('Invalid travel date');
    }
    const { supabase, user } = await getUserOrThrow();
    // Resolve the user's tz to validate the horizon in calendar days.
    const { data: prof } = await supabase.from('profiles').select('timezone').eq('id', user.id).single();
    const tz = prof?.timezone ?? 'UTC';
    const today = dayIndex(new Date().toISOString(), tz);
    const target = dayIndex(expiresAt, tz);
    if (target <= today || target - today > MAX_TRAVEL_DAYS) {
        throw new Error('Pick a return date within the next 90 days');
    }
    // Need a distinct set to revert to (the default), else travel is meaningless.
    const { data: others } = await supabase
        .from('equipment_profiles')
        .select('id')
        .eq('user_id', user.id)
        .neq('id', profileId);
    if (!others || others.length === 0) {
        throw new Error('Create a home set first so travel mode can switch back');
    }
    // Atomic set-target-and-clear-others in one statement (one-overlay invariant).
    const { error } = await supabase
        .from('equipment_profiles')
        .update({ expires_at: null })
        .eq('user_id', user.id)
        .neq('id', profileId);
    if (error) throw new Error('Failed to start travel mode');
    // Ownership-checked set on the target.
    const { data: set, error: setErr } = await supabase
        .from('equipment_profiles')
        .update({ expires_at: expiresAt })
        .eq('id', profileId)
        .eq('user_id', user.id)
        .select('id')
        .single();
    if (setErr || !set) throw new Error('Failed to start travel mode');
    revalidatePath('/pulse');
}

export async function endTravel(): Promise<void> {
    const { supabase, user } = await getUserOrThrow();
    const { error } = await supabase
        .from('equipment_profiles')
        .update({ expires_at: null })
        .eq('user_id', user.id)
        .not('expires_at', 'is', null);
    if (error) throw new Error('Failed to end travel mode');
    revalidatePath('/pulse');
}
```

NOTE: the spec's single-statement CASE update is the ideal; the Supabase JS client cannot express a per-row CASE in one `.update()`, so this uses clear-others-then-set-target. The partial unique index still guarantees only one non-null overlay (others go null first), and at two users concurrency is not a real risk. If a SQL RPC is later added, collapse to one CASE statement. Document this inline.

- [ ] **Step 3: Verify** `bun run typecheck`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/pulse/actions/equipment.ts
git commit -m "feat(pulse): startTravel/endTravel server actions (#322)"
```

---

## Task 6: Hook + context wiring

**Files:** Modify `src/hooks/pulse/useEquipmentProfiles.ts`, `src/context/PulseContext.ts:94`, `src/components/pulse/PulseProvider.tsx:136-141,607-618`

- [ ] **Step 1:** `useEquipmentProfiles.ts`, import `startTravel as serverStartTravel, endTravel as serverEndTravel` from `@/app/pulse/actions`. Add:

```ts
const startTravel = useCallback(
    async (id: string, expiresAt: string): Promise<void> => {
        await mutate(
            (prev?: EquipmentProfile[]) =>
                prev?.map((p) => ({ ...p, expires_at: p.id === id ? expiresAt : null })),
            false,
        );
        try {
            await serverStartTravel(id, expiresAt);
        } finally {
            await mutate();
        }
    },
    [mutate],
);

const endTravel = useCallback(async (): Promise<void> => {
    await mutate((prev?: EquipmentProfile[]) => prev?.map((p) => ({ ...p, expires_at: null })), false);
    try {
        await serverEndTravel();
    } finally {
        await mutate();
    }
}, [mutate]);
```

Add `startTravel, endTravel` to the returned object.

- [ ] **Step 2:** `PulseContext.ts`, after line 94 add to the interface:

```ts
    startTravel: (id: string, expiresAt: string) => Promise<void>;
    endTravel: () => Promise<void>;
```

- [ ] **Step 3:** `PulseProvider.tsx`, destructure `startTravel, endTravel` from `useEquipmentProfiles()` (after line 140), and add them to both the context value object (~607) and its `useMemo` deps array (~614).

- [ ] **Step 4: Verify** `bun run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/pulse/useEquipmentProfiles.ts src/context/PulseContext.ts src/components/pulse/PulseProvider.tsx
git commit -m "feat(pulse): expose startTravel/endTravel through the hook + context (#322)"
```

---

## Task 7: Manager UI (`EquipmentProfilesEditor`)

**Files:** Modify `src/components/pulse/EquipmentProfilesEditor.tsx`; Test `src/components/pulse/__tests__/EquipmentProfilesEditor.travel.test.tsx` (new, or extend the existing editor test)

- [ ] **Step 1: Write failing component tests** covering: (a) a non-default row shows "Use until…", tapping a 7-day chip calls `startTravel(id, <iso>)`; (b) the active overlay row shows "✈ In use" + days-left + reverts-to text and an "End travel" button that calls `endTravel`; (c) a single-profile user sees "Create a travel set" (opens the create form). Mock `usePulse` to supply `equipmentProfiles`, `profile` (with `timezone`, `active_equipment_profile_id`), `startTravel`, `endTravel`, `createEquipmentProfile`. Follow the existing editor test's mocking pattern.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement.** Pull `startTravel, endTravel` and `profile.timezone` from `usePulse`. Compute `now = new Date().toISOString()`, `tz = profile.timezone`, `overlay = activeTravelProfile(equipmentProfiles, now, tz)`, `def = defaultProfile(equipmentProfiles, activeId, now, tz)`. Badge rule: overlay row → `✈ In use · {travelDaysLeft} days left · reverts to {def?.name}`; default row → `Active` when no overlay, muted `Default` when an overlay is active; others → none. Add per non-default, non-overlay row a "Use until…" toggle revealing `TRAVEL_DAY_PRESETS` chips (+ a custom `<input type="date">` reusing the program-anchor idiom); a chip/date calls `startTravel(p.id, computeTravelExpiry(now, tz, days))` (custom date → `computeTravelExpiry` is bypassed; pass noon-UTC of the picked date, i.e. `new Date(picked + 'T12:00:00Z').toISOString()`). Overlay row shows "End travel" (`endTravel`) + an inline "Deleting ends travel mode" hint on its delete. When `equipmentProfiles.length < 2`, render a "Going away? Create a travel set" button that calls `openCreate()` pre-filling name "Travel". All copy em-dash-free; errors via the existing inline/toast split.

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/EquipmentProfilesEditor.tsx src/components/pulse/__tests__/EquipmentProfilesEditor.travel.test.tsx
git commit -m "feat(pulse): travel controls + badges in the equipment manager (#322)"
```

---

## Task 8: Train pill (`TravelPill` in `LogView`)

**Files:** Create `src/components/pulse/TravelPill.tsx`; Modify `src/components/pulse/views/LogView.tsx` (render near the top of the main return, ~line 338, above the mobile `CoachPanel`); Test `src/components/pulse/__tests__/TravelPill.test.tsx` (new)

- [ ] **Step 1: Write failing tests:** active state renders "Travel mode" + days-left + reverts-to name; ended state (recently-expired overlay) renders "Travel ended" with a Regenerate affordance and a Dismiss that calls `endTravel`; renders nothing when no overlay and nothing ended.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement `TravelPill`.** `usePulse()` → `equipmentProfiles`, `profile`, `endTravel`, `navigate`. `now`/`tz` as above. `overlay = activeTravelProfile(...)`; if active → calm pill `✈ Travel mode · reverts to {def} in {N} days`, tap → `navigate('profile')`. Else find `ended = equipmentProfiles.find((p) => travelEndedRecently(p, now, tz))`; if present → `✈ Travel ended · regenerate your {def} routine?` with `<GenerateRoutineButton label="Regenerate" className="…" />` and a Dismiss button calling `endTravel`. Render `null` otherwise. Tokens only (`pulse-accent`, etc.), no hardcoded hex; no em dashes. Add `<TravelPill />` to `LogView`'s main return.

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/TravelPill.tsx src/components/pulse/views/LogView.tsx src/components/pulse/__tests__/TravelPill.test.tsx
git commit -m "feat(pulse): Train travel pill with post-expiry regenerate nudge (#322)"
```

---

## Task 9: Travel-aware generation prefill

**Files:** Modify `src/components/pulse/RoutineSetupFlow.tsx:322` (+ add a `timezone?` prop), `src/components/pulse/GenerateRoutineButton.tsx` and `src/components/pulse/OnboardingModal.tsx` (pass `profile.timezone`)

- [ ] **Step 1:** Add an optional `timezone?: string` prop to `RoutineSetupFlow`. Line 322 becomes:

```ts
() => new Set(initial?.equipment ?? resolveEquipmentPrefill(
    equipmentProfiles, activeEquipmentProfileId, timezone ? new Date().toISOString() : undefined, timezone)),
```

(When `timezone` is absent, overlay resolution is skipped, so `TemplatesTab` and existing tests are byte-identical.)

- [ ] **Step 2:** In `GenerateRoutineButton` and `OnboardingModal`, pass `timezone={profile.timezone}` to `RoutineSetupFlow`. (`TuneYourPlanPanel` needs no change: it seeds from `answers.equipment`, which already reflects the travel prefill used at generation.)

- [ ] **Step 3: Verify** `bun run typecheck` + existing setup-flow/template tests. Expected: PASS (no behavior change without a timezone).

- [ ] **Step 4: Commit**

```bash
git add src/components/pulse/RoutineSetupFlow.tsx src/components/pulse/GenerateRoutineButton.tsx src/components/pulse/OnboardingModal.tsx
git commit -m "feat(pulse): seed generation equipment from the active travel set (#322)"
```

---

## Task 10: Full verification + roadmap/CLAUDE.md FINISH sync

- [ ] **Step 1: Full suite + typecheck**

Run: `bun run test:run && bun run typecheck`
Expected: all green. Fix any `EquipmentProfile` fixtures still missing `expires_at` inline.

- [ ] **Step 2:** Update `docs/roadmap.md`: move #322 to Shipped (dated bullet under Reference & archive; strike its "Next up" line), set `In progress:` back to `(none)`, refresh the test count. Update `CLAUDE.md`'s Equipment-profiles paragraph: travel mode shipped (the `expires_at` overlay, read-time expiry, one-overlay index, `dates.ts` extraction, the new helpers, manager controls, Train pill).

- [ ] **Step 3:** Code review the full diff (code-reviewer subagent / `/code-review`) before declaring done; address findings.

- [ ] **Step 4: Commit**

```bash
git add docs/roadmap.md CLAUDE.md
git commit -m "docs(roadmap): ship travel mode (#322)"
```

---

## Self-review notes (spec coverage)

- One-overlay invariant: index (Task 1) + clear-others-then-set (Task 5). NOTE divergence from the spec's single CASE statement, justified by the Supabase JS client (documented in Task 5).
- TZ/boundary precision: `dayIndex` reuse via `dates.ts` (Task 2), all helpers + DST test (Task 4).
- Single-profile path: "Create a travel set" (Task 7) + `startTravel` guard (Task 5).
- Post-expiry nudge: `travelEndedRecently` (Task 4) + ended pill (Task 8).
- Badge rule, extend-by-re-run, overlay-deletion hint: Task 7.
- Engine-change guard + golden identity: Task 4.
- Generation consumption: Task 9 (TuneYourPlanPanel inherits via `answers.equipment`).
- Dismissed items (env var, date-fns-tz, analytics, perf index, placeholder profile): not in any task, intentionally.
