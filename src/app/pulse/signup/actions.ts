'use server';
import { createClient } from '@/lib/supabase/server';
import { getOrigin } from '@/lib/origin';
import { validatePassword } from '@/lib/pulse/passwordValidation';

export type SignupState =
    | { status: 'idle' }
    | { status: 'sent'; email: string }
    | { status: 'error'; message: string; email: string };

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const confirm = String(formData.get('confirm') ?? '');

    if (!email) return { status: 'error', message: 'Enter your email address.', email };
    const pwError = validatePassword(password, confirm);
    if (pwError) return { status: 'error', message: pwError, email };

    const supabase = await createClient();
    const origin = await getOrigin();
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${origin}/pulse/auth/confirm` },
    });

    if (error) {
        // Do not confirm whether an address already exists (enumeration).
        const message = /already (registered|exists|been registered)/i.test(error.message)
            ? 'If you already have an account, sign in or reset your password.'
            : 'We could not create your account. Please check your details and try again.';
        return { status: 'error', message, email };
    }

    return { status: 'sent', email };
}

export async function resendConfirmation(email: string): Promise<{ status: 'resent' | 'error' }> {
    if (!email) return { status: 'error' };
    const supabase = await createClient();
    const origin = await getOrigin();
    const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${origin}/pulse/auth/confirm` },
    });
    return { status: error ? 'error' : 'resent' };
}
