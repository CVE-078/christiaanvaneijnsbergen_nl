import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AuthShell from '@/components/pulse/AuthShell';
import { LINK } from '@/components/pulse/authStyles';
import ResetPasswordForm from './ResetPasswordForm';

export const metadata: Metadata = {
    title: 'Set a new password',
    robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
    // The recovery link runs through /pulse/auth/confirm, which establishes a
    // session before redirecting here. If there is none (link expired or a direct
    // visit), show a recovery path instead of the form.
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return (
            <AuthShell>
                <div className="flex flex-col">
                    <h1 className="font-pulse font-semibold text-pulse-text text-base mb-2">Link expired</h1>
                    <p className="font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-dim mb-6">
                        This password reset link has expired or the session was not established. Request a new one.
                    </p>
                    <Link href="/pulse/forgot-password" className={LINK}>
                        Request a new reset link
                    </Link>
                </div>
            </AuthShell>
        );
    }

    return (
        <AuthShell>
            <ResetPasswordForm />
        </AuthShell>
    );
}
