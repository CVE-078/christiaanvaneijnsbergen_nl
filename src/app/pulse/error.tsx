'use client';
import Link from 'next/link';

interface Props {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function PulseError({ error, reset }: Props) {
    return (
        <div className="min-h-screen bg-pulse-bg flex items-center justify-center p-4">
            <div role="alert" className="max-w-[380px] w-full text-center">
                <div className="font-pulse text-[0.8125rem] tracking-[0.1em] uppercase text-[#f43f5e] mb-4">Error</div>
                <p className="text-pulse-dim text-[0.875rem] mb-3 font-pulse">Failed to load. Please try again.</p>
                {error.digest && (
                    <p className="text-[#333] text-[0.75rem] font-pulse tracking-[0.04em] mb-8">
                        Code: {error.digest}
                    </p>
                )}
                <div className="flex gap-3 justify-center flex-wrap">
                    <button
                        onClick={reset}
                        className="py-[0.625rem] px-6 bg-transparent border border-pulse-accent rounded-[3px] text-pulse-accent font-pulse text-sm tracking-[0.08em] uppercase cursor-pointer">
                        Try again
                    </button>
                    <Link
                        href="/"
                        className="py-[0.625rem] px-6 bg-transparent border border-[#2a2a2a] rounded-[3px] text-pulse-dim font-pulse text-sm tracking-[0.08em] uppercase no-underline inline-flex items-center">
                        ← Back
                    </Link>
                </div>
            </div>
        </div>
    );
}
