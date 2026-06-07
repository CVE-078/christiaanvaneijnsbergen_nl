import type {
    Bias,
    Emphasis,
    EmphasisKey,
    EquipmentKey,
    ExerciseCategory,
    Focus,
    MovementPattern,
    ProgramStyle,
    SessionTime,
    Gender,
    PriorityMuscle,
    TrainingStyle,
    VarietyPreference,
    LoadingPreference,
    WorkoutType,
    WorkoutVariant,
} from './types';
import type { ExperienceLevel, Goal, OnboardingAnswers } from './recommendation';

export type { Focus };

// ── Emphasis library ─────────────────────────────────────────────────────────
// Each entry pairs a training bias with an ordered list of movement patterns
// (compounds first). The slot filler walks this list and backfills from it to
// reach the target count. `vertical_pull` is never a primary slot, a
// dumbbell-only user has no usable option, so it is omitted entirely; pulling
// is covered by `horizontal_pull` + `back_iso`.
export const EMPHASES: Record<EmphasisKey, Emphasis> = {
    // ── Upper (4-day classic) ────────────────────────────────────────────────
    upper_chest_back: {
        bias: 'hypertrophy',
        slots: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'chest_iso', 'back_iso', 'biceps_iso'],
    },
    upper_delts_arms: {
        bias: 'hypertrophy',
        slots: ['vertical_push', 'horizontal_pull', 'shoulder_iso', 'biceps_iso', 'triceps_iso', 'chest_iso'],
    },
    // ── Upper (4-day aesthetic, upper-priority, more isolation) ──────────────
    upper_aesthetic_a: {
        bias: 'hypertrophy',
        slots: ['horizontal_push', 'horizontal_pull', 'shoulder_iso', 'chest_iso', 'back_iso', 'biceps_iso'],
    },
    upper_aesthetic_b: {
        bias: 'pump',
        slots: ['vertical_push', 'horizontal_pull', 'shoulder_iso', 'biceps_iso', 'triceps_iso', 'back_iso'],
    },
    // ── Lower (4-day) ─────────────────────────────────────────────────────────
    lower_quad: {
        bias: 'hypertrophy',
        slots: ['squat', 'lunge', 'hinge', 'glute_iso', 'calf', 'core'],
    },
    lower_post: {
        bias: 'hypertrophy',
        slots: ['hinge', 'glute_iso', 'lunge', 'squat', 'calf', 'core'],
    },
    lower_lean: {
        bias: 'pump',
        slots: ['lunge', 'glute_iso', 'hinge', 'squat', 'calf', 'core'],
    },
    // ── Full body ─────────────────────────────────────────────────────────────
    fb_strength: {
        bias: 'strength',
        slots: ['hinge', 'squat', 'horizontal_push', 'horizontal_pull', 'vertical_push', 'biceps_iso', 'core'],
    },
    fb_hyper: {
        bias: 'hypertrophy',
        slots: ['lunge', 'hinge', 'horizontal_push', 'horizontal_pull', 'shoulder_iso', 'triceps_iso', 'biceps_iso'],
    },
    fb_balanced: {
        bias: 'balanced',
        slots: ['squat', 'hinge', 'vertical_push', 'horizontal_pull', 'horizontal_push', 'shoulder_iso', 'core'],
    },
    fb_pump: {
        bias: 'pump',
        slots: ['lunge', 'horizontal_push', 'horizontal_pull', 'shoulder_iso', 'biceps_iso', 'triceps_iso', 'calf'],
    },
    // ── Full body, emphasis days (3-day) ─────────────────────────────────────
    fb_chest_back: {
        bias: 'hypertrophy',
        slots: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'chest_iso', 'back_iso', 'core'],
    },
    fb_legs: {
        bias: 'hypertrophy',
        slots: ['squat', 'hinge', 'lunge', 'glute_iso', 'calf', 'core'],
    },
    fb_delts_arms: {
        bias: 'hypertrophy',
        slots: ['vertical_push', 'horizontal_pull', 'shoulder_iso', 'biceps_iso', 'triceps_iso', 'core'],
    },
    // ── Push / Pull / Legs ────────────────────────────────────────────────────
    push: {
        bias: 'hypertrophy',
        slots: ['horizontal_push', 'vertical_push', 'chest_iso', 'shoulder_iso', 'triceps_iso'],
    },
    pull: {
        bias: 'hypertrophy',
        slots: ['horizontal_pull', 'hinge', 'back_iso', 'shoulder_iso', 'biceps_iso'],
    },
    legs: {
        bias: 'hypertrophy',
        slots: ['squat', 'hinge', 'lunge', 'glute_iso', 'calf', 'core'],
    },
    // ── Generic upper / lower (3-day U/L/FB, 5-day hybrids) ───────────────────
    upper_general: {
        bias: 'balanced',
        slots: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'shoulder_iso', 'biceps_iso', 'triceps_iso'],
    },
    lower_general: {
        bias: 'balanced',
        slots: ['squat', 'hinge', 'lunge', 'glute_iso', 'calf', 'core'],
    },
};

