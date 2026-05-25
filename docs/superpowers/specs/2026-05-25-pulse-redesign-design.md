# Pulse — Redesign Spec

**Date:** 2026-05-25
**Reference mockup:** `public/mockup-c2.html`
**Breakpoint:** 768px (mobile below, desktop at or above)

---

## 1. Design Language

Unchanged from the current codebase — no new tokens introduced.

| Token | Value | Use |
|-------|-------|-----|
| `BG` | `#0a0a0a` | Page background |
| `SURFACE` | `#141414` | Card / panel backgrounds |
| `SURFACE_2` | `#1a1a1a` | Input backgrounds, secondary surfaces — inline value, not an exported theme token |
| `BORDER` | `#222` | All dividers and borders |
| `MUTED` | `#3a3a3a` | Unfilled progress dots, disabled states |
| `DIM` | `#555` | Secondary text, meta labels |
| `BODY` | `#ccc` | Default text |
| `HEADING` | `#fff` | Primary text, exercise names |
| `ACCENT` | `#ff6c2f` | Active states, save buttons, progress fills |
| `GREEN` | `#22c55e` | Completed exercise indicators |
| `MONO` | JetBrains Mono | Numbers, labels, badges, monospaced UI |
| `SANS` | Inter | Body text, exercise names, buttons |

---

## 2. Mobile Layout (< 768px)

### 2.1 Navigation

Replace the current top-bar hamburger/overflow menu with a **bottom tab bar** — four items: Log, Program, History, Profile.

- Height: 64px + `safe-area-inset-bottom`
- Background: `rgba(10,10,10,0.96)` with `backdrop-filter: blur(12px)`
- Border: 1px top `BORDER`
- Active item: icon and label both `ACCENT`
- Inactive: icon and label both `DIM` / `MUTED`
- Icons: Unicode symbols (⊞ ◈ ◷ ◉) — no external icon library needed
- Labels: 0.5625rem, 600 weight, uppercase, 0.06em tracking

The existing top `PULSE. WK09 ···` bar is retained and simplified — logo, week pill, streak. No nav links in the topbar.

### 2.2 Workout Tabs

Push / Pull / Legs tabs remain below the topbar. Each tab gains a **progress summary** in a secondary line:

```
Push        Pull       Legs
3 / 5 done  0 / 5      0 / 5
```

- Summary text: 0.5625rem, `MONO`, `MUTED` colour (active tab: `DIM`)
- Active tab: `HEADING` label, 2px bottom border `ACCENT`

### 2.3 Week Strip

Unchanged layout. Dots beneath week numbers remain to indicate logged data.

### 2.4 Phase Bar

Unchanged — `phase-name`, `rir-badge`, `phase-desc` in one row.

### 2.5 Exercise Cards

Each exercise card replaces the current block-character progress (`█░`) with **dot indicators**:

- 6×6px circles, gap 3px
- Unfilled: `MUTED`
- Partial (saved sets): `ACCENT`
- All sets complete: `GREEN`

The exercise number (`01`, `02` …) is displayed in `MONO` 1rem bold as the leftmost element, replacing the plain index. On completion the number dims to `rgba(34,197,94,0.4)`.

When a card is open, a **2px progress bar** appears immediately below the header (no margin), filled proportionally in `ACCENT`.

### 2.6 Set Rows

Input height increases from ~32px to **40px**. Background is `SURFACE_2`. Font is `MONO` 0.9375rem 700 — the weight value is prominent and readable at a glance.

Saved sets render a dark green tint (`#0e1510`) background with the weight shown in `MONO` 1rem bold, then `× reps`, then `RIR N`, then a green `✓` flush right.

RIR label moves to a compact uppercase `MONO` label between the inputs and the Save button rather than inline with the inputs.

### 2.7 Rest Timer

