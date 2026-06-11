'use client';
import { useState } from 'react';
import { MIN_PASSWORD_LENGTH, validatePassword } from '@/lib/pulse/passwordValidation';
import { FIELD, LABEL, ERROR_TEXT, HINT_TEXT, fieldBorder } from './authStyles';

// Shared new-password + confirm pair with a length hint and inline mismatch
// feedback. Used by signup, reset-password, and the Profile change-password form.
// Submits via the input `name`s; server actions re-validate (defense in depth).
export default function PasswordFields({
    passwordLabel = 'Password',
    autoFocus = false,
}: {
    passwordLabel?: string;
    autoFocus?: boolean;
}) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const touched = password.length > 0 && confirm.length > 0;
    const error = touched ? validatePassword(password, confirm) : null;

    return (
        <>
            <label htmlFor="password" className={LABEL}>
                {passwordLabel}
            </label>
            <input
                id="password"
                name="password"
                type="password"
                required
                autoFocus={autoFocus}
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="password-hint"
                className={`${FIELD} mb-1.5 ${fieldBorder(false)}`}
            />
            <p id="password-hint" className={`${HINT_TEXT} mb-4`}>
                At least {MIN_PASSWORD_LENGTH} characters
            </p>

            <label htmlFor="confirm" className={LABEL}>
                Confirm password
            </label>
            <input
                id="confirm"
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'password-error' : undefined}
                className={`${FIELD} ${error ? 'mb-2' : 'mb-6'} ${fieldBorder(!!error)}`}
            />
            {error && (
                <p id="password-error" role="alert" className={`${ERROR_TEXT} mb-6`}>
                    {error}
                </p>
            )}
        </>
    );
}
