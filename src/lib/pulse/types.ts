export interface LogEntry {
    kg: number;
    reps: number;
    rir: number;
    saved: boolean;
    drops?: Array<{ kg: number; reps: number }>;
    // Links this set to the workout_session it was logged in (null for older /
    // unlinked rows). Used to assemble per-workout detail with real dates.
    session_id?: string | null;
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
    // Optional descriptive focus label for the quad/posterior lower-day split
    // (e.g. "Lower (Quads)" / "Lower (Hamstrings & Glutes)"), populated at
    // generation from the session emphasis. Null for sessions that don't need
    // disambiguation. Shown on spacious surfaces (Plan, guided); tabs keep the
    // compact type+variant label. See focusLabelForEmphasis in generation.ts.
    label?: string | null;
}

export type Unit = 'kg' | 'lbs';

export type LengthUnit = 'cm' | 'in';

export type Gender = 'male' | 'female';

// User-chosen muscle to emphasize in generation. 'arms' expands to biceps +
// triceps wherever muscles are enumerated. On the profile this is stored as
// PriorityMuscle | 'balanced' | null (null = never chosen → seed from gender;
// 'balanced' = explicit no-priority).
export type PriorityMuscle = 'glutes' | 'legs' | 'chest' | 'back' | 'shoulders' | 'arms';

export interface Profile {
    display_name: string | null;
    unit: Unit;
    length_unit: LengthUnit;
    active_routine_id: string | null;
    // Active equipment-profile pointer (equipment_profiles.id); null = none, which
    // is the pre-equipment-profiles behavior (generation equipment step starts
    // empty). See the equipment_profiles table.
    active_equipment_profile_id: string | null;
    onboarding_completed: boolean;
    goal_weight_kg: number | null;
    gender: Gender | null;
    priority_muscle: PriorityMuscle | 'balanced' | null;
    // How the user wants to train; seeds generation. null = never chosen (Balanced).
    training_style: TrainingStyle | null;
    // How much generation rotates exercises; seeds generation. null = never chosen ('varied').
    variety_preference: VarietyPreference | null;
    // Which loading modality to prefer within slots; seeds generation. null = no preference (identity).
    loading_lean: LoadingPreference | null;
    // Joint areas to avoid in generation; null/[] = no restrictions (identity).
    movement_restrictions: RestrictionFlag[] | null;
    // IANA timezone (e.g. 'Europe/Amsterdam'); used to resolve "today"/weekday
    // for calendar adherence. Defaults to 'UTC' until the browser reports one.
    timezone: string;
    // Chosen accent preset key (see ACCENT_PRESETS in constants.ts); null/absent
    // = the default coral. Applied by overriding the pulse-accent CSS vars.
    accent_color?: string | null;
}

