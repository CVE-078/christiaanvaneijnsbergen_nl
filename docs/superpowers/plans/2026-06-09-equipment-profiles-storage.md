# Equipment Profiles, Branch A (Storage + Manager) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist named, reusable equipment sets per user and let them be managed (create / edit / delete / set-active) from the Profile screen, with no change to generation behavior yet.

**Architecture:** A dedicated `equipment_profiles` table (RLS-scoped) plus a nullable `profiles.active_equipment_profile_id` pointer. Server actions for CRUD, a GET route + SWR hook for reads (the standard Pulse data-domain pattern), context wiring, a shared `EquipmentSelector` checkbox component, and an `EquipmentProfilesEditor` card in ProfileView's "Training preferences" group. Generation is untouched (that is Branch B).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict), Supabase (Postgres + RLS), SWR, Vitest + Testing Library (jsdom). Package manager `bun`.

**Spec:** `docs/superpowers/specs/2026-06-09-08-55-24-equipment-profiles-design.md`

**Conventions to follow (from the spec + repo):**
- No em dashes anywhere (copy, comments, docs). Use commas, periods, semicolons, parentheses, or a plain hyphen.
- No server-action unit-test harness in this repo (actions hit Supabase). Action behavior is covered through hook / component tests, not direct action tests.
- Commit messages: conventional commits, `type(scope): subject`, subject line only, no body, no Co-Authored-By. Use scope `pulse`. Commit with the gmail identity and the empty-gpg workaround:
  `GIT_CONFIG_GLOBAL=/dev/null git -c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen" commit -m "..."`
- Run a single test file: `bun run test:run <path>`. Typecheck: `bun run typecheck`. Full suite: `bun run test:run`.

---

### Task 1: Database migration (table + RLS + active pointer)

**Files:**
- Create: `docs/migrations/2026-06-09-09-06-36-equipment-profiles.sql`

This migration is applied by hand in the Supabase SQL editor (no runner in this repo). There is no automated test; correctness is reviewed by reading it against the existing `2026-06-04-11-50-47-exercise-swaps.sql` pattern.

- [ ] **Step 1: Write the migration**

```sql
-- Equipment profiles: named, reusable equipment sets per user (Home / Gym /
-- Travel). Equipment is captured transiently per generation today; this makes it
-- persistent and switchable. Generation still reads the chosen set through
-- answers.equipment -> hasEquipment; profiles only seed the picker.
--
-- Travel mode (#322) is the planned extension: it will add an `expires_at`
-- column here plus an auto-revert to the saved default set. Build it on top of
-- this table, do not fork a second one.
create table if not exists equipment_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  equipment text[] not null check (array_length(equipment, 1) >= 1),
  created_at timestamptz not null default now()
);

create index if not exists equipment_profiles_user_idx on equipment_profiles (user_id);

alter table equipment_profiles enable row level security;

create policy "equipment_profiles_select_own" on equipment_profiles
  for select using (auth.uid() = user_id);
create policy "equipment_profiles_insert_own" on equipment_profiles
  for insert with check (auth.uid() = user_id);
create policy "equipment_profiles_update_own" on equipment_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "equipment_profiles_delete_own" on equipment_profiles
  for delete using (auth.uid() = user_id);

-- Active-profile pointer on the user's profile. null = no active profile = the
-- pre-equipment-profiles behavior (the generation equipment step starts empty).
-- ON DELETE SET NULL so deleting the active profile cleanly clears the pointer.
alter table profiles
  add column if not exists active_equipment_profile_id uuid
  references equipment_profiles(id) on delete set null;
```

- [ ] **Step 2: Apply it in Supabase**

Paste the file into the Supabase SQL editor and run it. (Ask the user to do this; the app cannot reach the DB from the repo.) Note it as applied.

- [ ] **Step 3: Commit**

```bash
git add docs/migrations/2026-06-09-09-06-36-equipment-profiles.sql
GIT_CONFIG_GLOBAL=/dev/null git -c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen" commit -m "feat(pulse): add equipment_profiles table and active pointer migration"
```

---

### Task 2: Types + Profile field ripple

Adds the `EquipmentProfile` type and the `active_equipment_profile_id` field on `Profile`, then threads the field through every place that builds a full `Profile` (the loader, the default, and all test fixtures). The field is **required** (`string | null`) to match the other recent Profile fields; the compiler will flag every literal that needs it.

**Files:**
- Modify: `src/lib/pulse/types.ts`
- Modify: `src/lib/pulse/queries.ts` (PROFILE_SELECT + loadProfile)
- Modify: `src/hooks/pulse/useProfile.ts` (DEFAULT_PROFILE)
- Modify (fixtures the compiler flags): `src/hooks/pulse/__tests__/useProfile.test.ts`, `src/hooks/pulse/__tests__/useProfile.test.tsx`, `src/components/pulse/__tests__/DesktopLayout.test.tsx`, `src/components/pulse/__tests__/PulseProvider.test.tsx`, `src/components/pulse/__tests__/ProfileView.test.tsx`, `src/lib/pulse/__tests__/queries.test.ts`, and any others `bun run typecheck` reports.

- [ ] **Step 1: Add the `EquipmentProfile` type and the Profile field**

In `src/lib/pulse/types.ts`, add the field to the `Profile` interface immediately after `active_routine_id`:

```ts
    active_routine_id: string | null;
    // Active equipment-profile pointer (equipment_profiles.id); null = none, which
    // is the pre-equipment-profiles behavior (generation equipment step starts
    // empty). See the equipment_profiles table.
    active_equipment_profile_id: string | null;
```

