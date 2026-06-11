import type { TabKey, WorkoutType, WorkoutVariant, EquipmentKey } from './types';
import type { ExperienceLevel } from './recommendation';

// Short, scannable equipment labels for chips (the routine setup uses its own
// longer prose labels). Empty equipment = bodyweight, handled at the call site.
export const EQUIPMENT_LABELS: Record<EquipmentKey, string> = {
    dumbbells: 'Dumbbells',
    barbell: 'Barbell',
    bench: 'Bench',
    cables: 'Cables',
    machines: 'Machine',
    pull_up_bar: 'Pull-up bar',
};

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
// A ramp-back week eases the prescribed RIR before normal progression resumes.
// NOTE: RAMPBACK_VOLUME_FACTOR is recorded (in the adjustment payload + decision
// event) but not yet enforced anywhere, so today the only felt ease is the RIR
// bonus. Wiring the volume cut into set rendering is tracked as Tier 2 #7; the
// user-facing copy deliberately promises only an easier RIR until then.
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

// SUGGESTED_DAYS / MAX_TRAINING_DAYS moved to ./weeklyFrequency.ts (Issue 0),
// which owns the exact weekly-frequency concept end to end.

// Selectable accent colours. `key` is stored on the profile; `accent`/`dim`
// override the `--color-pulse-accent` / `--color-pulse-accent-dim` tokens at
// runtime. The first entry (coral) is the default and matches globals.css.
export interface AccentPreset {
    key: string;
    label: string;
    accent: string;
    dim: string;
}
export const ACCENT_PRESETS: AccentPreset[] = [
    { key: 'coral', label: 'Coral', accent: '#ff7d66', dim: '#b0503d' },
    { key: 'emerald', label: 'Emerald', accent: '#34d399', dim: '#1f8a63' },
    { key: 'sky', label: 'Sky', accent: '#38bdf8', dim: '#2b7fa6' },
    { key: 'violet', label: 'Violet', accent: '#a78bfa', dim: '#6d57b5' },
    { key: 'amber', label: 'Amber', accent: '#fbbf24', dim: '#b08712' },
    { key: 'rose', label: 'Rose', accent: '#fb7185', dim: '#b04a58' },
];
export const DEFAULT_ACCENT_KEY = 'coral';

// Resolve a stored accent key to its preset, falling back to the default.
export function accentPreset(key: string | null | undefined): AccentPreset {
    return ACCENT_PRESETS.find((p) => p.key === key) ?? ACCENT_PRESETS[0];
}

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

// Travel mode (#322).
export const MAX_TRAVEL_DAYS = 90;
export const TRAVEL_DAY_PRESETS = [3, 7, 14] as const;
// How long the post-expiry "regenerate your home routine?" nudge lingers.
export const ENDED_NUDGE_DAYS = 14;

// Behavior-driven adaptation (#7).
export const BEHAVIOR_MIN_SWAPS = 3; // recent swap-weeks away from a lift before it is demoted
export const BEHAVIOR_RECENCY_DAYS = 120; // ~one to two training blocks; older swaps decay out
