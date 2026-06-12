import type { Metadata } from 'next';
import Link from 'next/link';
import { login } from './actions';
import SubmitButton from './SubmitButton';
import { LINK } from '@/components/pulse/authStyles';

export const metadata: Metadata = {
    title: 'Pulse Login',
    robots: { index: false, follow: false },
};

// Fields sit on surface-2 inside a surface card, Slate separates by tone shift,
// not borders; the hairline border only sharpens to coral on focus.
const FIELD =
    'block w-full py-3 px-3.5 bg-pulse-surface-2 rounded-lg text-pulse-text font-pulse text-base box-border border outline-none transition-colors focus:border-pulse-accent';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    const params = await searchParams;
    const errorMessage =
        params.error === 'expired'
            ? 'That link has expired or was already used. Sign in, or request a new one.'
            : params.error === 'invalid_link'
              ? 'That link was invalid. Sign in, or request a new one.'
              : params.error === '1'
                ? 'Invalid email or password.'
                : null;
    const hasError = errorMessage !== null;

    return (
        <div className="min-h-screen bg-pulse-bg flex items-center justify-center p-4">
            <form action={login} className="w-full max-w-[360px] bg-pulse-surface rounded-2xl p-7 flex flex-col">
                <div className="mb-7">
                    <div className="font-pulse font-bold text-lg tracking-[0.06em] uppercase text-pulse-text">
                        Pulse<span className="text-pulse-accent">.</span>
                    </div>
                    <div className="font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-dim mt-1">
                        An adaptive strength coach, on any device
                    </div>
                </div>

                {hasError && (
                    <p
                        id="login-error"
                        role="alert"
                        className="font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-error mb-5">
                        {errorMessage}
                    </p>
                )}

                <label
                    htmlFor="email"
                    className="block font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-1.5">
                    Email
                </label>
                <input
                    id="email"
                    type="email"
                    name="email"
                    required
                    autoFocus
                    autoComplete="email"
                    aria-invalid={hasError ? true : undefined}
                    aria-describedby={hasError ? 'login-error' : undefined}
                    className={`${FIELD} mb-4 ${hasError ? 'border-pulse-error/40' : 'border-pulse-border'}`}
                />

                <label
                    htmlFor="password"
                    className="block font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-1.5">
                    Password
                </label>
                <input
                    id="password"
                    type="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    aria-invalid={hasError ? true : undefined}
                    aria-describedby={hasError ? 'login-error' : undefined}
                    className={`${FIELD} mb-6 ${hasError ? 'border-pulse-error/40' : 'border-pulse-border'}`}
                />

                <SubmitButton />

                <div className="mt-6 flex flex-col items-center gap-2">
                    <Link href="/pulse/forgot-password" className={LINK}>
                        Forgot password?
                    </Link>
                    <Link href="/pulse/signup" className={LINK}>
                        Create an account
                    </Link>
                </div>
            </form>
        </div>
    );
}
