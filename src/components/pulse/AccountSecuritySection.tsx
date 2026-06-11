'use client';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import PasswordFields from './PasswordFields';
import AuthSubmitButton from './AuthSubmitButton';
import SectionLabel from './SectionLabel';
import { FIELD, LABEL, ERROR_TEXT, fieldBorder } from './authStyles';
import { updatePassword, deleteAccount, type PasswordUpdateState } from '@/app/pulse/actions/account';

const INITIAL: PasswordUpdateState = {};

function ChangePassword() {
    const [state, formAction] = useActionState(updatePassword, INITIAL);
    return (
        <form action={formAction} className="flex flex-col mb-8">
            <SectionLabel className="mb-3">Change password</SectionLabel>
            {state.error && (
                <p role="alert" className={`${ERROR_TEXT} mb-4`}>
                    {state.error}
                </p>
            )}
            {state.ok && (
                <p role="status" className="font-pulse text-[0.8125rem] text-pulse-success mb-4">
                    Password updated.
                </p>
            )}
            <PasswordFields passwordLabel="New password" />
            <AuthSubmitButton label="Update password" pendingLabel="Updating…" />
        </form>
    );
}

const CONFIRM_WORD = 'DELETE';

function DeleteButton({ armed }: { armed: boolean }) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={!armed || pending}
            aria-busy={pending}
            className="block w-full py-3 rounded-lg border-none font-pulse font-semibold text-sm tracking-[0.04em] bg-pulse-error text-pulse-bg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
            {pending ? 'Deleting…' : 'Delete my account'}
        </button>
    );
}

function DeleteAccount() {
    const [confirmText, setConfirmText] = useState('');
    const armed = confirmText === CONFIRM_WORD;
    return (
        <div className="rounded-xl border border-pulse-error/30 bg-pulse-error/5 p-4">
            <SectionLabel className="mb-2">Delete account</SectionLabel>
            <p className="font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-dim mb-4">
                This permanently deletes your account and all your training data. This cannot be undone.
            </p>
            <label htmlFor="confirm-delete" className={LABEL}>
                Type {CONFIRM_WORD} to confirm
            </label>
            <input
                id="confirm-delete"
                type="text"
                autoComplete="off"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className={`${FIELD} mb-4 ${fieldBorder(false)}`}
            />
            <form action={deleteAccount}>
                <DeleteButton armed={armed} />
            </form>
        </div>
    );
}

// Account security controls for the Profile screen: change password and the
// delete-account danger zone. Kept out of the 800+ line ProfileView.
export default function AccountSecuritySection() {
    return (
        <>
            <ChangePassword />
            <DeleteAccount />
        </>
    );
}
