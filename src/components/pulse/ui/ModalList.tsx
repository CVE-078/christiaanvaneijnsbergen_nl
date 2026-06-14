import type { ReactNode } from 'react';

// Shared list-modal primitives, so every "show all" sheet (milestones, coach
// decisions, workouts, body metrics) renders the same section headers and icon
// badges. The single source of truth for the list-modal visual language; new
// list modals MUST use these rather than re-inventing the markup.

// A sticky section header: an uppercase muted label, a hairline divider that
// fills the row, and an optional right-aligned count ("47 milestones").
export function ModalGroupHeader({ label, count }: { label: string; count?: ReactNode }) {
    return (
        <div className="sticky -top-0.5 z-10 flex items-center gap-3 bg-pulse-surface pb-2 pt-3">
            <span className="font-pulse text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-pulse-muted">
                {label}
            </span>
            <span className="h-px flex-1 bg-pulse-border" />
            {count != null && count !== '' && (
                <span className="shrink-0 font-pulse text-[0.64rem] text-pulse-muted">{count}</span>
            )}
        </div>
    );
}

// The 33px rounded-square icon badge for list-modal rows. The tint (background +
// icon colour) comes from `className`, e.g. "bg-pulse-accent/15 text-pulse-accent".
export function ModalIconBadge({ className = '', children }: { className?: string; children: ReactNode }) {
    return (
        <span className={`grid h-[33px] w-[33px] shrink-0 place-items-center rounded-[10px] ${className}`}>
            {children}
        </span>
    );
}