And add the new interface immediately after the `Profile` interface closes (after its `}`):

```ts
// A named, reusable equipment set (Home / Gym / Travel). Equipment is a subset of
// EQUIPMENT_KEYS. Persisted in the equipment_profiles table; seeds generation's
// equipment picker (Branch B). created_at is also the recency tiebreak for the
// pre-fill resolution rule.
export interface EquipmentProfile {
    id: string;
    name: string;
    equipment: EquipmentKey[];
    created_at: string;
}
```

(`EquipmentKey` is already declared lower in the file via `EQUIPMENT_KEYS`; TypeScript hoists the type, so the reference resolves.)

- [ ] **Step 2: Thread the field through the loader**

In `src/lib/pulse/queries.ts`, add `active_equipment_profile_id` to `PROFILE_SELECT`:

```ts
const PROFILE_SELECT =
    'display_name, unit, length_unit, active_routine_id, active_equipment_profile_id, onboarding_completed, goal_weight_kg, gender, priority_muscle, timezone, accent_color, training_style, variety_preference, loading_lean, movement_restrictions';
```

And in `loadProfile`, add the field to the returned object right after `active_routine_id`:

```ts
        active_routine_id: data?.active_routine_id ?? null,
        active_equipment_profile_id: data?.active_equipment_profile_id ?? null,
```

- [ ] **Step 3: Thread the field through DEFAULT_PROFILE**

In `src/hooks/pulse/useProfile.ts`, add to `DEFAULT_PROFILE` right after `active_routine_id`:

```ts
    active_routine_id: null,
    active_equipment_profile_id: null,
```

- [ ] **Step 4: Run typecheck and fix every flagged Profile literal**

Run: `bun run typecheck`
Expected: errors on each full `Profile` literal missing the new field (the test fixtures listed above, plus possibly `src/app/api/pulse/profile/route.ts`).

For each flagged literal, add the line `active_equipment_profile_id: null,` next to its `active_routine_id:` line. Re-run until clean.

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the full suite**

Run: `bun run test:run`
Expected: all green (the field is additive; no behavior change).

- [ ] **Step 6: Commit**

```bash
git add -A
GIT_CONFIG_GLOBAL=/dev/null git -c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen" commit -m "feat(pulse): add EquipmentProfile type and active pointer field"
```

---

### Task 3: Server actions

CRUD + set-active actions. No direct action test (repo convention); coverage comes through the hook (Task 5) and manager (Task 8). Soft, case-insensitive name uniqueness is enforced here.

**Files:**
- Create: `src/app/pulse/actions/equipment.ts`
- Modify: `src/app/pulse/actions.ts` (barrel re-export)

- [ ] **Step 1: Write the actions file**

Create `src/app/pulse/actions/equipment.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { assertUuid } from './_shared';
import type { SupabaseServerClient } from './_shared';
import { EQUIPMENT_KEYS } from '@/lib/pulse/types';
import type { EquipmentKey, EquipmentProfile } from '@/lib/pulse/types';

function validName(name: string): string {
    if (typeof name !== 'string') throw new Error('Invalid data');
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 40) throw new Error('Name must be 1 to 40 characters');
    return trimmed;
}

function validEquipment(equipment: EquipmentKey[]): EquipmentKey[] {
    if (!Array.isArray(equipment) || equipment.length === 0) throw new Error('Pick at least one equipment item');
    const unique = [...new Set(equipment)];
    if (!unique.every((e) => (EQUIPMENT_KEYS as readonly string[]).includes(e))) throw new Error('Invalid equipment');
    return unique;
}

// Reject a name that case-insensitively matches another of the user's profiles.
// Soft uniqueness (action-level, not a DB constraint) for clearer errors; see the
// design doc. `exceptId` skips the row being edited.
async function assertNameFree(
    supabase: SupabaseServerClient,
    userId: string,
    name: string,
    exceptId?: string,
): Promise<void> {
    const { data } = await supabase.from('equipment_profiles').select('id, name').eq('user_id', userId);
    const clash = (data ?? []).some((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== exceptId);
    if (clash) throw new Error(`You already have a profile called ${name}`);
}

export async function createEquipmentProfile(name: string, equipment: EquipmentKey[]): Promise<EquipmentProfile> {
    const cleanName = validName(name);
    const cleanEquipment = validEquipment(equipment);
    const { supabase, user } = await getUserOrThrow();
    await assertNameFree(supabase, user.id, cleanName);
    const { data, error } = await supabase
        .from('equipment_profiles')
        .insert({ user_id: user.id, name: cleanName, equipment: cleanEquipment })
        .select('id, name, equipment, created_at')
        .single();
    if (error || !data) throw new Error('Failed to create equipment profile');
    revalidatePath('/pulse');
    return {
        id: data.id,
        name: data.name,
        equipment: (data.equipment ?? []) as EquipmentKey[],
        created_at: data.created_at,
    };
}

export async function updateEquipmentProfile(id: string, name: string, equipment: EquipmentKey[]): Promise<void> {
    assertUuid(id);
    const cleanName = validName(name);
    const cleanEquipment = validEquipment(equipment);
    const { supabase, user } = await getUserOrThrow();
    await assertNameFree(supabase, user.id, cleanName, id);
    const { error } = await supabase
        .from('equipment_profiles')
        .update({ name: cleanName, equipment: cleanEquipment })
        .eq('id', id)
        .eq('user_id', user.id);
    if (error) throw new Error('Failed to update equipment profile');
    revalidatePath('/pulse');
}

export async function deleteEquipmentProfile(id: string): Promise<void> {
    assertUuid(id);
    const { supabase, user } = await getUserOrThrow();
    const { error } = await supabase.from('equipment_profiles').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw new Error('Failed to delete equipment profile');
    revalidatePath('/pulse');
}

export async function setActiveEquipmentProfile(id: string | null): Promise<void> {
    if (id !== null) assertUuid(id);
    const { supabase, user } = await getUserOrThrow();
    // Verify ownership when setting (null clears the pointer).
    if (id !== null) {
        const { data } = await supabase
            .from('equipment_profiles')
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();
        if (!data) throw new Error('Equipment profile not found');
    }
    const { error } = await supabase
        .from('profiles')
        .upsert(
            { id: user.id, active_equipment_profile_id: id, updated_at: new Date().toISOString() },
            { onConflict: 'id' },
        );
    if (error) throw new Error('Failed to set active equipment profile');
    revalidatePath('/pulse');
}
```

