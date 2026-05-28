import { createContext, useContext } from 'react';
import type {
    Logs,
    Profile,
    BodyweightEntry,
    WorkoutType,
    Unit,
    LogEntry,
    View,
    PRMap,
    DbExercise,
    WorkoutRoutine,
    RoutineWithExercises,
    RoutineExercise,
    RoutineTemplate,
    ExerciseCategory,
    ScheduleEntry,
} from '@/lib/pulse/types';

export interface PulseContextValue {
    // Data
    logs: Logs;
    profile: Profile;
    bodyweightLogs: BodyweightEntry[];
    isLoading: boolean;

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
    logBodyWeight: (weightKg: number) => Promise<BodyweightEntry>;
    deleteBodyWeight: (id: string) => Promise<void>;

    // UI state
    navigate: (view: View) => void;
    activeWeek: number;
    setActiveWeek: (week: number) => void;
    activeTab: WorkoutType;
    setActiveTab: (tab: WorkoutType) => void;
    activeDay: number | null;
    setActiveDay: (day: number) => void;
    activeSchedule: ScheduleEntry[];
    showOnboarding: boolean;
    triggerOnboarding: () => void;
    dismissOnboarding: () => void;

    // Rest timer
    timerTrigger: number;
    fireTrigger: () => void;

    // Routine & exercise state
    exercises: DbExercise[];
    routines: RoutineWithExercises[];
    activeRoutine: RoutineWithExercises | null;
    routineExercisesByType: Partial<Record<WorkoutType, RoutineExercise[]>>;

    // Routine mutations
    createRoutine: (name: string) => Promise<WorkoutRoutine>;
    deleteRoutine: (id: string) => Promise<void>;
    setActiveRoutine: (routineId: string | null) => Promise<void>;
    addExerciseToRoutine: (
        routineId: string,
        exerciseId: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
        workoutType: WorkoutType,
    ) => Promise<RoutineExercise>;
    removeExerciseFromRoutine: (routineExerciseId: string) => Promise<void>;
    updateRoutineExercise: (
        routineExerciseId: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
    ) => Promise<void>;
    reorderRoutineExercises: (routineId: string, orderedIds: string[]) => Promise<void>;
    cloneTemplate: (slug: string, trainingDays?: number[], sessionTime?: string) => Promise<WorkoutRoutine>;
    completeOnboarding: () => Promise<void>;

    // Exercise library mutations
    createExercise: (name: string, category: ExerciseCategory, defaultSets: string, defaultReps: string) => Promise<DbExercise>;
    updateExercise: (id: string, name: string) => Promise<void>;
    deleteExercise: (id: string) => Promise<void>;
}

export const PulseContext = createContext<PulseContextValue | null>(null);

export function usePulse(): PulseContextValue {
    const ctx = useContext(PulseContext);
    if (!ctx) throw new Error('usePulse must be used inside PulseProvider');
    return ctx;
}
