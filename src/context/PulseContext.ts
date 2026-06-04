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
    LogEntry,
    Sex,
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

    // Log mutations
    updateLog: (key: string, entry: LogEntry) => void;
    deleteLog: (key: string) => void;
    handleExport: () => void;

    // Profile mutations
    updateProfile: (displayName: string | null, unit: Unit) => Promise<void>;
    updateSex: (sex: Sex | null) => Promise<void>;
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
    };
    errors: {
        profile: boolean;
        bodyweight: boolean;
        logs: boolean;
        routines: boolean;
        exercises: boolean;
        notes: boolean;
    };
    retry: () => void;

    // Routine mutations
    createRoutine: (name: string) => Promise<WorkoutRoutine>;
    renameRoutine: (id: string, name: string) => Promise<void>;
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
}

export const PulseContext = createContext<PulseContextValue | null>(null);

export function usePulse(): PulseContextValue {
    const ctx = useContext(PulseContext);
    if (!ctx) throw new Error('usePulse must be used inside PulseProvider');
    return ctx;
}
