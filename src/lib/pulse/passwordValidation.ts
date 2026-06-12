// Minimum length for a new password. Mirrors the minimum configured in Supabase
// Auth; enforced client-side here for immediate feedback and server-side by Supabase.
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Validate a new-password + confirm pair. Returns a human-readable error string,
 * or null when the pair is valid. Length is checked before match.
 */
export function validatePassword(password: string, confirm: string): string | null {
    if (password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (password !== confirm) {
        return 'Passwords do not match.';
    }
    return null;
}
