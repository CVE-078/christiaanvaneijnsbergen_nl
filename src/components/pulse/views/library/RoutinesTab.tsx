'use client';
import { useState, useTransition } from 'react';
import { mutate } from 'swr';
import { usePulse } from '@/context/PulseContext';
import { sessionTypeFor, formatProgramStatus } from '@/lib/pulse/utils';
import { routineSessionChips } from '@/lib/pulse/library';
import type { WorkoutType, WorkoutVariant } from '@/lib/pulse/types';
import GenerateRoutineButton from '@/components/pulse/GenerateRoutineButton';
import RoutineCard from './RoutineCard';
import NewRoutineChooser from './NewRoutineChooser';
import RoutineManageSheet from './RoutineManageSheet';
import RoutineSessionEditor from './RoutineSessionEditor';

// ── Routines tab ───────────────────────────────────────────────────────────────
// Card list + a "New routine" chooser; each card opens a manage sheet, and a
// scheduled routine's sessions open a per-session editor. Ad-hoc routines edit
// inline inside the manage sheet. All mutations reuse the existing usePulse actions.
export default function RoutinesTab() {
    const {
        routines,
        activeRoutine,
        exercises,
        profile,
        programPosition,
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

    const [chooserOpen, setChooserOpen] = useState(false);
    const [manageRoutineId, setManageRoutineId] = useState<string | null>(null);
    const [editorSession, setEditorSession] = useState<{ type: WorkoutType; variant: WorkoutVariant | null } | null>(
        null,
    );

    const managed = routines.find((r) => r.id === manageRoutineId) ?? null;

    // ── Mutations (reused from the previous RoutinesTab) ──────────────────────
    const handleCreateAdHoc = (name: string) =>
        startTransition(async () => {
            const created = await createRoutine(name);
            setChooserOpen(false);
            setManageRoutineId(created.id); // open the new routine so the user can add exercises
        });
    const handleSetActive = (id: string) => startTransition(async () => void (await setActiveRoutine(id)));
    const handleRename = (id: string, name: string) =>
        startTransition(async () => void (await renameRoutine(id, name)));
    const handleDelete = (id: string) =>
        startTransition(async () => {
            await deleteRoutine(id);
            setManageRoutineId(null);
            setEditorSession(null);
        });
    const handleAdd = (
        routineId: string,
        exerciseId: string,
        sets: string,
        reps: string,
        kg: number | null,
        type: WorkoutType,
    ) => startTransition(async () => void (await addExerciseToRoutine(routineId, exerciseId, sets, reps, kg, type)));
    const handleUpdate = (id: string, sets: string, reps: string, kg: number | null, rest: number | null) =>
        startTransition(async () => void (await updateRoutineExercise(id, sets, reps, kg, rest)));
    const handleReorder = (routineId: string, orderedIds: string[]) =>
        startTransition(async () => void (await reorderRoutineExercises(routineId, orderedIds)));

    async function handleRemove(routineId: string, id: string) {
        const ex = routines.find((r) => r.id === routineId)?.exercises.find((re) => re.id === id);
        if (ex?.superset_group_id) {
            await fetch(`/api/pulse/supersets/${ex.superset_group_id}`, { method: 'DELETE' });
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

    // ── Card meta + active-routine progress ───────────────────────────────────
    const activeStatus =
        activeRoutine && programPosition
            ? formatProgramStatus(programPosition, activeRoutine.program_weeks ?? 12)
            : null;

    const cardMeta = (r: (typeof routines)[number]): string => {
        if (r.schedule.length === 0) {
            const n = r.exercises.length;
            return `${n} ${n === 1 ? 'exercise' : 'exercises'} · no fixed schedule`;
        }
        const sessions = routineSessionChips(r).length;
        return `${sessions} ${sessions === 1 ? 'session' : 'sessions'} · ${r.program_weeks ?? 12}-week plan`;
    };

    // ── Session editor inputs (scheduled routine) ─────────────────────────────
    const scheduleTypes = managed ? [...new Set(managed.schedule.map((s) => s.workout_type))] : [];
    const orderedExercises = managed ? [...managed.exercises].sort((a, b) => a.order - b.order) : [];
    const sessionExercises =
        managed && editorSession
            ? orderedExercises.filter(
                  (re) =>
                      sessionTypeFor(re.workout_type, scheduleTypes) === editorSession.type &&
                      (re.variant ?? null) === editorSession.variant,
              )
            : [];
    const sessionLabel = editorSession
        ? `${editorSession.type[0].toUpperCase()}${editorSession.type.slice(1)}${editorSession.variant ? ` ${editorSession.variant}` : ''}`
        : '';

    return (
        <div className="flex flex-col gap-4">
            {/* Count row + accent New routine */}
            <div className="flex items-center justify-between">
                <span className="font-pulse-body text-[0.66rem] uppercase tracking-[0.08em] text-pulse-muted">
                    {routines.length} {routines.length === 1 ? 'routine' : 'routines'}
                </span>
                <button
                    type="button"
                    onClick={() => setChooserOpen(true)}
                    className="flex items-center gap-1 rounded-lg bg-pulse-accent px-3 py-1.5 font-pulse text-[0.78rem] font-semibold text-pulse-bg">
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden>
                        <line x1="8" y1="3" x2="8" y2="13" strokeLinecap="round" />
                        <line x1="3" y1="8" x2="13" y2="8" strokeLinecap="round" />
                    </svg>
                    New routine
                </button>
            </div>

            {/* Card list */}
            {routines.length === 0 ? (
                <div className="font-pulse text-[0.8125rem] tracking-[0.04em] text-pulse-muted">
                    No routines yet. Create one above.
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {routines.map((r) => {
                        const isActive = activeRoutine?.id === r.id;
                        return (
                            <RoutineCard
                                key={r.id}
                                routine={r}
                                isActive={isActive}
                                progress={
                                    isActive && activeStatus
                                        ? { fraction: activeStatus.progress, label: activeStatus.weekLabel }
                                        : null
                                }
                                meta={cardMeta(r)}
                                onOpen={() => {
                                    setEditorSession(null);
                                    setManageRoutineId(r.id);
                                }}
                            />
                        );
                    })}
                </div>
            )}

            {/* New routine chooser: Generate (reuses GenerateRoutineButton) + Ad-hoc */}
            <NewRoutineChooser
                open={chooserOpen}
                onClose={() => setChooserOpen(false)}
                onAdHoc={handleCreateAdHoc}
                generateSlot={
                    <GenerateRoutineButton className="flex w-full items-center gap-3 rounded-[13px] border border-pulse-accent/40 bg-pulse-accent/[0.06] p-3.5 text-left">
                        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-pulse-accent text-pulse-bg">
                            <svg
                                width="17"
                                height="17"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                aria-hidden>
                                <path d="M8 1.5l1.6 3.4 3.7.5-2.7 2.6.7 3.7L8 10.4 4.7 12.2l.7-3.7L2.7 5.9l3.7-.5z" />
                            </svg>
                        </span>
                        <span>
                            <span className="font-pulse text-[0.9rem] font-medium text-pulse-text">
                                Generate a routine
                            </span>
                            <span className="mt-0.5 block font-pulse text-[0.74rem] text-pulse-dim">
                                Answer a few questions, we build and periodize it.
                            </span>
                        </span>
                    </GenerateRoutineButton>
                }
            />

            {/* Manage sheet (one open at a time; session editor replaces it) */}
            {managed && !editorSession && (
                <RoutineManageSheet
                    open
                    routine={managed}
                    isActive={activeRoutine?.id === managed.id}
                    exercises={exercises}
                    unit={unit}
                    onClose={() => setManageRoutineId(null)}
                    onSetActive={() => handleSetActive(managed.id)}
                    onRename={(name) => handleRename(managed.id, name)}
                    onDelete={() => handleDelete(managed.id)}
                    onOpenSession={(group) => setEditorSession(group)}
                    onReorder={(ids) => handleReorder(managed.id, ids)}
                    onRemove={(id) => handleRemove(managed.id, id)}
                    onUpdate={handleUpdate}
                    onAdd={(exId, sets, reps, kg, type) => handleAdd(managed.id, exId, sets, reps, kg, type)}
                    onPair={handlePair}
                    onUnpair={handleUnpair}
                />
            )}

            {/* Per-session editor (scheduled routine) */}
            {managed && editorSession && (
                <RoutineSessionEditor
                    open
                    onClose={() => {
                        setEditorSession(null);
                        setManageRoutineId(null);
                    }}
                    onBack={() => setEditorSession(null)}
                    title={sessionLabel}
                    subtitle={`${managed.name} · ${sessionExercises.length} ${sessionExercises.length === 1 ? 'exercise' : 'exercises'}`}
                    sessionExercises={sessionExercises}
                    allExerciseIds={orderedExercises.map((re) => re.id)}
                    type={editorSession.type}
                    exercises={exercises}
                    unit={unit}
                    onReorder={(ids) => handleReorder(managed.id, ids)}
                    onRemove={(id) => handleRemove(managed.id, id)}
                    onUpdate={handleUpdate}
                    onAdd={(exId, sets, reps, kg, type) => handleAdd(managed.id, exId, sets, reps, kg, type)}
                    onPair={handlePair}
                    onUnpair={handleUnpair}
                />
            )}
        </div>
    );
}
