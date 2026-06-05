'use client';
import { useState, useMemo } from 'react';
import {
    logKey,
    getPhase,
    getRIR,
    parseLogKey,
    parseMaxSets,
    groupExercises,
    computeLastSessionMap,
    baseWorkoutType,
    resolveExercise,
    swapCandidates,
    swapKey,
} from '@/lib/pulse/utils';
import { progressionInfo } from '@/lib/pulse/adherence';
import { RAMPBACK_RIR_BONUS } from '@/lib/pulse/constants';
import { usePulse } from '@/context/PulseContext';
import PageSkeleton, { ErrorState } from '../PageSkeleton';
import RegenNudge from '../RegenNudge';
import WorkoutTabs from '../WorkoutTabs';
import DayTabs from '../DayTabs';
import ExerciseCard from '../ExerciseCard';
import SupersetCard from '../SupersetCard';
import ExerciseSwapPicker from '../ExerciseSwapPicker';
import { useWorkoutSession } from '@/hooks/pulse/useWorkoutSession';
import WorkoutModeScreen from '../WorkoutModeScreen';
import ShareCard from '../ShareCard';
import GenerateRoutineButton from '../GenerateRoutineButton';
import PendingSyncBadge from '../PendingSyncBadge';
import type { LogEntry, RoutineExercise, WorkoutSession, WorkoutVariant } from '@/lib/pulse/types';

