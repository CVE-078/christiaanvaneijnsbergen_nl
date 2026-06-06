'use client';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
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
import { useSessions } from '@/hooks/pulse/useSessions';
import { useProgramAdjustments } from '@/hooks/pulse/useProgramAdjustments';
import { useDecisionEvents } from '@/hooks/pulse/useDecisionEvents';
import { useOfflineSync } from '@/hooks/pulse/useOfflineSync';
import { useToast } from '@/lib/pulse/toast';
import {
    computeStreak,
    computePRMap,
    orderTabKeys,
    baseWorkoutType,
    swapKey,
    parseLogKey,
    logKey,
    computeE1RMHistory,
    decisionForExercise,
} from '@/lib/pulse/utils';
import { recordDecisionEvent } from '@/app/pulse/actions';
import { computeProgramPosition, computeWeekAdherence, computeRegenSuggestion } from '@/lib/pulse/adherence';
import { accentPreset } from '@/lib/pulse/constants';
import { buildWorkoutCsv } from '@/lib/pulse/csv';
import type {
    RoutineExercise,
    WorkoutType,
    TabKey,
    ScheduleEntry,
    View,
    ProgramPosition,
    LogEntry,
} from '@/lib/pulse/types';

// User-local calendar day (YYYY-MM-DD) for right now. en-CA formats as ISO-ordered
// y-m-d; this is the workout_date stamped on each set so skip detection reads the
// day a set actually happened, not the abstract program week. Falls back to the UTC
// date if the stored timezone is somehow invalid (Intl throws on a bad zone).
function localDateString(tz: string): string {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    } catch {
        return new Date().toISOString().slice(0, 10);
    }
}

interface Props {
    userId: string;
    email: string;
    navigate: (view: View) => void;
    children: React.ReactNode;
}

