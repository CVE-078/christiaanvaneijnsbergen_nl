# Profile training-preference editors, design spec

**Date:** 2026-06-08
**Roadmap item:** Tier 1 #15 (Quick-start generation + post-generation "Tune your plan"), **Branch 1 of the sequenced work**.
**Branch:** `feature/quick-start-generation`

## Summary

Add a standing **"Training preferences"** group on the Profile screen with editors for **training style**, **variety**, and **loading lean**, alongside the existing **movement restrictions** editor (regrouped under the same heading). Each editor persists its profile column and applies to the next routine generation. This is the durable home for the three generation preferences that are currently settable only inside `RoutineSetupFlow`, so a later branch can safely trim them out of the creation flow without leaving users no way to set them.

Persist-only model (identical to the shipped restrictions editor): no regeneration, no migration. All columns already exist and `loadProfile` already selects them.

## Why this is Branch 1

Trimming the routine-creation flow (the #15 goal) removes the only UI for training style / variety / loading lean. Building this standing home first removes the capability gap, so the flow trim becomes a safe, independent follow-on. This branch is additive (it removes nothing) and ships value on its own.

## Out of scope (separate follow-on branches)

- The post-generation "Tune your plan" panel (regenerate-in-place + logged-sets safety).
- The `mode:'quick'` flow trim itself.

Do not let either creep into this branch.

## Architecture

### Shared option constants (new module)

`TRAINING_STYLE_OPTIONS`, `VARIETY_OPTIONS`, `LOADING_LEAN_OPTIONS`, and `RESTRICTION_OPTIONS` currently live inline in `RoutineSetupFlow.tsx` (the first three) and as an inline re-declared array in `ProfileView.tsx` (restrictions). Extract all four into a new module `src/lib/pulse/generationPreferences.ts` as the single source of truth (each entry `{ key, label, desc }`). Update `RoutineSetupFlow` and `ProfileView` to import from it. This kills the existing duplication smell (flagged in the movement-restrictions code review) in one pass.

### Server actions (`src/app/pulse/actions/profile.ts`)

Two new, mirroring `updateMovementRestrictions` exactly (validate against allowed values, `getUserOrThrow`, upsert the single column with `onConflict: 'id'`, `revalidatePath('/pulse')`):

- `updateVarietyPreference(pref: VarietyPreference)`: validate `pref` is `'varied' | 'consistent'`.
- `updateLoadingLean(pref: LoadingPreference | null)`: validate `pref` is one of `'barbell' | 'dumbbell' | 'machine' | 'cable'` **or null** (null clears the preference). Write the column as-is (null is a valid stored value, the generator treats it as no preference / identity).

`updateTrainingStyle` already exists (server action + `useProfile` callback from the training-style feature, currently dormant), no new action needed.

### Hook + context + provider

- `useProfile` (`src/hooks/pulse/useProfile.ts`): add optimistic `updateVarietyPreference` and `updateLoadingLean` setters mirroring `updateMovementRestrictions` (optimistic `mutateProfile({ ...profile, <col>: value }, false)`, await server, revalidate). Confirm `updateTrainingStyle` is present in the hook's returned object (it is defined; ensure it is returned).
- `PulseContext` (`src/context/PulseContext.ts`): add `updateTrainingStyle`, `updateVarietyPreference`, `updateLoadingLean` to the `PulseContextValue` interface. (`updateTrainingStyle` is currently dormant and not on the interface, so it is wired through here for the first time.)
- `PulseProvider` (`src/components/pulse/PulseProvider.tsx`): destructure all three from `useProfile()` and add them to the context value object and its dependency array, mirroring `updateMovementRestrictions`.

### ProfileView UI (`src/components/pulse/views/ProfileView.tsx`)

A "Training preferences" group (one `SectionLabel` + intro line, then the four editors). Group intro copy: "Shape how Pulse builds your routines. Applies to plans you generate from now on." Each editor uses the existing Profile toggle pattern (`startTransition` / `isPending` guard / `disabled={isPending}` / `opacity` while pending), consistent with the accent and restrictions editors.

- **Training style**: single-select rows from `TRAINING_STYLE_OPTIONS`. Active = `profile.training_style ?? 'balanced'`. Click → `updateTrainingStyle(key)`. Always has one active (defaults to balanced).
- **Variety**: single-select rows from `VARIETY_OPTIONS`. Active = `profile.variety_preference ?? 'varied'`. Click → `updateVarietyPreference(key)`. Always has one active (defaults to varied).
- **Loading lean**: rows from `LOADING_LEAN_OPTIONS` **plus an explicit "No preference" row at the top**. Active state:
  - When `profile.loading_lean` is null → the "No preference" row is active and no equipment row is highlighted.
  - When set → that equipment row is active.
  - Selecting "No preference" → `updateLoadingLean(null)`. Selecting an inactive equipment row → `updateLoadingLean(key)`.
  - Clicking the **already-active** equipment row is a **no-op** (the setter is not called). Equipment rows do NOT tap-to-deselect, that is the difference from the flow step; clearing is done only via the "No preference" row. This prevents a redundant double-fire.
  - The explicit "No preference" row is required (not tap-to-deselect alone) because this is a standing editor with no Next button, so clearing must be a visible, discoverable affordance. Null is a valid intentional state, not a missing default, so it must render distinctly (never as a stale prior value).
- **Movement restrictions**: the existing multi-select editor, unchanged in behavior, regrouped under this heading and switched to import `RESTRICTION_OPTIONS` from the shared module instead of its current inline array.

### Apply model

Persist-only. Each editor writes its profile column; the value applies the next time the user generates a routine (via the existing `param ?? profile ?? default` resolution in `generateAndSaveRoutine`). No regeneration is triggered from Profile. Copy states this. (The immediate-regenerate experience is the separate post-gen "Tune your plan" follow-on.)

## Data / migration impact

None. `training_style`, `variety_preference`, `loading_lean`, `movement_restrictions` all already exist on `profiles` and are already in `PROFILE_SELECT` / `loadProfile`. RLS is inherited (no column changes).

## Tests

- **Server actions** (`actions` tests, mirror the `updateMovementRestrictions` test): `updateVarietyPreference` rejects an invalid value; `updateLoadingLean` accepts each of the four values **and null**, rejects an invalid string.
- **`useProfile` optimistic updates**: `updateVarietyPreference` and `updateLoadingLean` optimistically set the profile then revalidate (mirror the existing setter tests).
- **ProfileView render/interaction**:
  - The three editors render and reflect current profile values (training style defaults to balanced, variety to varied when columns are null).
  - **Null loading-lean renders as "No preference" active with no equipment row highlighted** (explicit, since the `?? default` pattern does not apply, null is intentional).
  - Clicking a row calls the matching setter with the expected argument (including the "No preference" row calling `updateLoadingLean(null)`).
  - Clicking the **already-active** equipment row does **not** call `updateLoadingLean` (no-op; equipment rows do not deselect).
- **Shared-constants extraction is non-breaking**: existing `RoutineSetupFlow` tests stay green after the import swap (no copy change; the constants move byte-identical).

## Self-review notes

- Identity preserved: extracting the option constants is a pure move (same labels/desc), so `RoutineSetupFlow` behavior is byte-identical.
- The only genuinely new validation surface is `updateLoadingLean` accepting null; the test covers it explicitly.
- No engine change, no generation-logic change, deterministic generation unaffected (these are preference-storage writes only).