Displayed inline beneath the open exercise card (outside the card border-radius, sharing the card's bottom margin slot). Contains: label, progress track, elapsed/remaining time in `ACCENT`.

---

## 3. Desktop Layout (≥ 768px)

### 3.1 Shell

Full-viewport flex row: `sidebar` + `content`. No scrolling at the shell level — overflow is managed within each pane.

### 3.2 Sidebar (192px)

Always visible, never collapses.

**Brand section** (top):
- Logo: `MONO` 0.8125rem 700 uppercase, `ACCENT` period
- Week: `WK 09 / 12` — number in `ACCENT`
- Streak: `MONO` 0.5625rem `MUTED`

**Nav section** (flex: 1, scrollable):
- Buttons: full-width, `MONO` 0.8125rem, left-aligned
- Active: `#fff` text, `#1a1a1a` background, 2px left border `ACCENT`
- Inactive: `DIM` text, transparent background
- Hover: `BODY` text, `SURFACE` background

**Utilities section** (bottom, border-top):
- Export
- Sign out (wraps `<form action={logout}>`)
- Style: `MONO` 0.75rem, `MUTED` colour, no left border

### 3.3 Log View — Two-Pane

The Log view on desktop renders as a horizontal split within the content area.

**Left pane (300px, fixed):**
- Workout tabs (Push/Pull/Legs) with progress summary — same as mobile tabs
- Week strip — same as mobile
- Context bar (phase + RIR + description) — same as mobile but slightly more compact
- Exercise list: one row per exercise, no expand/collapse
  - Compact: `d-ex-num` (MONO 0.9375rem bold) + exercise name + dot row
  - Active item: `#161616` background, 2px left border `ACCENT`, name in `#fff`
  - Hover: `SURFACE` background
  - Completed items: 60% opacity when not active
- Overflow: `overflow-y: auto`

**Right pane (flex: 1):**
- Header: exercise name (1.125rem 700) + meta (`MONO` 0.5625rem uppercase)
- Set list (scrollable): same set row design as mobile but inputs capped at 100px max-width, Save button reads "Save set"
- Rest timer pinned at bottom (border-top, never scrolls away)

### 3.4 Other Views on Desktop

- **Program**: renders inside the content area, full width, existing layout unchanged
- **History**: existing 2-column CSS grid (`pulse-history-grid`) already planned — applies here
- **Profile**: existing side-by-side CSS split (`pulse-profile-layout`) already planned — applies here

---

## 4. Component Changes

| Component | Change |
|-----------|--------|
| `TrackerClient` | Add `useMediaQuery('(min-width: 768px)')` gate; render `DesktopLayout` or existing mobile JSX |
| `DesktopLayout` | New — sidebar + content shell (already in desktop-layout plan, breakpoint updated to 768px) |
| `LogViewDesktop` | New — two-pane log (already in desktop-layout plan, no changes needed) |
| `ExerciseCard` (mobile) | Replace `█░` block chars with dot indicators; add 2px progress bar below header; increase input height to 40px; update set-saved background |
| `WorkoutTabs` | Add progress summary line per tab |
| `TrackerClient` (mobile topbar) | Remove nav links from topbar; add bottom `BottomNav` component (new, extracted from TrackerClient mobile JSX) |

The `DesktopLayout` and two-pane components are already fully specced in `docs/superpowers/plans/2026-05-25-desktop-layout.md`. The only change from that plan is the breakpoint: **768px instead of 1024px**.

---

## 5. What Does Not Change

- All server actions, data fetching, Supabase logic — untouched
- Existing mobile views: `LogView`, `HistoryView`, `ProgramView`, `ProfileView` — only `ExerciseCard` and `WorkoutTabs` receive visual updates
- Theme tokens — no new values added
- Test coverage strategy — existing pattern of unit tests per component continues

---

## 6. Out of Scope

- Animation / transition beyond what is already in the mockup (0.1–0.2s colour transitions)
- Swipe gestures for workout type switching
- Dark/light mode toggle
- Any data model or schema changes
