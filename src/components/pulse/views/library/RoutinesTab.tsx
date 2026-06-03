'use client';
import { useEffect, useState, useTransition } from 'react';
import { mutate } from 'swr';
import { usePulse } from '@/context/PulseContext';
import { toDisplay, toKg } from '@/lib/pulse/utils';
import { defaultWorkoutType } from '@/lib/pulse/types';
import type { ExerciseCategory, RoutineExercise, Unit, WorkoutType } from '@/lib/pulse/types';
import { WORKOUT_TYPE_OPTIONS } from '@/lib/pulse/constants';
import { INPUT, BTN_PRIMARY, CARD } from '@/components/pulse/ui';
import GenerateRoutineButton from '@/components/pulse/GenerateRoutineButton';

const SECTION_LABEL = 'font-pulse text-[0.625rem] tracking-[0.1em] uppercase text-pulse-muted';

// ── Routine exercise row ───────────────────────────────────────────────────────
function RoutineExerciseRow({
    re,
    index,
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
    index: number;
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
        <div className="flex flex-col gap-2 bg-pulse-surface rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
                <span className="font-pulse text-xs text-pulse-muted w-5 shrink-0">{index + 1}</span>
                <span className="font-pulse text-sm text-pulse-text flex-1 min-w-0 truncate">{re.exercise.name}</span>
                {!editing && (
                    <span className="font-pulse text-xs text-pulse-dim shrink-0">
                        {re.sets} × {re.reps}
                        {re.starting_weight_kg !== null && (
                            <>
                                {' '}
                                · {toDisplay(re.starting_weight_kg, unit)} {unit}
                            </>
                        )}
                    </span>
                )}
                <button
                    onClick={() => onMove(index, -1)}
                    disabled={!canMoveUp}
                    aria-label={`Move ${re.exercise.name} up`}
                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
                    ↑
                </button>
                <button
                    onClick={() => onMove(index, 1)}
                    disabled={!canMoveDown}
                    aria-label={`Move ${re.exercise.name} down`}
                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
                    ↓
                </button>
                <button
                    onClick={() => setEditing((v) => !v)}
                    aria-label={`Edit ${re.exercise.name}`}
                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                    Edit
                </button>
                {onPair && (
                    <button
                        onClick={onPair}
                        className="font-pulse text-xs text-pulse-accent bg-transparent border-none cursor-pointer shrink-0">
                        Pair ↓
                    </button>
                )}
                {onUnpair && (
                    <button
                        onClick={onUnpair}
                        className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                        Unpair
                    </button>
                )}
                <button
                    onClick={() => onRemove(re.id)}
                    aria-label={`Remove ${re.exercise.name}`}
                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                    Remove
                </button>
            </div>
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

// ── Routines tab ───────────────────────────────────────────────────────────────
export default function RoutinesTab() {
    const {
        routines,
        activeRoutine,
        exercises,
        profile,
        createRoutine,
        deleteRoutine,
        setActiveRoutine,
        addExerciseToRoutine,
        removeExerciseFromRoutine,
        updateRoutineExercise,
        reorderRoutineExercises,
    } = usePulse();
    const [, startTransition] = useTransition();

    const unit = profile.unit;

    const [routineName, setRoutineName] = useState('');

    const [pickExerciseId, setPickExerciseId] = useState('');
    const [addSets, setAddSets] = useState('3');
    const [addReps, setAddReps] = useState('8-12');
    const [addWeight, setAddWeight] = useState('');
    const [addWorkoutType, setAddWorkoutType] = useState<WorkoutType>('push');

    const selectedEx = exercises.find((e) => e.id === pickExerciseId);
    useEffect(() => {
        if (selectedEx) {
            const suggested = defaultWorkoutType(selectedEx.category as ExerciseCategory);
            if (suggested) setAddWorkoutType(suggested);
        }
    }, [pickExerciseId]);

    function handleCreateRoutine() {
        const name = routineName.trim();
        if (!name) return;
        startTransition(async () => {
            await createRoutine(name);
            setRoutineName('');
        });
    }

    function handleSetActive(id: string) {
        startTransition(async () => {
            await setActiveRoutine(id);
        });
    }

    function handleDeleteRoutine(id: string, name: string) {
        if (!window.confirm(`Delete routine "${name}"? This cannot be undone.`)) return;
        startTransition(async () => {
            await deleteRoutine(id);
        });
    }

    function handleAddExercise() {
        if (!activeRoutine || !pickExerciseId) return;
        const trimmed = addWeight.trim();
        const raw = trimmed === '' ? NaN : parseFloat(trimmed);
        const kgValue = Number.isNaN(raw) ? null : toKg(raw, unit);
        startTransition(async () => {
            await addExerciseToRoutine(activeRoutine.id, pickExerciseId, addSets, addReps, kgValue, addWorkoutType);
            setPickExerciseId('');
            setAddWeight('');
            setAddWorkoutType('push');
        });
    }

    const sortedActiveExercises = activeRoutine ? [...activeRoutine.exercises].sort((a, b) => a.order - b.order) : [];

    async function handleMove(index: number, dir: -1 | 1) {
        if (!activeRoutine) return;
        const reordered = [...sortedActiveExercises];
        const re = reordered[index];

        if (re.superset_group_id !== null) {
            const pairIdx = reordered
                .map((r, i) => (r.superset_group_id === re.superset_group_id ? i : -1))
                .filter((i) => i !== -1)
                .sort((a, b) => a - b);
            const [fi, si] = pairIdx;
            if (dir === -1) {
                if (fi === 0) return;
                const above = reordered[fi - 1];
                if (above.superset_group_id !== null) {
                    // The neighbor above is itself a pair: move both of its members
                    // as a unit so its adjacency is preserved.
                    const neighbor = reordered
                        .map((r, i) => (r.superset_group_id === above.superset_group_id ? i : -1))
                        .filter((i) => i !== -1)
                        .sort((a, b) => a - b);
                    const start = neighbor[0];
                    const count = neighbor.length;
                    const moved = reordered.splice(start, count);
                    reordered.splice(si + 1 - count, 0, ...moved);
                } else {
                    const [moved] = reordered.splice(fi - 1, 1);
                    reordered.splice(fi + 1, 0, moved);
                }
            } else {
                if (si === reordered.length - 1) return;
                const below = reordered[si + 1];
                if (below.superset_group_id !== null) {
                    // The neighbor below is itself a pair: move both of its members
                    // as a unit so its adjacency is preserved.
                    const neighbor = reordered
                        .map((r, i) => (r.superset_group_id === below.superset_group_id ? i : -1))
                        .filter((i) => i !== -1)
                        .sort((a, b) => a - b);
                    const start = neighbor[0];
                    const count = neighbor.length;
                    const moved = reordered.splice(start, count);
                    reordered.splice(fi, 0, ...moved);
                } else {
                    const [moved] = reordered.splice(si + 1, 1);
                    reordered.splice(fi, 0, moved);
                }
            }
        } else {
            const target = index + dir;
            if (target < 0 || target >= reordered.length) return;
            const targetRe = reordered[target];
            if (targetRe.superset_group_id !== null) {
                const pairFirst = reordered.findIndex((r) => r.superset_group_id === targetRe.superset_group_id);
                const [moved] = reordered.splice(index, 1);
                if (dir === -1) {
                    reordered.splice(pairFirst, 0, moved);
                } else {
                    reordered.splice(pairFirst + 1, 0, moved);
                }
            } else {
                [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
            }
        }

        const orderedIds = reordered.map((r) => r.id);
        await reorderRoutineExercises(activeRoutine.id, orderedIds);
    }

    async function handleRemove(id: string) {
        const exercise = sortedActiveExercises.find((r) => r.id === id);
        if (exercise?.superset_group_id) {
            await fetch(`/api/pulse/supersets/${exercise.superset_group_id}`, { method: 'DELETE' });
        }
        await removeExerciseFromRoutine(id);
    }

    async function handlePair(exerciseAId: string, exerciseBId: string) {
        const res = await fetch('/api/pulse/supersets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exerciseAId, exerciseBId }),
        });
        if (!res.ok) return;
        await mutate('/api/pulse/routines');
    }

    async function handleUnpair(groupId: string) {
        const res = await fetch(`/api/pulse/supersets/${groupId}`, { method: 'DELETE' });
        if (!res.ok) return;
        await mutate('/api/pulse/routines');
    }

    function handleUpdateExercise(
        id: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
        restSeconds: number | null,
    ) {
        startTransition(async () => {
            await updateRoutineExercise(id, sets, reps, startingWeightKg, restSeconds);
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <GenerateRoutineButton label="Generate routine" className={`${BTN_PRIMARY} self-start`} />

            {/* Create routine */}
            <div className={`${CARD} flex flex-col gap-3`}>
                <div className={SECTION_LABEL}>Create routine</div>
                <div className="flex gap-2">
                    <input
                        aria-label="Routine name"
                        placeholder="Routine name"
                        value={routineName}
                        onChange={(e) => setRoutineName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateRoutine();
                        }}
                        className={`${INPUT} flex-1`}
                    />
                    <button onClick={handleCreateRoutine} className={BTN_PRIMARY}>
                        Create
                    </button>
                </div>
            </div>

            {/* Routine list */}
            <div className="flex flex-col gap-2">
                {routines.length === 0 ? (
                    <div className="font-pulse text-[0.8125rem] text-pulse-muted tracking-[0.04em]">
                        No routines yet. Create one above.
                    </div>
                ) : (
                    routines.map((r) => {
                        const isActive = activeRoutine?.id === r.id;
                        return (
                            <div
                                key={r.id}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                                    isActive ? 'bg-pulse-surface ring-1 ring-pulse-accent/40' : 'bg-pulse-surface'
                                }`}>
                                <div className="flex-1 min-w-0">
                                    <div className="font-pulse text-sm text-pulse-text truncate">{r.name}</div>
                                    <div className="font-pulse text-xs text-pulse-dim">
                                        {r.exercises.length} {r.exercises.length === 1 ? 'exercise' : 'exercises'}
                                    </div>
                                </div>
                                {isActive ? (
                                    <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 rounded-full px-2 py-0.5 shrink-0">
                                        Active
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => handleSetActive(r.id)}
                                        className="font-pulse text-xs text-pulse-dim bg-pulse-surface-2 border-none rounded-lg px-3 py-1.5 cursor-pointer shrink-0">
                                        Set active
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDeleteRoutine(r.id, r.name)}
                                    aria-label={`Delete ${r.name}`}
                                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                                    Delete
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Active routine editor */}
            {activeRoutine && (
                <div className={`${CARD} flex flex-col gap-4`}>
                    <div className="font-pulse text-sm font-semibold text-pulse-text">
                        Active: <span className="text-pulse-accent">{activeRoutine.name}</span>
                    </div>

                    {/* Add exercise to routine */}
                    <div className="flex flex-col gap-2">
                        <div className={SECTION_LABEL}>Add exercise</div>
                        <select
                            aria-label="Exercise"
                            value={pickExerciseId}
                            onChange={(e) => setPickExerciseId(e.target.value)}
                            className={INPUT}>
                            <option value="">Select an exercise…</option>
                            {exercises.map((ex) => (
                                <option key={ex.id} value={ex.id}>
                                    {ex.name}
                                </option>
                            ))}
                        </select>
                        <select
                            aria-label="Workout type"
                            value={addWorkoutType}
                            onChange={(e) => setAddWorkoutType(e.target.value as WorkoutType)}
                            className={INPUT}>
                            {WORKOUT_TYPE_OPTIONS.map(({ value, label }) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <div className="flex flex-wrap items-end gap-2">
                            <label className="flex flex-col gap-1">
                                <span className={SECTION_LABEL}>Sets</span>
                                <input
                                    aria-label="Sets"
                                    value={addSets}
                                    onChange={(e) => setAddSets(e.target.value)}
                                    className={`${INPUT} w-16`}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={SECTION_LABEL}>Reps</span>
                                <input
                                    aria-label="Reps"
                                    value={addReps}
                                    onChange={(e) => setAddReps(e.target.value)}
                                    className={`${INPUT} w-20`}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={SECTION_LABEL}>Weight ({unit})</span>
                                <input
                                    type="number"
                                    aria-label="Starting weight"
                                    placeholder="optional"
                                    value={addWeight}
                                    onChange={(e) => setAddWeight(e.target.value)}
                                    className={`${INPUT} w-24`}
                                />
                            </label>
                            <button onClick={handleAddExercise} disabled={!pickExerciseId} className={BTN_PRIMARY}>
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Routine exercise list */}
                    <div className="flex flex-col gap-2">
                        {sortedActiveExercises.length === 0 ? (
                            <div className="font-pulse text-[0.8125rem] text-pulse-muted tracking-[0.04em]">
                                No exercises in this routine yet.
                            </div>
                        ) : (
                            sortedActiveExercises.map((re, i) => {
                                const isPaired = re.superset_group_id !== null;
                                const pairIndices = isPaired
                                    ? sortedActiveExercises
                                          .map((r, idx) => (r.superset_group_id === re.superset_group_id ? idx : -1))
                                          .filter((idx) => idx !== -1)
                                          .sort((a, b) => a - b)
                                    : null;
                                const firstPairIdx = pairIndices?.[0] ?? i;
                                const secondPairIdx = pairIndices?.[1] ?? i;
                                const isFirstInPair = isPaired && i === firstPairIdx;
                                const next = sortedActiveExercises[i + 1];
                                const canPairWithNext =
                                    !isPaired && next !== undefined && next.superset_group_id === null;

                                let canMoveUp: boolean;
                                let canMoveDown: boolean;
                                if (isPaired) {
                                    canMoveUp = firstPairIdx > 0;
                                    canMoveDown = secondPairIdx < sortedActiveExercises.length - 1;
                                } else {
                                    canMoveUp = i > 0;
                                    canMoveDown = i < sortedActiveExercises.length - 1;
                                }

                                return (
                                    <RoutineExerciseRow
                                        key={re.id}
                                        re={re}
                                        index={i}
                                        total={sortedActiveExercises.length}
                                        unit={unit}
                                        onMove={handleMove}
                                        onRemove={handleRemove}
                                        onUpdate={handleUpdateExercise}
                                        canMoveUp={canMoveUp}
                                        canMoveDown={canMoveDown}
                                        onPair={canPairWithNext ? () => handlePair(re.id, next.id) : undefined}
                                        onUnpair={isFirstInPair ? () => handleUnpair(re.superset_group_id!) : undefined}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
