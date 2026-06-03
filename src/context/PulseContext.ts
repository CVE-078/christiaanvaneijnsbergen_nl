import { createContext, useContext } from 'react';
import type {
    Logs,
    Notes,
    Profile,
    BodyweightEntry,
    WorkoutType,
    TabKey,
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
import type { ExperienceLevel } from '@/lib/pulse/recommendation';

export interface PulseContextValue {
    // Data
    logs: Logs;
    profile: Profile;
    bodyweightLogs: BodyweightEntry[];

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

    // Notes
    notes: Notes;
    saveNote: (week: number, routineExerciseId: string, note: string) => Promise<void>;
    deleteNote: (week: number, routineExerciseId: string) => Promise<void>;

    // UI state
    navigate: (view: View) => void;
    activeWeek: number;
    setActiveWeek: (week: number) => void;
    activeTab: TabKey;
    setActiveTab: (tab: TabKey) => void;
    activeDay: number | null;
    setActiveDay: (day: number) => void;
    activeSchedule: ScheduleEntry[];
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
    routineExercisesByType: Partial<Record<WorkoutType, RoutineExercise[]>>;
    routineExercisesByTabKey: Partial<Record<TabKey, RoutineExercise[]>>;

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
        variant?: 'A' | 'B' | null,
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
}

export const PulseContext = createContext<PulseContextValue | null>(null);

export function usePulse(): PulseContextValue {
    const ctx = useContext(PulseContext);
    if (!ctx) throw new Error('usePulse must be used inside PulseProvider');
    return ctx;
}
