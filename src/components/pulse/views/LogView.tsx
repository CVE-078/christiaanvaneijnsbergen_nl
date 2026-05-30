'use client';
import { useState } from 'react';
import { logKey, getPhase, getRIR, weekHasData, parseMaxSets } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import WorkoutTabs from '../WorkoutTabs';
import DayTabs from '../DayTabs';
import ExerciseCard from '../ExerciseCard';
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
    const [shareSession, setShareSession] = useState<{ session: WorkoutSession; completedAt: string } | null>(null);

    const rir = getRIR(activeWeek);
    const phase = getPhase(activeWeek);
    const unit = profile.unit;
    const routineExercises: RoutineExercise[] = routineExercisesByTabKey[activeTab] ?? [];

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
        const firstDash = key.indexOf('-');
        const lastDash = key.lastIndexOf('-');
        const rid = key.slice(firstDash + 1, lastDash);
        const exercise = routineExercises.find((r) => r.id === rid);
        fireTrigger(exercise?.rest_seconds ?? undefined);
    }

    async function handleStartWorkout() {
        if (!activeRoutine) return;
        const baseType = (activeTab as string).includes(':') ? (activeTab as string).split(':')[0] : activeTab;
        try {
            await startSession(activeRoutine.id, baseType);
            setWorkoutModeOpen(true);
        } catch {
            // session creation failed — button remains enabled for retry, no overlay opened
        }
    }

    async function handleCompleteWorkout() {
        if (!session) return;
        const completedAt = new Date().toISOString();
        const completedSession = session;
        try {
            await completeSession(completedSession.id);
        } catch {
            // ignore — session may have already been completed or network failed
        }
        setWorkoutModeOpen(false);
        setShareSession({ session: completedSession, completedAt });
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
                    className="font-pulse text-sm font-semibold bg-pulse-accent text-black rounded-lg px-5 py-2.5 cursor-pointer border-none">
                    Go to Library
                </button>
            </div>
        );
    }

    return (
        <div>
            {workoutModeOpen && session && (
                <WorkoutModeScreen
                    exercises={workoutExercises}
                    sessionId={session.id}
                    variant={session.variant}
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
                    exercises={workoutExercises}
                    logs={logs}
                    prMap={prMap}
                    week={activeWeek}
                    unit={unit}
                    onDismiss={() => setShareSession(null)}
                />
            )}

            {activeSchedule.length > 0 ? <DayTabs /> : <WorkoutTabs />}

            <div className="flex px-4 gap-1 overflow-x-auto [scrollbar-width:none] pb-3">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
                    const active = w === activeWeek;
                    const hasWeekData = weekHasData(w, logs);
                    return (
                        <button
                            key={w}
                            onClick={() => setActiveWeek(w)}
                            className={`font-pulse text-sm min-w-[2.25rem] h-8 flex flex-col items-center justify-center rounded-full border cursor-pointer shrink-0 transition-all duration-150 ${
                                active
                                    ? 'font-bold text-pulse-accent bg-pulse-accent/10 border-pulse-accent/25'
                                    : 'font-normal text-pulse-dim bg-transparent border-transparent hover:border-pulse-border'
                            }`}>
                            {w}
                            <span
                                className={`block w-1 h-1 rounded-full -mt-0.5 ${hasWeekData ? 'bg-pulse-accent' : 'bg-transparent'}`}
                            />
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-between gap-3 px-4 pb-3">
                <div className="flex items-center gap-3">
                    <span className="font-pulse text-xs font-semibold tracking-[0.08em] uppercase text-pulse-dim">
                        {phase.label}
                    </span>
                    <span className="font-pulse text-xs font-bold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-full px-2 py-0.5">{rir} RIR</span>
                </div>
                {routineExercises.length > 0 && (
                    <button
                        onClick={handleStartWorkout}
                        className="font-pulse text-xs font-semibold bg-pulse-accent text-black rounded-full px-3 py-1.5 cursor-pointer border-none">
                        Start workout
                    </button>
                )}
            </div>

            <div
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={activeSchedule.length > 0 ? `tab-day-${activeDay}` : `tab-${activeTab}`}
                className="pt-1 px-4 pb-8 max-w-[600px] lg:max-w-[820px] mx-auto flex flex-col gap-2">
                {routineExercises.map((re, i) => (
                    <ExerciseCard
                        key={re.id}
                        routineExercise={re}
                        exIdx={i}
                        week={activeWeek}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={handleSave}
                        onDelete={deleteLog}
                        note={notes[`${activeWeek}-${re.id}`]}
                        onSaveNote={(n) => saveNote(activeWeek, re.id, n)}
                        onDeleteNote={() => deleteNote(activeWeek, re.id)}
                    />
                ))}
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
