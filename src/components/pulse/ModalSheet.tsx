'use client';
import { useEffect, type ReactNode } from 'react';

interface Props {
    open: boolean;
    onClose: () => void;
    /**
     * When provided, a back chevron renders at the header's left edge and calls
     * this instead of dismissing. Use it when the sheet was opened from a list
     * sheet, so "back" returns to that list while the close (✕) still fully
     * dismisses. Omit it for a top-level sheet.
     */
    onBack?: () => void;
    title: string;
    /**
     * A muted line under the title. List sheets pass a count ("24 entries"),
     * detail sheets pass context (a PR line, a strength level).
     */
    subtitle?: ReactNode;
    /** Accessible dialog label; defaults to the title. */
    ariaLabel?: string;
    /** Sheet body, rendered below the standardized header. Use px-6 for edge alignment. */
    children: ReactNode;
}

// Shared modal shell: bottom-sheet on mobile, centered dialog on desktop. Owns
// the overlay, panel sizing, mobile grip, Escape-to-close, and a standardized
// header (optional back chevron · title + subtitle · close). It is the single
// source of truth for modal spacing (p-6 edges), so every Pulse modal reads the
// same. The body below the header is the caller's; keep its sections on px-6.
export default function ModalSheet({ open, onClose, onBack, title, subtitle, ariaLabel, children }: Props) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel ?? title}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center"
            onClick={onClose}>
            <div
                className="flex w-full max-w-[560px] max-h-[86vh] flex-col rounded-t-[20px] bg-pulse-surface pb-6 lg:max-h-[78vh] lg:rounded-[18px] lg:mx-6"
                onClick={(e) => e.stopPropagation()}>
                {/* Grip handle, mobile only */}
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-pulse-border lg:hidden" aria-hidden />

                {/* Standardized header */}
                <div className="flex items-start gap-3 px-6 pt-4 pb-3">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label="Back"
                            className="-ml-1 mt-[2px] shrink-0 cursor-pointer border-none bg-transparent p-0 text-pulse-muted hover:text-pulse-text">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden>
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>
                    )}
                    <div className="min-w-0 flex-1">
                        <span className="block truncate font-pulse-display text-[1.3rem] font-bold leading-tight text-pulse-text">
                            {title}
                        </span>
                        {subtitle != null && subtitle !== '' && (
                            <span className="mt-[3px] block font-pulse text-[0.75rem] text-pulse-muted">
                                {subtitle}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="mt-[2px] shrink-0 cursor-pointer border-none bg-transparent font-pulse text-[1.05rem] leading-none text-pulse-muted hover:text-pulse-text">
                        &#x2715;
                    </button>
                </div>

                {children}
            </div>
        </div>
    );
}
