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
    sets: Array<LogEntry & { exIdx: number; setIdx: number }>;
}

export type View = 'log' | 'program' | 'history' | 'profile';

// Maps exercise key (workoutType-exIdx) to best E1RM value
export type PRMap = Record<string, number>;
