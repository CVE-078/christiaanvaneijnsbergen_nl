export interface LogEntry {
    kg: number;
    reps: number;
    rir: number;
    saved: boolean;
    drops?: Array<{ kg: number; reps: number }>;
}

export type Logs = Record<string, LogEntry>;

// Summary of the most recent prior session for an exercise (shown on cards).
export type LastSession = { kg: number; reps: number; setCount: number };

export const WORKOUT_TYPES = [
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
] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export type WorkoutVariant = 'A' | 'B' | 'C' | 'D';
export type TabKey = WorkoutType | `${WorkoutType}:${WorkoutVariant}`;

export interface ScheduleEntry {
    day_of_week: number; // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
    workout_type: WorkoutType;
    variant?: WorkoutVariant | null;
}

export type Unit = 'kg' | 'lbs';

export interface Profile {
    display_name: string | null;
    unit: Unit;
    active_routine_id: string | null;
    onboarding_completed: boolean;
    goal_weight_kg: number | null;
}

export interface BodyMeasurement {
    id: string;
    measured_at: string;
    waist_cm: number | null;
    hips_cm: number | null;
    chest_cm: number | null;
    arms_cm: number | null;
}

export interface BodyweightEntry {
    id: string;
    logged_at: string;
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
    sets: Array<LogEntry & { routineExerciseId: string; setIdx: number }>;
}

export const VIEWS = ['train', 'plan', 'progress', 'profile', 'library'] as const;
export type View = (typeof VIEWS)[number];

// User exercise preferences. v1 only uses 'hidden' (never-show); extensible to
// 'favorite' later. Surfaced to the client as a Set<string> of hidden ids.
export type ExercisePreference = 'hidden';

export type PRMap = Record<string, number>;

export type Notes = Record<string, string>; // key: `${week}-${routineExerciseId}`

export interface BestSet {
    routineExerciseId: string;
    week: number;
    kg: number;
    reps: number;
    e1rm: number;
}

export interface ShareStats {
    workoutLabel: string;
    date: string;
    durationMin: number;
    totalSets: number;
    topLifts: Array<{ name: string; displayWeight: number; reps: number; isPR: boolean }>;
    prCount: number;
}

export const EXERCISE_CATEGORIES = [
    'chest',
    'shoulders',
    'triceps',
    'back',
    'biceps',
    'legs',
    'glutes',
    'calves',
    'abs',
    'other',
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export interface DbExercise {
    id: string;
    name: string;
    category: ExerciseCategory;
    default_sets: string;
    default_reps: string;
    user_id: string | null;
    equipment?: EquipmentKey[];
    movement_pattern?: MovementPattern | null;
    is_compound?: boolean;
}

export interface WorkoutRoutine {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
}

export interface RoutineExercise {
    id: string;
    routine_id: string;
    exercise_id: string;
    workout_type: WorkoutType;
    order: number;
    sets: string;
    reps: string;
    starting_weight_kg: number | null;
    rest_seconds?: number | null;
    variant: WorkoutVariant | null;
    superset_group_id: string | null;
    exercise: DbExercise;
}

export type ExerciseItem = RoutineExercise | [RoutineExercise, RoutineExercise];

export interface ExerciseInstruction {
    exercise_id: string;
    primary_muscles: string[];
    secondary_muscles: string[];
    cues: string[];
}

export interface RoutineWithExercises extends WorkoutRoutine {
    exercises: RoutineExercise[];
    schedule: ScheduleEntry[];
}

export interface WorkoutSession {
    id: string;
    user_id: string;
    routine_id: string | null;
    workout_type: string;
    variant: WorkoutVariant | null;
    started_at: string;
    completed_at: string | null;
}

export const EQUIPMENT_KEYS = ['dumbbells', 'barbell', 'bench', 'cables', 'machines', 'pull_up_bar'] as const;
export type EquipmentKey = (typeof EQUIPMENT_KEYS)[number];
// Bodyweight exercises are represented by an empty `equipment` array (always
// available), so it is intentionally NOT an EquipmentKey.

export const MOVEMENT_PATTERNS = [
    'horizontal_push',
    'vertical_push',
    'horizontal_pull',
    'vertical_pull',
    'squat',
    'hinge',
    'lunge',
    'calf',
    'core',
    'chest_iso',
    'back_iso',
    'shoulder_iso',
    'biceps_iso',
    'triceps_iso',
    'glute_iso',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

// ── Generation: bias, emphasis & program styles ─────────────────────────────

/** Training bias for a session, driving rep ranges. */
export type Bias = 'strength' | 'hypertrophy' | 'balanced' | 'pump';

/** Which session focus a scheduled day trains. */
export type Focus = 'full_body' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';

export interface Emphasis {
    bias: Bias;
    /** Ordered preferred movement patterns; compounds first. The slot filler
     *  walks this list and backfills from it to reach the target count. */
    slots: MovementPattern[];
}

export type EmphasisKey =
    // upper (4-day classic + aesthetic)
    | 'upper_chest_back'
    | 'upper_delts_arms'
    | 'upper_aesthetic_a'
    | 'upper_aesthetic_b'
    // lower (4-day)
    | 'lower_quad'
    | 'lower_post'
    | 'lower_lean'
    // full body
    | 'fb_strength'
    | 'fb_hyper'
    | 'fb_balanced'
    | 'fb_pump'
    | 'fb_chest_back'
    | 'fb_legs'
    | 'fb_delts_arms'
    // ppl
    | 'push'
    | 'pull'
    | 'legs'
    // generic upper/lower (3-day U/L/FB, 5-day hybrids)
    | 'upper_general'
    | 'lower_general';

export interface ProgramStyle {
    key: string;
    name: string;
    /** One-line description for the picker. */
    bestFor: string;
    sessions: Array<{
        focus: Focus;
        emphasis: EmphasisKey;
        variant: WorkoutVariant | null;
    }>;
}

export type SessionTime = '~30 min' | '45–60 min' | '90+ min';

export interface RoutineTemplate {
    id: string;
    name: string;
    slug: string;
    required_equipment: EquipmentKey[];
    days_per_week: string;
    experience_level: 'beginner' | 'intermediate' | 'advanced';
    session_time: string;
    description: string;
    schedule_pattern: WorkoutType[];
    default_days: number[];
}

export function defaultWorkoutType(cat: ExerciseCategory): WorkoutType | null {
    const map: Record<ExerciseCategory, WorkoutType | null> = {
        chest: 'chest',
        shoulders: 'shoulders',
        triceps: 'arms',
        back: 'back',
        biceps: 'arms',
        legs: 'legs',
        glutes: 'legs',
        calves: 'legs',
        abs: null,
        other: null,
    };
    return map[cat];
}

export function templateMatchesEquipment(
    template: Pick<RoutineTemplate, 'required_equipment'>,
    userEquipment: Set<EquipmentKey>,
): boolean {
    return template.required_equipment.every((e) => userEquipment.has(e));
}
