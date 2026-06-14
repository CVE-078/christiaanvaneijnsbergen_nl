'use client';
import { useEffect, useState } from 'react';
import { toDisplay, toKg } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import type { RoutineExercise, Unit } from '@/lib/pulse/types';
import { INPUT, BTN_PRIMARY } from '@/components/pulse/ui';

const SECTION_LABEL = 'font-pulse text-[0.625rem] tracking-[0.1em] uppercase text-pulse-muted';
const ICONBTN =
    'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border-none bg-transparent text-pulse-dim cursor-pointer hover:bg-white/[0.06] hover:text-pulse-text disabled:opacity-30 disabled:cursor-not-allowed';

export default function RoutineExerciseRow({
    re,
    index,
    displayNumber,
    total,
    unit,
    onMove,
    onRemove,
    onUpdate,
    canMoveUp,
    canMoveDown,
    onPair,
    onUnpair,
}: {
    re: RoutineExercise;
    /** Position in the flat ordered list; drives reorder (onMove) and move-bound checks. */
    index: number;
    /** 1-based number shown in the badge. Per-session in grouped views (matches Plan);
     *  falls back to index + 1 (flat numbering) when omitted. */
    displayNumber?: number;
    total: number;
    unit: Unit;
    onMove: (index: number, dir: -1 | 1) => void;
    onRemove: (id: string) => void;
    onUpdate: (
        id: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
        restSeconds: number | null,
    ) => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onPair?: () => void;
    onUnpair?: () => void;
}) {
    const { hiddenExerciseIds } = usePulse();
    const isHidden = hiddenExerciseIds.has(re.exercise_id);
    const [editing, setEditing] = useState(false);
    const [sets, setSets] = useState(re.sets);
    const [reps, setReps] = useState(re.reps);
    const [weight, setWeight] = useState(
        re.starting_weight_kg !== null ? String(toDisplay(re.starting_weight_kg, unit)) : '',
    );
    const [rest, setRest] = useState<string>(re.rest_seconds != null ? String(re.rest_seconds) : '');

    useEffect(() => {
        if (!editing) {
            setSets(re.sets);
            setReps(re.reps);
            setWeight(re.starting_weight_kg !== null ? String(toDisplay(re.starting_weight_kg, unit)) : '');
            setRest(re.rest_seconds != null ? String(re.rest_seconds) : '');
        }
    }, [re.id, re.sets, re.reps, re.starting_weight_kg, re.rest_seconds, unit, editing]);

    function handleSave() {
        const trimmed = weight.trim();
        const raw = trimmed === '' ? NaN : parseFloat(trimmed);
        const kgValue = Number.isNaN(raw) ? null : toKg(raw, unit);
        const restValue = rest !== '' ? Number(rest) : null;
        onUpdate(re.id, sets, reps, kgValue, restValue);
        setEditing(false);
    }

    return (
        <div className="flex flex-col gap-1.5 bg-pulse-surface rounded-xl px-3 py-2.5">
            {/* Line 1: index + name + right-anchored icon cluster (variant A) */}
            <div className="flex items-center gap-2">
                <span className="font-pulse text-xs text-pulse-muted w-5 shrink-0">{displayNumber ?? index + 1}</span>
                <span className="font-pulse text-sm text-pulse-text flex-1 min-w-0 truncate">
                    {re.exercise.name}
                    {isHidden && (
                        <span className="ml-2 font-pulse text-[0.5625rem] tracking-[0.08em] uppercase text-pulse-muted">
                            Hidden
                        </span>
                    )}
                </span>
                {!editing && (
                    <span className="flex shrink-0 items-center gap-0.5">
                        {/* Pair (conditional) sits LEFT so the persistent icons never shift */}
                        {onPair && (
                            <button
                                type="button"
                                onClick={onPair}
                                aria-label={`Pair ${re.exercise.name} with next`}
                                className={`${ICONBTN} text-pulse-accent`}>
                                {/* link icon */}
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    aria-hidden>
                                    <path
                                        d="M6.5 9.5l3-3M5 8l-1.5 1.5a2.1 2.1 0 0 0 3 3L8 11M11 8l1.5-1.5a2.1 2.1 0 0 0-3-3L8 5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        )}
                        {onUnpair && (
                            <button
                                type="button"
                                onClick={onUnpair}
                                aria-label={`Unpair ${re.exercise.name}`}
                                className={`${ICONBTN} text-pulse-accent`}>
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    aria-hidden>
                                    <path d="M3 8h7M7 5l3 3-3 3M13 4v8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onMove(index, -1)}
                            disabled={!canMoveUp}
                            aria-label={`Move ${re.exercise.name} up`}
                            className={ICONBTN}>
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                aria-hidden>
                                <polyline points="4 10 8 6 12 10" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => onMove(index, 1)}
                            disabled={!canMoveDown}
                            aria-label={`Move ${re.exercise.name} down`}
                            className={ICONBTN}>
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                aria-hidden>
                                <polyline points="4 6 8 10 12 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            aria-label={`Edit ${re.exercise.name}`}
                            className={ICONBTN}>
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                aria-hidden>
                                <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => onRemove(re.id)}
                            aria-label={`Remove ${re.exercise.name}`}
                            className={`${ICONBTN} text-pulse-error hover:bg-pulse-error/10 hover:text-pulse-error`}>
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                aria-hidden>
                                <path
                                    d="M3 4.5h10M6 4.5V3.2c0-.4.3-.7.7-.7h2.6c.4 0 .7.3.7.7v1.3M5 4.5l.5 8c0 .5.4.9.9.9h3.2c.5 0 .9-.4.9-.9l.5-8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </span>
                )}
            </div>
            {/* Line 2: sets x reps meta (only when not editing) */}
            {!editing && (
                <span className="font-pulse text-[0.6875rem] text-pulse-dim pl-7">
                    {re.sets} × {re.reps}
                    {re.starting_weight_kg !== null && (
                        <>
                            {' '}
                            · {toDisplay(re.starting_weight_kg, unit)} {unit}
                        </>
                    )}
                </span>
            )}
            {editing && (
                <div className="flex flex-wrap items-end gap-2 pl-8">
                    <label className="flex flex-col gap-1">
                        <span className={SECTION_LABEL}>Sets</span>
                        <input
                            aria-label={`${re.exercise.name} sets`}
                            value={sets}
                            onChange={(e) => setSets(e.target.value)}
                            className={`${INPUT} w-16`}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className={SECTION_LABEL}>Reps</span>
                        <input
                            aria-label={`${re.exercise.name} reps`}
                            value={reps}
                            onChange={(e) => setReps(e.target.value)}
                            className={`${INPUT} w-16`}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className={SECTION_LABEL}>Weight ({unit})</span>
                        <input
                            type="number"
                            aria-label={`${re.exercise.name} starting weight`}
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            className={`${INPUT} w-24`}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className={SECTION_LABEL}>Rest</span>
                        <select
                            aria-label={`${re.exercise.name} rest duration`}
                            value={rest}
                            onChange={(e) => setRest(e.target.value)}
                            className={INPUT}>
                            <option value="">Default</option>
                            <option value="60">60 s</option>
                            <option value="90">90 s</option>
                            <option value="120">2 min</option>
                            <option value="180">3 min</option>
                        </select>
                    </label>
                    <button onClick={handleSave} className={BTN_PRIMARY}>
                        Save
                    </button>
                </div>
            )}
        </div>
    );
}
