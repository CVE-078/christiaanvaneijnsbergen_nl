'use client';
import { useEffect, useState } from 'react';
import ModalSheet from '@/components/pulse/ModalSheet';
import type { DbExercise, ExerciseInstruction } from '@/lib/pulse/types';

interface ExerciseDetailSheetProps {
    exercise: DbExercise;
    favorite: boolean;
    hidden: boolean;
    similar: DbExercise[];
    open: boolean;
    onClose: () => void;
    onToggleFavorite: (ex: DbExercise) => void;
    onToggleHide: (ex: DbExercise) => void;
    onEdit?: (ex: DbExercise) => void;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Friendly labels for movement pattern values.
const PATTERN_LABELS: Record<string, string> = {
    horizontal_push: 'Horizontal push',
    vertical_push: 'Vertical push',
    horizontal_pull: 'Horizontal pull',
    vertical_pull: 'Vertical pull',
    squat: 'Squat',
    hinge: 'Hinge',
    lunge: 'Lunge',
    carry: 'Carry',
    core: 'Core',
    calf: 'Calf',
    chest_iso: 'Chest isolation',
    triceps_iso: 'Triceps isolation',
    biceps_iso: 'Biceps isolation',
    lateral_raise: 'Lateral raise',
    front_delt_isolation: 'Front delt isolation',
    back_iso: 'Back isolation',
    glute_iso: 'Glute isolation',
    quad_iso: 'Quad isolation',
    hamstring_iso: 'Hamstring isolation',
};

function patternLabel(p: string | null | undefined): string | null {
    if (!p) return null;
    return PATTERN_LABELS[p] ?? p.replace(/_/g, ' ');
}

export default function ExerciseDetailSheet({
    exercise,
    favorite,
    hidden,
    similar,
    open,
    onClose,
    onToggleFavorite,
    onToggleHide,
    onEdit,
}: ExerciseDetailSheetProps) {
    const [instructions, setInstructions] = useState<ExerciseInstruction | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setInstructions(null);
        setLoading(true);
        fetch(`/api/pulse/exercises/${exercise.id}/instructions`)
            .then((res) => {
                if (!res.ok) throw new Error('not found');
                return res.json() as Promise<ExerciseInstruction>;
            })
            .then((d) => {
                if (!cancelled) {
                    setInstructions(d);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, exercise.id]);

    const subtitle = `${cap(exercise.category)} · ${exercise.is_compound ? 'Compound' : 'Isolation'}`;

    const badges: string[] = [
        cap(exercise.category),
        ...(exercise.equipment ?? []).map((e) => cap(e)),
        exercise.is_compound ? 'Compound' : 'Isolation',
    ];
    const patternText = patternLabel(exercise.movement_pattern);
    if (patternText) badges.push(patternText);

    const hasCues = !loading && instructions && instructions.cues.length > 0;
    const hasTargets = !loading && instructions && (instructions.primary_muscles.length > 0 || instructions.secondary_muscles.length > 0);

    return (
        <ModalSheet open={open} onClose={onClose} title={exercise.name} subtitle={subtitle}>
            <div className="overflow-y-auto px-6 pb-2">
                {/* Metadata badges */}
                <div className="mb-4 flex flex-wrap gap-1.5" data-testid="exercise-detail-badges">
                    {badges.map((badge) => (
                        <span
                            key={badge}
                            className={`rounded-lg px-2.5 py-1 font-pulse text-xs font-medium ${
                                badge === 'Compound' || badge === 'Isolation'
                                    ? 'bg-pulse-accent/10 text-pulse-accent'
                                    : 'bg-pulse-surface-2 text-pulse-dim'
                            }`}>
                            {badge}
                        </span>
                    ))}
                </div>

                {/* Actions row: Favorite + Hide (+ Edit for custom) */}
                <div className="mb-5 flex gap-2">
                    <button
                        type="button"
                        aria-pressed={favorite}
                        aria-label={favorite ? 'Favorited' : 'Favorite'}
                        onClick={() => onToggleFavorite(exercise)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 font-pulse text-sm font-medium transition-colors ${
                            favorite
                                ? 'border-pulse-accent/40 bg-pulse-accent/8 text-pulse-accent'
                                : 'border-pulse-border bg-transparent text-pulse-text'
                        }`}>
                        <svg width="15" height="15" viewBox="0 0 20 20" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden>
                            <path d="M10 1l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9 4.7 17.6l1-5.8L1.5 7.7l5.9-.9z" strokeLinejoin="round" />
                        </svg>
                        {favorite ? 'Favorited' : 'Favorite'}
                    </button>
                    <button
                        type="button"
                        aria-label={hidden ? 'Unhide' : 'Hide'}
                        onClick={() => onToggleHide(exercise)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-pulse-border bg-transparent py-2.5 font-pulse text-sm font-medium text-pulse-text transition-colors hover:border-pulse-dim">
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                            {hidden ? (
                                <>
                                    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
                                    <circle cx="8" cy="8" r="2" />
                                </>
                            ) : (
                                <>
                                    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
                                    <circle cx="8" cy="8" r="2" />
                                    <line x1="2" y1="2" x2="14" y2="14" strokeLinecap="round" />
                                </>
                            )}
                        </svg>
                        {hidden ? 'Unhide' : 'Hide'}
                    </button>
                    {onEdit && (
                        <button
                            type="button"
                            aria-label="Edit"
                            onClick={() => onEdit(exercise)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-pulse-border bg-transparent py-2.5 font-pulse text-sm font-medium text-pulse-text transition-colors hover:border-pulse-dim">
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                                <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
                            </svg>
                            Edit
                        </button>
                    )}
                </div>

                {/* Targets section */}
                {loading && (
                    <p className="mb-4 font-pulse text-sm text-pulse-muted">Loading&hellip;</p>
                )}
                {hasTargets && (
                    <div className="mb-4">
                        <div className="mb-2 font-pulse text-[0.625rem] uppercase tracking-[0.12em] text-pulse-muted">
                            Targets
                        </div>
                        <div className="font-pulse-body text-sm">
                            <div className="flex flex-wrap gap-1.5">
                                {instructions!.primary_muscles.map((m) => (
                                    <span
                                        key={m}
                                        className="rounded-full border border-pulse-accent/25 bg-pulse-accent/10 px-2.5 py-0.5 text-xs font-medium text-pulse-accent">
                                        {m}
                                    </span>
                                ))}
                                {instructions!.secondary_muscles.map((m) => (
                                    <span
                                        key={m}
                                        className="rounded-full bg-pulse-surface-2 px-2.5 py-0.5 text-xs font-medium text-pulse-dim">
                                        {m}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* How to section */}
                {hasCues && (
                    <div className="mb-4">
                        <div className="mb-2 font-pulse text-[0.625rem] uppercase tracking-[0.12em] text-pulse-muted">
                            How to
                        </div>
                        <ol className="m-0 flex flex-col gap-1 pl-4 font-pulse-body text-sm leading-relaxed text-pulse-dim">
                            {instructions!.cues.map((cue, i) => (
                                <li key={i}>{cue}</li>
                            ))}
                        </ol>
                    </div>
                )}

                {/* Similar exercises section */}
                {similar.length > 0 && (
                    <div className="mb-4">
                        <div className="mb-2 font-pulse text-[0.625rem] uppercase tracking-[0.12em] text-pulse-muted">
                            Similar exercises
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {similar.map((ex) => (
                                <span
                                    key={ex.id}
                                    className="rounded-lg border border-pulse-border bg-pulse-surface-2 px-2.5 py-1.5 font-pulse text-xs text-pulse-text">
                                    {ex.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </ModalSheet>
    );
}
