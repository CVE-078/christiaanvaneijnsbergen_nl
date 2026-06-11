// Shared class tokens for the auth screens, factored out of the login page so
// signup / forgot-password / reset-password mirror it exactly. Slate theme:
// fields sit on surface-2, the hairline border sharpens to coral on focus.
export const FIELD =
    'block w-full py-3 px-3.5 bg-pulse-surface-2 rounded-lg text-pulse-text font-pulse text-base box-border border outline-none transition-colors focus:border-pulse-accent';

export const LABEL = 'block font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-1.5';

export const ERROR_TEXT = 'font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-error';

export const HINT_TEXT = 'font-pulse text-[0.75rem] tracking-[0.02em] text-pulse-muted';

export const LINK =
    'font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-dim hover:text-pulse-accent transition-colors';

/** Border class for a field, error-aware (matches the login page). */
export function fieldBorder(hasError: boolean): string {
    return hasError ? 'border-pulse-error/40' : 'border-pulse-border';
}
