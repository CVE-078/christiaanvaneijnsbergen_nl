'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { explainCopy, type ExplainConcept, type ExplainCopy, type ExplainParams } from '@/lib/pulse/explainCopy';
import { useMediaQuery } from '@/hooks/pulse/useMediaQuery';
import ModalSheet from './ModalSheet';

interface WhyProps {
    /** The concept whose canonical explanation this affordance surfaces. */
    concept: ExplainConcept;
    /** Loose param bag the concept reads (e.g. progression -> isRepAdvance). */
    params?: ExplainParams;
    /**
     * `why` (default): a coaching decision (target weight, deload, status word).
     * Renders a trailing info glyph; a dotted underline under a number reads as an
     * input error, so numbers never get the underline.
     * `glossary`: a term / acronym (e1RM, "warm-up"). Renders a dotted underline,
     * the web convention for "tap for a definition".
     */
    variant?: 'why' | 'glossary';
    /** Desktop popover placement hint; defaults to auto (flips up when low). */
    position?: 'top' | 'bottom' | 'auto';
    /** The value / term the affordance sits on. */
    children: ReactNode;
}

// 12px muted info glyph (Lucide "info"), drawn as an SVG rather than a text glyph.
function InfoGlyph() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-1 inline-block shrink-0 text-pulse-muted"
            aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
    );
}

function WhyBody({ copy, className }: { copy: ExplainCopy; className?: string }) {
    return (
        <div className={className}>
            <p className="font-pulse-body text-[0.85rem] leading-relaxed text-pulse-dim">{copy.why}</p>
            {copy.next && (
                <p className="mt-2 font-pulse-body text-[0.8rem] leading-relaxed text-pulse-muted">{copy.next}</p>
            )}
        </div>
    );
}

const PANEL_WIDTH = 264;

// A real (non-modal) dialog anchored to the trigger, mirroring how ModalSheet
// owns its overlay: a transparent full-screen backdrop owns click-outside so
// dismissal never fights the surface underneath (e.g. SetLogger's inputs). It is
// portaled to document.body so it never inherits an ancestor's text-transform /
// tracking (e.g. an uppercase section header). Focus moves into it on open, is
// trapped while open, and the parent returns it to the trigger on close. A "Got
// it" button makes dismissal obvious (Escape / click-outside / re-tap still work).
function WhyPopover({
    copy,
    anchorRect,
    position,
    onClose,
}: {
    copy: ExplainCopy;
    anchorRect: DOMRect | null;
    position: 'top' | 'bottom' | 'auto';
    onClose: () => void;
}) {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Move focus to the first control (the "Got it" button) on open.
    useEffect(() => {
        const root = dialogRef.current;
        const focusable = root?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
        (focusable ?? root)?.focus();
    }, []);

    // Escape closes (document-level, like ModalSheet, so it works regardless of
    // where focus sits).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Place below the trigger by default; flip above when it sits in the lower
    // half or when explicitly hinted. Clamp horizontally so it never hard-clips
    // off the left/right edge (v1: not full collision detection, see spec).
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const openUp = position === 'top' || (position === 'auto' && !!anchorRect && anchorRect.bottom > vh / 2);
    const left = anchorRect ? Math.max(8, Math.min(anchorRect.left, vw - PANEL_WIDTH - 8)) : 8;
    const placement: CSSProperties = openUp
        ? { left, bottom: anchorRect ? vh - anchorRect.top + 8 : 8 }
        : { left, top: anchorRect ? anchorRect.bottom + 8 : 8 };

    return (
        <div className="fixed inset-0 z-50" onClick={onClose}>
            <div
                ref={dialogRef}
                role="dialog"
                aria-label={copy.title}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                    // Trap Tab / Shift+Tab to the dialog's own focusables so focus
                    // never leaks to the page behind a non-modal dialog.
                    if (e.key !== 'Tab') return;
                    const root = dialogRef.current;
                    if (!root) return;
                    const focusables = Array.from(
                        root.querySelectorAll<HTMLElement>(
                            'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
                        ),
                    );
                    if (focusables.length === 0) {
                        e.preventDefault();
                        root.focus();
                        return;
                    }
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    const active = document.activeElement;
                    if (e.shiftKey && (active === first || active === root)) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && active === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }}
                style={{ position: 'fixed', width: PANEL_WIDTH, ...placement }}
                className="relative overflow-hidden rounded-[14px] border border-pulse-border bg-pulse-surface py-3 pl-4 pr-2.5 normal-case tracking-normal shadow-[0_14px_40px_-12px_rgba(0,0,0,0.6)] outline-none">
                {/* Coach signature: a thin accent bar down the left edge. */}
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-pulse-accent/85" />
                <div className="flex items-start justify-between gap-2.5">
                    <p className="font-pulse text-[0.9rem] font-semibold leading-snug text-pulse-text">{copy.title}</p>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mt-0.5 shrink-0 cursor-pointer rounded-md border-none bg-transparent p-1 font-pulse text-[0.9rem] leading-none text-pulse-muted hover:text-pulse-text">
                        &#x2715;
                    </button>
                </div>
                <WhyBody copy={copy} className="mt-1 pr-1.5" />
            </div>
        </div>
    );
}

// Shared on-demand explanation affordance: tap a value or term, the coach
// answers. Zero chrome until invoked. Mobile reuses ModalSheet; desktop opens an
// anchored WhyPopover. The canonical copy lives in explainCopy, so every surface
// renders the same sentence.
export default function Why({ concept, params, variant = 'why', position = 'auto', children }: WhyProps) {
    const copy = explainCopy(concept, params);
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const [open, setOpen] = useState(false);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const close = () => {
        setOpen(false);
        triggerRef.current?.focus();
    };
    const toggle = () => {
        if (open) {
            close();
            return;
        }
        if (triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect());
        setOpen(true);
    };

    const triggerClass =
        variant === 'glossary'
            ? 'inline cursor-pointer border-none bg-transparent p-0 [font:inherit] text-inherit underline decoration-dotted decoration-pulse-muted underline-offset-2'
            : 'inline-flex items-center cursor-pointer border-none bg-transparent p-0 [font:inherit] text-inherit';

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label={copy.title}
                aria-expanded={open}
                onClick={toggle}
                className={triggerClass}>
                {children}
                {variant === 'why' && <InfoGlyph />}
            </button>

            {open &&
                typeof document !== 'undefined' &&
                createPortal(
                    isDesktop ? (
                        <WhyPopover copy={copy} anchorRect={anchorRect} position={position} onClose={close} />
                    ) : (
                        <ModalSheet open title={copy.title} onClose={close}>
                            <WhyBody copy={copy} className="px-6 pb-2" />
                        </ModalSheet>
                    ),
                    document.body,
                )}
        </>
    );
}
