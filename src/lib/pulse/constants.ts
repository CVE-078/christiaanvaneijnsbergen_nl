import type { WorkoutType } from './types';
import type { DaysPerWeek, ExperienceLevel } from './recommendation';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
    push: 'Push', pull: 'Pull', legs: 'Legs',
    chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
    upper: 'Upper', lower: 'Lower', full_body: 'Full Body',
};

export const WORKOUT_TYPE_ORDER: readonly WorkoutType[] = [
    'push', 'pull', 'legs', 'chest', 'back', 'shoulders', 'arms', 'upper', 'lower', 'full_body',
];

export const SUGGESTED_DAYS: Record<DaysPerWeek, number[]> = {
    '2-3': [1, 3],
    '4':   [1, 2, 4, 5],
    '5-6': [1, 2, 3, 4, 5],
};

export const EXPERIENCE_LEVEL_COLOR: Record<ExperienceLevel, string> = {
    beginner:     'text-emerald-400',
    intermediate: 'text-amber-400',
    advanced:     'text-red-400',
};