/** Resolve an emphasis key to its `{ bias, slots }` definition. */
export function emphasisFor(key: EmphasisKey): Emphasis {
    return EMPHASES[key];
}

// ── Muscle priority ──────────────────────────────────────────────────────────
// Movement patterns each priority muscle is trained through (compound first).
// `arms` covers both biceps and triceps isolation.
export const PRIORITY_PATTERNS: Record<PriorityMuscle, MovementPattern[]> = {
    glutes: ['glute_iso', 'hinge'],
    legs: ['squat', 'lunge'],
    chest: ['horizontal_push', 'chest_iso'],
    back: ['horizontal_pull', 'back_iso'],
    shoulders: ['vertical_push', 'shoulder_iso'],
    arms: ['biceps_iso', 'triceps_iso'],
};

/** Default priority seeded from gender (UI only): female → glutes, else balanced. */
export function genderDefault(gender: Gender | null): PriorityMuscle | 'balanced' {
    return gender === 'female' ? 'glutes' : 'balanced';
}

/** Normalize the stored profile value to an active priority, or null for none. */
export function resolvePriority(value: PriorityMuscle | 'balanced' | null | undefined): PriorityMuscle | null {
    return value && value !== 'balanced' ? value : null;
}

/**
 * Tilt an emphasis toward a priority by front-loading the priority's movement
 * patterns that already appear in the emphasis slot list. The slot filler picks
 * front slots first and backfills in order, so this gives the prioritized muscle
 * the first pick and earlier backfill (more volume) within the session's exercise
 * budget. Sessions that don't already train the priority (no matching pattern)
 * are left untouched, we never inject a glute slot into an upper day. A null
 * priority is the identity.
 */
export function tiltEmphasis(emphasis: Emphasis, priority: PriorityMuscle | null): Emphasis {
    if (!priority) return emphasis;
    const wanted = PRIORITY_PATTERNS[priority];
    const present = wanted.filter((p) => emphasis.slots.includes(p));
    if (present.length === 0) return emphasis;
    const rest = emphasis.slots.filter((s) => !present.includes(s));
    return { bias: emphasis.bias, slots: [...present, ...rest] };
}

