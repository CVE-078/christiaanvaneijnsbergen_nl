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
import { useToast } from '@/lib/pulse/toast';
import { computeStreak, computePRMap } from '@/lib/pulse/utils';
import { WORKOUT_TYPE_ORDER } from '@/lib/pulse/constants';
import type {
    Logs,
    Notes,
    Profile,
    BodyweightEntry,
    DbExercise,
    RoutineWithExercises,
    RoutineExercise,
    WorkoutType,
    TabKey,
    ScheduleEntry,
    View,
} from '@/lib/pulse/types';

// Mirror the tab ordering WorkoutTabs renders: base workout_type order, then A before B.
function orderTabKeys(keys: TabKey[]): TabKey[] {
    return [...keys].sort((a, b) => {
        const baseA = a.includes(':') ? (a.split(':')[0] as WorkoutType) : (a as WorkoutType);
        const baseB = b.includes(':') ? (b.split(':')[0] as WorkoutType) : (b as WorkoutType);
        const orderA = WORKOUT_TYPE_ORDER.indexOf(baseA);
        const orderB = WORKOUT_TYPE_ORDER.indexOf(baseB);
        if (orderA !== orderB) return orderA - orderB;
        return a < b ? -1 : 1;
    });
}

interface Props {
    initialLogs?: Logs;
    initialProfile?: Profile;
    initialBodyweightLogs?: BodyweightEntry[];
    initialExercises?: DbExercise[];
    initialRoutines?: RoutineWithExercises[];
    initialNotes?: Notes;
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
    const {
        logs,
        updateLog,
        deleteLog,
        handleExport,
        loading: loadingLogs,
        error: logsError,
    } = useWorkoutLogs(initialLogs, onSaveError);
    const {
        profile,
        bodyweightLogs,
        updateProfile,
        logBodyWeight,
        deleteBodyWeight,
        loadingProfile,
        loadingBodyweight,
        profileError,
        bodyweightError,
    } = useProfile(initialProfile, initialBodyweightLogs);
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
    } = useRoutines(initialExercises, initialRoutines, profile.active_routine_id);
    const { activeWeek, setActiveWeek, activeTab, setActiveTab } = useUIState();
    const { timerTrigger, timerDuration, fireTrigger } = useRestTimer();
    const { notes, saveNote, deleteNote, loading: loadingNotes, error: notesError } = useNotes(initialNotes);

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

    const setActiveDay = useCallback(
        (day: number) => {
            _setActiveDay(day);
            const entry = activeSchedule.find((e) => e.day_of_week === day);
            if (entry) setActiveTab(entry.workout_type);
        },
        [activeSchedule, setActiveTab],
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
        () => ({ profile, bodyweightLogs, updateProfile, logBodyWeight, deleteBodyWeight }),
        [profile, bodyweightLogs, updateProfile, logBodyWeight, deleteBodyWeight],
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
            showOnboarding,
            triggerOnboarding,
            dismissOnboarding,
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
            showOnboarding,
            triggerOnboarding,
            dismissOnboarding,
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
            routineExercisesByType,
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
            routineExercisesByType,
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
            ...loadingValue,
        }),
        [logsValue, profileValue, computedValue, uiStateValue, timerValue, routinesValue, notesValue, loadingValue],
    );

    return <PulseContext.Provider value={contextValue}>{children}</PulseContext.Provider>;
}
