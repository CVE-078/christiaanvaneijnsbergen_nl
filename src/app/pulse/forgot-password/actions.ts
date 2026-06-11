'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOrigin } from '@/lib/origin';

export async function requestReset(formData: FormData) {
    const email = String(formData.get('email') ?? '').trim();

    // Best-effort send. We always redirect to the same neutral confirmation
    // regardless of whether the address exists, so this does not leak which
    // emails are registered.
    if (email) {
        const supabase = await createClient();
        const origin = await getOrigin();
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/pulse/auth/confirm` });
    }

    redirect('/pulse/forgot-password?sent=1');
}