- [ ] **Step 2: Re-export from the barrel**

In `src/app/pulse/actions.ts`, add the line alongside the other re-exports:

```ts
export * from './actions/equipment';
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
GIT_CONFIG_GLOBAL=/dev/null git -c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen" commit -m "feat(pulse): add equipment profile CRUD server actions"
```

---

### Task 4: Loader + GET route

**Files:**
- Modify: `src/lib/pulse/queries.ts` (select const + loader + type import)
- Create: `src/app/api/pulse/equipment-profiles/route.ts`
- Modify (test): `src/lib/pulse/__tests__/queries.test.ts`

- [ ] **Step 1: Write the failing loader test**

In `src/lib/pulse/__tests__/queries.test.ts`, add `loadEquipmentProfiles` to the import at the top, then add this block at the end of the file:

```ts
describe('loadEquipmentProfiles', () => {
    it('selects the canonical columns scoped to the user and maps rows', async () => {
        const { client, calls } = makeClient({
            data: [
                { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Home', equipment: ['dumbbells'], created_at: '2026-06-09T00:00:00Z' },
            ],
            error: null,
        });
        const profiles = await loadEquipmentProfiles(client, UID);
        expect(calls.table).toBe('equipment_profiles');
        expect(calls.select).toBe('id, name, equipment, created_at');
        expect(profiles).toEqual([
            { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Home', equipment: ['dumbbells'], created_at: '2026-06-09T00:00:00Z' },
        ]);
    });

    it('throws on query error', async () => {
        const { client } = makeClient({ data: null, error: new Error('boom') });
        await expect(loadEquipmentProfiles(client, UID)).rejects.toThrow('boom');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/queries.test.ts`
Expected: FAIL (`loadEquipmentProfiles` is not exported).

- [ ] **Step 3: Implement the loader**

In `src/lib/pulse/queries.ts`, add `EquipmentProfile` and `EquipmentKey` to the `import type { ... } from '@/lib/pulse/types'` block. Add the select const near the other `*_SELECT` consts:

```ts
const EQUIPMENT_PROFILES_SELECT = 'id, name, equipment, created_at';
```

Add the loader (place it after `loadProfile`):

```ts
// The user's equipment profiles, most-recently-created first (id desc as a
// deterministic tiebreak). Scoped to the user by RLS and the explicit user_id
// filter; the resolution rule for which set pre-fills generation lives in Branch B.
export async function loadEquipmentProfiles(
    supabase: SupabaseServerClient,
    userId: string,
): Promise<EquipmentProfile[]> {
    const { data, error } = await supabase
        .from('equipment_profiles')
        .select(EQUIPMENT_PROFILES_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        equipment: (r.equipment ?? []) as EquipmentKey[],
        created_at: r.created_at,
    }));
}
```

- [ ] **Step 4: Run the loader test to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the GET route**

Create `src/app/api/pulse/equipment-profiles/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadEquipmentProfiles } from '@/lib/pulse/queries';
import type { EquipmentProfile } from '@/lib/pulse/types';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let profiles: EquipmentProfile[] = [];
    try {
        profiles = await loadEquipmentProfiles(supabase, user.id);
    } catch {
        profiles = [];
    }
    return NextResponse.json(profiles);
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `bun run typecheck`
Expected: no errors.

```bash
git add -A
GIT_CONFIG_GLOBAL=/dev/null git -c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen" commit -m "feat(pulse): add equipment profiles loader and GET route"
```

---

### Task 5: `useEquipmentProfiles` hook

**Files:**
- Create: `src/hooks/pulse/useEquipmentProfiles.ts`
- Create (test): `src/hooks/pulse/__tests__/useEquipmentProfiles.test.ts`

- [ ] **Step 1: Write the failing hook test**

Create `src/hooks/pulse/__tests__/useEquipmentProfiles.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('swr', () => ({ default: vi.fn(), useSWRConfig: () => ({ mutate: vi.fn() }) }));
vi.mock('@/app/pulse/actions', () => ({
    createEquipmentProfile: vi.fn(),
    updateEquipmentProfile: vi.fn().mockResolvedValue(undefined),
    deleteEquipmentProfile: vi.fn().mockResolvedValue(undefined),
    setActiveEquipmentProfile: vi.fn().mockResolvedValue(undefined),
}));

