'use client';
import { useEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';

// Drag the grip down past this many pixels to dismiss the sheet.
const SWIPE_DISMISS_PX = 90;

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

// Shared modal shell: bottom-sheet on phones (< md), centered dialog on tablet
// and desktop (>= md, no grip/swipe). Owns the overlay, panel sizing, the
// phone-only grip, Escape-to-close, and a standardized
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

    // Lock the page behind the sheet so it cannot scroll while a modal is open;
    // restore the prior value on close so nested/sequential modals don't leak it.
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    // Swipe-down-to-dismiss from the grip (mobile). Tracks a downward drag,
    // follows the finger, and closes past the threshold, snapping back otherwise.
    const [dragY, setDragY] = useState(0);
    const [dragging, setDragging] = useState(false);
    const startY = useRef<number | null>(null);

    // Reset any in-flight drag when the sheet is dismissed externally, so it never
    // reopens mid-translated.
    useEffect(() => {
        if (!open) {
            setDragY(0);
            setDragging(false);
            startY.current = null;
        }
    }, [open]);

    const onGripTouchStart = (e: ReactTouchEvent) => {
        startY.current = e.touches[0]?.clientY ?? null;
        setDragging(true);
    };
    const onGripTouchMove = (e: ReactTouchEvent) => {
        if (startY.current === null) return;
        const dy = (e.touches[0]?.clientY ?? startY.current) - startY.current;
        setDragY(dy > 0 ? dy : 0);
    };
    const onGripTouchEnd = () => {
        if (dragY > SWIPE_DISMISS_PX) onClose();
        setDragY(0);
        setDragging(false);
        startY.current = null;
    };

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel ?? title}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center"
            onClick={onClose}>
            <div
                className="flex w-full max-w-[560px] max-h-[86vh] flex-col rounded-t-[20px] bg-pulse-surface pb-6 md:max-h-[78vh] md:rounded-[18px] md:mx-6"
                style={{
                    transform: dragY ? `translateY(${dragY}px)` : undefined,
                    transition: dragging ? 'none' : 'transform 0.2s ease',
                }}
                onClick={(e) => e.stopPropagation()}>
                {/* Grip handle, mobile only. The whole strip is the drag target so a
                    downward swipe dismisses the sheet (see onGripTouch* above). */}
                <div
                    className="flex touch-none justify-center pb-1 pt-2 md:hidden"
                    role="button"
                    aria-label="Drag down to dismiss"
                    tabIndex={-1}
                    onTouchStart={onGripTouchStart}
                    onTouchMove={onGripTouchMove}
                    onTouchEnd={onGripTouchEnd}>
                    <span className="h-1 w-10 rounded-full bg-pulse-border" aria-hidden />
                </div>

                {/* Standardized header. Desktop gets the full p-6 top; mobile keeps a
                    tighter top because the grip handle already sits above it. */}
                <div className="flex items-start gap-3 px-6 pb-3 pt-4 md:pt-6">
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
