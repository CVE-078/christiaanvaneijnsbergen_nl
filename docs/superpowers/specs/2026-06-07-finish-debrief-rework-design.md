# Finish / debrief screen rework, design

Date: 2026-06-07
Status: approved design, ready for implementation plan
Mockup: `docs/superpowers/designs/2026-06-07-12-00-00-finish-debrief.html`

## Goal

Rework the post-workout screen (today's `ShareCard`) from a screenshot-only stats card into a **debrief-first** screen that:

1. Captures how the session felt: a **session RPE (1-10)** and an optional **free-text note**.
2. Shows a **coach summary** built from data already shipped: the engine's decisions (progressions / auto-deload / ramp-back from the `DecisionEvent` log), PRs, sets / tonnage / duration, and the muscles this session hit.
3. Gives a general UX pass, with **real image export** (download / native share) demoted to a secondary action.

The new signal (RPE + notes) feeds the active validation block; the coach summary makes the adaptive intelligence visible at the moment it matters.

## Non-goals

- No social feed / followers / public profiles (Pulse stays not-a-social-network). Sharing is a manual, user-initiated image export only.
- No LLM-generated summary. The coach read is a deterministic, rule-based sentence.
- No changes to per-set logging, the adaptive engine, or how decisions are generated.
- Editing a re-opened session's debrief is out of scope (the debrief shows once, on fresh completion, matching today's ShareCard behavior).
- Surfacing RPE / notes in the History view is a follow-up (noted at the end), not part of this spec.

## Primary decisions (from brainstorming)

| Decision | Choice |
| --- | --- |
| Primary job | Private debrief first; sharing secondary |
| Rating | Session RPE 1-10, optional, gauge-style selector with Easy/Hard/Max anchors |
| Summary scope | Session-scoped + decisions (not weekly/program context) |
| Layout | Single scrollable overlay (Approach A) |
| Share | Real image export (PNG) of a clean, export-only card |

## Data model

New migration `docs/migrations/<timestamp>-session-debrief.sql` adds two nullable columns to `workout_sessions`:

- `session_rpe smallint` with `check (session_rpe between 1 and 10)`, nullable.
- `session_note text` with `check (char_length(session_note) <= 1000)`, nullable.

Both nullable so completing without rating/notes stays valid. Existing RLS policies on `workout_sessions` already scope by `user_id`; the new columns need no policy change. Apply manually in the Supabase SQL editor (no migration runner in this repo).

`WorkoutSession` in `src/lib/pulse/types.ts` gains `session_rpe: number | null` and `session_note: string | null`.

## Persistence & API

- Extend the existing session PATCH route (`src/app/api/pulse/sessions/[id]/route.ts`) to accept an optional `{ rpe?: number | null, note?: string | null }` body and update those columns (server-side validation: rpe integer 1-10 or null; note trimmed, <= 1000 chars or null).
- Add a `saveSessionDebrief(sessionId, { rpe, note })` path used by **Done**. The save is **best-effort**, consistent with how `completeSession` already works (not routed through the offline write queue): on failure show a toast, but still dismiss (the session is already completed; the debrief is enrichment). Optimistic local update of the session object so History/derived state see it immediately.
- "Done" with no rating and no note touches nothing (no-op PATCH skipped).

## Pure logic (src/lib/pulse/utils.ts)

Add session-scoped pure functions (unit-tested, no React), composed into one `computeSessionSummary` so the component stays thin:

- `computeSessionTonnage(session, exercises, logs, week, unit)` -> total `kg × reps` over this session's saved sets (bodyweight sets contribute their added load only, which is 0 for pure bodyweight; documented).
- `computeSessionMuscleVolume(exercises, logs, week)` -> session-scoped fractional per-muscle sets, reusing the existing accumulation helper behind `computePerMuscleVolume` but limited to this session's logged sets. Returns top muscles for the chips.
- `sessionDecisions(decisions, week, exerciseIds)` -> filters the `DecisionEventRow[]` log to this session: `week === session week` AND `affectedArea ∈ exerciseIds` (program-wide ramp-back, `affectedArea === ''`, is matched on week alone). Buckets into `{ progressions, deloads, rampBack }`. (Decisions are stored per routine + week + affected exercise, not by `session_id`; week + exercise membership is the correct proxy because decisions are generated at set-save during the session.)
- `composeCoachRead(summary)` -> deterministic one-line sentence chosen from: PR count, progression count, deload presence, ramp-back presence, else the steady/on-plan fallback. A small, ordered rule set; pure and fully testable.
- Extend / wrap `computeShareStats` so `computeSessionSummary` returns everything the screen needs: `workoutLabel`, `date`, `durationMin`, `totalSets`, `tonnage`, `topLifts` (with `isPR`), `prCount`, `decisions` (bucketed), `muscles` (top N with fractional sets), `coachRead`.