// ── Program style catalog ──────────────────────────────────────────────────
// Keyed by session count (= trainingDays.length). Variant letters are unique
// per distinct same-focus session (two upper → A,B; three full_body → A,B,C);
// a focus used once is `null`. The first style of each count is the recommended
// default (see recommendStyle).
export const STYLES: Record<number, ProgramStyle[]> = {
    // ── 2 days ────────────────────────────────────────────────────────────────
    2: [
        {
            key: 'fb-2',
            name: 'Full Body',
            bestFor: 'Two days a week, hits everything each session.',
            sessions: [
                { focus: 'full_body', emphasis: 'fb_strength', variant: 'A' },
                { focus: 'full_body', emphasis: 'fb_hyper', variant: 'B' },
            ],
        },
    ],

    // ── 3 days ────────────────────────────────────────────────────────────────
    3: [
        {
            key: 'fb-3',
            name: 'Full Body',
            bestFor: 'Best all-rounder for three days. Heavy, hypertrophy, balanced.',
            sessions: [
                { focus: 'full_body', emphasis: 'fb_strength', variant: 'A' },
                { focus: 'full_body', emphasis: 'fb_hyper', variant: 'B' },
                { focus: 'full_body', emphasis: 'fb_balanced', variant: 'C' },
            ],
        },
        {
            key: 'fb-emphasis-3',
            name: 'Full Body - Emphasis Days',
            bestFor: 'Full body, but each day leans into one region.',
            sessions: [
                { focus: 'full_body', emphasis: 'fb_chest_back', variant: 'A' },
                { focus: 'full_body', emphasis: 'fb_legs', variant: 'B' },
                { focus: 'full_body', emphasis: 'fb_delts_arms', variant: 'C' },
            ],
        },
        {
            key: 'ppl-3',
            name: 'Push / Pull / Legs',
            bestFor: 'Classic split, each muscle group once a week.',
            sessions: [
                { focus: 'push', emphasis: 'push', variant: null },
                { focus: 'pull', emphasis: 'pull', variant: null },
                { focus: 'legs', emphasis: 'legs', variant: null },
            ],
        },
        {
            key: 'ulf-3',
            name: 'Upper / Lower / Full Body',
            bestFor: 'Upper and lower focus plus one full-body day.',
            sessions: [
                { focus: 'upper', emphasis: 'upper_general', variant: null },
                { focus: 'lower', emphasis: 'lower_general', variant: null },
                { focus: 'full_body', emphasis: 'fb_balanced', variant: null },
            ],
        },
    ],

    // ── 4 days ────────────────────────────────────────────────────────────────
    4: [
        {
            key: 'ul-classic-4',
            name: 'Classic Upper / Lower',
            bestFor: 'The reliable four-day split. Each half twice a week.',
            sessions: [
                { focus: 'upper', emphasis: 'upper_chest_back', variant: 'A' },
                { focus: 'lower', emphasis: 'lower_quad', variant: 'A' },
                { focus: 'upper', emphasis: 'upper_delts_arms', variant: 'B' },
                { focus: 'lower', emphasis: 'lower_post', variant: 'B' },
            ],
        },
        {
            key: 'ul-aesthetic-4',
            name: 'Aesthetic Upper / Lower',
            bestFor: 'Upper-body priority with extra isolation and a leaner lower.',
            sessions: [
                { focus: 'upper', emphasis: 'upper_aesthetic_a', variant: 'A' },
                { focus: 'lower', emphasis: 'lower_lean', variant: 'A' },
                { focus: 'upper', emphasis: 'upper_aesthetic_b', variant: 'B' },
                { focus: 'lower', emphasis: 'lower_post', variant: 'B' },
            ],
        },
        {
            key: 'ppl-fb-4',
            name: 'Push / Pull / Legs + Full Body',
            bestFor: 'PPL with a full-body day to bump frequency.',
            sessions: [
                { focus: 'push', emphasis: 'push', variant: null },
                { focus: 'pull', emphasis: 'pull', variant: null },
                { focus: 'legs', emphasis: 'legs', variant: null },
                { focus: 'full_body', emphasis: 'fb_balanced', variant: null },
            ],
        },
        {
            key: 'fb-hmhp-4',
            name: 'Full Body - Heavy / Medium / Heavy / Pump',
            bestFor: 'Four full-body days with a pump finisher to close the week.',
            sessions: [
                { focus: 'full_body', emphasis: 'fb_strength', variant: 'A' },
                { focus: 'full_body', emphasis: 'fb_balanced', variant: 'B' },
                { focus: 'full_body', emphasis: 'fb_hyper', variant: 'C' },
                { focus: 'full_body', emphasis: 'fb_pump', variant: 'D' },
            ],
        },
    ],

    // ── 5 days ────────────────────────────────────────────────────────────────
    5: [
        {
            key: 'ulppl-5',
            name: 'Upper / Lower / Push / Pull / Legs',
            bestFor: 'High frequency: upper-lower base plus a PPL block.',
            sessions: [
                { focus: 'upper', emphasis: 'upper_general', variant: null },
                { focus: 'lower', emphasis: 'lower_quad', variant: null },
                { focus: 'push', emphasis: 'push', variant: null },
                { focus: 'pull', emphasis: 'pull', variant: null },
                { focus: 'legs', emphasis: 'lower_post', variant: null },
            ],
        },
        {
            key: 'pplul-5',
            name: 'Push / Pull / Legs + Upper / Lower',
            bestFor: 'PPL front-loaded, finished with an upper-lower block.',
            sessions: [
                { focus: 'push', emphasis: 'push', variant: null },
                { focus: 'pull', emphasis: 'pull', variant: null },
                { focus: 'legs', emphasis: 'legs', variant: null },
                { focus: 'upper', emphasis: 'upper_general', variant: null },
                { focus: 'lower', emphasis: 'lower_general', variant: null },
            ],
        },
        {
            key: 'fb-ul-hybrid-5',
            name: 'Full Body + Upper / Lower Hybrid',
            bestFor: 'A full-body anchor plus two upper-lower pairs.',
            sessions: [
                { focus: 'full_body', emphasis: 'fb_strength', variant: null },
                { focus: 'upper', emphasis: 'upper_chest_back', variant: 'A' },
                { focus: 'lower', emphasis: 'lower_quad', variant: 'A' },
                { focus: 'upper', emphasis: 'upper_delts_arms', variant: 'B' },
                { focus: 'lower', emphasis: 'lower_post', variant: 'B' },
            ],
        },
    ],

    // ── 6 days ────────────────────────────────────────────────────────────────
    6: [
        {
            key: 'ppl-x2-6',
            name: 'Push / Pull / Legs ×2',
            bestFor: 'Six days, each muscle group twice a week.',
            sessions: [
                { focus: 'push', emphasis: 'push', variant: 'A' },
                { focus: 'pull', emphasis: 'pull', variant: 'A' },
                { focus: 'legs', emphasis: 'legs', variant: 'A' },
                { focus: 'push', emphasis: 'push', variant: 'B' },
                { focus: 'pull', emphasis: 'pull', variant: 'B' },
                { focus: 'legs', emphasis: 'legs', variant: 'B' },
            ],
        },
    ],
};

/**
 * Default-selected style key for a session count.
 * 3 → Full Body, 4 → Classic Upper/Lower, 5 → Upper/Lower/Push/Pull/Legs.
 * For counts with a single style, returns that style's key.
 *
 * Gender-agnostic: personalization now comes from the muscle priority (which
 * tilts emphasis/volume within the chosen split), not from biasing the split.
 */