export function PulseProvider({ userId, email, navigate, children }: Props) {
    const { show: showToast } = useToast();
    const onSaveError = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
    const {
        logs,
        updateLog: persistLog,
        deleteLog,
        loading: loadingLogs,
        error: logsError,
    } = useWorkoutLogs(userId, onSaveError);
    const {
        profile,
        bodyweightLogs,
        bodyMeasurements,
        refreshMeasurements,
        updateProfile,
        updateGender,
        updateLengthUnit,
        updatePriorityMuscle,
        updateTimezone,
        updateAccentColor,
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
        updateRoutineProgramWeeks,
        setProgramAnchor,
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
    const { notes, saveNote, deleteNote, loading: loadingNotes, error: notesError } = useNotes(userId);
    const { swaps, setSwap, clearSwap } = useSwaps();
    const { hiddenExerciseIds, toggleHideExercise } = usePreferences();
    const { sessions, refreshSessions, loading: loadingSessions, error: sessionsError } = useSessions();
    const {
        adjustments,
        acceptReentryDeload,
        dismissReentry,
        loading: loadingAdjustments,
        error: adjustmentsError,
    } = useProgramAdjustments();
    const { decisions } = useDecisionEvents();

    // Replay any offline-queued log/note writes on mount, reconnect, and focus.
    // Scoped to this user so a shared device never replays another account's writes.
    useOfflineSync(userId);

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
            sessions: loadingSessions,
            adjustments: loadingAdjustments,
        }),
        [
            loadingProfile,
            loadingBodyweight,
            loadingLogs,
            loadingRoutines,
            loadingExercises,
            loadingNotes,
            loadingSessions,
            loadingAdjustments,
        ],
    );

    const errors = useMemo(
        () => ({
            profile: !!profileError,
            bodyweight: !!bodyweightError,
            logs: !!logsError,
            routines: !!routinesError,
            exercises: !!exercisesError,
            notes: !!notesError,
            sessions: !!sessionsError,
            adjustments: !!adjustmentsError,
        }),
        [
            profileError,
            bodyweightError,
            logsError,
            routinesError,
            exercisesError,
            notesError,
            sessionsError,
            adjustmentsError,
        ],
    );

    const streak = useMemo(() => computeStreak(logs), [logs]);
    const prMap = useMemo(() => computePRMap(logs), [logs]);

    // Download the full logged history as CSV. Resolves exercise names (honouring
    // week-scoped swaps) from routines/exercises, which only the provider has —
    // hence it lives here rather than in useWorkoutLogs.
    const handleExport = useCallback(() => {
        const reName = new Map<string, string>();
        for (const r of routines) for (const re of r.exercises) reName.set(re.id, re.exercise.name);
        const exName = new Map<string, string>();
        for (const e of exercises) exName.set(e.id, e.name);
        const nameFor = (reId: string, week: number) => {
            const subId = swaps[swapKey(week, reId)];
            if (subId) return exName.get(subId) ?? reName.get(reId) ?? '—';
            return reName.get(reId) ?? '—';
        };
        const csv = buildWorkoutCsv(logs, { nameFor, prMap });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pulse-history-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [logs, routines, exercises, swaps, prMap]);

    // DecisionEvent keys (`type:lift:week`) already logged this page session. We
    // fire each at most once and only mark it captured on success, so an offline
    // failure simply retries on the next save — the event is re-derivable from the
    // logs, so it is fired best-effort rather than through the durable write queue.
    const capturedDecisions = useRef<Set<string>>(new Set());

    // The single set-save choke point exposed to the UI as `updateLog`. Persists
    // the set (stamping the user-local workout date + the guided session id so skip
    // detection / behavior learning are trustworthy), then logs the deload /
    // progression DecisionEvent the save implies — derived purely from the logs the
    // provider already holds, so the components stay untouched.
    const logSet = useCallback(
        (key: string, entry: LogEntry, sessionId?: string | null) => {
            persistLog(key, entry, sessionId ?? null, localDateString(profile.timezone));

            if (!activeRoutine) return;
            const parsed = parseLogKey(key);
            if (!parsed) return;
            const re = activeRoutine.exercises.find((x) => x.id === parsed.routineExerciseId);
            if (!re) return;
            const decision = decisionForExercise({
                routineExerciseId: re.id,
                week: parsed.week,
                e1rmHistory: computeE1RMHistory(logs, re.id),
                previousEntry: parsed.week > 1 ? logs[logKey(parsed.week - 1, re.id, 0)] : undefined,
                repsRange: re.reps,
            });
            if (!decision) return;
            const dedupeKey = `${decision.type}:${decision.affectedArea}:${decision.week}`;
            if (capturedDecisions.current.has(dedupeKey)) return;
            recordDecisionEvent(activeRoutine.id, decision)
                .then(() => capturedDecisions.current.add(dedupeKey))
                .catch(() => {});
        },
        [logs, activeRoutine, profile.timezone, persistLog],
    );

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

    // ── Adaptive missed-workout regeneration ────────────────────────────────
    // Derive the program position and the nudge from the active routine's
    // anchor, schedule, completed sessions, and accepted adjustments. `now` is
    // fixed at mount — detecting a live day rollover mid-session is unnecessary.
    const nowIso = useMemo(() => new Date().toISOString(), []);
    const routineSessions = useMemo(
        () => (activeRoutine ? sessions.filter((s) => s.routine_id === activeRoutine.id) : []),
        [sessions, activeRoutine],
    );
    const routineAdjustments = useMemo(
        () => (activeRoutine ? adjustments.filter((a) => a.routine_id === activeRoutine.id) : []),
        [adjustments, activeRoutine],
    );
    const programPosition = useMemo<ProgramPosition | null>(() => {
        if (!activeRoutine) return null;
        return computeProgramPosition({
            anchor: activeRoutine.program_anchor,
            programWeeks: activeRoutine.program_weeks ?? 12,
            schedule: activeSchedule,
            sessions: routineSessions,
            adjustments: routineAdjustments,
            tz: profile.timezone,
            now: nowIso,
        });
    }, [activeRoutine, activeSchedule, routineSessions, routineAdjustments, profile.timezone, nowIso]);
    const regenSuggestion = useMemo(() => {
        if (!activeRoutine || !programPosition) return null;
        const weekAdherence = computeWeekAdherence({
            schedule: activeSchedule,
            sessions: routineSessions,
            anchor: activeRoutine.program_anchor,
            tz: profile.timezone,
            now: nowIso,
        });
        return computeRegenSuggestion(programPosition, weekAdherence, routineAdjustments);
    }, [activeRoutine, programPosition, activeSchedule, routineSessions, routineAdjustments, profile.timezone, nowIso]);
    const currentWeek = programPosition?.weekInteger ?? activeWeek;

    // Persist the browser timezone once the profile has loaded, if it changed.
    // updateTimezone is a stable useCallback; listed so the effect always uses
    // the current instance.
    useEffect(() => {
        if (loadingProfile) return;
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (browserTz && browserTz !== profile.timezone) {
            updateTimezone(browserTz).catch(() => {});
        }
    }, [loadingProfile, profile.timezone, updateTimezone]);

    // Apply the chosen accent colour by overriding the pulse-accent CSS tokens at
    // the document root (cascades to every pulse-accent class and var usage).
    useEffect(() => {
        const preset = accentPreset(profile.accent_color);
        const root = document.documentElement;
        root.style.setProperty('--color-pulse-accent', preset.accent);
        root.style.setProperty('--color-pulse-accent-dim', preset.dim);
    }, [profile.accent_color]);

    // Make activeWeek default to, and then follow, the completion-paced current
    // week — without yanking the user while they browse. On the first sync for a
    // routine we snap to current; afterwards we only advance when currentWeek
    // moves AND the user was sitting on the previous current week (so manual
    // navigation elsewhere is left alone). Keyed by routine id so a switch resyncs.
    const weekFollow = useRef<{ routineId: string | null; lastCurrent: number | null }>({
        routineId: null,
        lastCurrent: null,
    });
    useEffect(() => {
        if (loadingRoutines || loadingSessions) return;
        if (!activeRoutine?.program_anchor || !programPosition) return;
        const current = programPosition.weekInteger;
        const follow = weekFollow.current;
        if (follow.routineId !== activeRoutine.id) {
            weekFollow.current = { routineId: activeRoutine.id, lastCurrent: current };
            if (current !== activeWeek) setActiveWeek(current);
            return;
        }
        if (current !== follow.lastCurrent) {
            if (activeWeek === follow.lastCurrent) setActiveWeek(current);
            weekFollow.current = { routineId: activeRoutine.id, lastCurrent: current };
        }
    }, [loadingRoutines, loadingSessions, activeRoutine, programPosition, activeWeek, setActiveWeek]);

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
        () => ({ logs, updateLog: logSet, deleteLog, handleExport }),
        [logs, logSet, deleteLog, handleExport],
    );
    const profileValue = useMemo(
        () => ({
            profile,
            bodyweightLogs,
            bodyMeasurements,
            updateProfile,
            updateGender,
            updateLengthUnit,
            updatePriorityMuscle,
            updateTimezone,
            updateAccentColor,
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
            updateLengthUnit,
            updatePriorityMuscle,
            updateTimezone,
            updateAccentColor,
            logBodyWeight,
            deleteBodyWeight,
            refreshMeasurements,
        ],
    );
    const computedValue = useMemo(() => ({ streak, prMap, email, userId }), [streak, prMap, email, userId]);
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
            updateRoutineProgramWeeks,
            setProgramAnchor,
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
            updateRoutineProgramWeeks,
            setProgramAnchor,
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
    const regenValue = useMemo(
        () => ({
            adjustments,
            programPosition,
            currentWeek,
            regenSuggestion,
            acceptReentryDeload,
            dismissReentry,
            refreshSessions,
            decisions,
        }),
        [
            adjustments,
            programPosition,
            currentWeek,
            regenSuggestion,
            acceptReentryDeload,
            dismissReentry,
            refreshSessions,
            decisions,
        ],
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
            ...regenValue,
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
            regenValue,
            loadingValue,
        ],
    );

    return <PulseContext.Provider value={contextValue}>{children}</PulseContext.Provider>;
}
