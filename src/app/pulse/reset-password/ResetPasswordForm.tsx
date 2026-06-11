'use client';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PasswordFields from '@/components/pulse/PasswordFields';
import AuthSubmitButton from '@/components/pulse/AuthSubmitButton';
import { ERROR_TEXT } from '@/components/pulse/authStyles';
import { updatePassword, type PasswordUpdateState } from '@/app/pulse/actions/account';

const INITIAL: PasswordUpdateState = {};

export default function ResetPasswordForm() {
    const [state, formAction] = useActionState(updatePassword, INITIAL);
    const router = useRouter();

    useEffect(() => {
        if (state.ok) router.replace('/pulse/train');
    }, [state.ok, router]);

    return (
        <form action={formAction} className="flex flex-col">
            <h1 className="font-pulse font-semibold text-pulse-text text-base mb-2">Set a new password</h1>
            <p className="font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-dim mb-6">
                Choose a new password for your account.
            </p>

            {state.error && (
                <p role="alert" className={`${ERROR_TEXT} mb-5`}>
                    {state.error}
                </p>
            )}

            <PasswordFields passwordLabel="New password" autoFocus />

            <AuthSubmitButton label="Update password" pendingLabel="Updating…" />
        </form>
    );
}
