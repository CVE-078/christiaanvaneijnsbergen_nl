'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '@/hooks/pulse/useMediaQuery';
import ModalSheet from '@/components/pulse/ModalSheet';
import type { GroupBy } from '@/lib/pulse/library';

export interface FilterState {
    favorites: boolean;
    fitsGear: boolean;
    respectsRestrictions: boolean;
    showHidden: boolean;
}

interface ExerciseFilterControlProps {
    value: FilterState;
    activeProfileName: string | null;
    onChange: (next: FilterState) => void;
    groupBy: GroupBy;
    onGroupByChange: (g: GroupBy) => void;
}

// Filter icon (three horizontal lines, narrowing).
function FilterIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden>
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="4" y1="8" x2="12" y2="8" />
            <line x1="6" y1="12" x2="10" y2="12" />
        </svg>
    );
}

interface ToggleRowProps {
    label: string;
    checked: boolean;
    onToggle: () => void;
}

function ToggleRow({ label, checked, onToggle }: ToggleRowProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={onToggle}
            className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-0 py-2 text-left">
            <span className="font-pulse text-[0.88rem] font-medium text-pulse-text">{label}</span>
            {/* Visual toggle pill */}
            <span
                aria-hidden
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors${checked ? ' bg-pulse-accent' : ' bg-pulse-surface-2'}`}>
                <span
                    className={`h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform${checked ? ' translate-x-[18px]' : ' translate-x-1'}`}
                />
            </span>
        </button>
    );
}

const GROUP_BY_OPTIONS: [GroupBy, string][] = [
    ['muscle', 'Muscle'],
    ['equipment', 'Equipment'],
    ['type', 'Type'],
];

interface GroupByRowProps {
    value: GroupBy;
    onChange: (g: GroupBy) => void;
}

function GroupByRow({ value, onChange }: GroupByRowProps) {
    return (
        <div className="py-2">
            <p className="mb-1.5 font-pulse text-[0.75rem] uppercase tracking-[0.10em] text-pulse-muted">Group by</p>
            <div
                role="group"
                aria-label="Group by"
                className="flex rounded-[8px] border border-pulse-border bg-pulse-surface-2 overflow-hidden">
                {GROUP_BY_OPTIONS.map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={value === key}
                        aria-label={label}
                        onClick={() => onChange(key)}
                        className={[
                            'flex-1 py-[7px] font-pulse text-[0.78rem] transition-colors leading-none',
                            value === key
                                ? 'bg-pulse-accent/15 text-pulse-accent font-medium'
                                : 'text-pulse-muted hover:text-pulse-dim',
                        ].join(' ')}>
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}

const PANEL_WIDTH = 280;

interface FilterPanelProps {
    value: FilterState;
    activeProfileName: string | null;
    anchorRect: DOMRect | null;
    onChange: (next: FilterState) => void;
    onClose: () => void;
    groupBy: GroupBy;
    onGroupByChange: (g: GroupBy) => void;
}

function FilterPopover({ value, activeProfileName, anchorRect, onChange, onClose, groupBy, onGroupByChange }: FilterPanelProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = dialogRef.current;
        const focusable = root?.querySelector<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        (focusable ?? root)?.focus();
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const openUp = !!anchorRect && anchorRect.bottom > vh / 2;
    const left = anchorRect ? Math.max(8, Math.min(anchorRect.left, vw - PANEL_WIDTH - 8)) : 8;
    const placement: CSSProperties = openUp
        ? { left, bottom: anchorRect ? vh - anchorRect.top + 8 : 8 }
        : { left, top: anchorRect ? anchorRect.bottom + 8 : 8 };

    const fitsGearLabel = activeProfileName ? `Fits my gear: ${activeProfileName}` : 'Fits my gear';

    return (
        <div className="fixed inset-0 z-50" onClick={onClose}>
            <div
                ref={dialogRef}
                role="dialog"
                aria-label="Filter exercises"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                    if (e.key !== 'Tab') return;
                    const root = dialogRef.current;
                    if (!root) return;
                    const focusables = Array.from(
                        root.querySelectorAll<HTMLElement>(
                            'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
                        ),
                    );
                    if (focusables.length === 0) { e.preventDefault(); root.focus(); return; }
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    const active = document.activeElement;
                    if (e.shiftKey && (active === first || active === root)) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
                }}
                style={{ position: 'fixed', width: PANEL_WIDTH, ...placement }}
                className="overflow-hidden rounded-[14px] border border-pulse-border bg-pulse-surface px-4 py-2 shadow-[0_14px_40px_-12px_rgba(0,0,0,0.6)] outline-none">
                <GroupByRow value={groupBy} onChange={onGroupByChange} />
                <div className="border-t border-pulse-border/40" />
                <ToggleRow
                    label="Favorites"
                    checked={value.favorites}
                    onToggle={() => onChange({ ...value, favorites: !value.favorites })}
                />
                <div className="border-t border-pulse-border/40" />
                <ToggleRow
                    label={fitsGearLabel}
                    checked={value.fitsGear}
                    onToggle={() => onChange({ ...value, fitsGear: !value.fitsGear })}
                />
                <div className="border-t border-pulse-border/40" />
                <ToggleRow
                    label="Respects my restrictions"
                    checked={value.respectsRestrictions}
                    onToggle={() => onChange({ ...value, respectsRestrictions: !value.respectsRestrictions })}
                />
                <div className="border-t border-pulse-border/40" />
                <ToggleRow
                    label="Show hidden"
                    checked={value.showHidden}
                    onToggle={() => onChange({ ...value, showHidden: !value.showHidden })}
                />
            </div>
        </div>
    );
}

// A filter trigger (icon + count badge) that opens a panel with group-by and four toggle rows.
// Desktop: portaled popover anchored to the trigger.
// Mobile: ModalSheet.
export default function ExerciseFilterControl({ value, activeProfileName, onChange, groupBy, onGroupByChange }: ExerciseFilterControlProps) {
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const [open, setOpen] = useState(false);
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const activeCount = [value.favorites, value.fitsGear, value.respectsRestrictions, value.showHidden].filter(Boolean)
        .length;

    const toggle = () => {
        if (open) { setOpen(false); return; }
        if (triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect());
        setOpen(true);
    };
    const close = () => {
        setOpen(false);
        triggerRef.current?.focus();
    };

    const fitsGearLabel = activeProfileName ? `Fits my gear: ${activeProfileName}` : 'Fits my gear';

    const panelContent = (
        <>
            <GroupByRow value={groupBy} onChange={onGroupByChange} />
            <div className="border-t border-pulse-border/40 mx-6" />
            <ToggleRow
                label="Favorites"
                checked={value.favorites}
                onToggle={() => onChange({ ...value, favorites: !value.favorites })}
            />
            <div className="border-t border-pulse-border/40 mx-6" />
            <ToggleRow
                label={fitsGearLabel}
                checked={value.fitsGear}
                onToggle={() => onChange({ ...value, fitsGear: !value.fitsGear })}
            />
            <div className="border-t border-pulse-border/40 mx-6" />
            <ToggleRow
                label="Respects my restrictions"
                checked={value.respectsRestrictions}
                onToggle={() => onChange({ ...value, respectsRestrictions: !value.respectsRestrictions })}
            />
            <div className="border-t border-pulse-border/40 mx-6" />
            <ToggleRow
                label="Show hidden"
                checked={value.showHidden}
                onToggle={() => onChange({ ...value, showHidden: !value.showHidden })}
            />
        </>
    );

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                data-testid="filter-trigger"
                aria-label="Filter exercises"
                aria-expanded={open}
                onClick={toggle}
                className={`relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border bg-pulse-surface${activeCount > 0 ? ' border-pulse-accent text-pulse-accent' : ' border-pulse-border text-pulse-dim'}`}>
                <FilterIcon />
                {activeCount > 0 && (
                    <span
                        data-testid="filter-badge"
                        aria-live="polite"
                        className="absolute -right-1.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-[8px] bg-pulse-accent px-1 font-pulse text-[0.58rem] font-semibold leading-none text-pulse-bg">
                        {activeCount}
                    </span>
                )}
            </button>

            {open &&
                typeof document !== 'undefined' &&
                createPortal(
                    isDesktop ? (
                        <FilterPopover
                            value={value}
                            activeProfileName={activeProfileName}
                            anchorRect={anchorRect}
                            onChange={onChange}
                            onClose={close}
                            groupBy={groupBy}
                            onGroupByChange={onGroupByChange}
                        />
                    ) : (
                        <ModalSheet open title="Filter exercises" onClose={close}>
                            <div className="px-6 pb-4">
                                {panelContent}
                            </div>
                        </ModalSheet>
                    ),
                    document.body,
                )}
        </>
    );
}
