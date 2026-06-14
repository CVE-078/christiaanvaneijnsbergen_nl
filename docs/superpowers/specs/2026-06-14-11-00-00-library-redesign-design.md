# Library redesign, design spec

Date: 2026-06-14
Branch: `feature/library-redesign`
Status: design approved (mockups locked via the visual companion); reconciled against the Claude.ai (UX/IA) and Perplexity (architecture/evidence) review loop on 2026-06-14 (see section 14). Pending final spec sign-off.

## 1. Context and goal

The Library is the only major Pulse view that never had a redesign pass (Train, Plan, Progress, and Profile all did). Its backlog (the 2026-06-12 page-depth review) is real and unbuilt, and the metadata that makes a rich Library possible (`movement_pattern`, `equipment`, `is_compound`, `substitution_class`, `contraindications`, plus equipment profiles and movement restrictions) only landed recently.

This redesign is **hygiene, not moat**. The moat is adaptive generation and completion-paced progression; the Library is table-stakes findability and consistency cleanup. It touches the moat in exactly two places, and those are the genuinely high-value moves: the **custom-exercise-into-generation-pool** path (data quality) and **favorites floating in the swap/add pickers** (real friction reduction). Scope is held to that plus the consistency fixes; it must not balloon.

Goals:

- Make the exercise catalog findable (search + filters) and informative (metadata on rows + a detail sheet).
- Let favorites float in the Library and in the swap/add pickers.
- Let custom exercises carry generation metadata so they enter the generation pool.
- Fold the redundant Templates tab into a New-routine chooser; restyle the Routines tab.
- Fix two consistency defects: the Library tabs adopt the shared solid `SegmentedTabs`; the bespoke `ExerciseInstructionModal` is rebuilt on the shared `ModalSheet`.

Non-goals (v1): per-muscle fine search, `substitution_class` / `contraindications` input on custom exercises, template preview-before-clone beyond today's flow, a teardown of the routine exercise editor, and list virtualization or pagination.

## 2. Information architecture (decision: B)

Two tabs: **Exercises** and **Routines**. The Templates tab is removed and folded into a New-routine chooser as "Start from a template".

Rationale (corrected per the review): **Library is the authoring surface, Plan is the execution surface.** Exercises are ingredients, routines are recipes; both are authored in the Library. Plan is the active program in motion. Templates are a routine-creation path, so they belong behind "+ New routine", surfaced at the moment of intent, not as a standing browse tab. Routines stays in Library because it is authoring, not because we want to avoid reopening Plan (that earlier framing was rejected as a boundary that would drift).

Decision record: options A (Library = catalog only, Routines manager moves to Plan) and C (Library = browse, Routines moves to Plan) were considered and rejected; Routines is authoring and stays in Library.

## 3. Exercises tab

### 3.1 Toolbar (layout A)

- One row: a full-width **search** field plus a single **filter icon** button. Search filters across name + category + equipment, client-side over the already-loaded list. Category is the muscle dimension users reason in ("chest", "back", "legs").
  - Known v1 limitation (named deliberately): category is coarse, so `legs` and `shoulders` collapse quad/hamstring and front/rear-delt. Category-search cannot reach "hamstrings", "rear delts", or "glutes vs quads", which are among the most-wanted targeted searches. Acceptable for v1 (muscles live in a separate table); see section 13.