export function recommendStyle(sessionCount: number): string {
    const styles = STYLES[sessionCount];
    if (!styles || styles.length === 0) {
        // Fall back to the nearest defined count's first style.
        const counts = Object.keys(STYLES)
            .map(Number)
            .sort((a, b) => a - b);
        const nearest = counts.find((c) => c >= sessionCount) ?? counts[counts.length - 1];
        return STYLES[nearest][0].key;
    }

    return styles[0].key;
}

/** Resolve a style by key for a given session count, falling back to the recommended default. */
export function resolveStyle(styleKey: string, sessionCount: number): ProgramStyle {
    const styles = STYLES[sessionCount] ?? STYLES[recommendStyleCount(sessionCount)];
    const match = styles.find((s) => s.key === styleKey);
    if (match) return match;
    const fallbackKey = recommendStyle(sessionCount);
    return styles.find((s) => s.key === fallbackKey) ?? styles[0];
}

// Nearest defined session count (used to resolve a style list when the exact
// count has no catalog entry).
function recommendStyleCount(sessionCount: number): number {
    if (STYLES[sessionCount]) return sessionCount;
    const counts = Object.keys(STYLES)
        .map(Number)
        .sort((a, b) => a - b);
    return counts.find((c) => c >= sessionCount) ?? counts[counts.length - 1];
}

// ── Volume / rep ranges ──────────────────────────────────────────────────────

const VOLUME: Record<SessionTime, Record<ExperienceLevel, { exercises: number; sets: number }>> = {
    '~30 min': {
        beginner: { exercises: 3, sets: 2 },
        intermediate: { exercises: 4, sets: 3 },
        advanced: { exercises: 4, sets: 3 },
    },
    '45–60 min': {
        beginner: { exercises: 5, sets: 3 },
        intermediate: { exercises: 6, sets: 3 },
        advanced: { exercises: 6, sets: 4 },
    },
    '90+ min': {
        beginner: { exercises: 7, sets: 3 },
        intermediate: { exercises: 8, sets: 4 },
        advanced: { exercises: 8, sets: 4 },
    },
};

export function volumeFor(sessionTime: SessionTime, experience: ExperienceLevel): { exercises: number; sets: number } {
    const v = VOLUME[sessionTime][experience];
    return { exercises: Math.max(3, v.exercises), sets: Math.max(2, v.sets) };
}

/**
 * Rep range for a slot, by session bias and whether the lift is a compound.
 * `goal === 'lose_fat'` shifts both columns up one notch to bias toward density.
 */
export function repRange(bias: Bias, isCompound: boolean, goal?: Goal): string {
    const loseFat = goal === 'lose_fat';

    if (bias === 'strength') {
        if (isCompound) return loseFat ? '8-12' : '6-10';
        return loseFat ? '12-20' : '10-15';
    }
    if (bias === 'hypertrophy') {
        if (isCompound) return loseFat ? '10-15' : '8-12';
        return loseFat ? '15-20' : '12-15';
    }
    if (bias === 'pump') {
        if (isCompound) return loseFat ? '15-20' : '12-15';
        return loseFat ? '15-20' : '15-20';
    }
    // balanced
    if (isCompound) return loseFat ? '10-15' : '8-12';
    return loseFat ? '12-20' : '10-15';
}

// ── Training style ───────────────────────────────────────────────────────────
// Training style remaps each session's bias through this table before the rep
// and set logic. 'balanced' is the identity column, so an unset / balanced style
// leaves the engine's output byte-identical (the safety invariant for rollout).
// See docs/superpowers/specs/2026-06-07-training-style-generation-design.md.
//
// NOTE: training style does NOT constrain training frequency. A 6-day split under
// 'strength' remaps all six sessions to strength bias by design (an accepted
// limitation, there is no fatigue model yet). Future fatigue work must not assume
// the style already caps frequency.
const BIAS_REMAP: Record<TrainingStyle, Record<Bias, Bias>> = {
    balanced: { strength: 'strength', balanced: 'balanced', hypertrophy: 'hypertrophy', pump: 'pump' },
    strength: { strength: 'strength', balanced: 'strength', hypertrophy: 'strength', pump: 'hypertrophy' },
    bodybuilding: { strength: 'hypertrophy', balanced: 'hypertrophy', hypertrophy: 'hypertrophy', pump: 'pump' },
    powerbuilding: { strength: 'strength', balanced: 'strength', hypertrophy: 'strength', pump: 'strength' },
};

/** Remap a session's bias for the chosen training style. The single source of
 *  truth for day-level style remapping. Defensive fallback returns the input. */
export function resolveBias(sessionBias: Bias, style: TrainingStyle): Bias {
    return BIAS_REMAP[style]?.[sessionBias] ?? sessionBias;
}

// Main movement patterns that keep the heavy (strength) rep range under
// Powerbuilding; everything else uses the hypertrophy range. This constant is the
// single edit point for the heavy-pattern policy (data, not buried logic).
//
// NOTE: a conventional deadlift and a Romanian deadlift both map to `hinge`, so
// both land here. That is an intentional approximation until per-exercise metadata
// (generation Phase 0 #2) can separate the main lift from its accessory variants.
export const POWERBUILDING_HEAVY_PATTERNS: ReadonlySet<MovementPattern> = new Set([
    'squat',
    'hinge',
    'horizontal_push',
    'vertical_push',
]);

