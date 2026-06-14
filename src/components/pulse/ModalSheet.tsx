'use client';
import {
    useEffect,
    useId,
    useRef,
    useState,
    type ReactNode,
    type TouchEvent as ReactTouchEvent,
    type MouseEvent as ReactMouseEvent,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

// Drag the grip down past this many pixels to dismiss the sheet.
const SWIPE_DISMISS_PX = 90;

// Selector for the elements the focus trap cycles through. Excludes anything
// explicitly removed from the tab order (tabindex="-1", e.g. the grip).
const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
    /** Accessible dialog label; defaults to labelling the dialog by its title. */
    ariaLabel?: string;
    /**
     * Max panel width on tablet/desktop (a number is read as px). Defaults to
     * 560px. Widen it for content-dense sheets (e.g. a settings panel).
     */
    maxWidth?: number | string;
    /**
     * A pinned action region below the scrollable body. It stays visible while
     * the body scrolls, so primary actions (Apply / Save) are always reachable.
     */
    footer?: ReactNode;
    /** Sheet body, rendered in the scrollable region below the header. Use px-6 for edge alignment. */
    children: ReactNode;
}

// Shared modal shell: bottom-sheet on phones (< md), centered dialog on tablet
// and desktop (>= md, no grip/swipe). Owns the overlay, panel sizing, the
// phone-only grip, Escape-to-close, focus management (trap + restore), and a
// standardized header (optional back chevron · title + subtitle · close). It is
// the single source of truth for modal spacing (p-6 edges), so every Pulse modal
// reads the same. The body below the header scrolls; pass pinned actions as `footer`.
export default function ModalSheet({
    open,
    onClose,
    onBack,
    title,
    subtitle,
    ariaLabel,
    maxWidth = 560,
    footer,
    children,
}: Props) {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

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

    // Move focus into the dialog on open and return it to whatever was focused
    // before (the trigger) on close, so keyboard users are not dropped at the top
    // of the page. Focusing the panel itself (tabIndex -1) lets the dialog be
    // announced by its aria label before Tab walks into the controls.
    useEffect(() => {
        if (!open) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        return () => previouslyFocused?.focus?.();
    }, [open]);

    // Trap Tab within the dialog: wrap from last to first and back, so focus
    // never escapes to the inert page behind the overlay.
    const onPanelKeyDown = (e: ReactKeyboardEvent) => {
        if (e.key !== 'Tab') return;
        const panel = panelRef.current;
        if (!panel) return;
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.offsetParent !== null,
        );
        if (items.length === 0) {
            e.preventDefault();
            panel.focus();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        // active === panel covers the just-opened state: the panel holds focus
        // (tabIndex -1) so a backward Tab would otherwise escape to the page.
        if (e.shiftKey && (active === first || active === panel)) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    };

    // Drag-down-to-dismiss from the grip. Works with touch (mobile bottom sheet)
    // AND mouse (a narrow desktop window where the bottom sheet shows). Follows
    // the pointer and closes past the threshold, snapping back otherwise.
    const [dragY, setDragY] = useState(0);
    const [dragging, setDragging] = useState(false);
    const startY = useRef<number | null>(null);
    const dragYRef = useRef(0);
    const mouseCleanup = useRef<(() => void) | null>(null);

    // Keep a ref in sync with dragY so imperative window listeners (mouse drag)
    // read the latest value rather than a stale closure.
    const setDrag = (y: number) => {
        dragYRef.current = y;
        setDragY(y);
    };

    // Reset any in-flight drag when the sheet is dismissed externally, so it never
    // reopens mid-translated, and detach any live mouse listeners.
    useEffect(() => {
        if (!open) {
            setDrag(0);
            setDragging(false);
            startY.current = null;
            mouseCleanup.current?.();
            mouseCleanup.current = null;
        }
    }, [open]);

    const onGripTouchStart = (e: ReactTouchEvent) => {
        startY.current = e.touches[0]?.clientY ?? null;
        setDragging(true);
    };
    const onGripTouchMove = (e: ReactTouchEvent) => {
        if (startY.current === null) return;
        const dy = (e.touches[0]?.clientY ?? startY.current) - startY.current;
        setDrag(dy > 0 ? dy : 0);
    };
    const onGripTouchEnd = () => {
        if (dragYRef.current > SWIPE_DISMISS_PX) onClose();
        setDrag(0);
        setDragging(false);
        startY.current = null;
    };

    // Mouse drag: attach move/up to the window so the drag keeps tracking even if
    // the cursor leaves the grip; self-detaching on release.
    const onGripMouseDown = (e: ReactMouseEvent) => {
        e.preventDefault(); // no text selection while dragging
        startY.current = e.clientY;
        setDragging(true);
        const move = (ev: globalThis.MouseEvent) => {
            if (startY.current === null) return;
            const dy = ev.clientY - startY.current;
            setDrag(dy > 0 ? dy : 0);
        };
        const up = () => {
            if (dragYRef.current > SWIPE_DISMISS_PX) onClose();
            setDrag(0);
            setDragging(false);
            startY.current = null;
            mouseCleanup.current?.();
            mouseCleanup.current = null;
        };
        mouseCleanup.current = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabel ? undefined : titleId}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center"
            onClick={onClose}>
            <div
                ref={panelRef}
                tabIndex={-1}
                onKeyDown={onPanelKeyDown}
                className="flex max-h-[86vh] w-full flex-col rounded-t-[20px] bg-pulse-surface outline-none md:mx-6 md:max-h-[78vh] md:rounded-[18px]"
                style={{
                    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
                    transform: dragY ? `translateY(${dragY}px)` : undefined,
                    transition: dragging ? 'none' : 'transform 0.2s ease',
                }}
                onClick={(e) => e.stopPropagation()}>
                {/* Grip handle, mobile only. The whole strip is the drag target so a
                    downward swipe dismisses the sheet (see onGripTouch* above). It is
                    decorative for assistive tech (drag is pointer-only), so aria-hidden. */}
                <div
                    data-testid="modal-grip"
                    className="flex cursor-grab touch-none justify-center pb-1 pt-2 active:cursor-grabbing md:hidden"
                    aria-hidden
                    tabIndex={-1}
                    onTouchStart={onGripTouchStart}
                    onTouchMove={onGripTouchMove}
                    onTouchEnd={onGripTouchEnd}
                    onMouseDown={onGripMouseDown}>
                    <span className="h-1 w-10 rounded-full bg-pulse-border" />
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
                        <span
                            id={titleId}
                            className="block truncate font-pulse-display text-[1.3rem] font-bold leading-tight text-pulse-text">
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

                {/* Scrollable body: the header above and the footer below stay pinned
                    while this region scrolls. min-h-0 lets it shrink inside the flex
                    column so overflow actually triggers rather than blowing past max-h. */}
                <div className="min-h-0 flex-1 overflow-y-auto pb-6">{children}</div>

                {footer && <div className="border-t border-pulse-border px-6 pb-6 pt-4">{footer}</div>}
            </div>
        </div>
    );
}
