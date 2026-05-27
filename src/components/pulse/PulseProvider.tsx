'use client';
import { useMemo } from 'react';
import { PulseContext } from '@/context/PulseContext';
import { useWorkoutLogs } from '@/hooks/pulse/useWorkoutLogs';
import { useProfile } from '@/hooks/pulse/useProfile';
import { useRoutines } from '@/hooks/pulse/useRoutines';
import { useUIState } from '@/hooks/pulse/useUIState';
import { useRestTimer } from '@/hooks/pulse/useRestTimer';
import { computeStreak, computePRMap } from '@/lib/pulse/utils';
import type { Logs, Profile, BodyweightEntry, DbExercise, RoutineWithExercises, RoutineExercise, WorkoutType } from '@/lib/pulse/types';

interface Props {
    initialLogs: Logs;
    initialProfile: Profile;
    initialBodyweightLogs: BodyweightEntry[];
    initialExercises: DbExercise[];
    initialRoutines: RoutineWithExercises[];
    email: string;
    children: React.ReactNode;
}

export function PulseProvider({
    initialLogs,
    initialProfile,
    initialBodyweightLogs,
    initialExercises,
    initialRoutines,
    email,
    children,
}: Props) {
    const { logs, saveError, updateLog, deleteLog, handleExport } = useWorkoutLogs(initialLogs);
    const { profile, bodyweightLogs, updateProfile, logBodyWeight, deleteBodyWeight } = useProfile(
        initialProfile,
        initialBodyweightLogs,
    );
    const {
        exercises,
        routines,
        activeRoutine,
        createRoutine,
        deleteRoutine,
        setActiveRoutine,
        addExerciseToRoutine,
        removeExerciseFromRoutine,
        updateRoutineExercise,
        reorderRoutineExercises,
        createExercise,
        updateExercise,
        deleteExercise,
    } = useRoutines(initialExercises, initialRoutines, profile.active_routine_id);
    const { view, navigate, activeWeek, setActiveWeek, activeTab, setActiveTab } = useUIState();
    const { timerTrigger, fireTrigger } = useRestTimer();

    const streak = useMemo(() => computeStreak(logs), [logs]);
    const prMap = useMemo(() => computePRMap(logs), [logs]);

    const routineExercisesByType = useMemo((): Record<WorkoutType, RoutineExercise[]> => {
        const empty: Record<WorkoutType, RoutineExercise[]> = {
            push: [], pull: [], legs: [], chest: [], back: [], shoulders: [], arms: [],
        };
        if (!activeRoutine) return empty;
        const sorted = [...activeRoutine.exercises].sort((a, b) => a.order - b.order);
        const result = { ...empty };
        for (const re of sorted) {
            result[re.workout_type].push(re);
        }
        return result;
    }, [activeRoutine]);

    const contextValue = useMemo(
        () => ({
            logs,
            profile,
            bodyweightLogs,
            isLoading: false as const,
            saveError,
            streak,
            prMap,
            email,
            updateLog,
            deleteLog,
            handleExport,
            updateProfile,
            logBodyWeight,
            deleteBodyWeight,
            view,
            navigate,
            activeWeek,
            setActiveWeek,
            activeTab,
            setActiveTab,
            timerTrigger,
            fireTrigger,
            exercises,
            routines,
            activeRoutine,
            routineExercisesByType,
            createRoutine,
            deleteRoutine,
            setActiveRoutine,
            addExerciseToRoutine,
            removeExerciseFromRoutine,
            updateRoutineExercise,
            reorderRoutineExercises,
            createExercise,
            updateExercise,
            deleteExercise,
        }),
        [
            logs,
            profile,
            bodyweightLogs,
            saveError,
            streak,
            prMap,
            email,
            updateLog,
            deleteLog,
            handleExport,
            updateProfile,
            logBodyWeight,
            deleteBodyWeight,
            view,
            navigate,
            activeWeek,
            setActiveWeek,
            activeTab,
            setActiveTab,
            timerTrigger,
            fireTrigger,
            exercises,
            routines,
            activeRoutine,
            routineExercisesByType,
            createRoutine,
            deleteRoutine,
            setActiveRoutine,
            addExerciseToRoutine,
            removeExerciseFromRoutine,
            updateRoutineExercise,
            reorderRoutineExercises,
            createExercise,
            updateExercise,
            deleteExercise,
        ],
    );

    return <PulseContext.Provider value={contextValue}>{children}</PulseContext.Provider>;
}