/** Main bilateral compound patterns anchored across sessions under the
 *  'consistent' variety preference, so the same squat/press/row recurs for
 *  progressive overload and skill. Broader than POWERBUILDING_HEAVY_PATTERNS
 *  (which is about rep ranges, not skill): rows and vertical pulls belong here.
 *  `lunge` is excluded (unilateral accessory). Kept SEPARATE from
 *  POWERBUILDING_HEAVY_PATTERNS so a change to one never silently changes the
 *  other. NOTE: anchors are per-generation and never persisted; generation runs
 *  once at routine creation, so this does not interact with ramp-back today. The
 *  only thing that would reopen that is mid-program regeneration, at which point
 *  reconsider whether the anchor map should be preserved or reset. */
export const COMPOUND_ANCHOR_PATTERNS: ReadonlySet<MovementPattern> = new Set([
    'squat',
    'hinge',
    'horizontal_push',
    'vertical_push',
    'horizontal_pull',
    'vertical_pull',
]);

/** Rep range for a slot, given the bias already resolved by `resolveBias`.
 *  Powerbuilding is the one style that overrides per movement pattern: the main
 *  patterns get the strength range, accessories get hypertrophy. Every other style
 *  simply defers to `repRange` on the resolved bias (pattern ignored). */
export function resolveRepRange(
    effectiveBias: Bias,
    pattern: MovementPattern,
    isCompound: boolean,
    goal: Goal | undefined,
    style: TrainingStyle,
): string {
    if (style === 'powerbuilding') {
        const heavy = POWERBUILDING_HEAVY_PATTERNS.has(pattern);
        return repRange(heavy ? 'strength' : 'hypertrophy', isCompound, goal);
    }
    return repRange(effectiveBias, isCompound, goal);
}

const FOCUS_TYPE: Record<Focus, WorkoutType> = {
    full_body: 'full_body',
    upper: 'upper',
    lower: 'lower',
    push: 'push',
    pull: 'pull',
    legs: 'legs',
};

export interface ExerciseMeta {
    id: string;
    equipment: EquipmentKey[];
    movement_pattern: MovementPattern | null;
    is_compound: boolean;
    category: ExerciseCategory;
}

function hasEquipment(ex: ExerciseMeta, have: Set<EquipmentKey>): boolean {
    // Empty equipment = bodyweight, always available; otherwise every listed
    // equipment must be owned.
    if (ex.equipment.length === 0) return true;
    return ex.equipment.every((e) => have.has(e));
}

// ── Exercise ordering (tier sort) ────────────────────────────────────────────
// Applied after selectForSession; assigns the coach-standard presentation order:
// Tier 1 (primary compounds: squat + hinge) → Tier 2 (big multi-joint compounds:
// push, pull, lunge) → Tier 3 (isolation) → Tier 4 (calf, core finishers).
// Non-compound exercises in Tier 1/2 patterns fall through to Tier 3.

function patternTier(pattern: MovementPattern, isCompound: boolean): number {
    if (isCompound && (pattern === 'squat' || pattern === 'hinge')) return 1;
    if (
        isCompound &&
        (pattern === 'horizontal_push' ||
            pattern === 'horizontal_pull' ||
            pattern === 'vertical_push' ||
            pattern === 'vertical_pull' ||
            pattern === 'lunge')
    )
        return 2;
    if (pattern.endsWith('_iso')) return 3;
    return 4; // core, calf, anything else
}

// ── Heavy-compound deduplication guard ───────────────────────────────────────
// These patterns are capped at one compound per session to prevent coach-quality
// errors like "Sumo Deadlift + Deadlift in the same leg day". Lunge and glute_iso
// are intentionally excluded -- Back Squat + Bulgarian Split Squat is valid.
const HEAVY_DEDUP_PATTERNS: ReadonlySet<MovementPattern> = new Set(['hinge', 'squat']);

// ── Loading lean: modality preference secondary sort ─────────────────────────
// Maps a LoadingPreference to the EquipmentKey that identifies that modality.
// Used in byPattern to float preferred-equipment exercises to the front of the
// candidate list so the fresh-preference logic picks them first. Note the
// plural/singular mismatch between the preference names and EquipmentKey values
// ('dumbbell' → 'dumbbells', 'machine' → 'machines', 'cable' → 'cables').
const LOADING_TO_EQUIPMENT: Record<LoadingPreference, EquipmentKey> = {
    barbell: 'barbell',
    dumbbell: 'dumbbells',
    machine: 'machines',
    cable: 'cables',
};

// ── Slot selection (cross-session avoid-set) ─────────────────────────────────

interface Selected {
    ex: ExerciseMeta;
    pattern: MovementPattern;
}

