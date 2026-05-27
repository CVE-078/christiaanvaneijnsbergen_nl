'use client';
import { useMemo, useState, useCallback } from 'react';
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
        exercises, routines, activeRoutine,
        createRoutine, deleteRoutine, setActiveRoutine,
        addExerciseToRoutine, removeExerciseFromRoutine,
        updateRoutineExercise, reorderRoutineExercises,
        cloneTemplate, completeOnboarding,
        createExercise, updateExercise, deleteExercise,
    } = useRoutines(initialExercises, initialRoutines, profile.active_routine_id);
    const { view, navigate, activeWeek, setActiveWeek, activeTab, setActiveTab } = useUIState();
    const { timerTrigger, fireTrigger } = useRestTimer();

    const streak = useMemo(() => computeStreak(logs), [logs]);
    const prMap = useMemo(() => computePRMap(logs), [logs]);

    const [onboardingOverride, setOnboardingOverride] = useState<boolean | null>(null);
    const showOnboarding = onboardingOverride ??
        (!profile.onboarding_completed && routines.length === 0);
    const triggerOnboarding = useCallback(() => setOnboardingOverride(true), []);
    const dismissOnboarding = useCallback(() => setOnboardingOverride(false), []);

    const routineExercisesByType = useMemo((): Partial<Record<WorkoutType, RoutineExercise[]>> => {
        if (!activeRoutine) return {};
        const sorted = [...activeRoutine.exercises].sort((a, b) => a.order - b.order);
        const result: Partial<Record<WorkoutType, RoutineExercise[]>> = {};
        for (const re of sorted) {
            const type = re.workout_type;
            (result[type] ??= []).push(re);
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
            cloneTemplate,
            completeOnboarding,
            createExercise,
            updateExercise,
            deleteExercise,
            showOnboarding,
            triggerOnboarding,
            dismissOnboarding,
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
            cloneTemplate,
            completeOnboarding,
            createExercise,
            updateExercise,
            deleteExercise,
            showOnboarding,
            triggerOnboarding,
            dismissOnboarding,
        ],
    );

    return <PulseContext.Provider value={contextValue}>{children}</PulseContext.Provider>;
}