// A named, reusable equipment set (Home / Gym / Travel). Equipment is a subset of
// EQUIPMENT_KEYS. Persisted in the equipment_profiles table; seeds generation's
// equipment picker (Branch B). created_at is also the recency tiebreak for the
// pre-fill resolution rule.
export interface EquipmentProfile {
    id: string;
    name: string;
    equipment: EquipmentKey[];
    created_at: string;
    // Travel mode (#322): a future expires_at marks this as the active travel
    // overlay (auto-reverts to the default at read time). null for normal sets.
    expires_at: string | null;
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

// Two aligned trend series for the Body-tab recomp chart, each chronological and
// on its own scale, plus their first->last deltas. Built by computeRecompTrend.
export interface RecompTrend {
    weight: number[]; // bodyweight (kg), oldest to newest
    strength: number[]; // strength score (0-100), by week ascending
    weightDeltaKg: number | null; // last - first, null when fewer than 2 points
    strengthDelta: number | null; // last - first (score points), null when fewer than 2 points
}

// Strength score readout. Pure logic and the standards table live in
// strength.ts; this type stays here so types.ts remains the single source for
// domain types. MainLift is imported from strength.ts to avoid duplicating it.
import type { MainLift } from './strength';
export type { MainLift } from './strength';

export interface StrengthScore {
    score: number | null;
    level: string | null;
    reason: string | null;
    // True when scored against the neutral (gender-midpoint) standard because no
    // gender is set, so the UI can offer to refine it. Absent/false = exact.
    approximate?: boolean;
    lifts: Array<{ lift: MainLift; label: string; subScore: number; ratio: number }>;
}

export type Trend = 'up' | 'down' | 'flat' | 'none';
export interface RecompReadout {
    weight: Trend;
    strength: Trend;
    waist: Trend;
    isRecomping: boolean;
    verdict: string;
    weightDeltaKg: number | null;
    strengthDeltaPct: number | null;
    waistDeltaCm: number | null;
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

// One week of a repeating training block, assembled for the Plan block-arc view:
// the planned working-set volume, the target RIR, its phase, and whether it is a
// deload (the lowest-volume week(s) in the block). Derived by buildBlockArc;
// nothing persisted.
export interface BlockArcWeek {
    week: number;
    volume: number;
    rir: number;
    phase: Phase;
    isDeload: boolean;
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

// User exercise preferences. 'hidden' = never-show; 'favorite' = pin to top.
// Surfaced to the client as a Set<string> of hidden ids.
export type ExercisePreference = 'hidden' | 'favorite';

export type PRMap = Record<string, number>;

export type Notes = Record<string, string>; // key: `${week}-${routineExerciseId}`

export type Swaps = Record<string, string>; // key: `${week}-${routineExerciseId}` -> substitute exercise_id

export interface BestSet {
    routineExerciseId: string;
    week: number;
    kg: number;
    reps: number;
    e1rm: number;
}

// One row of the Plan "next session" preview: the working weight the Train screen
// will prefill for an exercise. Built by computeSessionTargets.
export interface SessionTargetRow {
    routineExerciseId: string;
    name: string;
    sets: string;
    reps: string;
    // Compact, prescription-unit-aware label for display (e.g. "8-12", "30-60s",
    // "10-12/side"). Use this rather than `reps` when rendering the preview, so an
    // isometric reads as a hold and unilateral work reads per side (P1.3).
    prescription: string;
    bodyweight: boolean;
    // Prefilled working weight in kg, or null when there is none yet (week 1, or a
    // fresh lift with no starting weight).
    weightKg: number | null;
}

export interface ShareStats {
    workoutLabel: string;
    date: string;
    durationMin: number;
    totalSets: number;
    topLifts: Array<{ name: string; displayWeight: number; reps: number; isPR: boolean }>;
    prCount: number;
}

export interface SessionSummary extends ShareStats {
    // Total external load this session in the display unit (sum of kg*reps over
    // saved sets incl. drop sets). Pure-bodyweight sets contribute their added
    // load only (0 for unloaded).
    tonnage: number;
    // Top muscle categories worked this session, fractional sets, highest first.
    muscles: Array<{ category: ExerciseCategory; sets: number }>;
    // This session's adaptive-engine events, bucketed for the "what adapted" list.
    decisions: { progressions: DecisionEventRow[]; deloads: DecisionEventRow[]; rampBack: DecisionEventRow[] };
    // Deterministic one-line coach read (no LLM).
    coachRead: string;
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

export interface VolumeTargetRow {
    category: ExerciseCategory;
    actual: number;
    min: number;
    max: number;
    toGo: number;
}

export type RecoveryStatus = 'under' | 'optimal' | 'high_fatigue' | 'overreaching';

// Per-muscle recovery classification plus the numbers the UI chips surface:
// avgRir (null when no sets logged), the week's set count, the target band, and
// sets still needed to reach the floor.
export interface RecoveryDetail {
    status: RecoveryStatus;
    sets: number;
    avgRir: number | null;
    min: number;
    max: number;
    toGo: number;
}

// How an exercise's prescription is read (P1.3). 'reps' (default) = a normal rep
// range; 'time' = a timed hold (default_reps holds the hold range, e.g. "30-60s")
// so isometrics never render as a rep count; 'per_side' = the reps are per limb.
export type PrescriptionUnit = 'reps' | 'time' | 'per_side';

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
    // P1.3: prescription rendering hint. Optional/additive (absent = 'reps').
    prescription_unit?: PrescriptionUnit | null;
    // Smart substitution v2 (#8): same-stimulus family + per-exercise joint-stress
    // flags, used to rank swap alternatives. Optional (additive; not every caller
    // selects them).
    substitution_class?: string | null;
    contraindications?: RestrictionFlag[];
}

export interface WorkoutRoutine {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    rationale?: string | null;
    // Periodized block length (8/10/12/16); the program repeats this block.
    // Optional in the type so existing constructors stay valid; readers default to 12.
    program_weeks?: number;
    // Calendar anchor for program "week 1, day 1". Drives completion-paced
    // progression + calendar adherence. Null only for legacy rows pre-backfill.
    program_anchor?: string | null;
    // Generation duress-warning KEYS (e.g. 'limited_variety', 'no_compound');
    // empty in the normal case. Rendered on the Plan page as a dismissible notice
    // via WARNING_COPY. Optional so existing routine constructors stay valid;
    // readers default to [].
    warnings?: string[];
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
    session_rpe: number | null;
    session_note: string | null;
}

// ── Adaptive missed-workout regeneration ────────────────────────────────────
// Persisted record of a ramp-back decision. Append-only; the engine reads these
// back to suppress repeat prompts and to offset progression for inserted weeks.
// reentry_deload / reentry_dismissed are the gap-driven ramp-back decisions;
// manual_deload is a user-initiated "go easier this week" (same ease, but it does
// NOT insert/offset the program the way a re-entry does).
export type AdjustmentKind = 'reentry_deload' | 'reentry_dismissed' | 'manual_deload';

export interface ProgramAdjustment {
    id: string;
    routine_id: string;
    kind: AdjustmentKind;
    // The monotonic program weekInteger this adjustment applies to.
    effective_week: number;
    created_at: string;
    payload: { volumeFactor?: number; rirBonus?: number; daysAway?: number };
}

// ── Program pause / injury mode ─────────────────────────────────────────────
// A deliberate, user-initiated break in a routine's program calendar. A date
// span, not a per-week ease: resumed_at IS NULL means the pause is active (at
// most one per routine, enforced by a partial unique index). The engine reads
// these to freeze program time (no behind/lapsed penalty, no missed-week hit)
// while a pause runs; detraining time (daysSinceLastSession) keeps ticking, so a
// long pause still hands off to the existing ramp-back on resume.
export interface ProgramPause {
    id: string;
    routine_id: string;
    paused_at: string; // ISO; when the pause began
    resumed_at: string | null; // ISO; when resumed. null = still paused.
    reason: string | null; // optional (injury / illness / travel / life); v1 always null
    created_at: string;
}

// ── DecisionEvent log ───────────────────────────────────────────────────────
// The unified, append/upsert log of every adaptive decision the engine makes.
// Ramp-back also persists in program_adjustments (its operational prescription
// state); this is the canonical log the Coach Decision Timeline reads. deload /
// progression are logged here for the first time (they were pure-function only).
export type DecisionEventType = 'ramp_back' | 'deload' | 'progression' | 'swap';

// Why the engine fired. 'plateau' = stalled e1RM (deload); 'targets_hit' = met
// the prescribed reps/RIR so the lift advances (progression); 'gap' = a missed
// stretch triggered ramp-back; 'manual' = the user chose to go easier this week.
export type DecisionTrigger = 'plateau' | 'targets_hit' | 'gap' | 'manual';

export interface DecisionEvent {
    type: DecisionEventType;
    trigger: DecisionTrigger;
    // The routine_exercise_id a per-lift decision applies to, or '' for a
    // program-wide decision (ramp-back). Empty string (not null) so the dedupe
    // key treats program-wide rows as one per (routine, type, week).
    affectedArea: string;
    // The monotonic program week this decision applies to.
    week: number;
    // Type-specific shape: { fromKg, toKg } for deload, { fromKg, toKg, fromReps,
    // toReps } for progression, { volumeFactor, rirBonus } for ramp-back.
    magnitude: Record<string, number>;
    // 0..1, or null when the engine does not score it.
    confidence: number | null;
}

// A DecisionEvent as stored/read back (server-assigned id + routine + timestamp).
export interface DecisionEventRow extends DecisionEvent {
    id: string;
    routine_id: string;
    created_at: string;
}

export type AdherenceStatus = 'on_track' | 'behind' | 'lapsed' | 'paused';

// Derived program position. weekInteger is completion-paced (advances when a
// scheduled microcycle is completed); progressionIndex is weekInteger minus any
// inserted ramp-back weeks, and is what feeds getPhase/getRIR/volumeForWeek.
export interface ProgramPosition {
    weekInteger: number;
    progressionIndex: number;
    isRampBack: boolean;
    completedCount: number;
    calendarWeek: number;
    behindBy: number;
    daysSinceLastSession: number | null;
    status: AdherenceStatus;
    // True when a pause is currently active for this routine (status === 'paused').
    isPaused: boolean;
    // Days the active pause has run (inclusive), or null when not paused.
    pausedDays: number | null;
    nextEntry: ScheduleEntry | null;
}

// Within-current-week adherence: which scheduled entries are done, still
// upcoming, or already missed (their day passed without a matching session).
export interface WeekAdherence {
    missed: ScheduleEntry[];
    upcoming: ScheduleEntry[];
    done: ScheduleEntry[];
}

// What the nudge offers. catch_up is informational (not persisted); a
// reentry_deload suggestion becomes a persisted adjustment when accepted.
export type RegenSuggestion =
    | { kind: 'reentry_deload'; weekInteger: number; daysAway: number }
    | { kind: 'catch_up'; missed: ScheduleEntry[] }
    | null;

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

/** How the user wants to train; remaps session bias and rep ranges in generation.
 *  'balanced' is the identity (today's behaviour). Stored nullable on the profile. */
export type TrainingStyle = 'balanced' | 'strength' | 'bodybuilding' | 'powerbuilding';

/** How much the generator rotates exercises across sessions. 'varied' is the
 *  identity (today's behaviour: prefer a not-yet-used exercise per slot).
 *  'consistent' anchors the main compound lifts across sessions (progressive
 *  overload + skill) while accessories keep rotating. Stored nullable on the
 *  profile; null resolves to 'varied' only at the generation boundary. */
export type VarietyPreference = 'consistent' | 'varied';

/** Which loading modality the user prefers within a movement-pattern slot.
 *  Acts as a secondary sort inside byPattern: preferred-equipment exercises
 *  float to the top so the fresh-preference logic picks them first. The
 *  fresh-preference always beats the loading preference (a fresh non-preferred
 *  exercise wins over a used preferred one). Stored nullable on the profile;
 *  null / undefined resolves to no preference (identity, byte-identical to
 *  the base generator). */
export type LoadingPreference = 'barbell' | 'dumbbell' | 'machine' | 'cable';

/** Joint areas a user can flag so generation avoids the movements that commonly
 *  stress them. A pure pool filter (like equipment); reduces and substitutes,
 *  never diagnoses or rehabs. Extensible: add a flag here + tag exercises. */
export const RESTRICTION_FLAGS = ['knee', 'lower_back', 'shoulder', 'wrist'] as const;
export type RestrictionFlag = (typeof RESTRICTION_FLAGS)[number];

/** Why a user swapped an exercise (Smart substitution v2, #8). Optional; null /
 *  absent = unspecified, treated as a preference (counts toward #7 learning).
 *  These three constraints are excluded from #7's demote. */
export const SWAP_REASONS = ['pain', 'no_equipment', 'crowded'] as const;
export type SwapReason = (typeof SWAP_REASONS)[number];

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
    // ppl x2 heavy/volume pairs (6-day A/B differentiation, Item 5)
    | 'push_heavy'
    | 'push_volume'
    | 'pull_heavy'
    | 'pull_volume'
    // phul (4-day powerbuilding: power + hypertrophy per region, #18)
    | 'phul_upper_power'
    | 'phul_lower_power'
    | 'phul_upper_hyp'
    | 'phul_lower_hyp'
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
    // Goal union mirrors recommendation.ts `Goal` (inlined to avoid an import cycle).
    goal: 'build_muscle' | 'lose_fat' | 'general_fitness';
    gender_fit: 'any' | 'female';
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
