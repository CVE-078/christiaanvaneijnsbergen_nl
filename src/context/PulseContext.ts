import { createContext, useContext } from 'react';
import type {
    Logs,
    Notes,
    Swaps,
    Profile,
    BodyweightEntry,
    BodyMeasurement,
    WorkoutType,
    WorkoutVariant,
    TabKey,
    Unit,
    LengthUnit,
    LogEntry,
    Gender,
    PriorityMuscle,
    View,
    PRMap,
    DbExercise,
    WorkoutRoutine,
    RoutineWithExercises,
    RoutineExercise,
    RoutineTemplate,
    ExerciseCategory,
    ScheduleEntry,
    SessionTime,
    ProgramAdjustment,
    ProgramPosition,
    RegenSuggestion,
    DecisionEventRow,
} from '@/lib/pulse/types';
import type { ExperienceLevel, OnboardingAnswers } from '@/lib/pulse/recommendation';

export interface PulseContextValue {
    // Data
    logs: Logs;
    profile: Profile;
    bodyweightLogs: BodyweightEntry[];
    bodyMeasurements: BodyMeasurement[];

    // Computed (memoized in PulseProvider)
    streak: number;
    prMap: PRMap;

    // Auth
    email: string;
    /** Supabase auth user id. Scopes offline-queue writes to this session. */
    userId: string;

    // Log mutations. sessionId links the set to its guided workout session (null
    // when logging outside guided mode); the provider stamps the user-local
    // workout date and logs any deload/progression DecisionEvent the save implies.
    updateLog: (key: string, entry: LogEntry, sessionId?: string | null) => void;
    deleteLog: (key: string) => void;
    handleExport: () => void;

    // Profile mutations
    updateProfile: (displayName: string | null, unit: Unit) => Promise<void>;
    updateGender: (gender: Gender | null) => Promise<void>;
    updateLengthUnit: (lengthUnit: LengthUnit) => Promise<void>;
    updatePriorityMuscle: (priority: PriorityMuscle | 'balanced' | null) => Promise<void>;
    updateTimezone: (timezone: string) => Promise<void>;
    updateAccentColor: (accentColor: string) => Promise<void>;
    logBodyWeight: (weightKg: number) => Promise<BodyweightEntry>;
    deleteBodyWeight: (id: string) => Promise<void>;
    refreshMeasurements: () => void;

    // Notes
    notes: Notes;
    saveNote: (week: number, routineExerciseId: string, note: string) => Promise<void>;
    deleteNote: (week: number, routineExerciseId: string) => Promise<void>;

    // Swaps
    swaps: Swaps;
    setSwap: (week: number, routineExerciseId: string, exerciseId: string) => Promise<void>;
    clearSwap: (week: number, routineExerciseId: string) => Promise<void>;

    // UI state
    navigate: (view: View) => void;
    activeWeek: number;
    setActiveWeek: (week: number) => void;
    activeTab: TabKey;
    setActiveTab: (tab: TabKey) => void;
    activeDay: number | null;
    setActiveDay: (day: number) => void;
    activeSchedule: ScheduleEntry[];
    /** Resolve a schedule entry to the variant-aware tab key whose exercises it shows. */
    resolveTabForEntry: (entry: ScheduleEntry) => TabKey;
    showOnboarding: boolean;
    triggerOnboarding: () => void;
    dismissOnboarding: () => void;

    // Guided mode (workout mode overlay) + rest-timer auto-advance
    autoAdvance: boolean;
    setAutoAdvance: (v: boolean) => void;
    workoutModeOpen: boolean;
    setWorkoutModeOpen: (v: boolean) => void;

    // Rest timer
    timerTrigger: number;
    timerDuration: number | null;
    fireTrigger: (durationSeconds?: number) => void;

    // Routine & exercise state
    exercises: DbExercise[];
    routines: RoutineWithExercises[];
    activeRoutine: RoutineWithExercises | null;
    routineExercisesByTabKey: Partial<Record<TabKey, RoutineExercise[]>>;