import useSWR from 'swr';
import {
    createEquipmentProfile as serverCreate,
    updateEquipmentProfile as serverUpdate,
    deleteEquipmentProfile as serverDelete,
    setActiveEquipmentProfile as serverSetActive,
} from '@/app/pulse/actions';
import { useEquipmentProfiles } from '../useEquipmentProfiles';
import type { EquipmentProfile } from '@/lib/pulse/types';

const home: EquipmentProfile = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Home', equipment: ['dumbbells'], created_at: '2026-06-09T00:00:00Z' };
const mutate = vi.fn();

beforeEach(() => {
    vi.mocked(useSWR).mockReturnValue({ data: [home], mutate, isLoading: false, error: undefined } as unknown as ReturnType<typeof useSWR>);
    mutate.mockClear();
    vi.mocked(serverCreate).mockClear();
    vi.mocked(serverUpdate).mockClear();
    vi.mocked(serverDelete).mockClear();
    vi.mocked(serverSetActive).mockClear();
});

describe('useEquipmentProfiles', () => {
    it('returns profiles from SWR data', () => {
        const { result } = renderHook(() => useEquipmentProfiles());
        expect(result.current.equipmentProfiles).toEqual([home]);
    });

    it('create calls the server action and revalidates', async () => {
        const created = { ...home, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Gym' };
        vi.mocked(serverCreate).mockResolvedValue(created);
        const { result } = renderHook(() => useEquipmentProfiles());
        await act(async () => {
            const out = await result.current.createEquipmentProfile('Gym', ['barbell']);
            expect(out).toEqual(created);
        });
        expect(serverCreate).toHaveBeenCalledWith('Gym', ['barbell']);
        expect(mutate).toHaveBeenCalled();
    });

    it('update optimistically patches then persists', async () => {
        const { result } = renderHook(() => useEquipmentProfiles());
        await act(async () => {
            await result.current.updateEquipmentProfile(home.id, 'Home Gym', ['dumbbells', 'bench']);
        });
        // First mutate call is the optimistic patch (a function, revalidate=false).
        expect(typeof mutate.mock.calls[0][0]).toBe('function');
        expect(mutate.mock.calls[0][1]).toBe(false);
        expect(serverUpdate).toHaveBeenCalledWith(home.id, 'Home Gym', ['dumbbells', 'bench']);
    });

    it('delete optimistically removes then persists', async () => {
        const { result } = renderHook(() => useEquipmentProfiles());
        await act(async () => {
            await result.current.deleteEquipmentProfile(home.id);
        });
        expect(typeof mutate.mock.calls[0][0]).toBe('function');
        expect(serverDelete).toHaveBeenCalledWith(home.id);
    });

    it('setActive calls the server action', async () => {
        const { result } = renderHook(() => useEquipmentProfiles());
        await act(async () => {
            await result.current.setActiveEquipmentProfile(home.id);
        });
        expect(serverSetActive).toHaveBeenCalledWith(home.id);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:run src/hooks/pulse/__tests__/useEquipmentProfiles.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

Create `src/hooks/pulse/useEquipmentProfiles.ts`:

```ts
import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
    createEquipmentProfile as serverCreate,
    updateEquipmentProfile as serverUpdate,
    deleteEquipmentProfile as serverDelete,
    setActiveEquipmentProfile as serverSetActive,
} from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import type { EquipmentKey, EquipmentProfile } from '@/lib/pulse/types';

const EQUIPMENT_PROFILES_KEY = '/api/pulse/equipment-profiles';
const PROFILE_KEY = '/api/pulse/profile';

// Stable empty default so `data ?? EMPTY` keeps constant identity across renders.
const EMPTY: EquipmentProfile[] = [];

export function useEquipmentProfiles() {
    const { mutate: globalMutate } = useSWRConfig();
    const { data, mutate, isLoading, error } = useSWR<EquipmentProfile[]>(
        EQUIPMENT_PROFILES_KEY,
        fetcher,
        SWR_READ_OPTS,
    );

    const createEquipmentProfile = useCallback(
        async (name: string, equipment: EquipmentKey[]): Promise<EquipmentProfile> => {
            const created = await serverCreate(name, equipment);
            await mutate();
            return created;
        },
        [mutate],
    );

    const updateEquipmentProfile = useCallback(
        async (id: string, name: string, equipment: EquipmentKey[]): Promise<void> => {
            await mutate(
                (prev?: EquipmentProfile[]) => prev?.map((p) => (p.id === id ? { ...p, name, equipment } : p)),
                false,
            );
            await serverUpdate(id, name, equipment);
            await mutate();
        },
        [mutate],
    );

    const deleteEquipmentProfile = useCallback(
        async (id: string): Promise<void> => {
            await mutate((prev?: EquipmentProfile[]) => prev?.filter((p) => p.id !== id), false);
            await serverDelete(id);
            await mutate();
            // Deleting the active profile clears the pointer (ON DELETE SET NULL);
            // refresh the profile cache so the active marker updates.
            await globalMutate(PROFILE_KEY);
        },
        [mutate, globalMutate],
    );

    const setActiveEquipmentProfile = useCallback(
        async (id: string | null): Promise<void> => {
            await serverSetActive(id);
            await globalMutate(PROFILE_KEY);
        },
        [globalMutate],
    );

    return {
        equipmentProfiles: data ?? EMPTY,
        loadingEquipmentProfiles: isLoading,
        equipmentProfilesError: error,
        createEquipmentProfile,
        updateEquipmentProfile,
        deleteEquipmentProfile,
        setActiveEquipmentProfile,
    };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:run src/hooks/pulse/__tests__/useEquipmentProfiles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
GIT_CONFIG_GLOBAL=/dev/null git -c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen" commit -m "feat(pulse): add useEquipmentProfiles hook"
```

---

### Task 6: Context wiring

Expose the hook through `PulseContext` so ProfileView (and Branch B) can consume it.

**Files:**
- Modify: `src/context/PulseContext.ts` (type imports + interface)
- Modify: `src/components/pulse/PulseProvider.tsx` (hook call + value memo + spread)

- [ ] **Step 1: Extend the context interface**

In `src/context/PulseContext.ts`, add `EquipmentProfile, EquipmentKey` to the `import type { ... } from '@/lib/pulse/types'` block. Then add this block to the `PulseContextValue` interface (place it right after the Swaps block):

```ts
    // Equipment profiles (named reusable equipment sets; storage + manager only,
    // generation wiring is Branch B). active pointer lives on `profile`.
    equipmentProfiles: EquipmentProfile[];
    createEquipmentProfile: (name: string, equipment: EquipmentKey[]) => Promise<EquipmentProfile>;
    updateEquipmentProfile: (id: string, name: string, equipment: EquipmentKey[]) => Promise<void>;
    deleteEquipmentProfile: (id: string) => Promise<void>;
    setActiveEquipmentProfile: (id: string | null) => Promise<void>;
```

- [ ] **Step 2: Compose the hook in the provider**

In `src/components/pulse/PulseProvider.tsx`:

Add the import near the other hook imports (after `import { useRoutines } from '@/hooks/pulse/useRoutines';`):

```ts
import { useEquipmentProfiles } from '@/hooks/pulse/useEquipmentProfiles';
```

Add the hook call near the other domain hook calls (e.g. right after the `useSwaps()` line):

```ts
    const {
        equipmentProfiles,
        createEquipmentProfile,
        updateEquipmentProfile,
        deleteEquipmentProfile,
        setActiveEquipmentProfile,
    } = useEquipmentProfiles();
```

Add a memoized value slice next to `swapsValue`:

```ts
    const equipmentValue = useMemo(
        () => ({
            equipmentProfiles,
            createEquipmentProfile,
            updateEquipmentProfile,
            deleteEquipmentProfile,
            setActiveEquipmentProfile,
        }),
        [
            equipmentProfiles,
            createEquipmentProfile,
            updateEquipmentProfile,
            deleteEquipmentProfile,
            setActiveEquipmentProfile,
        ],
    );
```

Spread it into `contextValue` (add `...equipmentValue,` after `...swapsValue,`) and add `equipmentValue` to that memo's dependency array (after `swapsValue,`).

- [ ] **Step 3: Typecheck + full suite**

Run: `bun run typecheck`
Expected: no errors.

Run: `bun run test:run`
Expected: all green (PulseProvider.test.tsx may assert on the context shape; if it builds a full mock context it will now need the four new fns and `equipmentProfiles: []`. Add them if the compiler or the test flags it).

- [ ] **Step 4: Commit**

```bash
git add -A
GIT_CONFIG_GLOBAL=/dev/null git -c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen" commit -m "feat(pulse): expose equipment profiles through PulseContext"
```

---

### Task 7: Shared `EquipmentSelector` component

The six-checkbox picker, extracted so the manager (this branch) and the setup flow (Branch B) render the identical control. Branch A is the first consumer; the flow adopts it in Branch B.

**Files:**
- Create: `src/components/pulse/EquipmentSelector.tsx`
- Create (test): `src/components/pulse/__tests__/EquipmentSelector.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/pulse/__tests__/EquipmentSelector.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EquipmentSelector from '../EquipmentSelector';
import type { EquipmentKey } from '@/lib/pulse/types';

describe('EquipmentSelector', () => {
    it('renders all six equipment options', () => {
        render(<EquipmentSelector selected={new Set()} onToggle={() => {}} />);
        for (const label of ['Dumbbells', 'Barbell', 'Bench', 'Cables', 'Machine', 'Pull-up bar']) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
    });

    it('marks selected items pressed', () => {
        render(<EquipmentSelector selected={new Set<EquipmentKey>(['barbell'])} onToggle={() => {}} />);
        expect(screen.getByRole('button', { name: /Barbell/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /Dumbbells/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onToggle with the key when clicked', async () => {
        const onToggle = vi.fn();
        render(<EquipmentSelector selected={new Set()} onToggle={onToggle} />);
        await userEvent.click(screen.getByRole('button', { name: /Cables/ }));
        expect(onToggle).toHaveBeenCalledWith('cables');
    });

    it('does not fire onToggle when disabled', async () => {
        const onToggle = vi.fn();
        render(<EquipmentSelector selected={new Set()} onToggle={onToggle} disabled />);
        await userEvent.click(screen.getByRole('button', { name: /Cables/ }));
        expect(onToggle).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:run src/components/pulse/__tests__/EquipmentSelector.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the component**

Create `src/components/pulse/EquipmentSelector.tsx`:

```tsx
import { EQUIPMENT_KEYS } from '@/lib/pulse/types';
import type { EquipmentKey } from '@/lib/pulse/types';
import { EQUIPMENT_LABELS } from '@/lib/pulse/constants';

interface Props {
    selected: Set<EquipmentKey>;
    onToggle: (key: EquipmentKey) => void;
    disabled?: boolean;
}

// The six-checkbox equipment picker. Shared by the Profile equipment-profile
// manager (Branch A) and the routine setup flow (Branch B) so both render the
// identical control. Stateless: the caller owns the selection.
export default function EquipmentSelector({ selected, onToggle, disabled = false }: Props) {
    return (
        <div className="flex flex-col gap-2">
            {EQUIPMENT_KEYS.map((key) => {
                const active = selected.has(key);
                return (
                    <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
                        onClick={() => onToggle(key)}
                        className={`flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                            active ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent' : 'bg-pulse-surface-2 ring-0'
                        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                        <div
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${active ? 'border-pulse-accent bg-pulse-accent' : 'border-pulse-muted'}`}>
                            {active && <span className="text-[10px] font-bold leading-none text-pulse-bg">✓</span>}
                        </div>
                        <span className="font-pulse-body text-sm text-pulse-text">{EQUIPMENT_LABELS[key]}</span>
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:run src/components/pulse/__tests__/EquipmentSelector.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
GIT_CONFIG_GLOBAL=/dev/null git -c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen" commit -m "feat(pulse): add shared EquipmentSelector component"
```

---

### Task 8: `EquipmentProfilesEditor` manager card + ProfileView wiring

The manager: list saved profiles (name + equipment summary + active marker + tap-to-activate), per-row edit (atomic) and delete, and a create form with suggested-name chips. Consumes `usePulse` and `EquipmentSelector`.

> **Visual-call note (do this first):** before writing the component, produce a small HTML mockup of the manager card and get the user's sign-off (his preferred workflow for visual decisions). The component below is the concrete baseline; the mockup may refine spacing, copy, and chip placement. Keep the data wiring and test contract intact whatever the mockup changes.

**Files:**
- Create: `src/components/pulse/EquipmentProfilesEditor.tsx`
- Create (test): `src/components/pulse/__tests__/EquipmentProfilesEditor.test.tsx`
- Modify: `src/components/pulse/views/ProfileView.tsx` (render the editor in the Training preferences group)

- [ ] **Step 1: Write the failing component test**

Create `src/components/pulse/__tests__/EquipmentProfilesEditor.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EquipmentProfilesEditor from '../EquipmentProfilesEditor';
import { ToastProvider } from '@/lib/pulse/toast';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));
import { usePulse } from '@/context/PulseContext';

const home = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Home', equipment: ['dumbbells'], created_at: '2026-06-09T00:00:00Z' };

const create = vi.fn().mockResolvedValue({ ...home, id: 'new', name: 'Gym' });
const update = vi.fn().mockResolvedValue(undefined);
const del = vi.fn().mockResolvedValue(undefined);
const setActive = vi.fn().mockResolvedValue(undefined);

function setContext(over: Record<string, unknown> = {}) {
    vi.mocked(usePulse).mockReturnValue({
        equipmentProfiles: [home],
        profile: { active_equipment_profile_id: null },
        createEquipmentProfile: create,
        updateEquipmentProfile: update,
        deleteEquipmentProfile: del,
        setActiveEquipmentProfile: setActive,
        ...over,
    } as unknown as ReturnType<typeof usePulse>);
}

function renderEditor() {
    return render(
        <ToastProvider>
            <EquipmentProfilesEditor />
        </ToastProvider>,
    );
}

beforeEach(() => {
    create.mockClear();
    update.mockClear();
    del.mockClear();
    setActive.mockClear();
    setContext();
});

describe('EquipmentProfilesEditor', () => {
    it('lists saved profiles with an equipment summary', () => {
        renderEditor();
        expect(screen.getByText('Home')).toBeInTheDocument();
        expect(screen.getByText(/Dumbbells/)).toBeInTheDocument();
    });

    it('opens the create form and requires a name and at least one equipment item', async () => {
        renderEditor();
        await userEvent.click(screen.getByRole('button', { name: /New profile/i }));
        const save = screen.getByRole('button', { name: /^Save$/ });
        expect(save).toBeDisabled();
        await userEvent.type(screen.getByPlaceholderText(/profile name/i), 'Gym');
        // Still disabled with no equipment chosen.
        expect(save).toBeDisabled();
        await userEvent.click(screen.getByRole('button', { name: /Barbell/ }));
        expect(save).toBeEnabled();
        await userEvent.click(save);
        expect(create).toHaveBeenCalledWith('Gym', ['barbell']);
    });

    it('a suggested-name chip fills the name field', async () => {
        renderEditor();
        await userEvent.click(screen.getByRole('button', { name: /New profile/i }));
        await userEvent.click(screen.getByRole('button', { name: /^Gym$/ }));
        expect(screen.getByPlaceholderText(/profile name/i)).toHaveValue('Gym');
    });

    it('tap-to-activate calls setActive', async () => {
        renderEditor();
        await userEvent.click(screen.getByRole('button', { name: /Set active/i }));
        expect(setActive).toHaveBeenCalledWith(home.id);
    });

    it('marks the active profile and offers no activate button for it', () => {
        setContext({ profile: { active_equipment_profile_id: home.id } });
        renderEditor();
        expect(screen.getByText(/Active/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Set active/i })).not.toBeInTheDocument();
    });

    it('delete calls deleteEquipmentProfile', async () => {
        renderEditor();
        await userEvent.click(screen.getByRole('button', { name: /Delete Home/i }));
        expect(del).toHaveBeenCalledWith(home.id);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:run src/components/pulse/__tests__/EquipmentProfilesEditor.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the manager component**

Create `src/components/pulse/EquipmentProfilesEditor.tsx`:

```tsx
import { useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { useToast } from '@/lib/pulse/toast';
import { EQUIPMENT_LABELS } from '@/lib/pulse/constants';
import type { EquipmentKey, EquipmentProfile } from '@/lib/pulse/types';
import EquipmentSelector from './EquipmentSelector';

const SUGGESTED_NAMES = ['Home', 'Gym', 'Travel'] as const;

function summary(equipment: EquipmentKey[]): string {
    if (equipment.length === 0) return 'No equipment';
    return equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ');
}

// Standing manager for equipment profiles, rendered in ProfileView's Training
// preferences group. Create / edit (atomic) / delete / set-active. Generation
// does not consume these yet (Branch B).
export default function EquipmentProfilesEditor() {
    const {
        equipmentProfiles,
        profile,
        createEquipmentProfile,
        updateEquipmentProfile,
        deleteEquipmentProfile,
        setActiveEquipmentProfile,
    } = usePulse();
    const toast = useToast();

    // null = closed; 'new' = create form; an id = editing that row.
    const [editing, setEditing] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [equipment, setEquipment] = useState<Set<EquipmentKey>>(new Set());
    const [busy, setBusy] = useState(false);

    const activeId = profile.active_equipment_profile_id;

    function openCreate() {
        setEditing('new');
        setName('');
        setEquipment(new Set());
    }

    function openEdit(p: EquipmentProfile) {
        setEditing(p.id);
        setName(p.name);
        setEquipment(new Set(p.equipment));
    }

    function close() {
        setEditing(null);
        setName('');
        setEquipment(new Set());
    }

    function toggle(key: EquipmentKey) {
        setEquipment((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    const canSave = name.trim().length > 0 && equipment.size > 0 && !busy;

    async function save() {
        if (!canSave) return;
        setBusy(true);
        try {
            const list = [...equipment];
            if (editing === 'new') await createEquipmentProfile(name, list);
            else if (editing) await updateEquipmentProfile(editing, name, list);
            close();
        } catch (e) {
            toast.show(e instanceof Error ? e.message : 'Could not save profile');
        } finally {
            setBusy(false);
        }
    }

    async function activate(id: string) {
        try {
            await setActiveEquipmentProfile(id);
        } catch {
            toast.show('Could not set active profile');
        }
    }

    async function remove(p: EquipmentProfile) {
        try {
            await deleteEquipmentProfile(p.id);
        } catch {
            toast.show('Could not delete profile');
        }
    }

    return (
        <div data-testid="equipment-profiles-editor">
            <p className="mb-3 font-pulse text-[0.8125rem] text-pulse-dim">
                Save the gear you train with (Home, Gym, Travel) so you do not re-enter it each time you build a plan.
            </p>

            <div className="flex flex-col gap-2">
                {equipmentProfiles.map((p) => {
                    const isActive = p.id === activeId;
                    return (
                        <div key={p.id} className="rounded-xl bg-pulse-surface-2 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 flex-col">
                                    <span className="flex items-center gap-2 font-pulse-body text-sm text-pulse-text">
                                        {p.name}
                                        {isActive && (
                                            <span className="rounded-full bg-pulse-accent/15 px-2 py-0.5 font-pulse text-[0.625rem] uppercase tracking-wide text-pulse-accent">
                                                Active
                                            </span>
                                        )}
                                    </span>
                                    <span className="truncate font-pulse text-[0.75rem] text-pulse-dim">
                                        {summary(p.equipment)}
                                    </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {!isActive && (
                                        <button
                                            type="button"
                                            onClick={() => activate(p.id)}
                                            className="font-pulse text-[0.75rem] text-pulse-accent">
                                            Set active
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => openEdit(p)}
                                        className="font-pulse text-[0.75rem] text-pulse-dim">
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Delete ${p.name}`}
                                        onClick={() => remove(p)}
                                        className="font-pulse text-[0.75rem] text-pulse-dim">
                                        Delete
                                    </button>
                                </div>
                            </div>

                            {editing === p.id && (
                                <EditForm
                                    name={name}
                                    setName={setName}
                                    equipment={equipment}
                                    toggle={toggle}
                                    canSave={canSave}
                                    busy={busy}
                                    onSave={save}
                                    onCancel={close}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {editing === 'new' ? (
                <div className="mt-2 rounded-xl bg-pulse-surface-2 p-3">
                    <EditForm
                        name={name}
                        setName={setName}
                        equipment={equipment}
                        toggle={toggle}
                        canSave={canSave}
                        busy={busy}
                        onSave={save}
                        onCancel={close}
                        showSuggestions
                    />
                </div>
            ) : (
                <button
                    type="button"
                    onClick={openCreate}
                    className="mt-2 w-full rounded-xl border border-dashed border-pulse-border p-3 font-pulse-body text-sm text-pulse-dim">
                    New profile
                </button>
            )}
        </div>
    );
}

function EditForm({
    name,
    setName,
    equipment,
    toggle,
    canSave,
    busy,
    onSave,
    onCancel,
    showSuggestions = false,
}: {
    name: string;
    setName: (v: string) => void;
    equipment: Set<EquipmentKey>;
    toggle: (key: EquipmentKey) => void;
    canSave: boolean;
    busy: boolean;
    onSave: () => void;
    onCancel: () => void;
    showSuggestions?: boolean;
}) {
    return (
        <div className="mt-3 flex flex-col gap-3">
            <input
                type="text"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                placeholder="Profile name"
                className="rounded-lg bg-pulse-bg px-3 py-2 font-pulse-body text-sm text-pulse-text outline-none ring-1 ring-pulse-border focus:ring-pulse-accent"
            />
            {showSuggestions && (
                <div className="flex flex-wrap gap-2">
                    {SUGGESTED_NAMES.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setName(s)}
                            className="rounded-full bg-pulse-bg px-3 py-1 font-pulse text-[0.75rem] text-pulse-dim ring-1 ring-pulse-border">
                            {s}
                        </button>
                    ))}
                </div>
            )}
            <EquipmentSelector selected={equipment} onToggle={toggle} disabled={busy} />
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={!canSave}
                    onClick={onSave}
                    className={`rounded-lg px-4 py-2 font-pulse-body text-sm ${canSave ? 'bg-pulse-accent text-pulse-bg' : 'cursor-not-allowed bg-pulse-surface text-pulse-muted'}`}>
                    Save
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg px-4 py-2 font-pulse-body text-sm text-pulse-dim">
                    Cancel
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:run src/components/pulse/__tests__/EquipmentProfilesEditor.test.tsx`
Expected: PASS. (If the toast import path differs, match the import used by `ProfileView.test.tsx`: `import { ToastProvider } from '@/lib/pulse/toast';`.)

- [ ] **Step 5: Render the editor in ProfileView**

In `src/components/pulse/views/ProfileView.tsx`, add the import near the other component imports:

```ts
import EquipmentProfilesEditor from '../EquipmentProfilesEditor';
```

Then add a subsection inside the "Training preferences group" `div`, immediately after the "Loading lean" block's closing `</div>` and before the "Movement restrictions" block:

```tsx
                        {/* Equipment profiles */}
                        <div>
                            <SectionLabel className="mb-2">Equipment profiles</SectionLabel>
                            <EquipmentProfilesEditor />
                        </div>
```

- [ ] **Step 6: Typecheck + full suite**

Run: `bun run typecheck`
Expected: no errors.

Run: `bun run test:run`
Expected: all green. (ProfileView.test.tsx renders the full view; its mocked `usePulse` context now needs `equipmentProfiles: []` and the four mutation fns, plus `profile.active_equipment_profile_id: null`. Add them to that test's `defaultContext` if it throws.)

- [ ] **Step 7: Commit**

```bash
git add -A
GIT_CONFIG_GLOBAL=/dev/null git -c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen" commit -m "feat(pulse): add equipment profiles manager to Profile"
```

---

### Task 9: Roadmap + CLAUDE.md sync (finish ritual)

**Files:**
- Modify: `docs/roadmap.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the roadmap**

In `docs/roadmap.md`: set `In progress:` back to `(none)`; set the `In review (on a branch, not yet merged):` line to Branch A on `feature/equipment-profiles-storage`; add a dated Shipped bullet under the reference/archive section summarizing Branch A; update the test count; and note that equipment profiles #6 Branch B (generation wiring) is the next step.

- [ ] **Step 2: Update CLAUDE.md**

Add equipment profiles to the domain-model / architecture notes: the `equipment_profiles` table + `profiles.active_equipment_profile_id`, the `EquipmentProfile` type, `useEquipmentProfiles` hook, the four actions, the shared `EquipmentSelector`, the manager in ProfileView, and that Branch B (generation wiring) is pending. Mention the migration file name.

- [ ] **Step 3: Verify the whole suite once more**

Run: `bun run test:run && bun run typecheck`
Expected: all green, no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
GIT_CONFIG_GLOBAL=/dev/null git -c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen" commit -m "docs(roadmap): ship equipment profiles Branch A (storage + manager)"
```

---

## Self-Review

**Spec coverage:**
- Dedicated table + RLS + `ON DELETE SET NULL` active pointer, name `CHECK`, travel-mode SQL comment -> Task 1.
- `EquipmentProfile` type + `Profile` field -> Task 2.
- Soft case-insensitive name uniqueness, atomic `updateEquipmentProfile`, create/delete/set-active, equipment subset + >=1 validation -> Task 3.
- User-scoped loader (`created_at` desc, `id` desc) + GET route + scoping test -> Task 4.
- Hook with optimistic create/update/delete + set-active touching the profile cache -> Task 5.
- Context exposure -> Task 6.
- Shared `EquipmentSelector` -> Task 7.
- Manager card (list, active marker, tap-to-activate, atomic edit, delete, suggested-name chips, >=1 guard) -> Task 8.
- Finish ritual (roadmap + CLAUDE.md) -> Task 9.

Out of scope here (Branch B): setup-flow pre-fill / quick-pick / save-as, Tune-panel picker, pre-fill resolution rule wiring, the "From your X profile" hint. The resolution-rule unit test and the delete-the-last-profile pre-fill test belong to Branch B (the rule is consumed there). Branch A's delete path is covered by the hook + manager tests.

**Placeholder scan:** No TBD/TODO. Every code step has complete code; every command has expected output. The Task 8 visual-call note is a process instruction, not a code placeholder (concrete baseline component is provided).

**Type consistency:** `EquipmentProfile { id, name, equipment, created_at }` is used identically in the type, loader, hook, actions, context, and components. Action names (`createEquipmentProfile`, `updateEquipmentProfile`, `deleteEquipmentProfile`, `setActiveEquipmentProfile`) match across actions, barrel, hook, and context. The field `active_equipment_profile_id` is spelled identically in the migration, type, loader, select const, default, and provider.
