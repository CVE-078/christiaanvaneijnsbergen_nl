'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
    const email = (formData.get('email') as string) ?? '';
    const password = (formData.get('password') as string) ?? '';

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) redirect('/pulse/login?error=1');

    // Create the profile row for brand-new users. Existing users' rows are untouched.
    if (data.user) {
        const { data: existing } = await supabase.from('profiles').select('id').eq('id', data.user.id).maybeSingle();
        if (!existing) {
            await supabase.from('profiles').insert({ id: data.user.id, unit: 'kg', onboarding_completed: false });
        }
    }

    redirect('/pulse/train');
}
