import type { TabKey, WorkoutType, WorkoutVariant } from './types';
import type { DaysPerWeek, ExperienceLevel } from './recommendation';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
    push: 'Push',
    pull: 'Pull',
    legs: 'Legs',
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    arms: 'Arms',
    upper: 'Upper',
    lower: 'Lower',
    full_body: 'Full Body',
};

// Long form used on the share card ("Push Day", "Leg Day"). Derived from the
// single base map above so the two never drift; the few labels that read oddly
// with a plain "Day" suffix (Legs→Leg, Shoulders→Shoulder, Full Body) override.
const WORKOUT_TYPE_LABEL_LONG_OVERRIDE: Partial<Record<WorkoutType, string>> = {
    legs: 'Leg Day',
    shoulders: 'Shoulder Day',
    full_body: 'Full Body',
};

export function workoutTypeLabelLong(type: WorkoutType): string {
    return WORKOUT_TYPE_LABEL_LONG_OVERRIDE[type] ?? `${WORKOUT_TYPE_LABELS[type]} Day`;
}

export const WORKOUT_TYPE_ORDER: readonly WorkoutType[] = [
    'push',
    'pull',
    'legs',
    'chest',
    'back',
    'shoulders',
    'arms',
    'upper',
    'lower',
    'full_body',
];

export const WORKOUT_TYPE_OPTIONS: readonly { value: WorkoutType; label: string }[] = WORKOUT_TYPE_ORDER.map((t) => ({
    value: t,
    label: WORKOUT_TYPE_LABELS[t],
}));

export const BARBELL_KG = 20;
export const DUMBBELL_HANDLE_KG = 2.5;
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

// Adaptive missed-workout regeneration. Under ~a week off there is no real
// detraining, so a gap only triggers a ramp-back suggestion at GAP_DAYS or more.
// A ramp-back week runs reduced volume at an easier RIR before normal progression
// resumes.
export const GAP_DAYS = 10;
export const RAMPBACK_VOLUME_FACTOR = 0.6;
export const RAMPBACK_RIR_BONUS = 1;

// Auto-applied deload for a stalled lift. The next target drops to DELOAD_FACTOR
// of the previous weight; after a deload the lift gets DELOAD_REBUILD_WEEKS quiet
// weeks to climb back before another deload can trigger. A consecutive e1RM drop
// of at least (1 - DELOAD_DROP_THRESHOLD) counts as "already deloaded".
export const DELOAD_FACTOR = 0.9;
export const DELOAD_REBUILD_WEEKS = 3;
export const DELOAD_DROP_THRESHOLD = 0.97;

export const SUGGESTED_DAYS: Record<DaysPerWeek, number[]> = {
    '2-3': [1, 3],
    '4': [1, 2, 4, 5],
    '5-6': [1, 2, 3, 4, 5],
};

// Upper bound on selectable training days for each days-per-week answer. The
// onboarding day picker caps selection here so the chosen frequency drives the
// routine's session count (e.g. "4 days" can't become a 6-session routine).
export const MAX_TRAINING_DAYS: Record<DaysPerWeek, number> = {
    '2-3': 3,
    '4': 4,
    '5-6': 6,
};

export const EXPERIENCE_LEVEL_COLOR: Record<ExperienceLevel, string> = {
    beginner: 'text-emerald-400',
    intermediate: 'text-amber-400',
    advanced: 'text-red-400',
};

export function tabKeyLabel(key: TabKey): string {
    if (key.includes(':')) {
        const [type, variant] = key.split(':') as [WorkoutType, WorkoutVariant];
        return `${WORKOUT_TYPE_LABELS[type]} ${variant}`;
    }
    return WORKOUT_TYPE_LABELS[key as WorkoutType];
}