/**
 * Pick exercises for one session using an emphasis's ordered slot list.
 * `used` is a routine-wide avoid-set: a candidate not yet used anywhere this
 * routine is preferred; repetition is only allowed when the pattern is
 * genuinely exhausted across the week. Never picks an exercise already chosen
 * in this session. Under 'consistent', a routine-wide anchor map pins the
 * first-chosen exercise for each compound pattern so it recurs across sessions;
 * accessories keep the fresh-preference.
 */
function selectForSession(
    emphasis: Emphasis,
    count: number,
    usable: ExerciseMeta[],
    used: Set<string>,
    variety: VarietyPreference,
    anchors: Map<MovementPattern, string>,
    loadingLean?: LoadingPreference | null,
): Selected[] {
    const preferredKey = loadingLean ? LOADING_TO_EQUIPMENT[loadingLean] : null;

    // Sort candidates: preferred-equipment exercises first (within freshness),
    // then stable alphabetical by id. When loadingLean is null/undefined the
    // sort is purely alphabetical (byte-identical to the pre-loading-lean output).
    const byPattern = (p: MovementPattern) =>
        usable.filter((ex) => ex.movement_pattern === p).sort((a, b) => {
            if (preferredKey) {
                const aMatch = a.equipment.includes(preferredKey) ? 0 : 1;
                const bMatch = b.equipment.includes(preferredKey) ? 0 : 1;
                if (aMatch !== bMatch) return aMatch - bMatch;
            }
            return a.id.localeCompare(b.id);
        });

    const chosen: Selected[] = [];
    const chosenIds = new Set<string>();
    // Tracks which heavy-compound patterns (hinge / squat) have been filled this
    // session. The cap prevents a second deadlift variant or squat compound from
    // entering via backfill while still allowing lunge and glute_iso accessories.
    const heavyPatternFilled = new Set<MovementPattern>();

    const push = (ex: ExerciseMeta, slot: MovementPattern) => {
        chosen.push({ ex, pattern: slot });
        chosenIds.add(ex.id);
        used.add(ex.id);
        if (HEAVY_DEDUP_PATTERNS.has(slot) && ex.is_compound) {
            heavyPatternFilled.add(slot);
        }
    };

    // `relaxHeavyCap`: thin-pool fallback -- allow a second heavy compound only
    // after a full backfill round produces nothing else.
    const pick = (slot: MovementPattern, relaxHeavyCap = false): boolean => {
        const candidates = byPattern(slot).filter((ex) => !chosenIds.has(ex.id));
        if (candidates.length === 0) return false;

        // Heavy-compound cap: skip if this Tier-1 pattern is already filled,
        // unless the cap has been relaxed because no other option is available.
        if (!relaxHeavyCap && HEAVY_DEDUP_PATTERNS.has(slot) && heavyPatternFilled.has(slot)) {
            return false;
        }

        // Variety 'consistent': anchor the main compound lifts across sessions.
        if (variety === 'consistent' && COMPOUND_ANCHOR_PATTERNS.has(slot)) {
            const anchoredId = anchors.get(slot);
            if (anchoredId) {
                // Anchor lookup takes precedence over the fresh-preference and
                // deliberately bypasses the routine-wide `used` avoid-set. Do not
                // reorder the fresh-preference ahead of this.
                const anchored = candidates.find((ex) => ex.id === anchoredId);
                if (anchored) {
                    push(anchored, slot);
                    return true;
                }
                // Defensive: anchored exercise not selectable here (e.g. a rare
                // second same-pattern slot in one session). Fall through to a
                // fresh pick WITHOUT re-anchoring. Cannot happen on a pattern's
                // first slot within one generation (usable pool is fixed).
            } else {
                // First time this pattern is filled: pick fresh, record the anchor.
                const fresh = candidates.find((ex) => !used.has(ex.id));
                const choice = fresh ?? candidates[0];
                push(choice, slot);
                anchors.set(slot, choice.id);
                return true;
            }
        }

        // Default / accessory path: prefer a candidate not yet used anywhere this
        // routine; otherwise fall back to the first (stable) candidate.
        const fresh = candidates.find((ex) => !used.has(ex.id));
        const choice = fresh ?? candidates[0];
        push(choice, slot);
        return true;
    };

    // First pass: one exercise per slot in emphasis order.
    for (const slot of emphasis.slots) {
        if (chosen.length >= count) break;
        pick(slot);
    }

    // Backfill: walk uncovered patterns first (breadth over depth), then revisit
    // already-filled ones. The heavy-cap is relaxed only after a full round yields
    // nothing, so thin equipment pools can still reach the target count.
    let relaxedHeavyCap = false;
    let guard = 0;
    while (chosen.length < count && guard < 50) {
        guard++;
        let added = false;
        const coveredPatterns = new Set(chosen.map((c) => c.pattern));
        // Stable sort: uncovered slots (0) before covered (1).
        const slotsByPriority = [...emphasis.slots].sort(
            (a, b) => (coveredPatterns.has(a) ? 1 : 0) - (coveredPatterns.has(b) ? 1 : 0),
        );
        for (const slot of slotsByPriority) {
            if (chosen.length >= count) break;
            if (pick(slot, relaxedHeavyCap)) added = true;
        }
        if (!added) {
            if (!relaxedHeavyCap) {
                relaxedHeavyCap = true; // one retry with the cap lifted
            } else {
                break; // pool genuinely exhausted
            }
        }
    }

    return chosen;
}

