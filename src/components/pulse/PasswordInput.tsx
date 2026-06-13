'use client';
import { useState, type InputHTMLAttributes } from 'react';

// A password input with a built-in show/hide eye toggle. Forwards all standard
// input props; `className` styles the field, `wrapperClassName` carries the
// layout margin (kept off the input so the eye stays vertically centered).
// The toggle is tabIndex={-1} so keyboard tabbing flows label -> field -> submit.
export default function PasswordInput({
    className = '',
    wrapperClassName = '',
    ...props
}: InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string }) {
    const [show, setShow] = useState(false);
    return (
        <div className={`relative ${wrapperClassName}`}>
            <input {...props} type={show ? 'text' : 'password'} className={`${className} pr-11`} />
            <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                tabIndex={-1}
                className="absolute right-3 top-1/2 flex -translate-y-1/2 cursor-pointer items-center border-none bg-transparent p-1 text-pulse-muted hover:text-pulse-text">
                {show ? (
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden>
                        <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                ) : (
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden>
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                )}
            </button>
        </div>
    );
}
