import type { Metadata } from 'next';
import Link from 'next/link';
import AuthShell from '@/components/pulse/AuthShell';
import { LINK } from '@/components/pulse/authStyles';

export const metadata: Metadata = {
    title: 'Account deleted',
    robots: { index: false, follow: false },
};

export default function AccountDeletedPage() {
    return (
        <AuthShell>
            <div className="flex flex-col">
                <h1 className="font-pulse font-semibold text-pulse-text text-base mb-2">Your account was deleted</h1>
                <p className="font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-dim mb-6">
                    Your account and training data have been removed. Thanks for giving Pulse a try.
                </p>
                <Link href="/pulse/signup" className={LINK}>
                    Start over with a new account
                </Link>
            </div>
        </AuthShell>
    );
}
