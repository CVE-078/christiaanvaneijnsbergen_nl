'use client';
import { useFormStatus } from 'react-dom';

// Full-width primary submit, label-configurable. Mirrors the login SubmitButton:
// coral when idle, dim + not-allowed while the action is pending.
export default function AuthSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className={`block w-full py-3 border-none rounded-lg text-pulse-bg font-pulse font-semibold text-sm tracking-[0.04em] transition-colors duration-150 ${pending ? 'bg-pulse-accent-dim cursor-not-allowed' : 'bg-pulse-accent cursor-pointer'}`}>
            {pending ? pendingLabel : label}
        </button>
    );
}
