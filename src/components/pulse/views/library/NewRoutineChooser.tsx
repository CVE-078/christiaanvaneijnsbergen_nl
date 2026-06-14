'use client';
import { useState } from 'react';
import ModalSheet from '@/components/pulse/ModalSheet';

export default function NewRoutineChooser({
    open,
    onClose,
    onGenerate,
    onAdHoc,
}: {
    open: boolean;
    onClose: () => void;
    onGenerate: () => void;
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
                <button
                    type="button"
                    onClick={onGenerate}
                    className="flex items-center gap-3 rounded-[13px] border border-pulse-accent/40 bg-pulse-accent/[0.06] p-3.5 text-left">
                    {/* sparkle icon badge */}
                    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-pulse-accent text-pulse-bg">
                        <svg
                            width="17"
                            height="17"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            aria-hidden>
                            <path d="M8 1.5l1.6 3.4 3.7.5-2.7 2.6.7 3.7L8 10.4 4.7 12.2l.7-3.7L2.7 5.9l3.7-.5z" />
                        </svg>
                    </span>
                    <span>
                        <span className="font-pulse text-[0.9rem] font-medium text-pulse-text">Generate a routine</span>
                        <span className="mt-0.5 block font-pulse text-[0.74rem] text-pulse-dim">
                            Answer a few questions, we build and periodize it.
                        </span>
                    </span>
                </button>

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
