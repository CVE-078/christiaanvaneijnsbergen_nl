'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
    const email = (formData.get('email') as string) ?? '';
    const password = (formData.get('password') as string) ?? '';

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) redirect('/pulse/login?error=1');

    // The profile row is created by the on_auth_user_created trigger when the
    // auth user is created at signup, so login no longer creates it lazily.
    redirect('/pulse/train');
}
