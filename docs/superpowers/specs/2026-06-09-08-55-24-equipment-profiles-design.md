# Equipment profiles (#6), design

Date: 2026-06-09
Roadmap item: Tier 2 #6, Equipment profiles
Branches: `feature/equipment-profiles-storage` (A), then `feature/equipment-profiles-generation` (B)

## Problem

Equipment is captured transiently per generation today. `RoutineSetupFlow` step 1 holds a
`Set<EquipmentKey>` (the six keys `dumbbells`, `barbell`, `bench`, `cables`, `machines`,
`pull_up_bar`) that flows through `answers.equipment` into `generateAndSaveRoutine` and the
`hasEquipment` pool filter in `generation.ts`. Nothing persists: the `Profile` type has no
equipment field and there is no equipment table. A user who trains at home and at a gym has to
re-enter their kit by hand every time they regenerate, and there is no way to keep distinct
setups (Home / Gym / Travel) and switch between them. This is the concrete home-gym and
cross-device feature.

## Goals

- Persist named equipment sets per user, with as many as the user wants.
- Manage them from Profile (create, name, edit equipment, delete, set active).
- Let the active set pre-fill the generation flow so returning users do not re-enter kit.
- Let the user pick a saved set in the flow and regenerate against it (non-destructively).
- Lay storage that travel mode (#322, deferred) can extend with an expiry, without a rework.

## Non-goals (deferred)

- **Travel mode (#322).** A thin expiry wrapper (`expires_at` + auto-revert) on this table,
  explicitly sequenced after #6. Not built here, but the data model anticipates it.
- **Auto-skipping the equipment step** entirely for returning users. v1 keeps the step visible
  but pre-filled. Disappearing the step is the v2 upgrade. (This distinction is called out in a
  code comment at the pre-fill site so the intent is unambiguous later.)
- **Per-routine equipment binding.** A routine does not remember which profile generated it;
  equipment still flows transiently through `answers.equipment` at generation time. Profiles
  only seed the picker.

## Decisions (settled in brainstorming)

1. **Two branches.** Branch A (storage + Profile manager) ships standalone with no capability
   gap and a reviewable diff; Branch B (generation wiring) follows. Reviewed independently.
2. **Non-destructive switching.** Switching the active profile only changes the default pre-fill
   for the next generation. Regenerating is always a separate, explicit action. Regen destroys
   logged sets, so it never happens silently on a switch.
3. **Dedicated table.** A first-class `equipment_profiles` table plus an active pointer on
   `profiles`, not a JSON column. Cleaner querying, scales to N profiles, and gives travel mode a
   natural home for `expires_at`.

## Architecture

Equipment profiles follow the same shape as the existing personalization inputs (training style,
variety, loading lean, movement restrictions): a persisted user setting, surfaced through a
Profile editor and the setup flow, that seeds generation. The one new thing is that equipment
becomes a named, multi-instance entity, so it gets its own table and a read hook rather than a
single profile column.

Generation itself does not change. Equipment continues to flow through `answers.equipment` into
`hasEquipment`. Profiles only seed the picker, so the byte-identical generation guarantees and
the existing golden / identity tests all still hold.

## Data model (Branch A)

New table `equipment_profiles`:

| column       | type          | notes                                                        |
|--------------|---------------|--------------------------------------------------------------|
| `id`         | `uuid` pk     | `gen_random_uuid()` default                                  |
| `user_id`    | `uuid`        | FK to `auth.users(id)` `ON DELETE CASCADE`, RLS-scoped       |
| `name`       | `text`        | not null, non-empty, trimmed, max 40 chars                   |
| `equipment`  | `text[]`      | subset of the six `EQUIPMENT_KEYS`, at least one required    |
| `created_at` | `timestamptz` | `now()` default; also the recency tiebreak for pre-fill      |

RLS policies in the migration (select / insert / update / delete restricted to
`auth.uid() = user_id`), matching every other Pulse table. Migration filename carries the full
timestamp prefix and lands in `docs/migrations/`. Applied by hand against Supabase (no runner in
this repo).

New nullable column on `profiles`:

- `active_equipment_profile_id uuid` -> FK to `equipment_profiles(id)` `ON DELETE SET NULL`.
  Deleting the active profile cleanly clears the pointer. `null` = no active profile = exactly
  today's behavior. Nothing to migrate (equipment was never stored before).

### Pre-fill resolution rule

The equipment the flow opens with is resolved in order:

1. The active profile (`active_equipment_profile_id`), if set.
2. Else, if any saved profiles exist, the most-recently-created one (`created_at` desc). This
   closes the gap where a user has profiles but none is marked active (e.g. created two, then
   deactivated both); "starts empty" would be confusing there.
3. Else empty (no saved profiles), which is today's behavior unchanged.

No extra column is needed; rule 2 uses `created_at`.

## Branch A: persistence + manager

### Server actions (`src/app/pulse/actions/equipment.ts`, new)

- `createEquipmentProfile(name: string, equipment: EquipmentKey[]): Promise<EquipmentProfile>`
- `renameEquipmentProfile(id: string, name: string): Promise<void>`
- `updateEquipmentProfileEquipment(id: string, equipment: EquipmentKey[]): Promise<void>`
- `deleteEquipmentProfile(id: string): Promise<void>`
- `setActiveEquipmentProfile(id: string | null): Promise<void>` (writes `profiles.active_equipment_profile_id`)

Each validates: name trimmed, non-empty, <= 40 chars; equipment a non-empty subset of
`EQUIPMENT_KEYS`. Each scopes the write to the authed user via the standard `getUserOrThrow`
plus RLS. Mutations call `revalidate` paths consistent with the other actions.

### Read path

- GET handler `src/app/api/pulse/equipment-profiles/route.ts` reusing a loader in
  `src/lib/pulse/queries.ts` (returns the user's profiles ordered `created_at` desc).
- Hook `src/hooks/pulse/useEquipmentProfiles.ts` mirroring the other data hooks: `useSWR` keyed
  on the endpoint, stable empty-array default, optimistic mutations (`mutate(next, false)` then
  await action then `mutate()`), exposed through `PulseProvider` / `PulseContext`. The active
  pointer continues to live on `profile` (read via `useProfile`); `setActiveEquipmentProfile`
  optimistically updates the profile cache like the other profile setters.

### Types

- `EquipmentProfile` interface in `src/lib/pulse/types.ts`: `{ id, name, equipment: EquipmentKey[], created_at }`.
- `active_equipment_profile_id: string | null` added to the `Profile` interface.

### Manager UI

A card in ProfileView's existing "Training preferences" group:

- Lists saved profiles: name + a compact equipment summary (reusing `EQUIPMENT_LABELS`), with an
  "Active" marker on the active one and a tap-to-activate affordance per row.
- Per-row edit (name + equipment) and delete (delete of the active row optimistically clears the
  active marker, matching `ON DELETE SET NULL`).
- "New profile" entry: name input with suggested-name chips (Home / Gym / Travel as one-tap
  suggestions, not auto-seeded rows) plus the same six-checkbox equipment selector the setup flow
  uses. Save is disabled until name is non-empty and at least one equipment item is checked
  (mirrors the flow's `equipment.size === 0` guard).

The equipment selector (six checkboxes, the `EQUIPMENT_OPTIONS` list) is extracted into a small
shared component so the manager and the setup flow render the identical control.

**Branch A ships standalone.** You can fully create, edit, activate, and delete equipment
profiles. Generation does not consume them yet, so there is no capability gap and the diff is
self-contained.

## Branch B: generation wiring

### Setup flow (`RoutineSetupFlow` step 1)

- Above the equipment checkboxes, a saved-profiles quick-pick row: each saved profile is a chip;
  tapping one fills the checkboxes from that profile's equipment. The step opens pre-filled per
  the resolution rule above (active, else most-recent, else empty). A comment at this site states
  that pre-fill is the v1 mechanism and that disappearing the step is the v2 upgrade.
- A "Save as profile" affordance appears when the current checkbox selection matches no saved
  profile, opening the same name + suggested-chips create path as the manager.
- When no profiles exist, the step is exactly today's (just the checkboxes), so onboarding for a
  brand-new user is unchanged.

### Tune panel (`TuneYourPlanPanel`)

- Add an equipment-profile picker alongside the existing personalization pickers. Picking a
  different profile and applying regenerates in place, exactly as the panel already does for the
  other inputs, and only before any sets are logged (the panel's existing precondition).

### Switching and regeneration

- Picking a profile in the flow or Tune panel only fills equipment for that generation. Setting a
  profile active is a manager action; active just changes the default pre-fill.
- Regenerating an in-progress routine (logged sets exist) routes through the normal Generate flow,
  which creates a new routine. Equipment switching never silently mutates or wipes an active
  routine.

### Generation engine

Unchanged. `generateAndSaveRoutine` still receives `answers.equipment` and passes it to
`generateRoutine` -> `hasEquipment`. Profiles seed the picker only.

## Testing

Per this repo's conventions (no server-action test harness; actions hit Supabase, so coverage
lives in hook / component tests).

**Branch A:**
- Manager component: renders the saved list, create requires name + >= 1 equipment, delete of the
  active profile clears the active marker optimistically, activate updates the marker.
- `useEquipmentProfiles` hook: optimistic create / rename / update / delete shape.
- Type-level: `EquipmentProfile` and the new `Profile` field compile and are threaded through
  context.

**Branch B:**
- Setup flow: opens pre-filled from the active profile; pre-fills from most-recent when none
  active; picking a chip fills the checkboxes; "Save as profile" appears only when the selection
  matches no saved set; no-profiles case renders today's checkboxes unchanged.
- Tune panel: switching the equipment profile and applying triggers an in-place regenerate.
- Generation golden / identity tests stay green (no engine change).

Full suite must stay green after each branch (run `bun run test:run` and `bun run typecheck`).

## Risks

- **RLS correctness on a new table.** Mitigated by copying the established policy shape from an
  existing Pulse table and including the policies in the same migration.
- **Active-pointer FK direction.** `profiles.active_equipment_profile_id -> equipment_profiles.id`
  with `ON DELETE SET NULL` is the correct direction (deleting a profile clears the pointer, not
  the other way round).
- **Optimistic-cache coherence** between `useEquipmentProfiles` (list) and `useProfile` (active
  pointer). Setting active touches the profile cache; deleting the active row touches both. Tests
  cover the delete-active path.
