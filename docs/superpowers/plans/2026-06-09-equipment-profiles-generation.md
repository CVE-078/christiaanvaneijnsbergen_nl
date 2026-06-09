# Equipment Profiles, Branch B (generation wiring) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, with full context) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let saved equipment profiles seed the generation equipment picker, non-destructively: pre-fill the setup flow per the resolution rule, offer a saved-profile quick-pick + "Save as profile", and add a chip-pick equipment picker to the Tune-your-plan panel. The generation engine does not change.

**Architecture:** Equipment continues to flow through `answers.equipment` into `hasEquipment`; profiles only seed the picker, so all golden / identity tests still hold. `RoutineSetupFlow` stays **prop-driven** (it does not consume `usePulse`): three new optional props carry the saved profiles, the active id, and a create callback, all defaulting to today's behavior, so existing flow tests are untouched and template cloning stays unchanged. The two generate consumers (`OnboardingModal`, `GenerateRoutineButton`) read those from `usePulse` and pass them down. Three pure helpers in `utils.ts` (`resolveEquipmentPrefill`, `equipmentKey`, `matchingProfileId`) carry the testable logic. `TuneYourPlanPanel` adds an equipment chip-pick that threads a new set into the in-place regenerate.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict), SWR, Vitest + Testing Library (jsdom). Package manager `bun`.

**Spec:** `docs/superpowers/specs/2026-06-09-08-55-24-equipment-profiles-design.md` (Branch B section)
**Visual sign-off:** `docs/superpowers/designs/2026-06-09-10-32-38-equipment-profiles-generation-mockup.html` (approved 2026-06-09)

**Conventions:** No em dashes anywhere. Conventional commits `type(scope): subject`, scope `pulse`, subject only, no body, no Co-Authored-By. Commit with the gmail identity + empty-gpg workaround:
`GIT_CONFIG_GLOBAL=/dev/null git -c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen" commit -m "..."`. Tests: `bun run test:run <path>`; full suite `bun run test:run`; types `bun run typecheck`.

## Settled decisions

- **Flow keeps its descriptive labels** (`EQUIPMENT_OPTIONS`: "Barbell & plates", "Gym machines (leg press, lat pulldown, etc.)"). The shared `EquipmentSelector` (short `EQUIPMENT_LABELS`) stays the Profile manager's control. The `EQUIPMENT_LABELS` comment already states the setup flow uses its own longer labels. Quick-pick chips use the short profile **names**, not equipment labels.
- **Hint and Save-as are mutually exclusive.** When the current selection set-equals a saved profile, show "Filled from your X profile" and highlight that chip; when it matches none, hide the hint and offer "Save as profile".
- **Save-as requires at least one existing profile** (`equipmentProfiles.length > 0`). This honors the spec's "no profiles → exactly today's checkboxes, onboarding unchanged" rule. First profiles are created in the Profile manager; the flow's save-as is for saving a *variant* once you already have one. Save-as **only ever creates**.
- **Save-as collapses to a one-line link** by default, expanding to the inline form on tap (approved in the mockup).
- **Tune panel is chip-pick only** (no checkbox grid), and the equipment section renders only when `equipmentProfiles.length > 0`. "Manage in Profile" is wired via an optional `onManageEquipment` callback the consumer supplies (clears the panel state and navigates to Profile), avoiding a navigate-vs-onDone race.
- **Commit split** (review each before the next): (1) pure helpers, (2) setup-flow piece + consumers, (3) Tune-panel piece, (4) docs sync.

---

### Task 1: Pure helpers in `utils.ts`

**Files:**
- Modify: `src/lib/pulse/utils.ts` (add three helpers + the `EquipmentProfile` / `EquipmentKey` type import if missing)
- Modify (test): `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing tests** in a new `describe` block in `utils.test.ts`.

```ts
import { resolveEquipmentPrefill, equipmentKey, matchingProfileId } from '../utils';
import type { EquipmentProfile } from '../types';

const prof = (id: string, equipment: EquipmentProfile['equipment'], created_at: string): EquipmentProfile => ({
    id, name: id, equipment, created_at,
});
// Loader returns created_at desc, so the most-recent is first.
const home = prof('home', ['dumbbells', 'bench'], '2026-06-09T02:00:00Z');
const gym = prof('gym', ['barbell', 'machines'], '2026-06-09T01:00:00Z');

describe('equipmentKey', () => {
    it('is order-independent', () => {
        expect(equipmentKey(['bench', 'dumbbells'])).toBe(equipmentKey(['dumbbells', 'bench']));
    });
});

