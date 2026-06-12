'use client';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import PasswordFields from './PasswordFields';
import AuthSubmitButton from './AuthSubmitButton';
import { FIELD, LABEL, ERROR_TEXT, fieldBorder } from './authStyles';
import { updatePassword, deleteAccount, type PasswordUpdateState } from '@/app/pulse/actions/account';

const INITIAL: PasswordUpdateState = {};

function ChangePassword() {
    const [state, formAction] = useActionState(updatePassword, INITIAL);
    return (
        <form action={formAction} className="flex flex-col pt-4">
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
            <AuthSubmitButton label="Update password" pendingLabel="Updating..." />
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
            {pending ? 'Deleting...' : 'Delete my account'}
        </button>
    );
}

function DeleteAccount() {
    const [confirmText, setConfirmText] = useState('');
    const armed = confirmText === CONFIRM_WORD;
    return (
        <div className="pt-4">
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
// delete-account danger zone. Each section is hidden behind a tappable row
// and expands inline (accordion). Kept out of the large ProfileView.
export default function AccountSecuritySection() {
    const [openSection, setOpenSection] = useState<'password' | 'delete' | null>(null);

    function toggle(section: 'password' | 'delete') {
        setOpenSection((prev) => (prev === section ? null : section));
    }

    return (
        <div className="flex flex-col gap-[7px]">
            {/* Change password row */}
            <div className="bg-pulse-surface rounded-xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggle('password')}
                    className="flex items-center justify-between w-full px-[13px] py-[13px] border-none bg-transparent cursor-pointer">
                    <span className="font-pulse font-semibold text-[0.92rem] text-pulse-text">Change password</span>
                    <span className="text-pulse-muted text-sm">{openSection === 'password' ? '∨' : '›'}</span>
                </button>
                {openSection === 'password' && (
                    <div className="px-[13px] pb-4">
                        <ChangePassword />
                    </div>
                )}
            </div>

            {/* Delete account row */}
            <div className="bg-pulse-surface rounded-xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggle('delete')}
                    className="flex items-center justify-between w-full px-[13px] py-[13px] border-none bg-transparent cursor-pointer">
                    <span className="font-pulse font-semibold text-[0.92rem] text-pulse-error">Delete account</span>
                    <span className="text-pulse-muted text-sm">{openSection === 'delete' ? '∨' : '›'}</span>
                </button>
                {openSection === 'delete' && (
                    <div className="px-[13px] pb-4">
                        <DeleteAccount />
                    </div>
                )}
            </div>
        </div>
    );
}
