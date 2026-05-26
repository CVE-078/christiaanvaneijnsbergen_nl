export interface LogEntry {
    kg: number;
    reps: number;
    rir: number;
    saved: boolean;
}

export type Logs = Record<string, LogEntry>;

export type WorkoutType = 'push' | 'pull' | 'legs';

export type Unit = 'kg' | 'lbs';

export interface Profile {
    display_name: string | null;
    unit: Unit;
}

export interface BodyweightEntry {
    id: string;
    logged_at: string; // YYYY-MM-DD
    weight_kg: number;
}

export interface Phase {
    weeks: number[];
    label: string;
    subtitle: string;
    rir: number[];
    color: string;
}

export interface Exercise {
    name: string;
    sets: string;
    reps: string;
    load: string;
    note: string;
}

export interface Workout {
    label: string;
    icon: string;
    color: string;
    description: string;
    exercises: Exercise[];
}

export interface VolumeEntry {
    week: number;
    sets: number;
}

export interface ScheduleDay {
    day: string;
    type: WorkoutType | 'rest';
}

export interface HistorySession {
    week: number;
    type: WorkoutType;
    sets: Array<LogEntry & { routineExerciseId: string; setIdx: number }>;
}

export type View = 'log' | 'program' | 'history' | 'profile' | 'library';

// Maps exercise key (workoutType-exIdx) to best E1RM value
export type PRMap = Record<string, number>;

// ── Exercise Library ──────────────────────────────────────────────────────────

export type ExerciseCategory = 'push' | 'pull' | 'legs' | 'other';

export interface DbExercise {
    id: string;
    name: string;
    category: ExerciseCategory;
    default_sets: string;
    default_reps: string;
    user_id: string | null; // null = global
}

export interface WorkoutRoutine {
    id: string;
    name: string;
    created_at: string;
}

export interface RoutineExercise {
    id: string;            // routine_exercise_id — used as log key component
    routine_id: string;
    exercise_id: string;
    order: number;
    sets: string;
    reps: string;
    starting_weight_kg: number | null;
    exercise: DbExercise;  // joined
}

export interface RoutineWithExercises extends WorkoutRoutine {
    exercises: RoutineExercise[];
}
