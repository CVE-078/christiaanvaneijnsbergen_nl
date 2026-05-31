'use client';
import { useState, useMemo } from 'react';
import { logKey, getPhase, getRIR, parseLogKey, parseMaxSets, groupExercises } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import WorkoutTabs from '../WorkoutTabs';
import DayTabs from '../DayTabs';
import ExerciseCard from '../ExerciseCard';
import SupersetCard from '../SupersetCard';
import { useWorkoutSession } from '@/hooks/pulse/useWorkoutSession';
import WorkoutModeScreen from '../WorkoutModeScreen';
import ShareCard from '../ShareCard';
import type { LogEntry, RoutineExercise, WorkoutSession } from '@/lib/pulse/types';

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
        routineExercisesByTabKey,
        navigate,
        updateLog,
        deleteLog,
        fireTrigger,
        notes,
        saveNote,
        deleteNote,
    } = usePulse();

    const { session, startSession, completeSession, clearSession } = useWorkoutSession();
    const [workoutModeOpen, setWorkoutModeOpen] = useState(false);
    const [shareSession, setShareSession] = useState<{
        session: WorkoutSession;
        completedAt: string;
        exercises: RoutineExercise[];
    } | null>(null);

    const rir = getRIR(activeWeek);
    const phase = getPhase(activeWeek);
    const unit = profile.unit;
    const routineExercises: RoutineExercise[] = routineExercisesByTabKey[activeTab] ?? [];

    // Build the set of weeks that have saved data once per logs change, so the
    // 12-week strip can do O(1) lookups instead of scanning all logs 12 times.
    // Mirrors weekHasData: the week is the number before the first '-' and the
    // entry must be saved.
    const weeksWithData = useMemo(() => {
        const set = new Set<number>();
        for (const key of Object.keys(logs)) {
            if (!logs[key]?.saved) continue;
            const firstDash = key.indexOf('-');
            if (firstDash === -1) continue;
            const week = Number(key.slice(0, firstDash));
            if (!isNaN(week)) set.add(week);
        }
        return set;
    }, [logs]);

    const hasData = routineExercises.some((re) =>
        Array.from({ length: parseMaxSets(re.sets) }, (_, s) => logKey(activeWeek, re.id, s)).some(
            (k) => logs[k]?.saved,
        ),
    );

    // Exercises for workout mode: filter by session variant if present
    const workoutExercises: RoutineExercise[] = (() => {
        if (!session?.variant) return routineExercises;
        const baseType = (activeTab as string).includes(':') ? (activeTab as string).split(':')[0] : activeTab;
        const variantKey = `${baseType}:${session.variant}`;
        return routineExercisesByTabKey[variantKey as typeof activeTab] ?? routineExercises;
    })();

    function handleSave(key: string, entry: LogEntry) {
        updateLog(key, entry);
        const rid = parseLogKey(key)?.routineExerciseId;
        const exercise = routineExercises.find((r) => r.id === rid);
        if (!exercise) return;

        if (exercise.superset_group_id) {
            const partner = routineExercises.find(
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
        const baseType = (activeTab as string).includes(':') ? (activeTab as string).split(':')[0] : activeTab;
        setWorkoutModeOpen(true);
        try {
            await startSession(activeRoutine.id, baseType);
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
        setWorkoutModeOpen(false);
        setShareSession({ session: completedSession, completedAt, exercises: snapshotExercises });
    }

    function handleCloseWorkoutMode() {
        clearSession();
        setWorkoutModeOpen(false);
    }

    if (!activeRoutine) {
        return (
            <div className="py-16 px-6 flex flex-col items-center gap-4 text-center">
                <div className="font-pulse text-[0.8125rem] tracking-[0.1em] uppercase text-pulse-muted">
                    No routine active
                </div>
                <div className="font-pulse text-sm text-pulse-dim max-w-[260px]">
                    Create a routine in the Library to start logging your workouts.
                </div>
                <button
                    onClick={() => navigate('explore')}
                    className="font-pulse text-sm font-semibold bg-pulse-accent text-pulse-bg rounded-lg px-5 py-2.5 cursor-pointer border-none">
                    Go to Library
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

            <div className="px-4 pt-6 pb-1">
                <div className="font-pulse text-[0.78125rem] text-pulse-muted tracking-[0.02em]">
                    <span className="text-pulse-dim font-medium">Week {String(activeWeek).padStart(2, '0')}</span> / 12
                    · {phase.label} · target <span className="text-pulse-dim font-medium">RIR {rir}</span>
                </div>
            </div>

            {activeSchedule.length > 0 ? <DayTabs /> : <WorkoutTabs />}

            <div className="flex px-4 gap-1 overflow-x-auto [scrollbar-width:none] pb-3">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
                    const active = w === activeWeek;
                    const hasWeekData = weeksWithData.has(w);
                    return (
                        <button
                            key={w}
                            onClick={() => setActiveWeek(w)}
                            className={`font-pulse text-sm min-w-[2.25rem] h-8 flex flex-col items-center justify-center rounded-full cursor-pointer shrink-0 transition-colors duration-150 ${
                                active
                                    ? 'font-semibold text-pulse-bg bg-pulse-accent'
                                    : 'font-normal text-pulse-dim bg-transparent hover:bg-pulse-surface'
                            }`}>
                            {w}
                            <span
                                className={`block w-1 h-1 rounded-full -mt-0.5 ${hasWeekData ? 'bg-pulse-accent' : 'bg-transparent'}`}
                            />
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-end gap-3 px-4 pb-3">
                {routineExercises.length > 0 && (
                    <button
                        onClick={handleStartWorkout}
                        className="font-pulse text-xs font-semibold bg-pulse-accent text-pulse-bg rounded-full px-3.5 py-1.5 cursor-pointer border-none">
                        Start workout
                    </button>
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
                        />
                    )
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