## Components

- **`FinishDebrief`** (rework of `ShareCard.tsx`, kept as the single overlay): renders the debrief layout from the mockup, header -> RPE -> notes -> coach summary (stat tiles, "what adapted" list or steady panel, muscle chips) -> actions. Holds local `rpe` / `note` state; calls `saveSessionDebrief` then `onDismiss` on Done. Props extend today's: it already receives `session, completedAt, exercises, logs, prMap, week, unit, onDismiss`; add the `decisions` feed (from `usePulse`/`useDecisionEvents`) and the save callback.
- **`RpeScale`** subcomponent: the 1-10 gauge selector (fills up to the selected value, anchors, plain-language read line). Self-contained, controlled via `value` / `onChange`.
- **`ShareImageCard`**: a clean, export-only card (workout label, date, top lifts, PRs, tonnage, branding, no notes/RPE). Rendered off-screen (e.g. fixed, `aria-hidden`, off-viewport) so it can be rasterized without flashing on screen.
- **Trigger unchanged**: `LogView` still snapshots the freshly completed session and renders the overlay (the `shareSession` state path stays; only the rendered component changes).

## Image export

- Add `html-to-image` (lighter than html2canvas) and use `toPng(node)` on the `ShareImageCard` ref.
- Share flow: if `navigator.canShare?.({ files })` is available (mobile), call `navigator.share` with the PNG `File`; otherwise trigger a download via an `<a download>` blob link (desktop). Wrap in try/catch; a user-cancelled share is a no-op, a real failure shows a toast.
- Fonts are self-hosted via `next/font` (same-origin), so `html-to-image` can inline them without a cross-origin fetch. Verify the `/pulse/*` CSP in `next.config.mjs` allows the generated `data:`/`blob:` image (`img-src` already permits `data:`; confirm `blob:` for the download link and that no `connect-src` addition is needed). Document any CSP change in the implementation.

## Testing

- Pure functions: `computeSessionTonnage` (incl. bodyweight = added load only, empty session = 0), `computeSessionMuscleVolume` (fractional, top-N ordering), `sessionDecisions` (week + exercise filtering, program-wide ramp-back on week alone, buckets), `composeCoachRead` (each rule branch: PR, progression, deload, ramp-back, steady fallback).
- `RpeScale`: renders 10 options, click sets value, gauge fill reflects value, read line text.
- `FinishDebrief`: rich state renders PRs + decisions; quiet state renders the steady panel (no empty list); Done with an RPE calls `saveSessionDebrief` with the value then `onDismiss`; Done with nothing dismisses without a PATCH; dismiss is always possible.
- Image export: unit-test the `ShareImageCard` data composition; the export click handler is tested with `html-to-image` mocked (assert it's called with the node and that share/download is attempted) — canvas rasterization itself is not asserted.

## Edge cases

- Zero / invalid duration -> `0 min` (existing `computeShareStats` behavior).
- No PRs and no decisions -> steady "nothing needed adjusting" panel, encouraging copy.
- Superset exercises -> counted individually in tonnage / muscle volume / decisions like any other exercise.
- Pure bodyweight session -> tonnage may read low/0; copy and stat label tolerate this (tonnage reflects external load).
- Re-opened session -> no debrief shown (unchanged), so no stale RPE prompt.

## Follow-ups (out of scope, noted for the roadmap)

- Show the captured RPE + note read-only in the History session detail.
- Use session RPE × duration as a session-load signal in the adaptive engine (a generation Phase 3 idea this unlocks).
