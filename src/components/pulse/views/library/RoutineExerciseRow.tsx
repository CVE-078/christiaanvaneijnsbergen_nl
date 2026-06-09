'use client';
import { useEffect, useState } from 'react';
import { toDisplay, toKg } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import type { RoutineExercise, Unit } from '@/lib/pulse/types';
import { INPUT, BTN_PRIMARY } from '@/components/pulse/ui';

const SECTION_LABEL = 'font-pulse text-[0.625rem] tracking-[0.1em] uppercase text-pulse-muted';

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
            {/* Line 1: index + full exercise name */}
            <div className="flex items-center gap-3">
                <span className="font-pulse text-xs text-pulse-muted w-5 shrink-0">{displayNumber ?? index + 1}</span>
                <span className="font-pulse text-sm text-pulse-text flex-1 min-w-0 truncate">
                    {re.exercise.name}
                    {isHidden && (
                        <span className="ml-2 font-pulse text-[0.5625rem] tracking-[0.08em] uppercase text-pulse-muted">
                            Hidden
                        </span>
                    )}
                </span>
            </div>
            {/* Line 2: sets × reps then all actions, indented past the index column */}
            {!editing && (
                <div className="flex items-center gap-2.5 pl-8 flex-wrap">
                    <span className="font-pulse text-[0.6875rem] text-pulse-dim shrink-0">
                        {re.sets} × {re.reps}
                        {re.starting_weight_kg !== null && (
                            <>
                                {' '}
                                · {toDisplay(re.starting_weight_kg, unit)} {unit}
                            </>
                        )}
                    </span>
                    <span className="w-px h-3 bg-pulse-border shrink-0 self-center" aria-hidden />
                    <button
                        onClick={() => onMove(index, -1)}
                        disabled={!canMoveUp}
                        aria-label={`Move ${re.exercise.name} up`}
                        className="font-pulse text-[0.6875rem] text-pulse-dim bg-transparent border-none cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
                        ↑
                    </button>
                    <button
                        onClick={() => onMove(index, 1)}
                        disabled={!canMoveDown}
                        aria-label={`Move ${re.exercise.name} down`}
                        className="font-pulse text-[0.6875rem] text-pulse-dim bg-transparent border-none cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
                        ↓
                    </button>
                    <button
                        onClick={() => setEditing((v) => !v)}
                        aria-label={`Edit ${re.exercise.name}`}
                        className="font-pulse text-[0.6875rem] text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                        Edit
                    </button>
                    {onPair && (
                        <button
                            onClick={onPair}
                            className="font-pulse text-[0.6875rem] text-pulse-accent bg-transparent border-none cursor-pointer shrink-0">
                            Pair ↓
                        </button>
                    )}
                    {onUnpair && (
                        <button
                            onClick={onUnpair}
                            className="font-pulse text-[0.6875rem] text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                            Unpair
                        </button>
                    )}
                    <button
                        onClick={() => onRemove(re.id)}
                        aria-label={`Remove ${re.exercise.name}`}
                        className="font-pulse text-[0.6875rem] text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                        Remove
                    </button>
                </div>
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