    // Per-domain client-fetch state (phase-1 instant loading)
    loading: {
        profile: boolean;
        bodyweight: boolean;
        logs: boolean;
        routines: boolean;
        exercises: boolean;
        notes: boolean;
        sessions: boolean;
        adjustments: boolean;
    };
    errors: {
        profile: boolean;
        bodyweight: boolean;
        logs: boolean;
        routines: boolean;
        exercises: boolean;
        notes: boolean;
        sessions: boolean;
        adjustments: boolean;
    };
    retry: () => void;

    // Routine mutations
    createRoutine: (name: string) => Promise<WorkoutRoutine>;
    renameRoutine: (id: string, name: string) => Promise<void>;
    updateRoutineProgramWeeks: (id: string, weeks: number) => Promise<void>;
    setProgramAnchor: (id: string, anchorISO: string) => Promise<void>;
    deleteRoutine: (id: string) => Promise<void>;
    setActiveRoutine: (routineId: string | null) => Promise<void>;
    addExerciseToRoutine: (
        routineId: string,
        exerciseId: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
        workoutType: WorkoutType,
        variant?: WorkoutVariant | null,
    ) => Promise<RoutineExercise>;
    removeExerciseFromRoutine: (routineExerciseId: string) => Promise<void>;
    updateRoutineExercise: (
        routineExerciseId: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
        restSeconds: number | null,
    ) => Promise<void>;
    reorderRoutineExercises: (routineId: string, orderedIds: string[]) => Promise<void>;
    cloneTemplate: (
        slug: string,
        trainingDays?: number[],
        sessionTime?: string,
        experience?: ExperienceLevel,
    ) => Promise<WorkoutRoutine>;
    generateRoutine: (
        answers: OnboardingAnswers,
        trainingDays: number[],
        sessionTime: SessionTime,
        styleKey: string,
        name?: string,
    ) => Promise<WorkoutRoutine>;
    completeOnboarding: () => Promise<void>;

    // Exercise library mutations
    createExercise: (
        name: string,
        category: ExerciseCategory,
        defaultSets: string,
        defaultReps: string,
    ) => Promise<DbExercise>;
    updateExercise: (id: string, name: string, defaultSets: string, defaultReps: string) => Promise<void>;
    deleteExercise: (id: string) => Promise<void>;

    // Exercise preferences (hide / never-show)
    hiddenExerciseIds: Set<string>;
    toggleHideExercise: (exerciseId: string, hidden: boolean) => Promise<void>;

    // Adaptive missed-workout regeneration
    adjustments: ProgramAdjustment[];
    // Derived program position for the active routine (null when none/loading).
    programPosition: ProgramPosition | null;
    // Completion-paced current program week (falls back to activeWeek when there
    // is no anchored program yet). The week the user is "due" to train.
    currentWeek: number;
    // The active nudge to surface on Train, or null.
    regenSuggestion: RegenSuggestion;
    acceptReentryDeload: (routineId: string, weekInteger: number, daysAway?: number) => Promise<void>;
    dismissReentry: (routineId: string, weekInteger: number) => Promise<void>;
    // User-initiated "go easier this week": applies the ramp-back ease to the
    // current week without inserting/offsetting the program.
    lightenThisWeek: (routineId: string, weekInteger: number) => Promise<void>;
    // The unified decision log (newest first) for the Coach Decision Timeline.
    decisions: DecisionEventRow[];
    // Revalidate the sessions feed (call after completing a workout so the
    // derived program position updates immediately rather than after SWR's dedup).
    refreshSessions: () => void;
}

export const PulseContext = createContext<PulseContextValue | null>(null);

export function usePulse(): PulseContextValue {
    const ctx = useContext(PulseContext);
    if (!ctx) throw new Error('usePulse must be used inside PulseProvider');
    return ctx;
}
