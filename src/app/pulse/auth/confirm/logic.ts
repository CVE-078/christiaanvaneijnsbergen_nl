// Pure logic for the /pulse/auth/confirm Route Handler, extracted so the param
// parsing and redirect resolution are unit-testable without the handler runtime.

// The email OTP types we accept. `email_change` is handled for forward
// compatibility (no UI initiates it in this cut); any other value is rejected.
export type ConfirmType = 'signup' | 'recovery' | 'email_change';

const ALLOWED_TYPES: readonly ConfirmType[] = ['signup', 'recovery', 'email_change'];

export const DEFAULT_NEXT = '/pulse/train';
export const RECOVERY_NEXT = '/pulse/reset-password';

/**
 * Validate a `next` redirect target. Only same-origin paths under /pulse are
 * allowed; anything else (external URL, protocol-relative //host, empty, missing)
 * falls back to the app home. This prevents an open-redirect via the email link.
 */
export function validateNext(next: string | null | undefined): string {
    if (next && next.startsWith('/pulse')) return next;
    return DEFAULT_NEXT;
}

/**
 * Parse the confirm query string. Returns the validated params, or an
 * `invalid_link` error when token_hash or a recognised type is missing.
 */
export function parseConfirmParams(
    params: URLSearchParams,
): { tokenHash: string; type: ConfirmType; next: string } | { error: 'invalid_link' } {
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (!tokenHash || !type || !ALLOWED_TYPES.includes(type as ConfirmType)) {
        return { error: 'invalid_link' };
    }
    return { tokenHash, type: type as ConfirmType, next: validateNext(params.get('next')) };
}

/** Where to send the user after a successful verifyOtp. Recovery always goes to the reset form. */
export function resolveSuccessRedirect(type: ConfirmType, next: string): string {
    return type === 'recovery' ? RECOVERY_NEXT : next;
}
