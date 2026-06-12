'use client';
import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import PasswordFields from '@/components/pulse/PasswordFields';
import AuthSubmitButton from '@/components/pulse/AuthSubmitButton';
import { FIELD, LABEL, ERROR_TEXT, LINK, fieldBorder } from '@/components/pulse/authStyles';
import { signup, resendConfirmation, type SignupState } from './actions';

const INITIAL: SignupState = { status: 'idle' };

function CheckEmail({ email }: { email: string }) {
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<'resent' | 'error' | null>(null);

    return (
        <div className="flex flex-col">
            <h1 className="font-pulse font-semibold text-pulse-text text-base mb-2">Check your email</h1>
            <p className="font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-dim mb-6">
                We sent a confirmation link to <span className="text-pulse-text">{email}</span>. Click it to activate
                your account, then sign in.
            </p>
            <button
                type="button"
                disabled={pending}
                onClick={() =>
                    startTransition(async () => {
                        const r = await resendConfirmation(email);
                        setResult(r.status);
                    })
                }
                className={`${LINK} text-left mb-4 disabled:opacity-50`}>
                {pending ? 'Resending…' : 'Resend confirmation email'}
            </button>
            {result === 'resent' && (
                <p className="font-pulse text-[0.8125rem] text-pulse-dim mb-4" role="status">
                    Sent again. Give it a minute, then check spam too.
                </p>
            )}
            {result === 'error' && (
                <p className={`${ERROR_TEXT} mb-4`} role="alert">
                    Could not resend right now. Try again shortly.
                </p>
            )}
            <Link href="/pulse/login" className={LINK}>
                Back to sign in
            </Link>
        </div>
    );
}

export default function SignupForm() {
    const [state, formAction] = useActionState(signup, INITIAL);

    if (state.status === 'sent') {
        return <CheckEmail email={state.email} />;
    }

    const hasError = state.status === 'error';
    const defaultEmail = state.status === 'error' ? state.email : '';

    return (
        <form action={formAction} className="flex flex-col">
            {hasError && (
                <p id="signup-error" role="alert" className={`${ERROR_TEXT} mb-5`}>
                    {state.message}
                </p>
            )}

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
                defaultValue={defaultEmail}
                aria-invalid={hasError ? true : undefined}
                aria-describedby={hasError ? 'signup-error' : undefined}
                className={`${FIELD} mb-4 ${fieldBorder(hasError)}`}
            />

            <PasswordFields />

            <AuthSubmitButton label="Create account" pendingLabel="Creating account…" />

            <p className="mt-6 text-center">
                <Link href="/pulse/login" className={LINK}>
                    Already have an account? Sign in
                </Link>
            </p>
        </form>
    );
}
