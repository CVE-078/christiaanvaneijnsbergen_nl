'use client';
import { useFormStatus } from 'react-dom';

export default function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className={`block w-full py-3 px-0 border-none rounded-[3px] text-white font-pulse font-bold text-sm tracking-[0.08em] uppercase transition-colors duration-150 ${pending ? 'bg-[#cc5522] cursor-not-allowed' : 'bg-pulse-accent cursor-pointer'}`}>
            {pending ? 'Signing in…' : 'Sign in'}
        </button>
    );
}