describe('matchingProfileId', () => {
    it('returns the id of the profile whose equipment set-equals the selection', () => {
        expect(matchingProfileId([home, gym], new Set(['bench', 'dumbbells']))).toBe('home');
    });
    it('returns null when nothing matches', () => {
        expect(matchingProfileId([home, gym], new Set(['cables']))).toBeNull();
    });
    it('returns null for no profiles', () => {
        expect(matchingProfileId([], new Set(['dumbbells']))).toBeNull();
    });
});

describe('resolveEquipmentPrefill', () => {
    it('returns the active profile when set and present', () => {
        expect(resolveEquipmentPrefill([home, gym], 'gym')).toEqual(['barbell', 'machines']);
    });
    it('falls back to the most-recent (first) when none active', () => {
        expect(resolveEquipmentPrefill([home, gym], null)).toEqual(['dumbbells', 'bench']);
    });
    it('falls back to most-recent when the active id is stale (deleted)', () => {
        expect(resolveEquipmentPrefill([home, gym], 'deleted-id')).toEqual(['dumbbells', 'bench']);
    });
    it('returns empty when there are no profiles (today\'s behavior)', () => {
        expect(resolveEquipmentPrefill([], null)).toEqual([]);
        expect(resolveEquipmentPrefill([], 'anything')).toEqual([]);
    });
});
```

- [ ] **Step 2: Run, verify it fails** (`bun run test:run src/lib/pulse/__tests__/utils.test.ts`) — FAIL (helpers not exported).

- [ ] **Step 3: Implement** the three helpers in `utils.ts` (add `EquipmentProfile`, `EquipmentKey` to the `import type ... from './types'`).

```ts
// Equipment-profile generation helpers (Branch B). The engine is unchanged;
// these only decide which saved set seeds / matches the equipment picker.

// Stable key for an equipment set: sorted, comma-joined. Two selections are the
// same kit iff their keys match (order-independent).
export function equipmentKey(equipment: Iterable<EquipmentKey>): string {
    return [...equipment].sort().join(',');
}

// The id of the saved profile whose equipment exactly matches `equipment`, or
// null when none match. Drives the "Filled from your X profile" hint + chip
// highlight, and gates the flow's "Save as profile" affordance.
export function matchingProfileId(profiles: EquipmentProfile[], equipment: Iterable<EquipmentKey>): string | null {
    const key = equipmentKey(equipment);
    return profiles.find((p) => equipmentKey(p.equipment) === key)?.id ?? null;
}

