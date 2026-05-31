# Desktop Layout Overhaul — Design Spec

**Date:** 2026-05-31
**Status:** Approved

## Goal

Replace the current horizontal top-nav bar on desktop (≥1024px) with a proper two-column layout: a fixed left sidebar and a scrollable content column. The mobile layout is unchanged.

## Layout Structure

Two-column flex layout filling the full viewport height:

```
┌──────────┬──────────────────────────────────┐
│ PULSE.   │  [view content — scrollable]     │
│ WK 07    │                                  │
│          │                                  │
│  Train ← │                                  │
│  Plan    │                                  │
│  Progress│                                  │
│  Profile │                                  │
│  Explore │                                  │
│          │                                  │
│ ┌──────┐ │                                  │
│ │PPL A │ │──────────────────────────────────│
│ │WK 07 │ │  REST  1:47  ██████░░░░          │
│ │4WK   │ │                                  │
│ └──────┘ └──────────────────────────────────┘
│ Sign out │
└──────────┘
```

Outer wrapper: `flex h-screen bg-pulse-bg overflow-hidden`. Sidebar is fixed-width (`w-[180px]`), content column is `flex-1 flex flex-col overflow-hidden`.

## Sidebar

**Width:** 180px, `border-r border-pulse-border`, `bg-pulse-bg` (matches page background — no elevated surface).

**Top section:**
- Logo: `PULSE.` with accent dot, same treatment as current top bar
- Week badge: `WK 07` pill in accent color

**Nav links:** Train / Plan / Progress / Profile / Explore as vertical text buttons. Active state: `bg-pulse-accent/10 text-pulse-accent`. Inactive: `text-pulse-dim hover:text-pulse-text hover:bg-white/5`. Same style tokens as the existing horizontal nav.

**Spacer:** `flex-grow` div pushes the context card to the bottom.

**Context card** (bottom of sidebar, above sign-out):
- Shows active routine name + current workout type label (e.g. "PPL — Push A")
- Week number and streak count
- If no active routine: shows a muted "No routine" label — no CTA (the Train view empty state handles that)
- Styled as a subtle inset card: `bg-pulse-surface border border-pulse-border rounded-xl p-3`

**Sign out:** Small muted text button below the context card.

**Export:** Removed from desktop layout — it was a secondary action tucked in the top bar. Not worth sidebar real estate. (Can be added to Profile view later if needed.)

## Content Column

Structure:
```tsx
<div className="flex-1 flex flex-col overflow-hidden">
  <main className="flex-1 overflow-y-auto">
    {children}
  </main>
  <RestTimer trigger={timerTrigger} duration={timerDuration ?? undefined} />
</div>
```

`<main>` scrolls independently. `<RestTimer>` sits below it as a sticky strip — the component already renders nothing when inactive, so no conditional wrapping is needed.

## Rest Timer Placement

The rest timer moves from `AppShell`'s viewport-fixed position into `DesktopLayout` as the bottom of the content column. On mobile, `AppShell` keeps its existing `fixed bottom-16` placement. The `timerTrigger` and `timerDuration` values come from `usePulse()` inside `DesktopLayout`, the same way they're accessed in `AppShell` today.

## Content Widths

No changes to view components. Each view already controls its own width:

| View | Current max-width | Desktop behaviour |
|---|---|---|
| Train (LogView) | `max-w-[600px] lg:max-w-[820px] mx-auto` | Stays narrow, centered |
| Plan (ProgramView) | `max-w-[600px] mx-auto` | Stays narrow, centered |
| Progress | none | Fills full content area |
| Profile | none | Fills full content area |
| Library/Explore | none | Fills full content area |

## Files Changed

| File | Change |
|---|---|
| `src/components/pulse/DesktopLayout.tsx` | Full rewrite — sidebar + content column + RestTimer |
| `src/components/pulse/AppShell.tsx` | Remove RestTimer block from the desktop path (DesktopLayout owns it) |

No other files change. Views, routing, `useMediaQuery` breakpoint, and `OnboardingModal` are all untouched.

## Out of Scope

- Export button relocation (deferred to Profile view, later)
- Any change to mobile layout
- Any change to individual view components
- Responsive behaviour between 1024px and ~1280px (existing breakpoint stays)
