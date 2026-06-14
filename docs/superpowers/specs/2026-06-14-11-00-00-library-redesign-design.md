# Library redesign, design spec

Date: 2026-06-14
Branch: `feature/library-redesign`
Status: design approved (mockups locked via the visual companion), pending spec review.

## 1. Context and goal

The Library is the only major Pulse view that never had a redesign pass (Train, Plan, Progress, and Profile all did). Its backlog (the 2026-06-12 page-depth review) is real and unbuilt, and the metadata that makes a rich Library possible (`movement_pattern`, `equipment`, `is_compound`, `substitution_class`, `contraindications`, plus equipment profiles and movement restrictions) only landed recently. This redesign closes the findability, metadata, favorites, and custom-into-generation gaps, and fixes two consistency defects, while leaving the just-shipped Plan page untouched.

Goals:

- Make the exercise catalog findable (search + filters) and informative (metadata on rows + a detail sheet).
- Let favorites float in the Library and in the swap/add pickers.
- Let custom exercises carry generation metadata so they enter the generation pool.
- Fold the redundant Templates tab into a New-routine chooser; restyle the Routines tab.
- Fix two consistency defects: the Library tabs adopt the shared solid `SegmentedTabs`; the bespoke `ExerciseInstructionModal` is rebuilt on the shared `ModalSheet`.

Non-goals (v1): per-muscle fine search, `substitution_class` / `contraindications` input on custom exercises, template preview-before-clone beyond today's flow, a teardown of the routine exercise editor, and list virtualization or pagination.

## 2. Information architecture (decision: B)

Two tabs: **Exercises** and **Routines**. The Templates tab is removed and folded into a New-routine chooser as "Start from a template".

Rationale: Exercises is a catalog you browse; Routines is your set of plans you manage; Templates is a routine-creation path, not a browse destination. Routines stays in Library rather than moving to Plan, to keep the freshly-redesigned Plan page lean (user decision).

Decision record: options A (Library = catalog only, Routines manager moves to Plan) and C (Library = browse, Routines moves to Plan) were both considered and rejected, to avoid reopening the Plan page so soon after #140.

## 3. Exercises tab

### 3.1 Toolbar (layout A)