// Which saved set pre-fills the generation equipment step. Resolution order
// (spec): active profile, else the most-recently-created (profiles arrive
// created_at desc from the loader, so profiles[0]), else empty (no saved
// profiles = today's behavior). Pure; the snapshot-on-open guarantee lives at
// the call site (a useState initializer).
export function resolveEquipmentPrefill(profiles: EquipmentProfile[], activeId: string | null): EquipmentKey[] {
    if (activeId) {
        const active = profiles.find((p) => p.id === activeId);
        if (active) return active.equipment;
    }
    return profiles[0]?.equipment ?? [];
}
```

- [ ] **Step 4: Run, verify it passes.** Then `bun run typecheck`.

- [ ] **Step 5: Commit** `feat(pulse): add equipment-profile generation helpers`.

---

### Task 2: Setup-flow wiring (`RoutineSetupFlow`) + generate consumers

**Files:**
- Modify: `src/components/pulse/RoutineSetupFlow.tsx`
- Modify: `src/components/pulse/OnboardingModal.tsx`, `src/components/pulse/GenerateRoutineButton.tsx`
- Modify (test): `src/components/pulse/__tests__/RoutineSetupFlow.test.tsx`, `src/components/pulse/__tests__/GenerateRoutineButton.test.tsx`

**Flow changes:**
- Add to `Props`: `equipmentProfiles?: EquipmentProfile[]`, `activeEquipmentProfileId?: string | null`, `onCreateEquipmentProfile?: (name: string, equipment: EquipmentKey[]) => Promise<EquipmentProfile>`. Destructure with defaults `= []`, `= null`, (callback optional). Import `EquipmentProfile` from types; `resolveEquipmentPrefill`, `matchingProfileId` from utils.
- Pre-fill: change the equipment state to a lazy initializer with a v1/v2 comment:

```ts
// Pre-fill the equipment step from the resolution rule (active -> most-recent ->
// empty), snapshotted on open so deleting the active profile mid-flow can't
// change an in-progress selection. v1 keeps the step visible but pre-filled;
// disappearing the step entirely for returning users is the v2 upgrade.
const [equipment, setEquipment] = useState<Set<EquipmentKey>>(
    () => new Set(initial?.equipment ?? resolveEquipmentPrefill(equipmentProfiles, activeEquipmentProfileId)),
);
```

- Save-as local state: `savingProfile` (form open), `profileName`, `savingBusy`, `saveError`.
- Derived: `showProfiles = equipmentProfiles.length > 0`; `matchedId = matchingProfileId(equipmentProfiles, equipment)`; `matchedProfile`; `canSaveProfile = profileName.trim().length > 0 && equipment.size > 0 && !savingBusy`.
- In **step 1** render, **above** the checkbox grid: the "Your equipment profiles" chip row (each chip `aria-pressed` when `p.id === matchedId`, an "active" sub-label when `p.id === activeEquipmentProfileId`, `onClick` sets `equipment = new Set(p.equipment)` and closes any open save-as), then the "Filled from your {matchedProfile.name} profile" hint when `showProfiles && matchedProfile`.
- **Below** the checkbox grid (before the Next/Cancel block): the save-as affordance, rendered only when `showProfiles && onCreateEquipmentProfile && equipment.size > 0 && !matchedId`. Collapsed = a `+ Save these as a profile` accent link; expanded = a dashed-border card with a name input (`maxLength={40}`, placeholder "Profile name"), Home/Gym/Travel suggestion chips that set the name, an inline `saveError` line, and Save (disabled until `canSaveProfile`) / Cancel. Save calls `onCreateEquipmentProfile(profileName.trim(), [...equipment])`; on success collapse + reset; on error set `saveError`.

(All chip / hint / save-as styling follows the approved mockup; reuse existing token classes — accent ring for active, `bg-pulse-surface-2` / `border-pulse-border` for inactive, `border-dashed` for the save card.)

**Consumer changes** (both `OnboardingModal` and `GenerateRoutineButton`): destructure `profile, equipmentProfiles, createEquipmentProfile` from `usePulse` and pass to the flow:

```tsx
equipmentProfiles={equipmentProfiles}
activeEquipmentProfileId={profile.active_equipment_profile_id}
onCreateEquipmentProfile={createEquipmentProfile}
```

(`TemplatesTab` is left untouched: it passes its own `initial.equipment` and no profiles, so `showProfiles` is false and it behaves exactly as today.)

- [ ] **Step 1: Write failing flow tests** (render with the props directly, no provider). Cover: pre-fills from active; pre-fills from most-recent when none active; no profiles -> no chip / no hint / starts empty; tapping a chip fills the checkboxes; save-as appears only when the selection matches no saved set; tapping save-as + typing a name + Save calls `onCreateEquipmentProfile` with the name and equipment; a suggestion chip fills the name. Assert checkbox state via `getByRole('checkbox', { name: /Dumbbells/ }).checked` (the wrapping `<label>` gives the input its accessible name). Assert the saved equipment with `expect([...onCreate.mock.calls[0][1]].sort()).toEqual([...].sort())` to avoid order fragility.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the flow changes.
- [ ] **Step 4: Run flow tests, verify pass.**
- [ ] **Step 5: Wire the two consumers.** Add a `GenerateRoutineButton` test: with `equipmentProfiles` in the `usePulse` mock and `profile.active_equipment_profile_id` set, opening the flow shows the matching chip (`getByRole('button', { name: /Home/ })`).
- [ ] **Step 6:** `bun run typecheck` then the **full suite** `bun run test:run` (a new required behavior can ripple into other fixtures; fix any stragglers inline). All green.
- [ ] **Step 7: Commit** `feat(pulse): wire equipment profiles into the setup flow`.

---

### Task 3: Tune-panel equipment picker (`TuneYourPlanPanel`)

**Files:**
- Modify: `src/components/pulse/TuneYourPlanPanel.tsx`
- Modify: `src/components/pulse/OnboardingModal.tsx`, `src/components/pulse/GenerateRoutineButton.tsx` (supply `onManageEquipment`)
- Modify (test): `src/components/pulse/__tests__/TuneYourPlanPanel.test.tsx`

**Panel changes:**
- Add `equipmentProfiles` to the `usePulse` destructure; import `equipmentKey` from utils, `EquipmentKey` / `EquipmentProfile` from types. Add an optional `onManageEquipment?: () => void` to `Props`.
- State: `const [equipment, setEquipment] = useState<Set<EquipmentKey>>(() => new Set(answers.equipment));`
- `const eqKey = equipmentKey(equipment);` Add `equipmentKey: equipmentKey(answers.equipment)` to the `applied` snapshot and `eqKey !== applied.equipmentKey` to `dirty`.
- `applyChanges`: pass `{ ...answers, equipment }` as the first arg to `generateRoutine`; on success include `equipmentKey: eqKey` in the new `applied` snapshot.
- Render an **Equipment** section (only when `equipmentProfiles.length > 0`), placed first among the pickers (after the intro, before "Change split"): a `SECTION_LABEL` "Equipment", a chip row (each chip `aria-pressed` when `equipmentKey(p.equipment) === eqKey`, `onClick` sets `equipment = new Set(p.equipment)`, disabled while `regenerating`), and a "Manage in Profile" link rendered only when `onManageEquipment` is provided (calls it; disabled while regenerating).

**Consumer changes:** supply `onManageEquipment`:
- `GenerateRoutineButton`: `onManageEquipment={() => { setOpen(false); setTuning(null); handingOffRef.current = false; navigate('profile'); }}`
- `OnboardingModal`: `onManageEquipment={async () => { await completeOnboarding(); dismissOnboarding(); navigate('profile'); }}`

- [ ] **Step 1: Update the default `usePulse` mock** in `TuneYourPlanPanel.test.tsx` to include `equipmentProfiles: []` (keeps the section hidden for existing tests). Add failing tests: with two profiles, the Equipment section + chips render and the chip matching `answers.equipment` is `aria-pressed`; picking a different chip enables Apply and regenerates with `expect.objectContaining({ equipment: new Set([...]) })` as the first arg; "Manage in Profile" calls `onManageEquipment`; no profiles -> no Equipment section.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the panel + consumer changes.
- [ ] **Step 4: Run panel tests, verify pass.** Confirm the existing regenerate assertions still pass: `{ ...answers, equipment: new Set(answers.equipment) }` deep-equals `baseState.answers` when equipment is unchanged (Vitest compares Set contents). If any assertion is reference-sensitive, switch it to `expect.objectContaining`.
- [ ] **Step 5:** `bun run typecheck` then the **full suite**. All green.
- [ ] **Step 6: Commit** `feat(pulse): add equipment-profile picker to Tune your plan`.

---

### Task 4: Finish ritual (roadmap + CLAUDE.md sync)

**Files:** `docs/roadmap.md`, `CLAUDE.md`

- [ ] Roadmap: set `In progress:` back to `(none)`; set `In review (...)` to Branch B on `feature/equipment-profiles-generation`; add a dated Shipped bullet; update the test count; note travel mode (#322) as the next equipment step.
- [ ] CLAUDE.md: update the Equipment profiles paragraph from "Branch A shipped, generation wiring is Branch B" to Branch B shipped: the setup-flow pre-fill + quick-pick chips + save-as, the Tune-panel chip-pick, the three `utils.ts` helpers, the new flow props, and that the engine is unchanged.
- [ ] `bun run test:run && bun run typecheck` once more, all green.
- [ ] Commit `docs(roadmap): ship equipment profiles Branch B (generation wiring)`.

---

## Self-Review

- **Spec coverage:** pre-fill resolution rule -> Task 1 helper + Task 2 wiring (+ dedicated 3-branch test incl. delete-the-last / stale-active path in Task 1); quick-pick chips + "From your X profile" hint + v1/v2 comment -> Task 2; "Save as profile" creates-only, appears only when selection matches no saved set -> Task 2; no-profiles = today's checkboxes -> Task 2 (gated on `showProfiles`); stale-active-mid-flow safe-by-snapshot -> Task 2 lazy initializer + comment; Tune-panel chip-pick + "Manage in Profile" + in-place regenerate -> Task 3; engine unchanged / golden tests green -> covered by running the full suite (no engine edits).
- **Type consistency:** `EquipmentProfile { id, name, equipment, created_at }` and `EquipmentKey` used identically across utils, flow props, consumers, and panel. `resolveEquipmentPrefill` / `equipmentKey` / `matchingProfileId` signatures match their call sites. `onCreateEquipmentProfile` matches the context's `createEquipmentProfile` signature `(name, equipment) => Promise<EquipmentProfile>`.
- **No placeholders:** every task names exact files, the helper code is complete, and each test list enumerates concrete cases with the assertion strategy.