// ── Auto-supersets (30-min sessions) ─────────────────────────────────────────

// Antagonist family groups: a member of one family pairs with a member of
// another for time efficiency.
const PUSH_PATTERNS: ReadonlySet<MovementPattern> = new Set([
    'horizontal_push',
    'vertical_push',
    'chest_iso',
    'shoulder_iso',
    'triceps_iso',
]);
const PULL_PATTERNS: ReadonlySet<MovementPattern> = new Set([
    'horizontal_pull',
    'vertical_pull',
    'back_iso',
    'biceps_iso',
]);
const SQUAT_PATTERNS: ReadonlySet<MovementPattern> = new Set(['squat', 'lunge']);
const HINGE_PATTERNS: ReadonlySet<MovementPattern> = new Set(['hinge', 'glute_iso']);

function antagonist(a: MovementPattern, b: MovementPattern): boolean {
    if (PUSH_PATTERNS.has(a) && PULL_PATTERNS.has(b)) return true;
    if (PULL_PATTERNS.has(a) && PUSH_PATTERNS.has(b)) return true;
    if (SQUAT_PATTERNS.has(a) && HINGE_PATTERNS.has(b)) return true;
    if (HINGE_PATTERNS.has(a) && SQUAT_PATTERNS.has(b)) return true;
    return false;
}

/**
 * Greedily pair the ordered selection into antagonist supersets, returning a
 * group id per index (null = solo). Paired members are reordered to be adjacent
 * by the caller (it consumes this order). Each pair shares one fresh group id;
 * leftovers stay solo.
 */
function buildSupersets(
    selected: Selected[],
    makeGroupId: () => string,
): Array<{ item: Selected; groupId: string | null }> {
    const out: Array<{ item: Selected; groupId: string | null }> = [];
    const consumed = new Array<boolean>(selected.length).fill(false);

    for (let i = 0; i < selected.length; i++) {
        if (consumed[i]) continue;
        // Find the first later, unconsumed antagonist.
        let partner = -1;
        for (let j = i + 1; j < selected.length; j++) {
            if (consumed[j]) continue;
            if (antagonist(selected[i].pattern, selected[j].pattern)) {
                partner = j;
                break;
            }
        }
        if (partner === -1) {
            out.push({ item: selected[i], groupId: null });
            consumed[i] = true;
        } else {
            const groupId = makeGroupId();
            consumed[i] = true;
            consumed[partner] = true;
            // Emit the pair adjacently so their `order` is consecutive.
            out.push({ item: selected[i], groupId });
            out.push({ item: selected[partner], groupId });
        }
    }
    return out;
}

// ── Blueprint generation ─────────────────────────────────────────────────────

export interface GenerationInput {
    style: ProgramStyle;
    answers: OnboardingAnswers;
    sessionTime: SessionTime;
    trainingDays: number[];
    pool: ExerciseMeta[];
    /** Active muscle priority (resolved; null = none). Tilts each session's emphasis. */
    priority?: PriorityMuscle | null;
    /** How the user wants to train. Remaps each session's bias and rep ranges.
     *  Absent / 'balanced' is a no-op (identity). */
    trainingStyle?: TrainingStyle;
    /** How much to rotate exercises across sessions. Absent / 'varied' is the
     *  no-op identity path; 'consistent' anchors the main compounds. */
    varietyPreference?: VarietyPreference;
    /** Which loading modality to prefer within a slot (secondary sort inside
     *  byPattern). Absent / null is the no-op identity path. */
    loadingLean?: LoadingPreference | null;
    /** Generates a unique superset group id. Server passes crypto.randomUUID. */
    makeGroupId?: () => string;
}

export interface RoutineBlueprint {
    schedule: Array<{ day_of_week: number; workout_type: WorkoutType; variant: WorkoutVariant | null }>;
    exercises: Array<{
        exercise_id: string;
        workout_type: WorkoutType;
        variant: WorkoutVariant | null;
        order: number;
        sets: string;
        reps: string;
        superset_group_id: string | null;
    }>;
}

let groupCounter = 0;
function defaultGroupId(): string {
    groupCounter += 1;
    return `superset-${groupCounter}`;
}

