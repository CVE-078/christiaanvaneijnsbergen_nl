import type {
    Bias,
    Emphasis,
    EmphasisKey,
    EquipmentKey,
    ExerciseCategory,
    Focus,
    MovementPattern,
    ProgramStyle,
    RestrictionFlag,
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
import { EMPTY_BEHAVIOR, type BehaviorSignal } from './behavior';

export type { Focus };

// ── Emphasis library ─────────────────────────────────────────────────────────
// Each entry pairs a training bias with an ordered list of movement patterns
// (compounds first). The slot filler walks this list and backfills from it to
// reach the target count. `vertical_pull` appears only on back-focused upper /
// pull days. A dumbbell-only user (no pull-up bar / lat pulldown) has no usable
// option, so the equipment filter no-ops the slot and backfill covers the gap
// from the other patterns; gym users get a vertical pull.
export const EMPHASES: Record<EmphasisKey, Emphasis> = {
    // ── Upper (4-day classic) ────────────────────────────────────────────────
    upper_chest_back: {
        bias: 'hypertrophy',
        // 7 slots: vertical_pull at pos 3 for gym users; at the 6-cap (45-60 min)
        // the trailing biceps_iso drops, and a dumbbell-only user no-ops
        // vertical_pull and keeps biceps_iso (byte-identical fallback).
        slots: [
            'horizontal_push',
            'horizontal_pull',
            'vertical_pull',
            'vertical_push',
            'chest_iso',
            'back_iso',
            'biceps_iso',
        ],
    },
    upper_delts_arms: {
        bias: 'hypertrophy',
        slots: ['vertical_push', 'horizontal_pull', 'shoulder_iso', 'biceps_iso', 'triceps_iso', 'chest_iso'],
    },
    // ── Upper (4-day aesthetic, upper-priority, more isolation) ──────────────
    upper_aesthetic_a: {
        bias: 'hypertrophy',
        // 7 slots: vertical_pull at pos 3; trailing biceps_iso drops at the 6-cap
        // for gym users, dumbbell-only no-ops vertical_pull and keeps biceps_iso.
        slots: [
            'horizontal_push',
            'horizontal_pull',
            'vertical_pull',
            'shoulder_iso',
            'chest_iso',
            'back_iso',
            'biceps_iso',
        ],
    },
    upper_aesthetic_b: {
        bias: 'pump',
        slots: ['vertical_push', 'horizontal_pull', 'shoulder_iso', 'biceps_iso', 'triceps_iso', 'back_iso'],
    },
    // ── Lower (4-day) ─────────────────────────────────────────────────────────
    // Clean Lower A / Lower B separation: quad days anchor on squat (no hinge),
    // the posterior day anchors on hinge (no squat). Each is always paired with
    // its opposite within a routine, so squat and hinge are each still trained
    // once across the week. This is what stops the `consistent` anchor map from
    // pinning the same squat + hinge to both leg days. The 6th exercise at
    // 45-60 min comes from backfill (a 2nd accessory).
    lower_quad: {
        bias: 'hypertrophy',
        slots: ['squat', 'lunge', 'glute_iso', 'calf', 'core'],
    },
    lower_post: {
        bias: 'hypertrophy',
        slots: ['hinge', 'glute_iso', 'lunge', 'calf', 'core'],
        // TODO (roadmap follow-up, NOT in this PR): this posterior day's only compound
        // is `hinge`. If a constrained equipment profile empties the hinge pool, the
        // session can degrade to glute_iso + lunge + calf + core with no heavy compound.
        // It needs a minimum-compound guard: substitute a lunge or squat compound
        // before backfilling with isolation. See the Bug 6 PR summary.
    },
    lower_lean: {
        bias: 'pump',
        slots: ['lunge', 'squat', 'glute_iso', 'calf', 'core'],
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
        // Deliberate 6th slot (2nd triceps_iso): balances the day to chest 2 /
        // shoulders 2 / triceps 2 instead of an undesigned backfill 6th.
        slots: ['horizontal_push', 'vertical_push', 'chest_iso', 'shoulder_iso', 'triceps_iso', 'triceps_iso'],
    },
    pull: {
        bias: 'hypertrophy',
        // No hinge on pull (an RDL/deadlift belongs on a leg day). vertical_pull
        // is a primary slot; the deliberate 6th is a 2nd back_iso (the natural
        // home for posterior-shoulder work: face pull / rear delt fly).
        slots: ['horizontal_pull', 'vertical_pull', 'back_iso', 'shoulder_iso', 'biceps_iso', 'back_iso'],
    },
    legs: {
        bias: 'hypertrophy',
        slots: ['squat', 'hinge', 'lunge', 'glute_iso', 'calf', 'core'],
    },
    // ── Generic upper / lower (3-day U/L/FB, 5-day hybrids) ───────────────────
    upper_general: {
        bias: 'balanced',
        // 7 slots: vertical_pull at pos 3; trailing triceps_iso drops at the 6-cap
        // for gym users, dumbbell-only no-ops vertical_pull and keeps triceps_iso.
        slots: [
            'horizontal_push',
            'horizontal_pull',
            'vertical_pull',
            'vertical_push',
            'shoulder_iso',
            'biceps_iso',
            'triceps_iso',
        ],
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
    // Bug 5: compound-first hierarchy (hinge > squat > lunge > glute_iso). The hip
    // hinge is the highest-leverage glute builder, then loaded squat, then unilateral
    // work, with direct glute isolation last. Listing isolation first (the old
    // ['glute_iso','hinge']) spent the freshest slot + the backfill on the
    // lowest-stimulus movement. tiltEmphasis only reorders patterns ALREADY in the
    // session's slots, so adding squat/lunge here never injects them into a day that
    // lacks them.
    glutes: ['hinge', 'squat', 'lunge', 'glute_iso'],
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
        // Bug 3: strength-bias compounds train in the 3-6 band (heavy, low-rep), not
        // the 6-10 hypertrophy-ish band. lose_fat keeps the strength day heavy-ish
        // (6-10) rather than chasing density, the day's whole purpose is the heavy
        // lift; the density bias still applies to hypertrophy/pump/balanced days.
        if (isCompound) return loseFat ? '6-10' : '3-6';
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
//
// Item 1 (2026-06-10): the pulling compounds (horizontal_pull / vertical_pull) are
// included. Excluding them gave a powerbuilding pull session hypertrophy reps on
// every lift while the first compound still took the strength +1 set bump (a 4-set
// x 8-12 main row), and the back was never trained heavy under a style sold as
// powerbuilding. A "conservative pulls" variant (moderate reps to manage joint
// stress) is a legitimate future option, but it must be an explicit per-pattern
// bias override, not the silent default.
export const POWERBUILDING_HEAVY_PATTERNS: ReadonlySet<MovementPattern> = new Set([
    'squat',
    'hinge',
    'horizontal_push',
    'vertical_push',
    'horizontal_pull',
    'vertical_pull',
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
    /** Display name, used only to look up the canonical-anchor rank (CANONICAL_ANCHORS,
     *  Bug 2 / P0 3.1). Optional: pools without it (synthetic test pools) get a neutral
     *  rank so ordering is byte-identical to the pre-ranking engine. */
    name?: string;
    equipment: EquipmentKey[];
    movement_pattern: MovementPattern | null;
    is_compound: boolean;
    category: ExerciseCategory;
    /** Science-derived 1-5 fatigue cost (1 = low, 5 = high). Optional: exercises
     *  without this field are treated as neutral (3) so they neither win nor lose
     *  against well-characterised exercises on fatigue alone. */
    fatigue?: number;
    /** Functional-role tag (e.g. 'horizontal_press', 'unilateral_leg', 'front_delt_isolation')
     *  used to deduplicate near-identical lifts across sessions. Null when an exercise
     *  doesn't fit a defined role (e.g. Russian Twist). */
    substitution_class: string | null;
    /** True for single-limb-at-a-time lifts (Step-Up, Bulgarian Split Squat, Walking
     *  Lunge); used to cap how many land in one session so they don't crowd it out. */
    unilateral: boolean;
    /** Joint areas this exercise commonly stresses. A user who flags one of these
     *  has the exercise filtered out of generation. Empty for the vast majority
     *  of exercises (DB default '{}'). */
    contraindications: RestrictionFlag[];
}

function hasEquipment(ex: ExerciseMeta, have: Set<EquipmentKey>): boolean {
    // Empty equipment = bodyweight, always available; otherwise every listed
    // equipment must be owned.
    if (ex.equipment.length === 0) return true;
    return ex.equipment.every((e) => have.has(e));
}

function isContraindicated(ex: ExerciseMeta, restrictions: Set<RestrictionFlag>): boolean {
    // Safety filter: hard, never relaxed (unlike the equipment thin-pool / heavy-
    // dedup / unilateral relax fallbacks). A flagged lift is never re-added to
    // fill a slot; if a pattern empties, the existing backfill covers it from
    // safe patterns. Empty restriction set = no-op (identity).
    if (restrictions.size === 0) return false;
    return ex.contraindications.some((c) => restrictions.has(c));
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

// ── Unilateral cap scope ──────────────────────────────────────────────────────
// The unilateral cap (at most one single-limb-at-a-time lift per session) governs
// single-limb COMPOUND work -- Walking Lunge, Bulgarian Split Squat, Step-Up --
// where stacking two front-loads balance-demanding fatigue without adding variety.
// Isolation / finisher patterns are EXEMPT: a unilateral Cable Kickback or
// Single-Leg Calf Raise is trivial accessory work that should neither consume the
// budget nor be blocked by it. Without this exemption a fresh unilateral glute_iso
// (the only fresh glute option once the bilateral ones are used) would set the flag
// and starve the session's primary lunge slot -- the lower_post "missing lunge"
// bug (2026-06-10). Isolation patterns are exactly the non-compound slots, so this
// matches the patternTier Tier-3/4 definition (`_iso` / calf / core).
function unilateralCapApplies(pattern: MovementPattern): boolean {
    return !pattern.endsWith('_iso') && pattern !== 'calf' && pattern !== 'core';
}

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

// ── Canonical anchor ranking (Bug 2 / roadmap P0 3.1) ────────────────────────
// The standard primary compound a session should be built around, per pattern.
// Lower index = more canonical. Applied in byPattern BEFORE the fatigue heuristic
// (2026-06-10): for explicitly named anchors the canonical preference is
// authoritative, fatigue is only a general tiebreak below it. It still sits AFTER
// loading-lean and substitution-class freshness (a user's equipment preference and
// cross-session rotation still win) and is a no-op for nameless / unlisted
// exercises (Infinity rank), so synthetic pools stay byte-identical to base.
//
// Why canonical must beat fatigue, not just break its ties: fatigue tracks
// mechanical cost, and for hinge the highest-fatigue lifts (Deadlift / Sumo
// Deadlift, both 5) are NOT the right hypertrophy anchor. Romanian Deadlift (4) is
// the standard first-hinge choice (better stimulus-to-fatigue, easier to learn);
// Sumo is a powerlifting-specific variant. A pure fatigue sort picked a deadlift
// every time and fell to random UUID order between Deadlift and Sumo. Listing hinge
// here with RDL first fixes that. squat is still NOT listed (Barbell Squat alone at
// fatigue 5 already resolves cleanly, so an entry would be inert).
//
// FRAGILITY: keyed by exercise NAME because ids are UUIDs (not stable across
// environments) while seed names are. Renaming a seed exercise silently degrades its
// anchor to UUID order. A catalog-consistency test (generation.test.ts) asserts every
// name here exists in the metadata seed. Longer term this wants an `anchor_rank`
// column next to fatigue (roadmap follow-up to generation Phase 0 #2).
export const CANONICAL_ANCHORS: Partial<Record<MovementPattern, string[]>> = {
    horizontal_push: [
        'Barbell Bench Press',
        'Incline Barbell Press',
        'Dumbbell Bench Press',
        'Incline Dumbbell Press',
        'Machine Chest Press',
        'Decline Bench Press',
        'Decline Dumbbell Press',
        'Smith Machine Bench Press',
        'Close-Grip Bench Press',
        'Push-Up',
    ],
    vertical_push: [
        'Barbell Overhead Press',
        'Dumbbell Overhead Press',
        'Dumbbell Push Press',
        'Arnold Press',
        'Machine Shoulder Press',
    ],
    horizontal_pull: [
        'Barbell Row',
        'T-Bar Row',
        'Dumbbell Bent-Over Row',
        'Chest-Supported Row',
        'Seated Cable Row',
        'Dumbbell Single-Arm Row',
    ],
    vertical_pull: ['Pull-Up', 'Lat Pulldown', 'Chin-Up'],
    // RDL first (the hypertrophy default), conventional Deadlift + Rack Pull next,
    // Sumo Deadlift last (powerlifting-specific). Hip Thrust / Good Morning stay
    // unlisted (accessory hinges, ranked by fatigue below the named primaries).
    hinge: ['Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Deadlift', 'Rack Pull', 'Sumo Deadlift'],
};

/** Canonical-anchor rank for an exercise within a pattern (lower = more canonical).
 *  Infinity when the pattern has no list or the exercise has no matching name, so it
 *  is a pure tiebreak that leaves nameless / unlisted exercises in their prior order. */
function anchorRank(ex: ExerciseMeta, pattern: MovementPattern): number {
    const order = CANONICAL_ANCHORS[pattern];
    if (!order || !ex.name) return Infinity;
    const i = order.indexOf(ex.name);
    return i === -1 ? Infinity : i;
}

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
    focus: Focus,
    count: number,
    usable: ExerciseMeta[],
    used: Set<string>,
    variety: VarietyPreference,
    anchors: Map<string, string>,
    usedSubstitutionClasses: Set<string>,
    loadingLean?: LoadingPreference | null,
    behavior: BehaviorSignal = EMPTY_BEHAVIOR,
): Selected[] {
    const preferredKey = loadingLean ? LOADING_TO_EQUIPMENT[loadingLean] : null;
    // Behavior demote (#7): O(1) membership for the sort layer below.
    const demoteSet = new Set(behavior.demote);

    // Session-scoped: true once a vertical_push exercise has been picked this
    // session. Read by byPattern's front-delt-isolation suppression below;
    // declared here (rather than alongside chosen/chosenIds) so the comparator
    // closure can reference it without a temporal-dead-zone concern.
    let verticalPushFilled = false;

    // Sort candidates: (1) preferred-equipment first (loading lean), (2) a
    // fresh-substitution-class preference (GQ3 cross-session dedup), (3) a
    // post-vertical-press front-delt-isolation suppression (GQ3), (4) the
    // canonical-anchor rank (named primary compounds win, authoritative over
    // fatigue), (5) a role-aware fatigue tiebreak, (6) stable alphabetical by id.
    // When loadingLean is null/undefined key (1) is a no-op; for nameless pools
    // key (4) is a no-op; when fatigue is uniformly undefined key (5) is a no-op.
    //
    // (2) soft-deprioritizes (never hard-blocks) a candidate whose
    // substitution_class already appears elsewhere in this routine, so
    // functionally-identical lifts under different names/equipment -- Romanian
    // Deadlift on both Pull and Legs, Walking Lunge then Bulgarian Split Squat
    // -- don't both make the cut. Untagged exercises (substitution_class: null)
    // are never deprioritized by this key; it only tracks named roles.
    //
    // (3) soft-deprioritizes Front Raise (substitution_class:
    // 'front_delt_isolation', distinct from the legitimate lateral_raise
    // family) once this session already has a vertical press: an Overhead /
    // Shoulder Press already loads the front delts hard, so reaching for an
    // isolation move that trains the same head is the lowest-value shoulder_iso
    // pick available, not the highest. Still selectable when it's the only
    // shoulder_iso candidate left (soft, not a hard block).
    //
    // (5) The fatigue tiebreak direction depends on the slot's role. Accessory /
    // isolation patterns keep the GQ2 behaviour (lower fatigue first: a coach
    // picks the cheaper isolation move when several train the same thing).
    // Anchor patterns -- COMPOUND_ANCHOR_PATTERNS, the main compounds a session
    // is built around -- invert that: higher fatigue first, because fatigue
    // cost tracks mechanical stimulus for primary lifts (Barbell Squat costs
    // more than Goblet Squat *because* it drives more adaptation), so
    // lowest-first was systematically picking the weakest anchor in the pool.
    // Untagged exercises sit at the neutral midpoint (3) either way, so they
    // neither win nor lose against well-characterised ones.
    const FATIGUE_UNKNOWN = 3;
    const FRONT_DELT_ISOLATION = 'front_delt_isolation';
    const byPattern = (p: MovementPattern) => {
        const anchorPattern = COMPOUND_ANCHOR_PATTERNS.has(p);
        return usable
            .filter((ex) => ex.movement_pattern === p)
            .sort((a, b) => {
                // Behavior demote (#7): sink rejected exercises within their pattern
                // group, but ONLY on non-anchor patterns so the main compounds are
                // never learned away. Empty demoteSet or an anchor pattern -> both 0,
                // falls through, base ordering preserved (golden test).
                if (!anchorPattern) {
                    const aDemote = demoteSet.has(a.id) ? 1 : 0;
                    const bDemote = demoteSet.has(b.id) ? 1 : 0;
                    if (aDemote !== bDemote) return aDemote - bDemote;
                }
                if (preferredKey) {
                    const aMatch = a.equipment.includes(preferredKey) ? 0 : 1;
                    const bMatch = b.equipment.includes(preferredKey) ? 0 : 1;
                    if (aMatch !== bMatch) return aMatch - bMatch;
                }
                const aSubUsed =
                    a.substitution_class !== null && usedSubstitutionClasses.has(a.substitution_class) ? 1 : 0;
                const bSubUsed =
                    b.substitution_class !== null && usedSubstitutionClasses.has(b.substitution_class) ? 1 : 0;
                if (aSubUsed !== bSubUsed) return aSubUsed - bSubUsed;
                const aFrontRaise = verticalPushFilled && a.substitution_class === FRONT_DELT_ISOLATION ? 1 : 0;
                const bFrontRaise = verticalPushFilled && b.substitution_class === FRONT_DELT_ISOLATION ? 1 : 0;
                if (aFrontRaise !== bFrontRaise) return aFrontRaise - bFrontRaise;
                // (5) Canonical-anchor rank (Bug 2): for explicitly named anchors the
                // canonical primary compound is authoritative and is applied BEFORE the
                // fatigue heuristic (2026-06-10). This lets Romanian Deadlift anchor hinge
                // over higher-fatigue Deadlift / Sumo, and keeps Barbell Bench Press ahead
                // of Close-Grip Bench Press. Infinity for nameless / unlisted exercises
                // (Infinity !== Infinity is false -> falls through to fatigue), so synthetic
                // pools stay byte-identical to base.
                const aRank = anchorRank(a, p);
                const bRank = anchorRank(b, p);
                if (aRank !== bRank) return aRank - bRank;
                // (6) Role-aware fatigue tiebreak, below canonical now. Anchor patterns
                // prefer the higher-fatigue primary lift (fatigue tracks mechanical stimulus
                // for main compounds); accessories prefer the lower-fatigue option. Untagged
                // exercises sit at the neutral midpoint, so they neither win nor lose here.
                const aFatigue = a.fatigue ?? FATIGUE_UNKNOWN;
                const bFatigue = b.fatigue ?? FATIGUE_UNKNOWN;
                if (aFatigue !== bFatigue) return anchorPattern ? bFatigue - aFatigue : aFatigue - bFatigue;
                return a.id.localeCompare(b.id);
            });
    };

    const chosen: Selected[] = [];
    const chosenIds = new Set<string>();
    // Bug 4/7: hard cap of 2 of any movement pattern per session. patternCount reads
    // the live `chosen` list so it covers both the first pass and backfill.
    const PATTERN_CAP = 2;
    const patternCount = (p: MovementPattern) => chosen.reduce((n, c) => (c.pattern === p ? n + 1 : n), 0);
    // Tracks which heavy-compound patterns (hinge / squat) have been filled this
    // session. The cap prevents a second deadlift variant or squat compound from
    // entering via backfill while still allowing lunge and glute_iso accessories.
    const heavyPatternFilled = new Set<MovementPattern>();
    // Mirrors heavyPatternFilled but for single-limb-at-a-time COMPOUND lifts
    // (unilateral: true on a compound slot), capped at one per session regardless of
    // pattern -- a session built around Walking Lunge shouldn't also reach for
    // Bulgarian Split Squat or Step-Up. Unlike the heavy-pattern cap this isn't keyed
    // by pattern: a unilateral pick in 'lunge' still blocks a unilateral pick in
    // 'squat'. Isolation / finisher slots are exempt (see unilateralCapApplies), so a
    // unilateral glute_iso / calf accessory neither sets nor is blocked by this flag.
    let unilateralFilled = false;

    const push = (ex: ExerciseMeta, slot: MovementPattern) => {
        chosen.push({ ex, pattern: slot });
        chosenIds.add(ex.id);
        used.add(ex.id);
        if (ex.substitution_class !== null) usedSubstitutionClasses.add(ex.substitution_class);
        // Only a unilateral COMPOUND consumes the cap (see unilateralCapApplies): a
        // unilateral isolation accessory must not block the session's primary lunge.
        if (ex.unilateral && unilateralCapApplies(slot)) unilateralFilled = true;
        if (slot === 'vertical_push') verticalPushFilled = true;
        if (HEAVY_DEDUP_PATTERNS.has(slot) && ex.is_compound) {
            heavyPatternFilled.add(slot);
        }
    };

    // `relaxHeavyCap` / `relaxUnilateralCap`: thin-pool fallbacks -- allow a
    // second heavy compound, or a second unilateral pick, only after a full
    // backfill round produces nothing else.
    const pick = (slot: MovementPattern, relaxHeavyCap = false, relaxUnilateralCap = false): boolean => {
        let candidates = byPattern(slot).filter((ex) => !chosenIds.has(ex.id));
        if (candidates.length === 0) return false;

        // Pattern-diversity cap (Bug 4/7): never seat more than PATTERN_CAP of one
        // movement pattern in a session. HARD (never relaxed, unlike the heavy /
        // unilateral caps below): under-filling toward diversity beats stacking a 3rd
        // of one pattern (the calf-explosion bug). The deliberate push/pull 6th slot
        // (2x triceps_iso / back_iso) sits exactly at the cap, so it is still allowed.
        if (patternCount(slot) >= PATTERN_CAP) return false;

        // Heavy-compound cap: skip if this Tier-1 pattern is already filled,
        // unless the cap has been relaxed because no other option is available.
        if (!relaxHeavyCap && HEAVY_DEDUP_PATTERNS.has(slot) && heavyPatternFilled.has(slot)) {
            return false;
        }

        // Unilateral cap: once a unilateral COMPOUND has filled this session, skip a
        // compound slot whose only remaining candidates are unilateral (mirrors the
        // heavy-compound cap's hard block), unless the cap has been relaxed because a
        // full backfill round produced nothing else. A slot with a mix of bilateral
        // and unilateral options simply narrows to bilateral. Isolation / finisher
        // slots are exempt (unilateralCapApplies): a unilateral accessory is always
        // selectable and never blocks them.
        if (unilateralFilled && !relaxUnilateralCap && unilateralCapApplies(slot)) {
            const bilateral = candidates.filter((ex) => !ex.unilateral);
            if (bilateral.length === 0) return false;
            candidates = bilateral;
        }

        // Variety 'consistent': anchor the main compound lifts across sessions.
        if (variety === 'consistent' && COMPOUND_ANCHOR_PATTERNS.has(slot)) {
            // Bug 1: anchor per (focus, pattern), NOT per pattern alone. Two sessions
            // of the SAME focus (Lower A + Lower B) share the anchor compound -- the
            // intended consistent behavior; sessions of DIFFERENT focus (Push vs Upper)
            // get distinct keys, so the second one's fresh pick respects `used` and
            // they never seat the same exercise (the cross-session collapse bug). The
            // key relies on Focus and MovementPattern enum members being colon-free.
            const anchorKey = `${focus}:${slot}`;
            const anchoredId = anchors.get(anchorKey);
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
                // First time this (focus, pattern) is filled: pick fresh, record it.
                const fresh = candidates.find((ex) => !used.has(ex.id));
                const choice = fresh ?? candidates[0];
                push(choice, slot);
                anchors.set(anchorKey, choice.id);
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
    // already-filled ones. The heavy-cap and unilateral-cap are each relaxed only
    // after a full round yields nothing, so thin equipment pools can still reach
    // the target count.
    let relaxedHeavyCap = false;
    let relaxedUnilateralCap = false;
    let guard = 0;
    while (chosen.length < count && guard < 50) {
        guard++;
        let added = false;
        // Bug 4: prefer the least-represented pattern (count-ascending, stable sort),
        // so backfill spreads across patterns instead of stacking the most-available
        // one (the calf-explosion bug). For emphases whose patterns are each at count
        // <=1 after the first pass this matches the old uncovered(0)-before-covered(1)
        // ordering; for push/pull (a deliberate 2x triceps_iso / back_iso) the doubled
        // pattern is correctly sunk so backfill never seats a 3rd. Same-pool golden
        // (varied) runs stay equal because the reorder is identical on both sides.
        const patternCounts = new Map<MovementPattern, number>();
        for (const c of chosen) patternCounts.set(c.pattern, (patternCounts.get(c.pattern) ?? 0) + 1);
        const slotsByPriority = [...emphasis.slots].sort(
            (a, b) => (patternCounts.get(a) ?? 0) - (patternCounts.get(b) ?? 0),
        );
        for (const slot of slotsByPriority) {
            if (chosen.length >= count) break;
            if (pick(slot, relaxedHeavyCap, relaxedUnilateralCap)) added = true;
        }
        if (!added) {
            if (!relaxedHeavyCap) {
                relaxedHeavyCap = true; // one retry with the cap lifted
            } else if (!relaxedUnilateralCap) {
                relaxedUnilateralCap = true; // one retry with the unilateral cap lifted
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

// ── Squat/hinge adjacency interleave (Item 4) ────────────────────────────────
// The tier sort lands squat and hinge both in Tier 1, so a session carrying both
// (the full-body strength / balanced days) opened with the two highest-fatigue
// lifts back to back. When such a session also has an upper compound, slot the
// first one between the two lower compounds (squat, bench, then hinge), the
// standard coaching sequence. Leg-only sessions (no upper compound to interleave)
// are left untouched, and position 0 is unchanged so the strength set-bump still
// lands on the leading compound.
const UPPER_COMPOUND_PATTERNS: ReadonlySet<MovementPattern> = new Set([
    'horizontal_push',
    'vertical_push',
    'horizontal_pull',
    'vertical_pull',
]);

function isLeadLowerCompound(item: Selected): boolean {
    return item.ex.is_compound && (item.pattern === 'squat' || item.pattern === 'hinge');
}

function interleaveLowerCompounds(sorted: Selected[]): Selected[] {
    if (sorted.length < 2 || !isLeadLowerCompound(sorted[0]) || !isLeadLowerCompound(sorted[1])) {
        return sorted;
    }
    const upperIdx = sorted.findIndex(
        (item, idx) => idx >= 2 && item.ex.is_compound && UPPER_COMPOUND_PATTERNS.has(item.pattern),
    );
    if (upperIdx === -1) return sorted;
    const out = [...sorted];
    const [upper] = out.splice(upperIdx, 1);
    out.splice(1, 0, upper);
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
    /** Joint areas to avoid. Absent / empty is the no-op identity path (no
     *  exercise filtered, output byte-identical to the base generator). */
    restrictions?: RestrictionFlag[];
    /** Behavior-learned bias (#7). `demote` exercise_ids sink within their
     *  movement-pattern group, but ONLY on non-anchor patterns so the main
     *  compounds are never learned away. Absent / empty demote is the no-op
     *  identity path (output byte-identical to base). */
    behavior?: BehaviorSignal;
    /** The program's start weekday (JS getDay, 0=Sun..6=Sat). Sessions are
     *  ordered from this day forward (wrapping the week) so session A lands on
     *  the first trained day on/after the start date. Absent = Monday (1), the
     *  conventional week start. */
    anchorDow?: number;
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

/**
 * Order selected weekday numbers (0=Sun..6=Sat) starting from the program's
 * anchor weekday and wrapping the week, so session A lands on the first trained
 * day on/after the start date. A naive ascending sort instead pins session A to
 * the lowest weekday number (Sunday whenever it is selected), which matches
 * neither the user's week start nor a non-Monday start date.
 *
 * Example: days [1,3,4,0] (Mon/Wed/Thu/Sun), anchor Tue(2) → [3,4,0,1]
 * (Wed,Thu,Sun,Mon), so the first session lands on Wednesday.
 */
export function orderTrainingDays(trainingDays: number[], anchorDow: number): number[] {
    return [...trainingDays].sort((a, b) => ((a - anchorDow + 7) % 7) - ((b - anchorDow + 7) % 7));
}

export function generateRoutine(input: GenerationInput): RoutineBlueprint {
    const { style, answers, sessionTime, trainingDays, pool } = input;
    const makeGroupId = input.makeGroupId ?? defaultGroupId;
    // Order from the start weekday so session A falls on the first trained day
    // on/after the anchor. Default Monday (1) keeps the conventional week start
    // for callers that don't pass an anchor.
    const days = orderTrainingDays(trainingDays, input.anchorDow ?? 1);
    const { exercises: exCount, sets } = volumeFor(sessionTime, answers.experience);
    const isSuperset = sessionTime === '~30 min';

    const restrictions = new Set(input.restrictions ?? []);
    const usable = pool
        .filter((ex) => hasEquipment(ex, answers.equipment))
        .filter((ex) => !isContraindicated(ex, restrictions));
    const used = new Set<string>();
    // Routine-wide record of substitution_class values already selected, so
    // selectForSession can soft-deprioritize functionally-identical lifts that
    // resurface under a different name/equipment (e.g. Romanian Deadlift on
    // both Pull and Legs). See the byPattern comparator for how it's applied.
    const usedSubstitutionClasses = new Set<string>();
    const variety = input.varietyPreference ?? 'varied';
    // Routine-wide anchor map (per-generation, never persisted) used only under
    // 'consistent' to keep the main compounds the same across sessions. Keyed by
    // `${focus}:${pattern}` (Bug 1) so the anchor is shared only between sessions of
    // the same focus, not across different-focus sessions.
    const anchors = new Map<string, string>();

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
        const selected = selectForSession(
            emphasis,
            session.focus,
            exCount,
            usable,
            used,
            variety,
            anchors,
            usedSubstitutionClasses,
            input.loadingLean,
            input.behavior ?? EMPTY_BEHAVIOR,
        );

        // Tier sort: present exercises in coach-standard order within each session.
        // Compounds lead (Tier 1: squat/hinge; Tier 2: push/pull/lunge), isolations
        // follow (Tier 3), core/calf finish (Tier 4). Stable sort preserves
        // emphasis-driven ordering within the same tier.
        const sortedSelected = [...selected].sort(
            (a, b) => patternTier(a.pattern, a.ex.is_compound) - patternTier(b.pattern, b.ex.is_compound),
        );
        // Item 4: keep the two heavy lower compounds from opening the session back
        // to back by slotting the first upper compound between them (a no-op unless
        // the session leads with both squat and hinge).
        const orderedSelection = interleaveLowerCompounds(sortedSelected);

        // Sets: 3 normally; 4 for the first compound of a strength-bias session.
        let firstCompoundBumped = false;
        const baseSets = Math.max(3, sets);

        const ordered = isSuperset
            ? buildSupersets(orderedSelection, makeGroupId)
            : orderedSelection.map((item) => ({ item, groupId: null as string | null }));

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
    demotedNames: string[] = [],
): string {
    const goal = GOAL_LABELS[answers.goal] ?? answers.goal;
    const base = `${style.name} for ${answers.experience} lifters · ${answers.days} days/week · ${goal} · ${sessionTime} sessions. ${style.bestFor}`;
    const styleClause = TRAINING_STYLE_CLAUSE[trainingStyle ?? 'balanced'];
    const withPriority = priority
        ? `${base} Every session leans a bit harder into ${priority}, the muscle you want to grow.`
        : base;
    // Behavior-learned bias (#7): name the lifts the plan leans away from, so the
    // adaptation is inspectable. Soft wording ("leans away from"), nothing is
    // dropped outright.
    const behaviorClause =
        demotedNames.length > 0
            ? ` Tuned to your history: leans away from ${demotedNames.join(', ')} (you keep swapping them out).`
            : '';
    return `${withPriority}${styleClause}${behaviorClause}`;
}