- One row: a full-width **search** field plus a single **filter icon** button (two elements, not three). Search filters across name + category + equipment, client-side over the already-loaded list. Category is the muscle dimension users reason in ("chest", "back", "legs"); finer per-muscle search is deferred (see section 11).
- The filter icon opens **advanced filters** (a popover on desktop, a `ModalSheet` on mobile, mirroring the `Why` affordance's responsive pattern): **Favorites**, **Fits my gear**, **Safe for me**, **Show hidden**. The icon shows an active-count badge; active filters also render as removable chips below the toolbar, so the default view stays calm.
  - **Fits my gear**: `hasEquipment(ex, effectiveSet)`, where `effectiveSet` is the active equipment profile with the travel overlay applied, via `resolveEquipmentPrefill`.
  - **Safe for me**: hides exercises where `isContraindicated(ex, profile.movement_restrictions)`.
  - **Show hidden**: the existing hidden-exercise behavior.
- **+ New** sits on the results/count line (right-aligned), opening the New-exercise sheet. It is deliberately not in the search row, since creating an exercise is an occasional action.

### 3.2 List (grouped)

- The existing category chips (`FilterChips`) narrow to one category; "All" shows the grouped view.
- Grouped view: a pinned **Favorites** section (when any exist), then one section per category with a header and a count. An active search filters across everything and flattens to the matches.
- Desktop (>= 1024px): section headers span full width; the rows under each header render in a 2-column grid, filling the 1000px container (no dead space). Mobile and tablet: single column (the app caps content at 600px until 1024px).
- Row: a favorite star + the name + a metadata line (category, equipment, compound vs isolation) + a chevron. Hidden rows are dimmed (only visible when Show hidden is on). Tapping the row opens the detail sheet.
- Performance: all exercises already arrive in a single cached SWR query (`loadExercises`, no limit, ~94 today). Rendering ~100-150 simple rows is well under a frame; no virtualization or pagination (premature at this scale, revisit only if the catalog reaches thousands). The grouping is for scannability, not performance.

### 3.3 Detail sheet (`ModalSheet`)

Tapping a row opens a `ModalSheet` (bottom sheet on mobile/tablet, centered modal on desktop):

- Metadata badges: category, equipment, compound vs isolation, movement pattern.
- Targets: primary and secondary muscles, from `exercise_instructions` (global exercises only).
- How to: the cues, from `exercise_instructions`. Omitted for custom exercises, which have none.
- Swap options: same-`substitution_class` exercises, ranked by `rankSubstitutes`, display-only (no replace action, since the user is not mid-session).
- Actions: Favorite (toggle), Hide/Unhide; for custom exercises, Edit and Delete.

This replaces the bespoke `ExerciseInstructionModal` (consistency fix, see section 5).

### 3.4 New / Edit exercise sheet (`ModalSheet`)

- Opened from **+ New** (empty, no Delete) or from a custom exercise's detail-sheet **Edit** (pre-filled, with Delete).
- Basics: name, category (editable, including in edit mode, which today's inline edit cannot do), default sets, and default reps as a **from/to range** (two fields; an empty "to" means a single target). Reps compose to the existing `default_reps` string on save and parse back on open, so no schema change.
- A **"Use in auto-generated routines"** toggle, default **off**. Off means logging-only (today's behavior). On reveals: movement pattern (friendly labels over `MovementPattern`), an equipment multi-select (`EquipmentKey`), and a compound/isolation choice. These write to the existing `exercises.movement_pattern` / `equipment` / `is_compound` columns, so the lift enters the generation pool.
- Global catalog exercises stay read-only (favorite/hide only). Edit and Delete are custom-only.
- `substitution_class` and `contraindications` are out of v1 (advanced, and not required to enter the pool).

## 4. Routines tab

- Restyled cards (treatment A): the name plus an **Active** badge on the active routine; session-type chips showing the split (for example Upper A, Lower A, Upper B, Lower B); for the active routine, a block-progress bar with "Week N of M"; for the others, a meta line (days/week, length).
- **+ New routine** (same toolbar placement as Exercises) opens a chooser `ModalSheet`: **Generate** (the existing `RoutineSetupFlow`, recommended), **Start from a template** (the folded-in template browser, then clone, today's flow), and **Ad-hoc routine** (name it and add exercises yourself).
- Tapping a routine opens a manage sheet (`ModalSheet`): Set active, Rename, Delete, a session preview, and the existing exercise editor is reachable here. This is the lighter-touch tab: a restyle plus the fold-in, not a teardown of the editor.
- `TemplatesTab` is removed as a tab; its filter, list, and clone logic is reused inside the chooser's template step.

## 5. Consistency fixes

- The Library tabs adopt the shared `SegmentedTabs` with `variant="solid"`, matching Progress and Profile exactly, replacing the custom pill buttons currently inline in `LibraryView`.
- The exercise detail/instructions modal is rebuilt on the shared `ModalSheet` (grip, standardized header, p-6 body, swipe-to-dismiss, Escape), replacing `ExerciseInstructionModal`'s bespoke `fixed inset-0` shell.

## 6. Data, state, and actions

- **Favorites**: extend `ExercisePreference` from `'hidden'` to `'hidden' | 'favorite'`, reusing the `user_exercise_preferences` table (user-scoped, RLS). Add a favorite write path (extend the preference action) and expose `favoriteExerciseIds` + a toggle through the context/hook. Favorites also float to the top of the swap and add pickers (`ExerciseSwapPicker`, `AddRoutineExerciseForm`). Migration: verify the `preference` column's CHECK constraint against the live schema; if it restricts to `'hidden'`, add `'favorite'` (additive, user-scoped). See section 9.
- **Custom-exercise metadata**: extend `createExercise` / `updateExercise` to accept optional `movement_pattern`, `equipment`, and `is_compound`. The columns already exist on `exercises`, so no schema change. When the generation toggle is off, these stay null (logging-only; the generator skips pattern-less exercises as it does today).
- **Filters and search**: pure, testable helpers, for example `filterExercises(list, { query, category, favorites, fitsGear, safe, showHidden, equipmentSet, restrictions })` and `groupByCategory(list)`. They reuse `hasEquipment`, `isContraindicated`, and `resolveEquipmentPrefill`.
- No change to `loadExercises` (the single cached query stands).

## 7. Components and files

- `LibraryView`: two tabs, solid `SegmentedTabs`.
- `ExercisesTab`: rebuilt (toolbar, filters, grouping, rows). New components: an exercise filter control (popover on desktop / `ModalSheet` on mobile), an exercise row, an exercise detail sheet (`ModalSheet`), and an exercise form sheet (`ModalSheet`, shared by add and edit). `ExerciseInstructionModal` is removed; its content moves into the detail sheet.
- `RoutinesTab`: restyled cards plus a New-routine chooser (`ModalSheet`) and a routine manage sheet (`ModalSheet`); the template browser is reused inside the chooser.
- `TemplatesTab`: removed as a tab; its logic is reused in the chooser.
- Pure helpers: a new `src/lib/pulse/library.ts` (or an extension of `utils.ts`) for the filter, search, group, and favorites helpers.
- Actions: `exercises.ts` extended (create/update metadata; favorite toggle). The exercises wiring in the provider/context exposes `favoriteExerciseIds` and the toggle.
- Types: the `ExercisePreference` union is extended.

## 8. Testing

- Pure helpers, unit-tested: query match across name/category/equipment; fits-my-gear via `hasEquipment`; safe-for-me via `isContraindicated`; favorites float; grouping plus counts; hidden visibility; reps range parse/compose round-trip.
- Component tests: `ExercisesTab` (search, filter toggles, grouping, row to detail), the exercise form sheet (toggle reveals metadata, edit pre-fill including category, the two-field reps), `RoutinesTab` (chooser paths, card states), and the `SegmentedTabs` / `ModalSheet` integration.
- Per the no-server-action-test-harness rule (actions hit Supabase), action validation is covered through the hook/component layer, not via action unit tests.

## 9. Migration

- Favorites preference value: a small additive migration to allow `'favorite'` if the `user_exercise_preferences.preference` column is CHECK-constrained (verify against the live schema first; the schema-in-VCS baseline from #125 is the reference). User-scoped, RLS already in place.
- No `exercises` schema change (the metadata columns already exist).

## 10. Decisions recorded (from the mockup loop)

- IA = B: two tabs, Templates folded into the New-routine chooser, Plan untouched.
- Toolbar = A: search + a separate filter icon, New on the results line.
- Tabs = solid `SegmentedTabs`; detail/instructions on `ModalSheet`.
- Custom-exercise generation toggle defaults off.
- Reps entered as a from/to range.
- Routine card = treatment A (split chips + progress bar).
- "Ad-hoc routine" wording (not "Blank routine").
- Detail = bottom sheet on mobile/tablet, centered modal on desktop; list grouped by category; desktop rows in a 2-column grid.

## 11. Deferred and future

- Per-muscle fine search (would need muscles denormalized onto the exercise list, or loading instructions for all).
- `substitution_class` / `contraindications` input on custom exercises.
- Template preview-before-clone (gated on the templates-role decision).
- Routine exercise editor teardown (out of scope; reused as-is in the manage sheet).
