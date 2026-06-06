'use client';
import { useState, useTransition } from 'react';
import { mutate } from 'swr';
import { usePulse } from '@/context/PulseContext';
import { sessionTypeFor } from '@/lib/pulse/utils';
import type { RoutineExercise, WorkoutType, WorkoutVariant } from '@/lib/pulse/types';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import { INPUT, BTN_PRIMARY, BTN_GHOST, CARD } from '@/components/pulse/ui';
import GenerateRoutineButton from '@/components/pulse/GenerateRoutineButton';
import RoutineExerciseRow from './RoutineExerciseRow';
import AddRoutineExerciseForm from './AddRoutineExerciseForm';

const SECTION_LABEL = 'font-pulse text-[0.625rem] tracking-[0.1em] uppercase text-pulse-muted';

// ── Routines tab ───────────────────────────────────────────────────────────────
export default function RoutinesTab() {
    const {
        routines,
        activeRoutine,
        exercises,
        profile,
        createRoutine,
        renameRoutine,
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
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameInput, setRenameInput] = useState('');

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

    function handleRenameSave(id: string) {
        const name = renameInput.trim();
        setRenamingId(null);
        if (!name) return;
        startTransition(async () => {
            await renameRoutine(id, name);
        });
    }

    function handleAddExercise(
        exerciseId: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
        workoutType: WorkoutType,
    ) {
        if (!activeRoutine) return;
        startTransition(async () => {
            await addExerciseToRoutine(activeRoutine.id, exerciseId, sets, reps, startingWeightKg, workoutType);
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

    // Group the active routine into sessions by (session type, variant), keeping
    // each row's global index into sortedActiveExercises so move/pair logic stays
    // unchanged. The session type comes from what the routine actually schedules:
    // a full-body routine tags exercises push/pull/legs but is one "Full Body"
    // session, so those roll up via sessionTypeFor. One group -> flat list.
    const scheduleTypes = activeRoutine ? [...new Set(activeRoutine.schedule.map((s) => s.workout_type))] : [];
    const sessionGroups: {
        type: WorkoutType;
        variant: WorkoutVariant | null;
        items: { re: RoutineExercise; index: number }[];
    }[] = [];
    {
        const byKey = new Map<string, number>();
        sortedActiveExercises.forEach((re, index) => {
            const sessionType = sessionTypeFor(re.workout_type, scheduleTypes);
            const key = `${sessionType}:${re.variant ?? ''}`;
            let gi = byKey.get(key);
            if (gi === undefined) {
                gi = sessionGroups.length;
                byKey.set(key, gi);
                sessionGroups.push({ type: sessionType, variant: re.variant ?? null, items: [] });
            }
            sessionGroups[gi].items.push({ re, index });
        });
    }

    function renderRow(re: RoutineExercise, i: number) {
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
        const canPairWithNext = !isPaired && next !== undefined && next.superset_group_id === null;

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
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Unified toolbar, Generate + Create routine actions in one row. */}
            <div className="flex items-center gap-2">
                <input
                    aria-label="Routine name"
                    placeholder="Routine name"
                    value={routineName}
                    onChange={(e) => setRoutineName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateRoutine();
                    }}
                    className={`${INPUT} flex-1 min-w-0`}
                />
                <button onClick={handleCreateRoutine} className={`${BTN_PRIMARY} shrink-0`}>
                    Create
                </button>
                <GenerateRoutineButton label="Generate" className={`${BTN_GHOST} shrink-0`} />
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
                                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                                    isActive ? 'bg-pulse-surface ring-1 ring-pulse-accent/40' : 'bg-pulse-surface'
                                }`}>
                                {renamingId === r.id ? (
                                    <input
                                        autoFocus
                                        aria-label={`Rename ${r.name}`}
                                        value={renameInput}
                                        onChange={(e) => setRenameInput(e.target.value)}
                                        onBlur={() => handleRenameSave(r.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameSave(r.id);
                                            if (e.key === 'Escape') setRenamingId(null);
                                        }}
                                        className={`${INPUT} flex-1 min-w-0`}
                                    />
                                ) : (
                                    <div className="flex-1 min-w-0">
                                        <div className="font-pulse text-sm text-pulse-text truncate">{r.name}</div>
                                        <div className="font-pulse text-xs text-pulse-dim">
                                            {r.exercises.length} {r.exercises.length === 1 ? 'exercise' : 'exercises'}
                                        </div>
                                    </div>
                                )}
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
                                {renamingId !== r.id && (
                                    <button
                                        onClick={() => {
                                            setRenamingId(r.id);
                                            setRenameInput(r.name);
                                        }}
                                        aria-label={`Rename ${r.name}`}
                                        className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                                        Rename
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
                    <AddRoutineExerciseForm exercises={exercises} unit={unit} onAdd={handleAddExercise} />

                    {/* Routine exercise list */}
                    <div className="flex flex-col gap-3">
                        {sortedActiveExercises.length === 0 ? (
                            <div className="font-pulse text-[0.8125rem] text-pulse-muted tracking-[0.04em]">
                                No exercises in this routine yet.
                            </div>
                        ) : sessionGroups.length <= 1 ? (
                            <div className="flex flex-col gap-2">
                                {sortedActiveExercises.map((re, i) => renderRow(re, i))}
                            </div>
                        ) : (
                            sessionGroups.map((group) => (
                                <div key={`${group.type}:${group.variant ?? ''}`} className="flex flex-col gap-2">
                                    <div className={SECTION_LABEL}>
                                        {WORKOUT_TYPE_LABELS[group.type]}
                                        {group.variant ? ` · ${group.variant}` : ''}
                                    </div>
                                    {group.items.map(({ re, index }) => renderRow(re, index))}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
