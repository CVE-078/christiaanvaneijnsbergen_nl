// ── Shared PULSE UI style constants ──────────────────────────────────────────
//
// Canonical Tailwind class-name strings shared across PULSE views.
//
// These previously lived (and drifted) inline in several view files:
//   - LibraryView.tsx     INPUT, BTN_PRIMARY, BTN_GHOST, CARD
//   - ProfileView.tsx     INPUT, BTN_PRIMARY
//   - OnboardingModal.tsx CARD, BTN_PRIMARY
//
// Unified drift notes (LibraryView's idiomatic Tailwind values are canonical):
//   - INPUT: ProfileView used `rounded-[3px] px-2 py-[0.375rem] text-[0.9375rem]`.
//     Unified to LibraryView's `rounded-lg px-3 py-2 text-sm`.
//   - BTN_PRIMARY: ProfileView added `tracking-[0.06em] uppercase rounded-[3px]
//     px-3 py-[0.4375rem]`; OnboardingModal used `rounded-lg px-5 py-2.5 w-full`.
//     Unified to LibraryView's `rounded-lg px-4 py-2`. Layout-specific extras
//     (e.g. `w-full`) should be appended at the call site, not baked in here.
//   - CARD: OnboardingModal used `rounded-2xl ... p-6` plus layout (`gap-5
//     w-full max-w-[420px]`). Unified to LibraryView's `rounded-xl p-4`.
//
// Kept as className string constants (not React components) to minimize churn
// for the consuming view files.

export const INPUT =
    'bg-pulse-bg border border-pulse-border rounded-lg px-3 py-2 text-white font-pulse text-sm outline-none focus:border-pulse-accent/50';

export const BTN_PRIMARY =
    'bg-pulse-accent text-black font-pulse text-sm font-semibold rounded-lg px-4 py-2 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed';

export const BTN_GHOST =
    'bg-transparent text-pulse-dim font-pulse text-sm border border-pulse-border rounded-lg px-3 py-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export const CARD = 'bg-pulse-surface border border-pulse-border rounded-xl p-4';
