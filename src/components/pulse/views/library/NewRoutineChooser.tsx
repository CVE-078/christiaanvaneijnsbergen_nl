'use client';
import { useState, type ReactNode } from 'react';
import ModalSheet from '@/components/pulse/ModalSheet';

export default function NewRoutineChooser({
    open,
    onClose,
    generateSlot,
    onAdHoc,
}: {
    open: boolean;
    onClose: () => void;
    /** The Generate choice, supplied by the caller (a styled GenerateRoutineButton)
     *  so its onboarding/tune handoff stays untouched. */
    generateSlot: ReactNode;
    onAdHoc: (name: string) => void;
}) {
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState('');
    const submit = () => {
        const n = name.trim();
        if (!n) return;
        onAdHoc(n);
        setNaming(false);
        setName('');
    };
    return (
        <ModalSheet open={open} onClose={onClose} title="New routine">
            <div className="flex flex-col gap-2.5 px-6">
                {generateSlot}

                {!naming ? (
                    <button
                        type="button"
                        onClick={() => setNaming(true)}
                        className="flex items-center gap-3 rounded-[13px] border border-pulse-border p-3.5 text-left">
                        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-pulse-surface-2 text-pulse-accent">
                            <svg
                                width="17"
                                height="17"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                aria-hidden>
                                <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
                                <line x1="8" y1="6" x2="8" y2="10" />
                                <line x1="6" y1="8" x2="10" y2="8" />
                            </svg>
                        </span>
                        <span>
                            <span className="font-pulse text-[0.9rem] font-medium text-pulse-text">Ad-hoc routine</span>
                            <span className="mt-0.5 block font-pulse text-[0.74rem] text-pulse-dim">
                                Start empty and add exercises yourself.
                            </span>
                        </span>
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <input
                            autoFocus
                            aria-label="Routine name"
                            value={name}
                            placeholder="Routine name"
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') submit();
                            }}
                            className="flex-1 rounded-[10px] border border-pulse-border bg-pulse-bg px-3 py-2.5 font-pulse text-sm text-pulse-text outline-none focus:border-pulse-accent"
                        />
                        <button
                            type="button"
                            onClick={submit}
                            className="rounded-[10px] bg-pulse-accent px-4 font-pulse text-sm font-semibold text-pulse-bg">
                            Create
                        </button>
                    </div>
                )}
            </div>
        </ModalSheet>
    );
}
