import type { Metadata } from 'next';
import { login } from './actions';
import SubmitButton from './SubmitButton';

export const metadata: Metadata = {
    title: 'Pulse — Login',
    robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    const params = await searchParams;
    const hasError = params.error === '1';

    return (
        <div className="min-h-screen bg-pulse-bg flex items-center justify-center p-4">
            <form action={login} className="w-full max-w-[360px]">
                <div className="mb-8">
                    <div className="font-pulse font-bold text-[0.8125rem] tracking-[0.08em] uppercase text-white mb-1">
                        Pulse<span className="text-pulse-accent">.</span>
                    </div>
                    <div className="font-pulse text-[0.6875rem] tracking-[0.06em] text-pulse-dim">
                        12-week PPL programme
                    </div>
                </div>

                {hasError && (
                    <p
                        id="login-error"
                        role="alert"
                        className="font-pulse text-[0.6875rem] tracking-[0.04em] text-[#f43f5e] mb-5">
                        Invalid email or password.
                    </p>
                )}

                <label
                    htmlFor="email"
                    className="block font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-dim mb-2">
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
                    className={`block w-full py-3 px-3 bg-pulse-surface rounded-[3px] text-white font-pulse text-[0.9375rem] mb-4 border box-border outline-none ${hasError ? 'border-[#f43f5e44]' : 'border-pulse-border'}`}
                />

                <label
                    htmlFor="password"
                    className="block font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-dim mb-2">
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
                    className={`block w-full py-3 px-3 bg-pulse-surface rounded-[3px] text-white font-pulse text-[0.9375rem] mb-4 border box-border outline-none ${hasError ? 'border-[#f43f5e44]' : 'border-pulse-border'}`}
                />

                <SubmitButton />
            </form>
        </div>
    );
}
