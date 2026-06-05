# Program start-day selection + false-"behind" fix — design

Date: 2026-06-05
Status: approved (scope), ready for implementation
Branch: `feature/program-start-day`

## Problem

Two issues with the adaptive-regen adherence overlay:

1. **False "behind".** `computeProgramPosition` counts a session scheduled for **today** as already-expected (`countWeekdayInRange` is inclusive of `today`), so a routine reads "behind" on the very day a session is due, before that day is over. This contradicts `computeWeekAdherence`, which already treats a session due today as `upcoming` (strict `< today`).
2. **No control over when the program starts.** `program_anchor` is auto-set to the first completed session and is not user-adjustable, so a user can't say "start my program today / on this date."

## Decisions (approved scope)

Fix the false "behind" **and** add an explicit, user-settable program start date.

## 1. Fix the over-count (`src/lib/pulse/adherence.ts`)

In `computeProgramPosition`, count only days **strictly before today** as expected:

```
const expectedSessions = schedule.reduce(
    (sum, e) => sum + countWeekdayInRange(start, today - 1, e.day_of_week),
    0,
);
```

`countWeekdayInRange` already returns 0 when `end < start`, so on day 1 (today === start) `expectedSessions` is 0 and the routine is never "behind" before any day has passed. This aligns `behindBy` with `computeWeekAdherence`'s `missed` set.

## 2. Settable start date

- **Action** (`src/app/pulse/actions/routines.ts`): `setProgramAnchor(id: string, anchorISO: string)` — `assertUuid(id)`, validate `anchorISO` is a finite date, update `workout_routines.program_anchor` for the owning user. Mirrors `updateRoutineProgramWeeks`.
- **Hook** (`src/hooks/pulse/useRoutines.ts`): `setProgramAnchor(id, anchorISO)` — optimistic `mutateRoutines` patch of `program_anchor`, call the action, revalidate. Mirrors `updateRoutineProgramWeeks`.
- **Context** (`PulseContext` + provider): expose `setProgramAnchor`.
- **UI** (`src/components/pulse/views/ProgramView.tsx`): a "Program start" row in the header card, below "Program length". A native `<input type="date">` showing the current anchor's date (or empty), plus a "Today" quick button. On change, set the anchor to **noon UTC of the chosen date** (`new Date(`${value}T12:00:00Z`).toISOString()`) so the calendar date resolves consistently across timezones. A short hint: "When week 1 begins. Changing it only re-aligns your schedule, not your logged progress."

**Non-destructive:** the anchor drives only the calendar overlay (`calendarWeek`, `expectedSessions`, the adherence window). Program progression (`weekInteger`) is completion-paced from logged sessions and is unaffected, so changing the start date never alters logged data or which week you're on.

## Footprint

One-line engine fix + action + hook + context + one UI row. **No migration** (`program_anchor` exists).

## Testing

- `adherence.test.ts`: a session scheduled for today, not yet done, is **not** "behind" (status `on_track`, `behindBy` 0); a session whose day has passed without a matching session **is** counted (`behindBy` > 0 / `behind`).
- Action/UI: `setProgramAnchor` validates input; ProgramView renders the start-date control and calls `setProgramAnchor` on change (component test).