export function generateRoutine(input: GenerationInput): RoutineBlueprint {
    const { style, answers, sessionTime, trainingDays, pool } = input;
    const makeGroupId = input.makeGroupId ?? defaultGroupId;
    const days = [...trainingDays].sort((a, b) => a - b);
    const { exercises: exCount, sets } = volumeFor(sessionTime, answers.experience);
    const isSuperset = sessionTime === '~30 min';

    const usable = pool.filter((ex) => hasEquipment(ex, answers.equipment));
    const used = new Set<string>();
    const variety = input.varietyPreference ?? 'varied';
    // Routine-wide anchor map (per-generation, never persisted) used only under
    // 'consistent' to keep the main compounds the same across sessions.
    const anchors = new Map<MovementPattern, string>();

    const schedule: RoutineBlueprint['schedule'] = [];
    const exercises: RoutineBlueprint['exercises'] = [];

    style.sessions.forEach((session, i) => {
        if (i >= days.length) return;
        const workout_type = FOCUS_TYPE[session.focus];
        const variant = session.variant;
        schedule.push({ day_of_week: days[i], workout_type, variant });

        const emphasis = tiltEmphasis(emphasisFor(session.emphasis), input.priority ?? null);
        const trainingStyle = input.trainingStyle ?? 'balanced';
        const effectiveBias = resolveBias(emphasis.bias, trainingStyle);
        const selected = selectForSession(emphasis, exCount, usable, used, variety, anchors, input.loadingLean);

        // Tier sort: present exercises in coach-standard order within each session.
        // Compounds lead (Tier 1: squat/hinge; Tier 2: push/pull/lunge), isolations
        // follow (Tier 3), core/calf finish (Tier 4). Stable sort preserves
        // emphasis-driven ordering within the same tier.
        const sortedSelected = [...selected].sort(
            (a, b) => patternTier(a.pattern, a.ex.is_compound) - patternTier(b.pattern, b.ex.is_compound),
        );

        // Sets: 3 normally; 4 for the first compound of a strength-bias session.
        let firstCompoundBumped = false;
        const baseSets = Math.max(3, sets);

        const ordered = isSuperset
            ? buildSupersets(sortedSelected, makeGroupId)
            : sortedSelected.map((item) => ({ item, groupId: null as string | null }));

        ordered.forEach(({ item, groupId }, order) => {
            const { ex, pattern } = item;
            let exSets = baseSets;
            if (effectiveBias === 'strength' && ex.is_compound && !firstCompoundBumped) {
                exSets = baseSets + 1;
                firstCompoundBumped = true;
            }
            exercises.push({
                exercise_id: ex.id,
                workout_type,
                variant,
                order,
                sets: String(exSets),
                reps: resolveRepRange(effectiveBias, pattern, ex.is_compound, answers.goal, trainingStyle),
                superset_group_id: groupId,
            });
        });
    });

    return { schedule, exercises };
}

// Trim a template's exercise list to the session-length volume target, grouping
// by (workout_type, variant) so each session keeps up to `exercises` lifts (never
// below the floor, never inventing exercises the template lacks). Replaces the old
// applyVolume slice-to-4 / minus-a-set logic that could gut a routine to one lift.
export function applyTemplateVolume<
    T extends { workout_type: string; variant: string | null; order: number; sets: string },
>(exercises: T[], sessionTime: SessionTime, experience: ExperienceLevel): T[] {
    const { exercises: perSession, sets } = volumeFor(sessionTime, experience);
    const groups = new Map<string, T[]>();
    for (const ex of exercises) {
        const key = `${ex.workout_type}:${ex.variant ?? ''}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(ex);
    }
    const out: T[] = [];
    for (const group of groups.values()) {
        const sorted = [...group].sort((a, b) => a.order - b.order);
        const keep = Math.min(sorted.length, Math.max(perSession, 3));
        for (const ex of sorted.slice(0, keep)) out.push({ ...ex, sets: String(sets) });
    }
    return out;
}

const GOAL_LABELS: Record<Goal, string> = {
    build_muscle: 'build muscle',
    lose_fat: 'lose fat',
    general_fitness: 'general fitness',
};

const TRAINING_STYLE_CLAUSE: Record<TrainingStyle, string> = {
    balanced: '',
    strength: ' Tuned for strength: heavier loads and lower reps on the main lifts.',
    bodybuilding: ' Tuned for size: moderate-to-high reps across every session.',
    powerbuilding: ' A powerbuilding blend: heavy main lifts, higher-rep accessories.',
};

// Human-readable reason a routine was generated, from the onboarding inputs and
// the chosen program style. Shown on the Plan screen and in the setup flow.
export function buildRationale(
    answers: OnboardingAnswers,
    sessionTime: SessionTime,
    style: ProgramStyle,
    priority?: PriorityMuscle | null,
    trainingStyle?: TrainingStyle,
): string {
    const goal = GOAL_LABELS[answers.goal] ?? answers.goal;
    const base = `${style.name} for ${answers.experience} lifters · ${answers.days} days/week · ${goal} · ${sessionTime} sessions. ${style.bestFor}`;
    const styleClause = TRAINING_STYLE_CLAUSE[trainingStyle ?? 'balanced'];
    const withPriority = priority
        ? `${base} Every session leans a bit harder into ${priority}, the muscle you want to grow.`
        : base;
    return `${withPriority}${styleClause}`;
}
