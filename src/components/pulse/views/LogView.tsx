'use client';
import { useState, useMemo, useEffect } from 'react';
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
import CoachPanel from '../CoachPanel';
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
        lightenThisWeek,
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
    // A manually-lightened week reads differently from a gap-driven re-entry.
    const isManualLighten =
        isRampBack && routineAdjustments.some((a) => a.kind === 'manual_deload' && a.effective_week === activeWeek);
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
    // Two-step confirm for the destructive "Clear day" in the finished state.
    const [clearConfirm, setClearConfirm] = useState(false);

    // Last session per exercise in one pass, so each card reads its own instead of
    // scanning the whole log set. Depends only on weeks before the current one.
    const lastSessionMap = useMemo(() => computeLastSessionMap(logs, activeWeek), [logs, activeWeek]);

    const hasData = routineExercises.some((re) =>
        Array.from({ length: parseMaxSets(re.sets) }, (_, s) => logKey(activeWeek, re.id, s)).some(
            (k) => logs[k]?.saved,
        ),
    );

    // Every set key for the active day/tab + week, and whether they're all logged.
    // Drives the finished state (Workout complete + Re-open / Clear day) and the
    // no-rest-on-the-last-set suppression.
    const daySetKeys = useMemo(
        () =>
            routineExercises.flatMap((re) =>
                Array.from({ length: parseMaxSets(re.sets) }, (_, s) => logKey(activeWeek, re.id, s)),
            ),
        [routineExercises, activeWeek],
    );
    const dayComplete = daySetKeys.length > 0 && daySetKeys.every((k) => logs[k]?.saved);
    // Disarm the clear-day confirm when the viewed day or week changes.
    useEffect(() => setClearConfirm(false), [activeTab, activeWeek]);

    // Exercises for workout mode: filter by session variant if present
    const workoutExercises: RoutineExercise[] = (() => {
        if (!session?.variant) return routineExercises;
        const baseType = baseWorkoutType(activeTab);
        const variantKey = `${baseType}:${session.variant}`;
        return routineExercisesByTabKey[variantKey as typeof activeTab] ?? routineExercises;
    })();

    function handleSave(key: string, entry: LogEntry) {
        // Link the set to the active guided session (null when logging from the
        // Train list outside guided mode). The provider stamps the workout date
        // and logs any deload/progression decision from here.
        updateLog(key, entry, session?.id ?? null);
        const rid = parseLogKey(key)?.routineExerciseId;
        // Resolve against the variant-aware list shown in the active context.
        // In an A/B variant workout the rendered rows live under the variant
        // tab key, so the base routineExercises list would not contain them and
        // the rest timer would never fire.
        const exercise = workoutExercises.find((r) => r.id === rid);
        if (!exercise) return;

        // No rest after the set that finishes the whole session, there's nothing
        // left to rest for. `logs` is the pre-save snapshot, so treat this key as saved.
        const sessionKeys = workoutExercises.flatMap((re) =>
            Array.from({ length: parseMaxSets(re.sets) }, (_, s) => logKey(activeWeek, re.id, s)),
        );
        if (entry.saved && sessionKeys.every((k) => k === key || logs[k]?.saved)) return;

        if (exercise.superset_group_id) {
            const partner = workoutExercises.find(
                (r) => r.superset_group_id === exercise.superset_group_id && r.id !== exercise.id,
            );
            if (partner) {
                if (exercise.order < partner.order) {
                    // First in pair, suppress rest timer
                    return;
                }
                // Second in pair, fire with first exercise's rest
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
            // session creation failed, close the screen
            setWorkoutModeOpen(false);
        }
    }

    async function handleCompleteWorkout() {
        const completedAt = new Date().toISOString();
        const completedSession = session;
        const snapshotExercises = workoutExercises;
        if (completedSession) {
            try {
                await completeSession(completedSession.id);
            } catch {
                // ignore, session may have already been completed or network failed
            }
            // Revalidate the sessions feed so the derived program position (current
            // week, on-track status) reflects this completion immediately.
            refreshSessions();
        }
        setWorkoutModeOpen(false);
        // Only surface the share card for a freshly completed session, not a re-open
        // (which carries no session and just lets the user add or edit sets).
        if (completedSession) {
            setShareSession({ session: completedSession, completedAt, exercises: snapshotExercises });
        }
    }

    function handleCloseWorkoutMode() {
        clearSession();
        setWorkoutModeOpen(false);
    }

    // Re-open the finished day in guided mode to add or edit sets. No new session is
    // started, so adherence isn't double-counted; new sets link to no session.
    function handleReopenWorkout() {
        setWorkoutModeOpen(true);
    }

    // Wipe the active day's logged sets so the user can re-do. Per-row optimistic
    // deletes (offline-queued); the completed session row is left as a record.
    function handleClearDay() {
        daySetKeys.forEach((k) => {
            if (logs[k]?.saved) deleteLog(k);
        });
        setClearConfirm(false);
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
                    notes={notes}
                    onSaveNote={(id, n) => saveNote(activeWeek, id, n)}
                    onDeleteNote={(id) => deleteNote(activeWeek, id)}
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
                {/* Coach decisions: inline on mobile only, desktop shows it in the right rail. */}
                <div className="lg:hidden">
                    <CoachPanel variant="inline" />
                </div>
                <div className="bg-pulse-surface rounded-2xl px-4 py-3.5">
                    {/* Identity row: week number + phase meta, with the week stepper alone on
                        the right. Day-actions live in their own band below, so this row stays
                        compact and never overflows on mobile. */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                                <span className="font-pulse-display text-[2.5rem] font-extrabold leading-[0.8] tracking-[-0.01em] text-pulse-text">
                                    {String(activeWeek).padStart(2, '0')}
                                </span>
                                <span className="font-pulse-display text-base font-semibold text-pulse-muted">
                                    /{programWeeks}
                                </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <span className="font-pulse-body text-[0.6875rem] text-pulse-dim">
                                    {isRampBack ? (isManualLighten ? 'Lighter' : 'Ramp-back') : phase.label} · target{' '}
                                    <span className="font-semibold text-pulse-accent">RIR {rir}</span>
                                </span>
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
                                        Go to Week {currentWeek}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="inline-flex shrink-0 items-center gap-[3px] rounded-lg bg-pulse-surface-2 p-[3px]">
                            <button
                                onClick={() => setActiveWeek(Math.max(1, activeWeek - 1))}
                                disabled={activeWeek <= 1}
                                aria-label="Previous week"
                                className="cursor-pointer rounded-md border-none bg-transparent px-2.5 py-1 font-pulse text-sm text-pulse-dim hover:text-pulse-text disabled:cursor-not-allowed disabled:opacity-40">
                                ‹
                            </button>
                            <span className="min-w-[3.25rem] px-1 text-center font-pulse text-xs font-semibold tabular-nums text-pulse-text">
                                Week {activeWeek}
                            </span>
                            <button
                                onClick={() => setActiveWeek(activeWeek + 1)}
                                aria-label="Next week"
                                className="cursor-pointer rounded-md border-none bg-transparent px-2.5 py-1 font-pulse text-sm text-pulse-dim hover:text-pulse-text disabled:cursor-not-allowed disabled:opacity-40">
                                ›
                            </button>
                        </div>
                    </div>
                    {/* Action band: status on the left, day-actions on the right. Same shape in
                        both the ready and complete states; flex-wrap is a safety net so the
                        actions drop to their own line rather than ever clipping on small screens. */}
                    {routineExercises.length > 0 &&
                        (dayComplete ? (
                            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-pulse-surface-2 py-2.5 pl-3.5 pr-2.5">
                                <span className="inline-flex items-center gap-1.5 font-pulse text-[0.8125rem] font-semibold text-pulse-success">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={3}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-[0.9375rem] w-[0.9375rem]"
                                        aria-hidden>
                                        <path d="M5 13l4 4L19 7" />
                                    </svg>
                                    Complete
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={handleReopenWorkout}
                                        className="cursor-pointer rounded-lg border border-pulse-border bg-transparent px-3.5 py-1.5 font-pulse text-[0.8125rem] font-medium text-pulse-dim transition-colors hover:border-pulse-accent/40 hover:text-pulse-text">
                                        Re-open
                                    </button>
                                    {clearConfirm ? (
                                        <button
                                            onClick={handleClearDay}
                                            className="cursor-pointer rounded-lg border border-[#f43f5e]/50 bg-transparent px-3.5 py-1.5 font-pulse text-[0.8125rem] font-semibold text-[#f43f5e] transition-colors hover:bg-[#f43f5e]/10">
                                            Confirm clear
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setClearConfirm(true)}
                                            className="cursor-pointer rounded-lg border-none bg-transparent px-2.5 py-1.5 font-pulse text-[0.8125rem] font-medium text-pulse-muted transition-colors hover:text-pulse-dim">
                                            Clear day
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-pulse-surface-2 py-2 pl-3.5 pr-2">
                                <div className="flex min-w-0 items-baseline gap-2">
                                    <span className="font-pulse text-[0.8125rem] font-semibold text-pulse-dim">
                                        Ready to train
                                    </span>
                                    <span className="whitespace-nowrap font-pulse-body text-[0.6875rem] text-pulse-muted">
                                        {routineExercises.length}{' '}
                                        {routineExercises.length === 1 ? 'exercise' : 'exercises'}
                                    </span>
                                </div>
                                <button
                                    onClick={handleStartWorkout}
                                    className="cursor-pointer rounded-lg border-none bg-pulse-accent px-4 py-1.5 font-pulse text-[0.8125rem] font-semibold text-pulse-bg transition-opacity hover:opacity-90">
                                    Start workout
                                </button>
                            </div>
                        ))}
                    <div className="mt-4">{activeSchedule.length > 0 ? <DayTabs /> : <WorkoutTabs />}</div>
                </div>
                {isRampBack ? (
                    <div className="mt-3 rounded-2xl border border-pulse-accent/30 bg-pulse-surface px-4 py-3">
                        <p className="font-pulse text-[0.8125rem] font-semibold text-pulse-accent">
                            {isManualLighten ? 'Lighter week' : 'Ramp-back week'}
                        </p>
                        <p className="mt-1 font-pulse text-[0.78125rem] text-pulse-dim">
                            {isManualLighten
                                ? 'You chose to go easier this week. An easier RIR target this week; your progression continues normally.'
                                : `Easing in${rampDaysAway ? ` after ${rampDaysAway} days off` : ''}. An easier RIR target before your normal progression resumes.`}
                        </p>
                    </div>
                ) : (
                    activeRoutine &&
                    routineExercises.length > 0 && (
                        <button
                            type="button"
                            onClick={() => lightenThisWeek(activeRoutine.id, activeWeek)}
                            className="mt-3 cursor-pointer rounded-xl border border-pulse-border bg-transparent px-3.5 py-2 font-pulse text-[0.78125rem] font-medium text-pulse-dim transition-colors hover:border-pulse-accent/40 hover:text-pulse-text">
                            Go easier this week
                        </button>
                    )
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
