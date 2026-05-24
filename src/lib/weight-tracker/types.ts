export interface LogEntry {
  kg: number;
  reps: number;
  rir: number;
  saved: boolean;
}

export type Logs = Record<string, LogEntry>;

export type WorkoutType = 'push' | 'pull' | 'legs';

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