export default function LogView() {
    const {
        activeWeek,
        setActiveWeek,
        activeTab,
        activeDay,
        activeSchedule,
        logs,
        profile,
        prMap,
        activeRoutine,
        adjustments,
        currentWeek,
        programPosition,
        refreshSessions,
        routineExercisesByTabKey,
        navigate,
        updateLog,
        deleteLog,
        fireTrigger,
        notes,
        saveNote,
        deleteNote,
        exercises,
        swaps,
        setSwap,
        clearSwap,
        hiddenExerciseIds,
        workoutModeOpen,
        setWorkoutModeOpen,
        loading,
        errors,
        retry,
    } = usePulse();

    const { session, startSession, completeSession, clearSession } = useWorkoutSession();
    const [shareSession, setShareSession] = useState<{
        session: WorkoutSession;
        completedAt: string;
        exercises: RoutineExercise[];
    } | null>(null);

    const programWeeks = activeRoutine?.program_weeks ?? 12;
    // Progression follows completion: a viewed week is offset by any inserted
    // ramp-back weeks, and a ramp-back week itself shows an easier RIR. With no
    // adjustments this is identical to the raw week, so behaviour is unchanged.
    const routineAdjustments = useMemo(
        () => (activeRoutine ? adjustments.filter((a) => a.routine_id === activeRoutine.id) : []),
        [adjustments, activeRoutine],
    );
    const { progressionIndex, isRampBack } = progressionInfo(activeWeek, routineAdjustments);
    const phase = getPhase(progressionIndex, programWeeks);
    const rir = getRIR(progressionIndex, programWeeks) + (isRampBack ? RAMPBACK_RIR_BONUS : 0);
    const rampDaysAway = isRampBack
        ? routineAdjustments.find((a) => a.kind === 'reentry_deload' && a.effective_week === activeWeek)?.payload
              .daysAway
        : undefined;
    const statusLabel =
        programPosition && programPosition.status !== 'on_track'
            ? programPosition.status === 'lapsed'
                ? `Back after ${programPosition.daysSinceLastSession ?? 0}d`
                : programPosition.behindBy === 1
                  ? '1 session behind'
                  : `${programPosition.behindBy} sessions behind`
            : null;
    const unit = profile.unit;
    const routineExercises: RoutineExercise[] = useMemo(
        () => routineExercisesByTabKey[activeTab] ?? [],
        [routineExercisesByTabKey, activeTab],
    );

    const exercisesById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
    const inSessionIds = useMemo(
        () => new Set(routineExercises.map((re) => resolveExercise(re, activeWeek, swaps, exercisesById).id)),
        [routineExercises, activeWeek, swaps, exercisesById],
    );
    const [swapTarget, setSwapTarget] = useState<RoutineExercise | null>(null);

    // Last session per exercise in one pass, so each card reads its own instead of
    // scanning the whole log set. Depends only on weeks before the current one.
    const lastSessionMap = useMemo(() => computeLastSessionMap(logs, activeWeek), [logs, activeWeek]);

    const hasData = routineExercises.some((re) =>
        Array.from({ length: parseMaxSets(re.sets) }, (_, s) => logKey(activeWeek, re.id, s)).some(
            (k) => logs[k]?.saved,
        ),
    );

    // Exercises for workout mode: filter by session variant if present
    const workoutExercises: RoutineExercise[] = (() => {
        if (!session?.variant) return routineExercises;
        const baseType = baseWorkoutType(activeTab);
        const variantKey = `${baseType}:${session.variant}`;
        return routineExercisesByTabKey[variantKey as typeof activeTab] ?? routineExercises;
    })();

    function handleSave(key: string, entry: LogEntry) {
        updateLog(key, entry);
        const rid = parseLogKey(key)?.routineExerciseId;
        // Resolve against the variant-aware list shown in the active context.
        // In an A/B variant workout the rendered rows live under the variant
        // tab key, so the base routineExercises list would not contain them and
        // the rest timer would never fire.
        const exercise = workoutExercises.find((r) => r.id === rid);
        if (!exercise) return;

        if (exercise.superset_group_id) {
            const partner = workoutExercises.find(
                (r) => r.superset_group_id === exercise.superset_group_id && r.id !== exercise.id,
            );
            if (partner) {
                if (exercise.order < partner.order) {
                    // First in pair — suppress rest timer
                    return;
                }
                // Second in pair — fire with first exercise's rest
                fireTrigger(partner.rest_seconds ?? undefined);
                return;
            }
        }

        fireTrigger(exercise.rest_seconds ?? undefined);
    }

    async function handleStartWorkout() {
        if (!activeRoutine) return;
        const tab = activeTab as string;
        const baseType = baseWorkoutType(activeTab);
        const variant = tab.includes(':') ? (tab.split(':')[1] as WorkoutVariant) : null;
        setWorkoutModeOpen(true);
        try {
            await startSession(activeRoutine.id, baseType, variant);
        } catch {
            // session creation failed — close the screen
            setWorkoutModeOpen(false);
        }
    }

    async function handleCompleteWorkout() {
        if (!session) return;
        const completedAt = new Date().toISOString();
        const completedSession = session;
        const snapshotExercises = workoutExercises;
        try {
            await completeSession(completedSession.id);
        } catch {
            // ignore — session may have already been completed or network failed
        }
        // Revalidate the sessions feed so the derived program position (current
        // week, on-track status) reflects this completion immediately.
        refreshSessions();
        setWorkoutModeOpen(false);
        setShareSession({ session: completedSession, completedAt, exercises: snapshotExercises });
    }

    function handleCloseWorkoutMode() {
        clearSession();
        setWorkoutModeOpen(false);
    }

    if (errors?.routines || errors?.logs) return <ErrorState onRetry={retry} />;
    if (loading?.routines || loading?.logs) return <PageSkeleton />;

    if (!activeRoutine) {
        return (
            <div className="py-16 px-6 flex flex-col items-center gap-4 text-center">
                <div className="font-pulse text-[0.8125rem] tracking-[0.1em] uppercase text-pulse-muted">
                    No routine active
                </div>
                <div className="font-pulse text-sm text-pulse-dim max-w-[260px]">
                    Create a routine in the Library to start logging your workouts.
                </div>
                <GenerateRoutineButton
                    label="Generate a routine"
                    className="font-pulse text-sm font-semibold bg-pulse-accent text-pulse-bg rounded-lg px-5 py-2.5 cursor-pointer border-none"
                />
                <button
                    onClick={() => navigate('library')}
                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer">
                    Browse the Library
                </button>
            </div>
        );
    }

    return (
        <div>
            {workoutModeOpen && (
                <WorkoutModeScreen
                    exercises={workoutExercises}
                    sessionId={session?.id ?? null}
                    variant={session?.variant ?? null}
                    week={activeWeek}
                    logs={logs}
                    unit={unit}
                    onSave={handleSave}
                    onDelete={deleteLog}
                    onComplete={handleCompleteWorkout}
                    onClose={handleCloseWorkoutMode}
                    resolveDisplay={(re) => resolveExercise(re, activeWeek, swaps, exercisesById)}
                    onSwapExercise={(re) => setSwapTarget(re)}
                />
            )}

            {shareSession && (
                <ShareCard
                    session={shareSession.session}
                    completedAt={shareSession.completedAt}
                    exercises={shareSession.exercises}
                    logs={logs}
                    prMap={prMap}
                    week={activeWeek}
                    unit={unit}
                    onDismiss={() => setShareSession(null)}
                />
            )}

            {swapTarget &&
                (() => {
                    const original = exercisesById.get(swapTarget.exercise_id) ?? swapTarget.exercise;
                    const candidates = swapCandidates(original, exercises, {
                        excludeIds: new Set([...hiddenExerciseIds, ...inSessionIds]),
                    });
                    const swapped = !!swaps[swapKey(activeWeek, swapTarget.id)];
                    return (
                        <ExerciseSwapPicker
                            originalName={original.name}
                            week={activeWeek}
                            candidates={candidates}
                            isSwapped={swapped}
                            onSelect={(exId) => {
                                setSwap(activeWeek, swapTarget.id, exId);
                                setSwapTarget(null);
                            }}
                            onRevert={() => {
                                clearSwap(activeWeek, swapTarget.id);
                                setSwapTarget(null);
                            }}
                            onClose={() => setSwapTarget(null)}
                        />
                    );
                })()}

            <div className="px-4 pt-6 pb-3 max-w-[600px] lg:max-w-[820px] mx-auto">
                <RegenNudge />
                <div className="bg-pulse-surface rounded-2xl px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="font-pulse text-[0.78125rem] text-pulse-muted tracking-[0.02em]">
                                <span className="text-pulse-dim font-medium">
                                    Week {String(activeWeek).padStart(2, '0')}
                                </span>{' '}
                                / {programWeeks} · {isRampBack ? 'Ramp-back' : phase.label} · target{' '}
                                <span className="text-pulse-dim font-medium">RIR {rir}</span>
                            </div>
                            <PendingSyncBadge />
                            {statusLabel && (
                                <span className="whitespace-nowrap rounded-md bg-pulse-surface-2 px-2 py-0.5 font-pulse text-[0.6875rem] font-semibold text-pulse-accent">
                                    {statusLabel}
                                </span>
                            )}
                            {currentWeek !== activeWeek && (
                                <button
                                    onClick={() => setActiveWeek(currentWeek)}
                                    className="cursor-pointer whitespace-nowrap rounded-md border-none bg-pulse-surface-2 px-2 py-0.5 font-pulse text-[0.6875rem] font-semibold text-pulse-accent hover:text-pulse-text">
                                    Go to Wk {currentWeek}
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="inline-flex items-center bg-pulse-surface-2 rounded-lg p-[3px] gap-[3px]">
                                <button
                                    onClick={() => setActiveWeek(Math.max(1, activeWeek - 1))}
                                    disabled={activeWeek <= 1}
                                    aria-label="Previous week"
                                    className="font-pulse text-sm text-pulse-dim bg-transparent border-none rounded-md px-2.5 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:text-pulse-text">
                                    ‹
                                </button>
                                <span className="font-pulse text-xs font-semibold text-pulse-text tabular-nums px-1.5 min-w-[2.5rem] text-center">
                                    Wk {activeWeek}
                                </span>
                                <button
                                    onClick={() => setActiveWeek(activeWeek + 1)}
                                    aria-label="Next week"
                                    className="font-pulse text-sm text-pulse-dim bg-transparent border-none rounded-md px-2.5 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:text-pulse-text">
                                    ›
                                </button>
                            </div>
                            {routineExercises.length > 0 && (
                                <button
                                    onClick={handleStartWorkout}
                                    className="font-pulse text-xs font-semibold bg-pulse-accent text-pulse-bg rounded-lg px-3.5 py-1.5 cursor-pointer border-none">
                                    Start workout
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="mt-3">{activeSchedule.length > 0 ? <DayTabs /> : <WorkoutTabs />}</div>
                </div>
                {isRampBack && (
                    <div className="mt-3 rounded-2xl border border-pulse-accent/30 bg-pulse-surface px-4 py-3">
                        <p className="font-pulse text-[0.8125rem] font-semibold text-pulse-accent">Ramp-back week</p>
                        <p className="mt-1 font-pulse text-[0.78125rem] text-pulse-dim">
                            Easing in{rampDaysAway ? ` after ${rampDaysAway} days off` : ''}. Reduced volume and an
                            easier RIR before your normal progression resumes.
                        </p>
                    </div>
                )}
            </div>

            <div
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={activeSchedule.length > 0 ? `tab-day-${activeDay}` : `tab-${activeTab}`}
                className="pt-1 px-4 pb-8 max-w-[600px] lg:max-w-[820px] mx-auto flex flex-col gap-2">
                {groupExercises(routineExercises).map((item, i) =>
                    Array.isArray(item) ? (
                        <SupersetCard
                            key={`${item[0].id}-${item[1].id}`}
                            pair={item as [RoutineExercise, RoutineExercise]}
                            pairIdx={i}
                            week={activeWeek}
                            logs={logs}
                            prMap={prMap}
                            unit={unit}
                            onSave={handleSave}
                            onDelete={deleteLog}
                            notes={notes}
                            onSaveNote={(id, n) => saveNote(activeWeek, id, n)}
                            onDeleteNote={(id) => deleteNote(activeWeek, id)}
                        />
                    ) : (
                        <ExerciseCard
                            key={item.id}
                            routineExercise={item}
                            exIdx={i}
                            week={activeWeek}
                            logs={logs}
                            prMap={prMap}
                            unit={unit}
                            onSave={handleSave}
                            onDelete={deleteLog}
                            note={notes[`${activeWeek}-${item.id}`]}
                            onSaveNote={(n) => saveNote(activeWeek, item.id, n)}
                            onDeleteNote={() => deleteNote(activeWeek, item.id)}
                            lastSession={lastSessionMap.get(item.id) ?? null}
                            displayExercise={resolveExercise(item, activeWeek, swaps, exercisesById)}
                            isSwapped={!!swaps[swapKey(activeWeek, item.id)]}
                            originalName={(exercisesById.get(item.exercise_id) ?? item.exercise).name}
                            onSwap={() => setSwapTarget(item)}
                            onRevert={() => clearSwap(activeWeek, item.id)}
                        />
                    ),
                )}
                {!hasData && (
                    <div className="pt-6 text-center">
                        <div className="font-pulse text-[0.8125rem] text-pulse-muted tracking-[0.04em]">
                            Tap an exercise to start logging.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
