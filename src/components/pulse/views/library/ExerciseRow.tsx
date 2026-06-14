'use client';
import type { DbExercise } from '@/lib/pulse/types';
import { EQUIPMENT_LABELS } from '@/lib/pulse/constants';

interface ExerciseRowProps {
    exercise: DbExercise;
    favorite: boolean;
    hidden: boolean;
    showCategory: boolean;
    onOpen: (ex: DbExercise) => void;
    onToggleFavorite: (ex: DbExercise) => void;
}

function cap(s: string): string {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Star icon: filled when favorite, outlined when not.
function StarIcon({ filled }: { filled: boolean }) {
    return filled ? (
        <svg
            width="17"
            height="17"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden>
            <path d="M10 1l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9 4.7 17.6l1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
    ) : (
        <svg
            width="17"
            height="17"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden>
            <path d="M10 1l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9 4.7 17.6l1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
    );
}

// Chevron-right icon.
function ChevronIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden>
            <polyline points="6 3 11 8 6 13" />
        </svg>
    );
}

// A single exercise row: favorite star + name + metadata + open chevron.
// The star stops propagation so tapping it never triggers onOpen.
export default function ExerciseRow({
    exercise,
    favorite,
    hidden,
    showCategory,
    onOpen,
    onToggleFavorite,
}: ExerciseRowProps) {
    const { name, category, equipment, is_compound } = exercise;

    // Build the metadata segments in order: category (if shown), equipment, compound/isolation.
    const segments: string[] = [];
    if (showCategory) segments.push(cap(category));
    if (equipment && equipment.length > 0) {
        const labels = equipment.map((k) => EQUIPMENT_LABELS[k as keyof typeof EQUIPMENT_LABELS] ?? cap(k));
        segments.push(labels.join('/'));
    }
    if (is_compound !== undefined) segments.push(is_compound ? 'Compound' : 'Isolation');

    const metaText = segments.join(' · ');

    return (
        // The whole card is the click target. <button> cannot nest <button>, so use a div
        // with role="button". The favorite star stops propagation so it never fires onOpen.
        <div
            data-testid="exercise-row-body"
            role="button"
            tabIndex={0}
            aria-label={name}
            onClick={() => onOpen(exercise)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(exercise);
                }
            }}
            className={`flex cursor-pointer items-center gap-[11px] rounded-[12px] bg-pulse-surface px-3 py-[11px]${hidden ? ' opacity-50' : ''}`}>
            {/* Favorite star button -- stops propagation so it never fires onOpen */}
            <button
                type="button"
                aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-pressed={favorite}
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(exercise);
                }}
                className={`shrink-0 cursor-pointer border-none bg-transparent p-0${favorite ? ' text-pulse-accent' : ' text-pulse-muted'}`}>
                <StarIcon filled={favorite} />
            </button>

            {/* Name + metadata (non-interactive, whole card is the click target) */}
            <div className="min-w-0 flex-1 text-left">
                <div className="text-[0.88rem] text-pulse-text">{name}</div>
                {metaText && (
                    <div
                        data-testid="exercise-row-meta"
                        className="mt-[3px] font-pulse-body text-[0.69rem] text-pulse-dim">
                        {metaText}
                    </div>
                )}
            </div>

            {/* Chevron: decorative, whole card opens detail */}
            <span aria-hidden className="shrink-0 text-pulse-muted">
                <ChevronIcon />
            </span>
        </div>
    );
}
