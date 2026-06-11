import type { Metadata } from 'next';
import Link from 'next/link';
import AuthShell from '@/components/pulse/AuthShell';
import AuthSubmitButton from '@/components/pulse/AuthSubmitButton';
import { FIELD, LABEL, LINK, fieldBorder } from '@/components/pulse/authStyles';
import { requestReset } from './actions';

export const metadata: Metadata = {
    title: 'Reset your Pulse password',
    robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    const params = await searchParams;
    const sent = params.sent === '1';

    if (sent) {
        return (
            <AuthShell>
                <div className="flex flex-col">
                    <h1 className="font-pulse font-semibold text-pulse-text text-base mb-2">Check your email</h1>
                    <p className="font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-dim mb-6">
                        If an account exists for that address, we sent a password reset link. Check your inbox, and spam
                        too.
                    </p>
                    <Link href="/pulse/login" className={LINK}>
                        Back to sign in
                    </Link>
                </div>
            </AuthShell>
        );
    }

    return (
        <AuthShell>
            <form action={requestReset} className="flex flex-col">
                <h1 className="font-pulse font-semibold text-pulse-text text-base mb-2">Reset password</h1>
                <p className="font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-dim mb-6">
                    Enter your email and we will send you a link to set a new password.
                </p>

                <label htmlFor="email" className={LABEL}>
                    Email
                </label>
                <input
                    id="email"
                    type="email"
                    name="email"
                    required
                    autoFocus
                    autoComplete="email"
                    className={`${FIELD} mb-6 ${fieldBorder(false)}`}
                />

                <AuthSubmitButton label="Send reset link" pendingLabel="Sending…" />

                <p className="mt-6 text-center">
                    <Link href="/pulse/login" className={LINK}>
                        Back to sign in
                    </Link>
                </p>
            </form>
        </AuthShell>
    );
}
