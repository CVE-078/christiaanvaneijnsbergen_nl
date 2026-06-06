import type { Metadata } from 'next';
import { login } from './actions';
import SubmitButton from './SubmitButton';

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
    const hasError = params.error === '1';

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
                        Invalid email or password.
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
            </form>
        </div>
    );
}