- The filter icon opens **advanced filters** (a popover on desktop, a `ModalSheet` on mobile, mirroring the `Why` affordance's responsive pattern): **Favorites**, **Fits my gear**, **Respects my restrictions**, **Show hidden**. The icon shows an active-count badge; active filters also render as removable chips below the toolbar, so the default view stays calm.
  - **Fits my gear**: `hasEquipment(ex, effectiveSet)`, where `effectiveSet` is the active equipment profile with the travel overlay applied, via `resolveEquipmentPrefill`. When on, the chip names the active profile ("Fits my gear: Home") so the user is never surprised by a transient travel overlay silently shaping results.
  - **Respects my restrictions** (renamed from "Safe for me"): hides exercises where `isContraindicated(ex, profile.movement_restrictions)`. The honest label avoids implying a medical safety guarantee from a coarse heuristic tag.
  - **Show hidden**: the existing hidden-exercise behavior.
- **+ New** sits on the results/count line (right-aligned), opening the New-exercise sheet. It is deliberately not in the search row, since creating an exercise is an occasional action.

### 3.2 List (grouped)

- The existing category chips (`FilterChips`) narrow to one category; "All" shows the grouped view.
- Grouped view: a pinned **Favorites** section (when any exist), then one section per category with a header and a count. An active search filters across everything and flattens to the matches. Inside a category group, the row metadata omits the redundant category token (it is implied by the section); the flattened search view keeps category on the row (it is informative there).
- **Empty-results state** (required): Fits-my-gear plus Respects-my-restrictions plus a query can easily return nothing, especially for a dumbbell-only or restricted user. The empty state names the active filters responsible and offers a one-tap clear ("No matches with Fits my gear + Respects my restrictions on. Clear filters"). Distinct from the genuinely-empty catalog state.
- Desktop (>= 1024px): section headers span full width; the rows under each header render in a 2-column grid, filling the 1000px container. Mobile and tablet: single column (the app caps content at 600px until 1024px).
- Row: a favorite star + the name + a metadata line (equipment, compound vs isolation, and category when in the flattened search view) + a chevron. Hidden rows are dimmed (only visible when Show hidden is on). Tapping the row opens the detail sheet.
- Performance: all exercises arrive in a single cached SWR query (`loadExercises`, no limit, ~94 today). Rendering ~100-150 simple rows is well under a frame; no virtualization or pagination (confirmed by the review: virtualization pays off at ~500-1,000+ rows and its overhead is unjustified here). Grouping is for scannability, not performance.

### 3.3 Detail sheet (`ModalSheet`)

Tapping a row opens a `ModalSheet` (bottom sheet on mobile/tablet, centered modal on desktop), with the standard visible close control (the grip alone is not relied on):

- Metadata badges: category, equipment, compound vs isolation, movement pattern.
- Targets: primary and secondary muscles, from `exercise_instructions` (global exercises only).
- How to: the cues, from `exercise_instructions`. Omitted for custom exercises, which have none.
- **Similar exercises** (renamed from "Swap options"): same-`substitution_class` exercises, ranked by `rankSubstitutes`, display-only. "Swap" is reserved for the mid-session replace action; in browse context this is "Similar exercises" so it does not train the wrong expectation.
- Actions: **Favorite** and **Hide** are **mutually exclusive** (see section 6, the preference is a single tri-state). The UI reflects this: favoriting an exercise clears any hidden state and vice versa, shown explicitly (no silent un-hide). For custom exercises, Edit and Delete.
- Opening **Edit** dismisses the detail sheet and opens the form sheet (sequential, not stacked, see section 5).

### 3.4 New / Edit exercise sheet (`ModalSheet`)

- Opened from **+ New** (empty, no Delete) or from a custom exercise's detail-sheet **Edit** (pre-filled, with Delete). The detail sheet closes first; the two sheets are never stacked.
- Basics: name, category (editable, including in edit mode, which today's inline edit cannot do), default sets, and default reps as a **from/to range** (two fields; an empty "to" means a single target).
  - Reps compose to the existing `default_reps` string on save and parse back on open, so no schema change. **Parse-failure fallback** (required, data-integrity): if an existing `default_reps` does not match the "min-max" or single-number shape (for example "AMRAP", "8 to 12", or freeform), the sheet shows the raw value in a single free-text field instead of forcing it into two numeric fields, so editing cannot corrupt a non-standard value on save.
- A **"Use in auto-generated routines"** toggle, default **off**. Off means logging-only (today's behavior); the sheet shows a quiet line on logging-only customs ("Logging only, won't appear in generated plans") so the user is not surprised when a generated routine omits their lift. On reveals: movement pattern (friendly labels over `MovementPattern`), an equipment multi-select (`EquipmentKey`), and a compound/isolation choice. These write to the existing `exercises` columns so the lift enters the generation pool.
- **Category-change awareness** (data-integrity): category drives per-muscle volume, so changing the category of a custom exercise that already has logged history retroactively rewrites past Progress analytics. A category change on an exercise with history asks for confirmation, naming the effect.
- Global catalog exercises stay read-only (favorite/hide only). Edit and Delete are custom-only.
- `substitution_class` and `contraindications` are out of v1.

## 4. Routines tab (Plan B, see section 11)

- Restyled cards (treatment A): the name plus an **Active** badge on the active routine; session-type chips showing the split; for the active routine a block-progress bar with "Week N of M"; for the others a meta line (days/week, length).
  - Single-source progress: the active card's week/progress reads from the **same `programPosition` in context** that the Plan page uses. It is not re-derived independently, so the two surfaces cannot show different week numbers.
- **+ New routine** opens a chooser `ModalSheet`: **Generate** (the existing `RoutineSetupFlow`, recommended), **Start from a template** (the folded-in template browser, then clone), and **Ad-hoc routine** (name it and add exercises yourself).
  - Caveat (internal): the Ad-hoc path opens the legacy exercise editor, which this redesign leaves untouched. It is the weakest downstream of the three doors; acceptable as a rare escape hatch, flagged so expectations are set until the editor is addressed.
  - The nested template browser on a 600px column is deep; its in-sheet filter set will be trimmed (or the nesting reconsidered) during Plan B design.
- Tapping a routine opens a manage sheet (`ModalSheet`): Set active, Rename, Delete, a session preview; the existing exercise editor is reachable here. Lighter-touch: a restyle plus the fold-in, not a teardown of the editor.
- `TemplatesTab` is removed as a tab; its filter, list, and clone logic is reused inside the chooser's template step.

## 5. Consistency fixes

- The Library tabs adopt the shared `SegmentedTabs` with `variant="solid"`, matching Progress and Profile exactly, replacing the custom pill buttons currently inline in `LibraryView`.
- The exercise detail/instructions modal is rebuilt on the shared `ModalSheet`, replacing `ExerciseInstructionModal`'s bespoke `fixed inset-0` shell. Every `ModalSheet` keeps its standard visible close control (not the grip alone), for screen-reader and keyboard access.
- **No stacked sheets.** Detail to Edit, and the filter control and chooser, dismiss the prior surface before opening the next (sequential), per the bottom-sheet guidance.

## 6. Data, state, and actions

- **Favorites (tri-state, mutually exclusive)**: `user_exercise_preferences` is one row per (user, exercise) keyed `onConflict: 'user_id,exercise_id'` with a single `preference`. So preference is a single tri-state: none, `'hidden'`, or `'favorite'`. Hidden and favorite are opposite intents and cannot coexist by construction; the UI enforces and shows this (section 3.3). Extend `ExercisePreference` to `'hidden' | 'favorite'`, add a favorite write path, and expose `favoriteExerciseIds` + a toggle through the context/hook. Favorites float to the top of the swap and add pickers (`ExerciseSwapPicker`, `AddRoutineExerciseForm`). Migration: see section 9.
- **Custom-exercise metadata**: extend `createExercise` / `updateExercise` to accept optional `movement_pattern`, `equipment`, and `is_compound`. Columns already exist on `exercises`, so no schema change. When the generation toggle is off, these stay null (logging-only; the generator skips pattern-less exercises as today).
  - Data-quality risk (documented): a layperson hand-tagging `movement_pattern` is the exact mis-tag class the Phase 0 muscle-bridge work corrects (for example tagging a cable crossover as a back movement miscredits volume). Acceptable at current scale (two users who know the taxonomy); the friendly-label dropdown mitigates. Open question for scale, deferred (section 13): whether a user-tagged custom should contribute to volume analytics identically to curated exercises, or be flagged/discounted.
- **Filters and search**: pure, testable helpers, for example `filterExercises(list, { query, category, favorites, fitsGear, respectsRestrictions, showHidden, equipmentSet, restrictions })` and `groupByCategory(list)`. They reuse `hasEquipment`, `isContraindicated`, and `resolveEquipmentPrefill`. This keeps `ExercisesTab`'s new dependency on those helpers behind a single, testable seam rather than scattered through the component.
- No change to `loadExercises` (the single cached query stands).

## 7. Components and files

- `LibraryView`: two tabs, solid `SegmentedTabs`.
- `ExercisesTab`: rebuilt (toolbar, filters, grouping, rows). New components: `ExerciseFilterControl` (popover on desktop / `ModalSheet` on mobile), `ExerciseRow`, `ExerciseDetailSheet` (`ModalSheet`), `ExerciseFormSheet` (`ModalSheet`, shared by add and edit). `ExerciseInstructionModal` is removed; its content moves into `ExerciseDetailSheet`.
- `RoutinesTab` (Plan B): restyled cards plus a New-routine chooser (`ModalSheet`) and a routine manage sheet (`ModalSheet`); the template browser is reused inside the chooser.
- `TemplatesTab` (Plan B): removed as a tab; its logic is reused in the chooser.
- Pure helpers: a new `src/lib/pulse/library.ts` for the filter, search, group, and favorites helpers.
- Actions: `exercises.ts` extended (create/update metadata; favorite via the existing preference action). The exercises wiring in the provider/context exposes `favoriteExerciseIds` and the toggle.
- Types: the `ExercisePreference` union is extended.

## 8. Testing

- Pure helpers, unit-tested: query match across name/category/equipment; fits-my-gear via `hasEquipment`; respects-restrictions via `isContraindicated`; favorites float; grouping plus counts; hidden visibility; the favorite/hidden mutual-exclusivity transition; reps range parse/compose round-trip including the non-conforming fallback; the empty-results-vs-empty-catalog distinction.
- Component tests: `ExercisesTab` (search, filter toggles, grouping, empty-results state, row to detail), `ExerciseFormSheet` (toggle reveals metadata, edit pre-fill including category, the two-field reps + fallback, the category-change confirmation), `RoutinesTab` (chooser paths, card states), and the `SegmentedTabs` / `ModalSheet` integration.
- Accessibility tests where practical: form labels, `aria-checked` on filter toggles, `aria-pressed` on the favorite star, the active-filter live region.
- Per the no-server-action-test-harness rule (actions hit Supabase), action validation is covered through the hook/component layer, not via action unit tests.

## 9. Migration

- Favorites preference value: a small additive migration to allow `'favorite'` if the `user_exercise_preferences.preference` column is CHECK-constrained (verify against the live schema first; the schema-in-VCS baseline from #125 is the reference). User-scoped, RLS already in place. The action's `preference !== 'hidden'` guard is widened to accept `'favorite'`.
- No `exercises` schema change (the metadata columns already exist).

## 10. Accessibility and internationalization

- Reps from/to: each input has its own `<label>`; the "empty to = single target" hint is wired via `aria-describedby`, not a second visual label on one field.
- Filter control: the active-count badge is announced (`aria-live="polite"`); each filter toggle exposes `aria-checked`.
- The favorite star exposes `aria-pressed`; the row chevron has an explicit `aria-label` ("Open details") rather than relying on the visual glyph.
- Grouped list section headers are real headings with a logical level.
- `ModalSheet` instances keep a visible, focusable close control.
- i18n: movement-pattern friendly labels, equipment labels, category labels, and any muscle strings surfaced in the detail sheet route through the canonical copy seam (the app's single-source i18n seam), so no parallel string path is introduced.

## 11. Sequencing (split into two plans)

Both reviewers recommend splitting; adopted.

- **Plan A (v1), Exercises tab.** Toolbar + search, the filter control, the grouped list + empty state, the detail sheet, the add/edit form sheet, favorites (incl. the migration and picker-float), custom-exercise generation metadata, and the two consistency fixes (`SegmentedTabs`, `ModalSheet`). This closes the Exercises backlog and the consistency defects and has standalone value.
- **Plan B (post-v1), Routines tab + Templates fold-in.** The restyled routine cards + manage sheet and the New-routine chooser with the folded-in template browser. The Templates fold-in carries a dependency on the still-open templates-role decision, and the nested-template-browser depth needs its own design pass, so it should not gate Plan A.

Hidden dependencies to verify during Plan A: favorites-in-pickers requires `ExerciseSwapPicker` / `AddRoutineExerciseForm` to read `favoriteExerciseIds` (test the integration); the custom-metadata write requires the `exercises` columns (verified present); the favorites migration requires the live CHECK-constraint check.

## 12. Decisions recorded (from the mockup loop)

- IA = B: two tabs, Templates folded into the New-routine chooser; Routines stays in Library as the authoring surface.
- Toolbar = A: search + a separate filter icon, New on the results line.
- Tabs = solid `SegmentedTabs`; detail/instructions on `ModalSheet`.
- Custom-exercise generation toggle defaults off.
- Reps entered as a from/to range.
- Routine card = treatment A (split chips + progress bar).
- "Ad-hoc routine" wording (not "Blank routine").
- Detail = bottom sheet on mobile/tablet, centered modal on desktop; list grouped by category; desktop rows in a 2-column grid.

## 13. Deferred and future

- Per-muscle fine search (would need muscles denormalized onto the exercise list, or loading instructions for all). The category-search coarseness (section 3.1) is the known v1 gap.
- `substitution_class` / `contraindications` input on custom exercises (extract an `ExerciseGenerationMetadataForm` if added).
- Whether user-tagged custom exercises should contribute to volume analytics identically to curated ones, or be flagged/discounted (the mis-tag risk, section 6).
- Template preview-before-clone and the in-sheet template-filter depth (Plan B design).
- Routine exercise editor teardown (the Ad-hoc path's weak downstream).

## 14. Review reconciliation (2026-06-14)

Reviewed by Claude.ai (UX/IA lens) and Perplexity (architecture + cited evidence). Both independently recommended the scope split and confirmed the no-virtualization call.

**Adopted (folded into the spec above):**
- Scope split into Plan A (Exercises) / Plan B (Routines + Templates). [both]
- Favorite/Hidden modeled as a mutually-exclusive tri-state; UI shows the exclusivity, no silent un-hide. [Claude.ai must-fix; grounded in the confirmed one-row-per-pair model]
- Reps parse-failure fallback for non-conforming existing `default_reps`. [Claude.ai must-fix, data-integrity]
- Empty-results state naming the active filters + one-tap clear. [Claude.ai must-fix]
- "Safe for me" renamed to "Respects my restrictions" (honest, non-medical claim). [Claude.ai must-fix]
- IA rationale corrected to authoring-vs-execution, not "avoid touching Plan". [Claude.ai]
- "Swap options" renamed to "Similar exercises" in browse context. [Claude.ai]
- Active-routine progress reads the single shared `programPosition`, no divergent re-derivation. [Claude.ai]
- Category-change-on-history confirmation; logging-only signal line; "Fits my gear" names the active profile; redundant category token dropped inside its group; category-search coarseness named. [Claude.ai]
- Accessibility set: reps labels + `aria-describedby`, `aria-live` filter badge, `aria-checked` toggles, `aria-pressed` favorite, heading-level section headers, visible close, i18n labels. [Perplexity, evidence-backed]
- No stacked `ModalSheet`s (sequential dismissal). [Perplexity, evidence-backed]
- Custom mis-tag / volume-analytics risk documented with a deferred mitigation question. [Claude.ai]

**Confirmed, no change:** no virtualization at ~100 rows (pays off at 500-1,000+); generation toggle default off; bottom-sheet (mobile) vs centered modal (desktop); the pure-helper seam and `src/lib/pulse/library.ts` boundary.

**Dismissed / deferred:**
- Two independent booleans for favorite + hidden: dismissed in favor of the tri-state (opposite intents; additive migration; matches the existing one-row-per-pair model).
- In-sheet template-filter trimming and the Ad-hoc-editor weakness: deferred to Plan B (not in Plan A scope).
- Custom-exercise volume-analytics discounting: deferred (acceptable at two users; revisit at scale).
