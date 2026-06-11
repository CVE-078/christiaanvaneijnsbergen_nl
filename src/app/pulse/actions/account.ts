'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validatePassword } from '@/lib/pulse/passwordValidation';

export type PasswordUpdateState = { ok?: boolean; error?: string };

/**
 * Set a new password for the current session user. Shared by the reset-password
 * flow (recovery session) and the Profile change-password form (normal session).
 * Re-validates server-side; Supabase enforces its own minimum too.
 */
export async function updatePassword(_prev: PasswordUpdateState, formData: FormData): Promise<PasswordUpdateState> {
    const password = String(formData.get('password') ?? '');
    const confirm = String(formData.get('confirm') ?? '');

    const error = validatePassword(password, confirm);
    if (error) return { error };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Your session has expired. Request a new password reset link.' };

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) return { error: 'Could not update your password. Please try again.' };

    return { ok: true };
}

/**
 * Permanently delete the current user's account. Revokes all of the user's
 * sessions globally (best-effort, never blocks the delete), then hard-deletes
 * the auth user via the service-role admin client. The user id is taken from the
 * server session only, never from the request, so a caller can only delete
 * themselves. Data removal relies on ON DELETE CASCADE from auth.users (see the
 * fk-cascade migration; that cascade MUST be applied for this to clean up data).
 */
export async function deleteAccount(): Promise<void> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/pulse/login');

    // Revoke every session for this user (covers other devices). Best-effort.
    try {
        await supabase.auth.signOut({ scope: 'global' });
    } catch {
        // ignore; deleteUser below invalidates sessions anyway
    }

    // Lazy import keeps server-only + the service-role key out of the client
    // build and the test graph.
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id, false);
    if (error) throw new Error('Failed to delete account');

    redirect('/pulse/account-deleted');
}
