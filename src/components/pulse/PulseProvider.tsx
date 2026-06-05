'use client';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSWRConfig } from 'swr';
import { PulseContext } from '@/context/PulseContext';
import { useWorkoutLogs } from '@/hooks/pulse/useWorkoutLogs';
import { useProfile } from '@/hooks/pulse/useProfile';
import { useRoutines } from '@/hooks/pulse/useRoutines';
import { useUIState } from '@/hooks/pulse/useUIState';
import { useRestTimer } from '@/hooks/pulse/useRestTimer';
import { useNotes } from '@/hooks/pulse/useNotes';
import { useSwaps } from '@/hooks/pulse/useSwaps';
import { usePreferences } from '@/hooks/pulse/usePreferences';
import { useOfflineSync } from '@/hooks/pulse/useOfflineSync';
import { useToast } from '@/lib/pulse/toast';
import { computeStreak, computePRMap, orderTabKeys, baseWorkoutType } from '@/lib/pulse/utils';
import type { RoutineExercise, WorkoutType, TabKey, ScheduleEntry, View } from '@/lib/pulse/types';

interface Props {
    email: string;
    navigate: (view: View) => void;
    children: React.ReactNode;
}

export function PulseProvider({ email, navigate, children }: Props) {
    const { show: showToast } = useToast();
    const onSaveError = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
    const {
        logs,
        updateLog,
        deleteLog,
        handleExport,
        loading: loadingLogs,
        error: logsError,
    } = useWorkoutLogs(onSaveError);
    const {
        profile,
        bodyweightLogs,
        bodyMeasurements,
        refreshMeasurements,
        updateProfile,
        updateGender,
        logBodyWeight,
        deleteBodyWeight,
        loadingProfile,
        loadingBodyweight,
        profileError,
        bodyweightError,
    } = useProfile();
    const {
        exercises,
        routines,
        activeRoutine,
        loadingExercises,
        loadingRoutines,
        exercisesError,
        routinesError,
        createRoutine,
        renameRoutine,
        deleteRoutine,
        setActiveRoutine,
        addExerciseToRoutine,
        removeExerciseFromRoutine,
        updateRoutineExercise,
        reorderRoutineExercises,
        cloneTemplate,
        generateRoutine,
        completeOnboarding,
        createExercise,
        updateExercise,
        deleteExercise,
    } = useRoutines(profile.active_routine_id);
    const {
        activeWeek,
        setActiveWeek,
        activeTab,
        setActiveTab,
        autoAdvance,
        setAutoAdvance,
        workoutModeOpen,
        setWorkoutModeOpen,
    } = useUIState();
    const { timerTrigger, timerDuration, fireTrigger } = useRestTimer();
    const { notes, saveNote, deleteNote, loading: loadingNotes, error: notesError } = useNotes();
    const { swaps, setSwap, clearSwap } = useSwaps();
    const { hiddenExerciseIds, toggleHideExercise } = usePreferences();

    // Replay any offline-queued log/note writes on mount, reconnect, and focus.
    useOfflineSync();

    const { mutate: globalMutate } = useSWRConfig();
    const retry = useCallback(() => {
        globalMutate(() => true);
    }, [globalMutate]);

    const loading = useMemo(
        () => ({
            profile: loadingProfile,
            bodyweight: loadingBodyweight,
            logs: loadingLogs,
            routines: loadingRoutines,
            exercises: loadingExercises,
            notes: loadingNotes,
        }),
        [loadingProfile, loadingBodyweight, loadingLogs, loadingRoutines, loadingExercises, loadingNotes],
    );

    const errors = useMemo(
        () => ({
            profile: !!profileError,
            bodyweight: !!bodyweightError,
            logs: !!logsError,
            routines: !!routinesError,
            exercises: !!exercisesError,
            notes: !!notesError,
        }),
        [profileError, bodyweightError, logsError, routinesError, exercisesError, notesError],
    );

    const streak = useMemo(() => computeStreak(logs), [logs]);
    const prMap = useMemo(() => computePRMap(logs), [logs]);

    const [onboardingOverride, setOnboardingOverride] = useState<boolean | null>(null);
    // Gate on loaded routines so the onboarding modal does not flash before the
    // client fetch resolves (routines is [] while loading).
    const showOnboarding = onboardingOverride ?? (!loadingRoutines && routines.length === 0);
    const triggerOnboarding = useCallback(() => setOnboardingOverride(true), []);
    const dismissOnboarding = useCallback(() => setOnboardingOverride(false), []);

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

    // Clamp activeTab to a valid tab when the set of tabs changes (e.g. routine swap or
    // exercises removed). Mirrors the ordering WorkoutTabs renders so the first tab matches.
    useEffect(() => {
        const tabs = orderTabKeys(Object.keys(routineExercisesByTabKey) as TabKey[]);
        if (tabs.length > 0 && !tabs.includes(activeTab)) {
            setActiveTab(tabs[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routineExercisesByTabKey]);

    const activeSchedule = useMemo(
        (): ScheduleEntry[] => [...(activeRoutine?.schedule ?? [])].sort((a, b) => a.day_of_week - b.day_of_week),
        [activeRoutine],
    );

    const [activeDay, _setActiveDay] = useState<number | null>(null);

    // Resolve a schedule entry to the best AVAILABLE tab key. The pinned
    // `type:variant` key is preferred, but if the routine has no exercises under
    // that exact key (e.g. a legacy routine whose schedule variant was not pinned,
    // or a variant/exercise mismatch) we fall back to the first tab of the same
    // workout type, then to the first tab overall — never an empty key, which is
    // what made /train render blank while Plan/Library still showed exercises.
    const resolveTabForEntry = useCallback(
        (entry: ScheduleEntry): TabKey => {
            const keys = orderTabKeys(Object.keys(routineExercisesByTabKey) as TabKey[]);
            const exact = (entry.variant ? `${entry.workout_type}:${entry.variant}` : entry.workout_type) as TabKey;
            if (keys.includes(exact)) return exact;
            const sameType = keys.find((k) => baseWorkoutType(k) === entry.workout_type);
            return sameType ?? keys[0] ?? exact;
        },
        [routineExercisesByTabKey],
    );

    useEffect(() => {
        if (activeSchedule.length === 0) return;
        const today = new Date().getDay();
        const sorted = [...activeSchedule].sort((a, b) => {
            const dA = (a.day_of_week - today + 7) % 7;
            const dB = (b.day_of_week - today + 7) % 7;
            return dA - dB;
        });
        const e0 = sorted[0];
        _setActiveDay(e0.day_of_week);
        setActiveTab(resolveTabForEntry(e0));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSchedule.map((e) => `${e.day_of_week}:${e.workout_type}:${e.variant ?? ''}`).join(',')]);

    const setActiveDay = useCallback(
        (day: number) => {
            _setActiveDay(day);
            const entry = activeSchedule.find((e) => e.day_of_week === day);
            if (entry) setActiveTab(resolveTabForEntry(entry));
        },
        [activeSchedule, setActiveTab, resolveTabForEntry],
    );

    // Build the context value by spreading the (stable) hook returns and the locally derived
    // pieces, instead of hand-maintaining a duplicated literal + dependency array. Each source
    // object keeps its own referential stability, so the merged value only changes when one of
    // those sources changes.
    const logsValue = useMemo(
        () => ({ logs, updateLog, deleteLog, handleExport }),
        [logs, updateLog, deleteLog, handleExport],
    );
    const profileValue = useMemo(
        () => ({
            profile,
            bodyweightLogs,
            bodyMeasurements,
            updateProfile,
            updateGender,
            logBodyWeight,
            deleteBodyWeight,
            refreshMeasurements,
        }),
        [
            profile,
            bodyweightLogs,
            bodyMeasurements,
            updateProfile,
            updateGender,
            logBodyWeight,
            deleteBodyWeight,
            refreshMeasurements,
        ],
    );
    const computedValue = useMemo(() => ({ streak, prMap, email }), [streak, prMap, email]);
    const uiStateValue = useMemo(
        () => ({
            navigate,
            activeWeek,
            setActiveWeek,
            activeTab,
            setActiveTab,
            activeDay,
            setActiveDay,
            activeSchedule,
            resolveTabForEntry,
            showOnboarding,
            triggerOnboarding,
            dismissOnboarding,
            autoAdvance,
            setAutoAdvance,
            workoutModeOpen,
            setWorkoutModeOpen,
        }),
        [
            navigate,
            activeWeek,
            setActiveWeek,
            activeTab,
            setActiveTab,
            activeDay,
            setActiveDay,
            activeSchedule,
            resolveTabForEntry,
            showOnboarding,
            triggerOnboarding,
            dismissOnboarding,
            autoAdvance,
            setAutoAdvance,
            workoutModeOpen,
            setWorkoutModeOpen,
        ],
    );
    const timerValue = useMemo(
        () => ({ timerTrigger, timerDuration, fireTrigger }),
        [timerTrigger, timerDuration, fireTrigger],
    );
    const routinesValue = useMemo(
        () => ({
            exercises,
            routines,
            activeRoutine,
            routineExercisesByTabKey,
            createRoutine,
            renameRoutine,
            deleteRoutine,
            setActiveRoutine,
            addExerciseToRoutine,
            removeExerciseFromRoutine,
            updateRoutineExercise,
            reorderRoutineExercises,
            cloneTemplate,
            generateRoutine,
            completeOnboarding,
            createExercise,
            updateExercise,
            deleteExercise,
        }),
        [
            exercises,
            routines,
            activeRoutine,
            routineExercisesByTabKey,
            createRoutine,
            renameRoutine,
            deleteRoutine,
            setActiveRoutine,
            addExerciseToRoutine,
            removeExerciseFromRoutine,
            updateRoutineExercise,
            reorderRoutineExercises,
            cloneTemplate,
            generateRoutine,
            completeOnboarding,
            createExercise,
            updateExercise,
            deleteExercise,
        ],
    );
    const notesValue = useMemo(() => ({ notes, saveNote, deleteNote }), [notes, saveNote, deleteNote]);
    const swapsValue = useMemo(() => ({ swaps, setSwap, clearSwap }), [swaps, setSwap, clearSwap]);
    const preferencesValue = useMemo(
        () => ({ hiddenExerciseIds, toggleHideExercise }),
        [hiddenExerciseIds, toggleHideExercise],
    );
    const loadingValue = useMemo(() => ({ loading, errors, retry }), [loading, errors, retry]);

    const contextValue = useMemo(
        () => ({
            ...logsValue,
            ...profileValue,
            ...computedValue,
            ...uiStateValue,
            ...timerValue,
            ...routinesValue,
            ...notesValue,
            ...swapsValue,
            ...preferencesValue,
            ...loadingValue,
        }),
        [
            logsValue,
            profileValue,
            computedValue,
            uiStateValue,
            timerValue,
            routinesValue,
            notesValue,
            swapsValue,
            preferencesValue,
            loadingValue,
        ],
    );

    return <PulseContext.Provider value={contextValue}>{children}</PulseContext.Provider>;
}
