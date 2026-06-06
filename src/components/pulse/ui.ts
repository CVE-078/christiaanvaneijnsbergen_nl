// ── Shared PULSE UI style constants ──────────────────────────────────────────
//
// Canonical Tailwind class-name strings shared across PULSE views (Slate theme).
//
// Consumers (import from here rather than re-declaring locally):
//   - GenerateRoutineButton.tsx        BTN_PRIMARY
//   - views/library/RoutinesTab.tsx    INPUT, BTN_PRIMARY, BTN_GHOST, CARD
//   - views/library/ExercisesTab.tsx   INPUT, BTN_PRIMARY, CARD
//   - views/ProfileView.tsx            INPUT, BTN_PRIMARY
//   - WorkoutModeScreen.tsx            BTN_PRIMARY_BLOCK
//   - ShareCard.tsx                    BTN_PRIMARY_BLOCK
//   - PageSkeleton.tsx (ErrorState)    BTN_PRIMARY
//   - RoutineSetupFlow.tsx             BTN_PRIMARY_BLOCK
//
// Slate visual rules applied here:
//   - Surfaces separate by tone shift (bg / surface / surface-2) + whitespace,
//     not borders. CARD uses a surface tone with no border.
//   - Inputs keep a hairline border so the editable field reads as interactive;
//     focus moves the border to the coral accent.
//   - One accent, coral (#ff7d66), with near-black text on the filled button.
//
// Two filled-button shapes: BTN_PRIMARY is the compact inline action
// (rounded-lg, px-4 py-2); BTN_PRIMARY_BLOCK is the full-width CTA used in
// modal footers and full-screen flows (w-full, rounded-xl, py-3).
//
// Kept as className string constants (not React components) to minimize churn
// for the consuming view files.

export const INPUT =
    'bg-pulse-bg border border-pulse-border rounded-lg px-3 py-2 text-pulse-text font-pulse text-sm outline-none focus:border-pulse-accent';

export const BTN_PRIMARY =
    'bg-pulse-accent text-pulse-bg font-pulse text-sm font-semibold rounded-lg px-4 py-2 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed';

// Full-width CTA for modal footers / full-screen flows. Same coral fill and
// type as BTN_PRIMARY, but block layout (w-full, py-3, rounded-xl).
export const BTN_PRIMARY_BLOCK =
    'font-pulse w-full py-3 rounded-xl bg-pulse-accent text-pulse-bg font-semibold text-sm cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed';

export const BTN_GHOST =
    'bg-pulse-surface-2 text-pulse-dim font-pulse text-sm rounded-lg px-3 py-2 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed';

export const CARD = 'bg-pulse-surface rounded-2xl p-4';
