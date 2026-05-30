'use client';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { PulseContext } from '@/context/PulseContext';
import { useWorkoutLogs } from '@/hooks/pulse/useWorkoutLogs';
import { useProfile } from '@/hooks/pulse/useProfile';
import { useRoutines } from '@/hooks/pulse/useRoutines';
import { useUIState } from '@/hooks/pulse/useUIState';
import { useRestTimer } from '@/hooks/pulse/useRestTimer';
import { useNotes } from '@/hooks/pulse/useNotes';
import { useToast } from '@/lib/pulse/toast';
import { computeStreak, computePRMap } from '@/lib/pulse/utils';
import type { Logs, Notes, Profile, BodyweightEntry, DbExercise, RoutineWithExercises, RoutineExercise, WorkoutType, TabKey, ScheduleEntry, View } from '@/lib/pulse/types';

interface Props {
    initialLogs: Logs;
    initialProfile: Profile;
    initialBodyweightLogs: BodyweightEntry[];
    initialExercises: DbExercise[];
    initialRoutines: RoutineWithExercises[];
    initialNotes: Notes;
    email: string;
    navigate: (view: View) => void;
    children: React.ReactNode;
}

export function PulseProvider({
    initialLogs,
    initialProfile,
    initialBodyweightLogs,
    initialExercises,
    initialRoutines,
    initialNotes,
    email,
    navigate,
    children,
}: Props) {
    const { show: showToast } = useToast();
    const onSaveError = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
    const { logs, updateLog, deleteLog, handleExport } = useWorkoutLogs(initialLogs, onSaveError);
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
    const { activeWeek, setActiveWeek, activeTab, setActiveTab } = useUIState();
    const { timerTrigger, timerDuration, fireTrigger } = useRestTimer();
    const { notes, saveNote, deleteNote } = useNotes(initialNotes);

    const streak = useMemo(() => computeStreak(logs), [logs]);
    const prMap = useMemo(() => computePRMap(logs), [logs]);

    const [onboardingOverride, setOnboardingOverride] = useState<boolean | null>(null);
    const showOnboarding = onboardingOverride ?? routines.length === 0;
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

    const routineExercisesByTabKey = useMemo((): Partial<Record<TabKey, RoutineExercise[]>> => {
        if (!activeRoutine) return {};
        const sorted = [...activeRoutine.exercises].sort((a, b) => a.order - b.order);
        const result: Partial<Record<TabKey, RoutineExercise[]>> = {};
        for (const re of sorted) {
            const key: TabKey = re.variant ? `${re.workout_type}:${re.variant}` : re.workout_type;
            (result[key] ??= []).push(re);
        }
        return result;
    }, [activeRoutine]);

    const activeSchedule = useMemo(
        (): ScheduleEntry[] =>
            [...(activeRoutine?.schedule ?? [])].sort((a, b) => a.day_of_week - b.day_of_week),
        [activeRoutine],
    );

    const [activeDay, _setActiveDay] = useState<number | null>(null);

    useEffect(() => {
        if (activeSchedule.length === 0) return;
        const today = new Date().getDay();
        const sorted = [...activeSchedule].sort((a, b) => {
            const dA = (a.day_of_week - today + 7) % 7;
            const dB = (b.day_of_week - today + 7) % 7;
            return dA - dB;
        });
        _setActiveDay(sorted[0].day_of_week);
        setActiveTab(sorted[0].workout_type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSchedule.map((e) => `${e.day_of_week}:${e.workout_type}`).join(',')]);

    const setActiveDay = useCallback((day: number) => {
        _setActiveDay(day);
        const entry = activeSchedule.find((e) => e.day_of_week === day);
        if (entry) setActiveTab(entry.workout_type);
    }, [activeSchedule, setActiveTab]);

    const contextValue = useMemo(
        () => ({
            logs,
            profile,
            bodyweightLogs,
            isLoading: false as const,
            streak,
            prMap,
            email,
            updateLog,
            deleteLog,
            handleExport,
            updateProfile,
            logBodyWeight,
            deleteBodyWeight,
            navigate,
            activeWeek,
            setActiveWeek,
            activeTab,
            setActiveTab,
            activeDay,
            setActiveDay,
            activeSchedule,
            timerTrigger,
            timerDuration,
            fireTrigger,
            exercises,
            routines,
            activeRoutine,
            routineExercisesByType,
            routineExercisesByTabKey,
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
            notes,
            saveNote,
            deleteNote,
        }),
        [
            logs,
            profile,
            bodyweightLogs,
            streak,
            prMap,
            email,
            updateLog,
            deleteLog,
            handleExport,
            updateProfile,
            logBodyWeight,
            deleteBodyWeight,
            navigate,
            activeWeek,
            setActiveWeek,
            activeTab,
            setActiveTab,
            activeDay,
            setActiveDay,
            activeSchedule,
            timerTrigger,
            timerDuration,
            fireTrigger,
            exercises,
            routines,
            activeRoutine,
            routineExercisesByType,
            routineExercisesByTabKey,
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
            notes,
            saveNote,
            deleteNote,
        ],
    );

    return <PulseContext.Provider value={contextValue}>{children}</PulseContext.Provider>;
}
