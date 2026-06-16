import type {
    Bias,
    Emphasis,
    EmphasisKey,
    EquipmentKey,
    ExerciseCategory,
    Focus,
    MovementPattern,
    Muscle,
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
import { estimateSessionMinutes } from './utils';
import { applyCoverageGapFill, trimToMrv } from './gapFill';
import { weeklyMuscleSets, MUSCLE_SET_TARGETS, type MuscleTarget } from './muscleVolume';

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
        // Dedicated quad isolation (leg extension): the squat under-trains the
        // biarticular rectus femoris, so a knee-extension isolation covers a real gap
        // (science review). It displaces glute_iso (a posterior-chain move that belongs
        // on the posterior day, where it is kept). glute_iso does NOT return here: on a
        // deep pool at 45-60 min the 6th pick is a 2nd quad_iso, keeping the quad day
        // quad-focused by design.
        slots: ['squat', 'quad_iso', 'lunge', 'calf', 'core'],
    },
    lower_post: {
        bias: 'hypertrophy',
        // Dedicated hamstring isolation (leg curl): the hinge cannot train the
        // monoarticular short head of biceps femoris (knee-flexion only), so a leg
        // curl is a unique, non-negotiable stimulus on a posterior day (science
        // review). It displaces lunge (a knee-extension-dominant move that belongs on
        // the quad day); lunge returns as the day's 2nd compound via the minimum-compound
        // floor guard (the first pass seats only hinge), not the backfill loop.
        slots: ['hinge', 'hamstring_iso', 'glute_iso', 'calf', 'core'],
        // The posterior day anchors on HINGE and never trains squat. The duress
        // lower fallbacks (the COMPOUND_FLOOR guard and the finisher deflection)
        // respect this: under a thin pool they reach for an in-contract compound
        // (a 2nd hinge or a lunge), never a squat (isOffContractLowerCompound).
        // A squat here would be ranked PRIMARY_LOWER and hijack the day from the
        // RDL (the Sumo-Squat-on-the-posterior-day bug, fixed 2026-06-11). If the
        // floor of 2 is genuinely unsatisfiable the day ships with
        // LIMITED_VARIETY_WARNING rather than an off-contract squat.
    },
    // Live-test Issue 3 (2026-06-11): bias changed pump -> hypertrophy. Pump put
    // the quad day's compounds at 12-15, accessory-level loading that confused
    // an advanced build-muscle user; hypertrophy (8-12 compounds) keeps the day
    // lighter than the strength lower days without reading like a finisher.
    // lunge-FIRST is deliberate, not incidental: the aesthetic style is
    // unilateral-led (Bulgarian split squat / step-up shape work gets the fresh
    // pick and earliest backfill), with squat as the second compound. The role
    // model still PRESENTS a seated squat first (lower pattern priority).
    lower_lean: {
        bias: 'hypertrophy',
        // Quad-led aesthetic day: same dedicated quad-isolation slot as lower_quad
        // (displaces glute_iso). glute_iso does NOT return; on a deep pool the 6th pick
        // is a 2nd lunge, fitting this unilateral-led day.
        slots: ['lunge', 'squat', 'quad_iso', 'calf', 'core'],
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
    // ── Push / Pull heavy + volume pairs (ppl-x2-6, Item 5) ──────────────────
    // The 6-day A/B contrast: A days are strength-biased (compounds 3-6, the
    // first compound takes the +1 set bump), B days hypertrophy. The volume day
    // leads with the OTHER compound (vertical push / vertical pull) so it gets
    // the fresh pick and earliest backfill; display order stays role-model-owned.
    // Q4: the doubled isolation slot lives on the VOLUME day only (the heavy day
    // already carries the set bump; 2x isolation there exceeds MAV alongside the
    // indirect work from two pressing/pulling compounds). At 45-60 min the
    // 5-slot heavy days backfill their 6th pick onto the lead compound pattern
    // (a 2nd horizontal push/pull at strength reps), an accepted consequence.
    push_heavy: {
        bias: 'strength',
        slots: ['horizontal_push', 'vertical_push', 'chest_iso', 'shoulder_iso', 'triceps_iso'],
    },
    push_volume: {
        bias: 'hypertrophy',
        slots: ['vertical_push', 'horizontal_push', 'shoulder_iso', 'chest_iso', 'triceps_iso', 'triceps_iso'],
    },
    pull_heavy: {
        bias: 'strength',
        slots: ['horizontal_pull', 'vertical_pull', 'back_iso', 'shoulder_iso', 'biceps_iso'],
    },
    pull_volume: {
        bias: 'hypertrophy',
        slots: ['vertical_pull', 'horizontal_pull', 'back_iso', 'biceps_iso', 'shoulder_iso', 'back_iso'],
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
    // ── PHUL (4-day powerbuilding: power + hypertrophy per region, phul-4) ─────
    // Each region trained twice a week: a strength-bias Power day and a
    // hypertrophy-bias Volume day. Both upper days use focus 'upper' and both lower
    // days focus 'lower', so the `consistent` anchor pins the same main lift across
    // the heavy and volume day of a region (progressive overload). New emphases, not
    // reuse: the power days need a strength bias no existing upper/lower emphasis
    // carries, and Lower Power needs squat AND hinge together (lower_quad / lower_post
    // deliberately split them). Designed for the Balanced training style; Strength /
    // Bodybuilding / Powerbuilding collapse the day-level contrast via resolveBias.
    // Spec: docs/superpowers/specs/2026-06-11-12-53-42-phul-program-style-design.md.
    phul_upper_power: {
        bias: 'strength',
        // Full upper press + pull, minimal arm isolation. The role model leads with the
        // horizontal-push compound (bench), which takes the +1 strength set bump.
        slots: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'biceps_iso', 'triceps_iso'],
    },
    phul_lower_power: {
        bias: 'strength',
        // Squat AND hinge are the two heavy money lifts (3-6 reps); squat is
        // PRIMARY_LOWER and takes the +1 set bump, the deadlift (hinge) lands
        // SECONDARY_LOWER. lunge for unilateral work, calf + core finishers. The 6th
        // pick at 45-60 min comes from backfill. No hamstring_iso slot by design (the
        // pattern now exists and lower_post uses it): the deadlift IS this PHUL day's
        // heavy posterior work, and once it fills hinge HEAVY_DEDUP_PATTERNS blocks a
        // second heavy hinge anyway.
        slots: ['squat', 'hinge', 'lunge', 'calf', 'core'],
    },
    phul_upper_hyp: {
        bias: 'hypertrophy',
        // Volume upper. NO vertical_push compound (the defining PHUL characteristic):
        // the overhead press lives on Power day; shoulders here come from shoulder_iso
        // (lateral raises) plus indirect work from horizontal pressing. Compounds first
        // (convention), then chest fly + full delt/arm isolation. vertical_pull no-ops
        // for dumbbell-only users; the trailing triceps_iso drops at the 6-exercise cap.
        slots: [
            'horizontal_push',
            'horizontal_pull',
            'vertical_pull',
            'chest_iso',
            'shoulder_iso',
            'biceps_iso',
            'triceps_iso',
        ],
    },
    phul_lower_hyp: {
        bias: 'hypertrophy',
        // Volume lower, quad-biased: squat-led, lunge before hinge for selection
        // freshness on the quad pattern. hinge supplies hamstring/posterior volume at
        // 8-12. PHUL deliberately keeps both lower days hinge-anchored (heavy deadlift
        // on Power, moderate hinge here) for progressive overload across the pair,
        // rather than the dedicated hamstring_iso slot lower_post uses.
        slots: ['squat', 'lunge', 'hinge', 'glute_iso', 'calf', 'core'],
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
    // Compound-first, then the direct knee-extension / knee-flexion isolation that
    // became real patterns with the leg-isolation split (so a legs priority also
    // deepens the posterior day's hinge + Leg Curl and the quad day's Leg Extension,
    // not just the squat + lunge). Mirrors every sibling priority pairing compound +
    // its direct isolation.
    legs: ['squat', 'hinge', 'lunge', 'quad_iso', 'hamstring_iso'],
    chest: ['horizontal_push', 'chest_iso'],
    back: ['horizontal_pull', 'back_iso'],
    shoulders: ['vertical_push', 'shoulder_iso'],
    arms: ['biceps_iso', 'triceps_iso'],
};

// Measurable priority (P3.2): a priority muscle adds up to this many extra direct
// sets across the WEEK, spread one-per-exercise over the priority-pattern lifts
// already selected (priority never injects a slot, so this only deepens existing
// priority work). 4 (not 3) so a priority is clearly meaningful, not cosmetic
// (science review). Never reduces other muscles' volume. Null priority = 0 extra
// sets, so the no-priority path stays byte-identical.
const PRIORITY_EXTRA_SETS_PER_WEEK = 4;
// Hard ceiling on the priority muscle's TOTAL weekly direct sets (baseline + the
// bumps above): added sets stop once the muscle reaches this, so a priority never
// pushes a muscle past its recoverable volume into junk territory (science review:
// ~20 sets/muscle/week is the natural ceiling for an intermediate).
export const PRIORITY_MUSCLE_SET_CEILING = 20;

// Item 3 (calibration round 2): on an attributed pool, a priority muscle is deepened
// until its weekly DIRECT sets reach its target band MINIMUM (not a flat +4 that fell
// short on high-target muscles like chest, which left priority chest at 8 of 10), capped
// at the band MAXIMUM and at +2 per lift so no single exercise inflates. Multi-muscle
// priorities sum their bands. Gated on attribution, so unattributed / synthetic pools
// keep the legacy flat +4 dose and stay byte-identical.
const PRIORITY_TARGET_MUSCLES: Record<PriorityMuscle, MuscleTarget[]> = {
    chest: ['chest'],
    back: ['back'],
    shoulders: ['side_delts'],
    arms: ['biceps', 'triceps'],
    glutes: ['glutes'],
    legs: ['quads', 'hamstrings'],
};
const PRIORITY_MAX_EXTRA_PER_LIFT = 2;

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
            key: 'phul-4',
            name: 'Power Hypertrophy Upper Lower',
            bestFor:
                'Powerbuilding: train each muscle twice a week, once heavy for strength and once for size. Designed for the Balanced training style to preserve the power/volume contrast.',
            // PHUL: each region trained twice, once heavy (Power, strength bias) and once
            // for volume (Hypertrophy). variant A = the Power pair, B = the Hypertrophy
            // pair. Both upper days share focus 'upper' and both lower days focus 'lower'
            // so the consistent anchor pins the same bench / squat across the heavy and
            // volume day (progressive overload). Grouped with the U/L splits in the
            // picker; not the default (recommendStyle returns STYLES[4][0]).
            sessions: [
                { focus: 'upper', emphasis: 'phul_upper_power', variant: 'A' },
                { focus: 'lower', emphasis: 'phul_lower_power', variant: 'A' },
                { focus: 'upper', emphasis: 'phul_upper_hyp', variant: 'B' },
                { focus: 'lower', emphasis: 'phul_lower_hyp', variant: 'B' },
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
            bestFor: 'Six days, each muscle group twice: a heavy A block and a volume B block.',
            // Legs A/B reuse lower_quad/lower_post, the same quad/posterior split used
            // in ul-classic-4 and ulppl-5. Share is intentional: same movement contract
            // across all three styles. Any edit to these emphases affects all consumers.
            sessions: [
                { focus: 'push', emphasis: 'push_heavy', variant: 'A' },
                { focus: 'pull', emphasis: 'pull_heavy', variant: 'A' },
                { focus: 'legs', emphasis: 'lower_quad', variant: 'A' },
                { focus: 'push', emphasis: 'push_volume', variant: 'B' },
                { focus: 'pull', emphasis: 'pull_volume', variant: 'B' },
                { focus: 'legs', emphasis: 'lower_post', variant: 'B' },
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

/** The style to surface as "Suggested" for the user's training intent (#18 follow-up).
 *  A powerbuilding lifter at 4 days is steered to PHUL (`phul-4`); every other case
 *  defers to the count-only `recommendStyle` default. Pure and additive: it does NOT
 *  change the auto-applied default (`recommendStyle` stays the pre-selection and the
 *  fallback), so a picker can float + badge a suggestion without altering generation
 *  for anyone who ignores it. The `phul-4` presence check keeps it safe if the style
 *  is ever removed. */
export function suggestedStyleKey(sessionCount: number, trainingStyle?: TrainingStyle | null): string {
    if (trainingStyle === 'powerbuilding' && sessionCount === 4 && (STYLES[4] ?? []).some((s) => s.key === 'phul-4')) {
        return 'phul-4';
    }
    return recommendStyle(sessionCount);
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
    experience?: ExperienceLevel,
    focus?: Focus,
): string {
    // P3.3 Bodybuilding character: isolation work gets the PUMP range (15-20) for a
    // hypertrophy-finisher feel, while compounds keep the hypertrophy range (8-12).
    // Gated on `style` (NOT effectiveBias), so it is a no-op for every other style and
    // the frozen goldens (captured at Balanced) hold. A session whose own bias is
    // already 'pump' is unchanged (its iso was already 15-20). lose_fat rides through
    // repRange unchanged.
    if (style === 'bodybuilding') {
        return isCompound ? repRange(effectiveBias, true, goal) : repRange('pump', false, goal);
    }
    const base =
        style === 'powerbuilding'
            ? repRange(POWERBUILDING_HEAVY_PATTERNS.has(pattern) ? 'strength' : 'hypertrophy', isCompound, goal)
            : repRange(effectiveBias, isCompound, goal);
    // P3.1: a beginner or a general-fitness lifter never receives the heaviest 3-6
    // compound range; floor it to 5-8 (a crisp 5 at high RIR is the textbook novice
    // method; only sub-5 near-max work carries the real novice risk, per the science
    // review). Experience and goal modulate the prescription independently of the
    // split's bias. Intermediate/advanced build_muscle (the golden baseline) is
    // untouched: base is returned as-is.
    if (isCompound && base === '3-6' && (experience === 'beginner' || goal === 'general_fitness')) {
        return '5-8';
    }
    // A build-muscle lifter on the Balanced (default) style should not get a pure
    // 3-6 strength day on the FULL-BODY heavy day: a balanced hypertrophy full-body
    // split's "heavy" day is hypertrophy-heavy (6-8), not powerlifting triples (this
    // also drops it out of the estimator's "heavy" class, so a 30-min full-body
    // session stops tripping over_time). Scoped to full_body so the deliberate heavy
    // days of other splits (PHUL power days, the ppl-x2 heavy push/pull days) keep
    // their intended 3-6; and to balanced + build_muscle so explicit Strength /
    // Powerbuilding styles (which intend 3-6) and lose_fat (never 3-6) are untouched.
    // Beginners are already floored to 5-8 just above.
    if (isCompound && base === '3-6' && style === 'balanced' && goal === 'build_muscle' && focus === 'full_body') {
        return '6-8';
    }
    return base;
}

const LOAD_LIMITED_LOWER_PATTERNS: ReadonlySet<MovementPattern> = new Set(['squat', 'hinge', 'lunge']);

/** Raise the rep range of a load-limited lift to 10-15. A "load-limited" lift is a
 *  dumbbell-only LOWER-BODY COMPOUND (goblet squat, dumbbell RDL, dumbbell split squat):
 *  it cannot be loaded heavily enough for low reps to be a strong stimulus. Narrowed to
 *  lower compounds only (Change A): isolations and upper-body dumbbell presses/rows are
 *  left to their assigned ranges (and to the future context-scoring layer).
 *
 *  No-ops on a NAMELESS exercise (synthetic test pools have no `name`), so the
 *  generation goldens stay byte-identical, exactly like ISOLATION_QUALITY /
 *  CANONICAL_ANCHORS. Real catalogue exercises all carry a name, so the floor applies
 *  there. Pure. */
export function floorRepRangeForLoad(reps: string, ex: ExerciseMeta): string {
    if (!ex.name) return reps;
    const dumbbellOnly =
        ex.equipment.includes('dumbbells') &&
        !ex.equipment.includes('barbell') &&
        !ex.equipment.includes('machines') &&
        !ex.equipment.includes('cables');
    if (!dumbbellOnly || !ex.is_compound || ex.movement_pattern === null) return reps;
    if (!LOAD_LIMITED_LOWER_PATTERNS.has(ex.movement_pattern)) return reps;
    const low = Number(reps.split('-')[0]);
    if (!Number.isFinite(low) || low >= 10) return reps;
    return '10-15';
}

/** The exercise's preferred rep window as [lo, hi], or null when it has none. A one-sided
 *  seed is widened (missing min -> 1, missing max -> 999). */
export function repWindow(ex: ExerciseMeta): [number, number] | null {
    if (ex.rep_min == null && ex.rep_max == null) return null;
    return [ex.rep_min ?? 1, ex.rep_max ?? 999];
}

/** True when a rep band [lo, hi] overlaps the window [wlo, whi]. */
export function bandOverlapsWindow(band: [number, number], window: [number, number]): boolean {
    return band[0] <= window[1] && window[0] <= band[1];
}

/** Clamp an assigned rep band into the exercise's preferred window (spec section 4).
 *  No window -> unchanged. Overlap -> intersect. No overlap (a thin pool forced a misfit
 *  in) -> the exercise's own window, so a power lift shows its low band, not the day's.
 *  No-op on a nameless/unwindowed exercise, so the goldens hold. Pure. */
export function clampRepsToWindow(reps: string, ex: ExerciseMeta): string {
    const window = repWindow(ex);
    if (!window) return reps;
    const lo = Number(reps.split('-')[0]);
    const hi = Number(reps.split('-')[1] ?? reps.split('-')[0]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return reps;
    if (bandOverlapsWindow([lo, hi], window)) {
        return `${Math.max(lo, window[0])}-${Math.min(hi, window[1])}`;
    }
    return `${window[0]}-${window[1]}`;
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
    /** Skill/complexity tier (P3.1b). A beginner soft-deprioritises 'advanced'
     *  lifts in selection. Optional: absent => never deprioritised, so synthetic
     *  pools and the goldens are byte-identical. */
    difficulty?: ExperienceLevel;
    /** Programming muscle this exercise directly trains (Tier-2 muscle-coverage
     *  warnings). Optional: synthetic test pools omit it, so the tally treats them as
     *  unattributed and the warning never fires on them (golden-stable). Real catalogue
     *  exercises carry it (seeded by the primary-muscle migration). */
    primary_muscle?: Muscle;
    /** Fine secondary muscles (same Muscle taxonomy), feeding the diagnostic-only
     *  effective-set estimate. Optional / may be empty. */
    secondary_muscle_groups?: Muscle[];
    /** Base hypertrophy quality (0-1), migrated from ISOLATION_QUALITY. Optional:
     *  absent -> NEUTRAL_QUALITY, so nameless/synthetic pools score neutrally and the
     *  goldens stay byte-identical. */
    quality?: number;
    /** Preferred rep window. Optional: absent -> no per-exercise constraint (the
     *  bias/goal range governs). Drives both a selection penalty and an assignment clamp. */
    rep_min?: number;
    rep_max?: number;
    /** Objective semantic properties (e.g. 'incline', 'lengthened_bias', 'explosive'),
     *  consumed by the style affinity. NOT style labels. Optional/absent = none. */
    attributes?: string[];
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

// The pool the generator can actually draw from for a given user: equipment-owned
// and not contraindicated. Exported so callers (e.g. the post-generation validator)
// can reason about what was AVAILABLE, not the raw catalogue (a dumbbell-only user
// has no usable vertical pull even though the catalogue contains pulldowns).
export function usablePool(
    pool: ExerciseMeta[],
    equipment: Set<EquipmentKey>,
    restrictions: Set<RestrictionFlag>,
): ExerciseMeta[] {
    return pool.filter((ex) => hasEquipment(ex, equipment) && !isContraindicated(ex, restrictions));
}

// ── Exercise ordering ────────────────────────────────────────────────────────
// Within-session presentation order is assigned by the exercise role model
// (assignRole / orderByRole, defined below after the Selected type), which replaced
// the old tier sort + squat/hinge interleave.

// ── Heavy-compound deduplication guard ───────────────────────────────────────
// These patterns are capped at one compound per session to prevent coach-quality
// errors like "Sumo Deadlift + Deadlift in the same leg day". Lunge and glute_iso
// are intentionally excluded -- Back Squat + Bulgarian Split Squat is valid.
const HEAVY_DEDUP_PATTERNS: ReadonlySet<MovementPattern> = new Set(['hinge', 'squat']);

// ── Minimum-compound floor + lower-bucket backfill (live-test Issue 1) ───────
// Per-focus floor of compounds a session must reach BEFORE backfill. Lower and
// full-body sessions are compound-dependent (2); upper/push/pull tolerate 1.
// When the first pass falls short, the floor guard searches the usable pool
// within the session's OWN body region only (2026-06-11 follow-up): lower /
// legs / full-body sessions search squat > hinge > lunge (the role model's
// lower pattern priority), upper / push / pull sessions search the four upper
// compounds. The guard never crosses regions: an upper compound on a leg day
// is a different session, not a degraded one. If the floor is genuinely
// unsatisfiable the session still generates and the caller surfaces
// LIMITED_VARIETY_WARNING; never reject.
const COMPOUND_FLOOR: Record<Focus, number> = {
    lower: 2,
    legs: 2,
    full_body: 2,
    upper: 1,
    push: 1,
    pull: 1,
};
const FLOOR_FALLBACK_PATTERNS: Record<'lower' | 'upper', MovementPattern[]> = {
    lower: ['squat', 'hinge', 'lunge'],
    upper: ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'],
};
// Which fallback region each focus searches. full_body uses the lower list for
// the FLOOR (its upper slots already seat any available upper compound in the
// first pass, so a shortfall means lower work is what is missing); the hard
// no-cross-region rule below applies to lower/legs only.
const FLOOR_REGION: Record<Focus, 'lower' | 'upper'> = {
    lower: 'lower',
    legs: 'lower',
    full_body: 'lower',
    upper: 'upper',
    push: 'upper',
    pull: 'upper',
};
// Lower-bucket patterns a duress backfill may draw from on lower / legs /
// full-body sessions. Trigger: only when backfill is about to REPEAT a
// finisher (a 2nd calf or 2nd core), a fresh lower-bucket pattern outside the
// emphasis slots is preferred (e.g. the dumbbell-only quad day reaches for a
// Dumbbell RDL instead of padding to 2x calf + 2x core). Deep pools never hit
// this (their emphasis patterns absorb backfill first), so golden outputs are
// unchanged; the quad/posterior split softens only under thin equipment.
const LOWER_BUCKET_FALLBACK: MovementPattern[] = ['squat', 'hinge', 'lunge', 'glute_iso'];
const FINISHER_PATTERNS: ReadonlySet<MovementPattern> = new Set(['calf', 'core']);

// P3.3 isolation lean (a +1 isolation slot under Bodybuilding) was dropped: the
// emphases are already isolation-saturated, so a NOVEL extra isolation pattern only
// exists for a couple of upper emphases (and a duplicate just hits PATTERN_CAP /
// wastes the budget on a thin pool). A genuine isolation lean needs the quad/
// hamstring-iso patterns + a lower-emphasis redesign (deferred, science-gated). The
// Bodybuilding character ships via the pump rep ranges in resolveRepRange (isolation
// 15-20), which is the clean, robust half.
// Stable warning KEY (not the user-facing sentence). Display copy lives in
// WARNING_COPY (constants.ts) and renders in the Plan generation-warning notice;
// stored in the routine's `warnings` column.
const LIMITED_VARIETY_WARNING = 'limited_variety';

// ── Essential movement coverage (P1.1) ──────────────────────────────────────
// Per-focus OR-groups of movement patterns a session must cover before its
// budget is spent on optional slots. The first pass reserves budget for any
// still-uncovered essential group, so a tight budget cannot starve a defining
// pattern. Without this, the full-body emphases list horizontal_pull at slot
// index 3; a 30-min beginner budget of 3 truncated before it, so a short
// full-body WEEK trained zero pulls (Issue 1). When essentials fit naturally
// (the common case, including every golden at its budget) no slot is skipped
// and the first pass is byte-identical to the original. Only full_body is gated
// today: the other focuses already cover their defining patterns within budget
// via emphasis ordering + the compound floor, so their groups are empty (a
// no-op path). The groups are OR-sets (any one pattern covers the group); the
// walk fills whichever group pattern the emphasis lists first, and a final
// inject step covers a group whose patterns are absent from the slot list or
// had no candidates (degrading safely if the whole group is unavailable).
const ESSENTIAL_PATTERNS: Record<Focus, MovementPattern[][]> = {
    full_body: [
        ['squat', 'hinge', 'lunge'],
        ['horizontal_push', 'vertical_push'],
        ['horizontal_pull', 'vertical_pull'],
    ],
    lower: [],
    legs: [],
    upper: [],
    push: [],
    pull: [],
};

// ── Lower-compound pattern priority + duress-fallback contract ───────────────
// Lower-body compound priority (squat anchors over hinge over lunge). Used by
// BOTH the exercise role model (ranking the Lower bucket, compareLowerRole) AND
// the duress lower fallbacks below. Lower number = higher-priority anchor.
const LOWER_PATTERN_PRIORITY: Partial<Record<MovementPattern, number>> = { squat: 0, hinge: 1, lunge: 2 };

// Emphasis-slot contract for the two duress lower fallbacks (the minimum-compound
// floor guard and the finisher deflection). On a lower / legs session these may
// reach OUTSIDE the emphasis slot list for a lower compound, but must NOT seat one
// that would OUTRANK the day's own anchor and hijack the PRIMARY_LOWER role:
//   - lower_post (anchor = hinge) must never receive a squat. This is the
//     Sumo-Squat-on-the-posterior-day bug: a squat (priority 0) seated by the
//     floor guard / deflection becomes PRIMARY_LOWER and displaces the RDL,
//     turning the posterior day quad-led.
//   - lower_quad / lower_lean (anchor = squat) MAY still receive an accessory
//     hinge (a Dumbbell RDL): hinge ranks BELOW squat, so it lands SECONDARY_LOWER
//     and the day stays squat-led (the live-test Issue 1 behaviour, kept).
// full_body legitimately spans regions and is NOT gated (it keeps the any-region
// fallback); the upper fallback list (push/pull/upper) is never lower-compound, so
// it is unaffected. The day's anchor priority is the best (lowest) LOWER priority
// among the lower compounds it actually trains in its slots.
function isOffContractLowerCompound(pattern: MovementPattern, emphasis: Emphasis, focus: Focus): boolean {
    if (focus !== 'lower' && focus !== 'legs') return false;
    const prio = LOWER_PATTERN_PRIORITY[pattern];
    if (prio === undefined) return false; // glute_iso / non-lower-compound never hijacks the anchor
    if (emphasis.slots.includes(pattern)) return false; // part of the day's own contract
    const anchorPrio = Math.min(...emphasis.slots.map((s) => LOWER_PATTERN_PRIORITY[s] ?? Infinity));
    return prio < anchorPrio; // outranks the day's anchor -> off-contract, never seated
}

// ── Unilateral cap scope ──────────────────────────────────────────────────────
// The unilateral cap (at most one single-limb-at-a-time lift per session) governs
// single-limb COMPOUND work -- Walking Lunge, Bulgarian Split Squat, Step-Up --
// where stacking two front-loads balance-demanding fatigue without adding variety.
// Isolation / finisher patterns are EXEMPT: a unilateral Cable Kickback or
// Single-Leg Calf Raise is trivial accessory work that should neither consume the
// budget nor be blocked by it. Without this exemption a fresh unilateral glute_iso
// (the only fresh glute option once the bilateral ones are used) would set the flag
// and starve the session's primary lunge slot -- the lower_post "missing lunge"
// bug (2026-06-10). Isolation patterns are exactly the non-compound slots (`_iso` /
// calf / core), the same set the role model maps to ISOLATION / FINISHER.
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
    // Strict overhead-press variations only. Dumbbell Push Press is deliberately
    // NOT listed (2026-06-11): it is a power movement whose value is the leg drive
    // for an explosive, low-rep effort, which is meaningless at the 8-12 hypertrophy
    // reps a Push day prescribes. Left unlisted it floats by fatigue/id (Infinity
    // anchor rank), well behind the strict presses here, so a fresh Arnold Press /
    // Machine Shoulder Press anchors the day before it does.
    vertical_push: ['Barbell Overhead Press', 'Dumbbell Overhead Press', 'Arnold Press', 'Machine Shoulder Press'],
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

/** Canonical-anchor rank for an exercise within a pattern (lower = more canonical). When the
 *  active style supplies a `canonicalReorder` for the pattern, that name order is used;
 *  otherwise CANONICAL_ANCHORS. Infinity when neither lists the exercise (or it is nameless),
 *  so it is a pure tiebreak that leaves nameless/unlisted exercises in their prior order, and
 *  Balanced (no reorder) is byte-identical. */
export function anchorRank(ex: ExerciseMeta, pattern: MovementPattern, profile?: StyleProfile): number {
    const order = profile?.canonicalReorder?.[pattern] ?? CANONICAL_ANCHORS[pattern];
    if (!order || !ex.name) return Infinity;
    const i = order.indexOf(ex.name);
    return i === -1 ? Infinity : i;
}

// Isolation-quality scores (0-1, higher = better hypertrophy default): loadability,
// resistance curve, stability, lengthened-position bias. From the ChatGPT + Perplexity
// science review over real-catalog outputs (2026-06-16). The isolation analog of
// CANONICAL_ANCHORS: it is wired into byPattern ABOVE the fatigue tiebreak, but ONLY on
// non-anchor (isolation / accessory) patterns -- the six COMPOUND_ANCHOR_PATTERNS keep
// CANONICAL_ANCHORS. Before #3 the accessory fatigue tiebreak (lower fatigue first)
// systematically defaulted to low-fatigue-but-poor isolations (Tricep Kickback,
// Concentration Curl, Front Raise); quality now decides first.
//
// FRAGILITY: keyed by exercise NAME (ids are UUIDs, not stable across environments).
// A renamed seed exercise silently degrades its quality to NEUTRAL_QUALITY. A
// catalog-consistency test (generation.test.ts) asserts every name here exists in the
// metadata seed. Longer term this wants a `quality` column next to `fatigue` (mirrors
// the anchor_rank follow-up). Only exercises that live on an ISOLATION pattern are
// listed: Straight-Arm Pulldown scored 1.0 in the review but the catalog tags it
// vertical_pull / compound (an anchor pattern), so CANONICAL_ANCHORS governs it, not
// quality, and it is omitted here.
export const ISOLATION_QUALITY: Record<string, number> = {
    // Biceps (biceps_iso)
    'Cable Curl': 1.0,
    'Incline Dumbbell Curl': 0.95,
    'Preacher Curl': 0.95,
    'Dumbbell Curl': 0.9,
    'Dumbbell Bicep Curl': 0.9,
    'Dumbbell Hammer Curl': 0.9,
    'Spider Curl': 0.85,
    'Concentration Curl': 0.7,
    // Triceps (triceps_iso). The review's "Cable Pushdown" maps to the catalogue's
    // Tricep Pushdown; the kickback it scored lowest is the catalogue's Tricep Kickback
    // (the catalogue's "Cable Kickback" is a glute movement, deliberately not listed).
    'Tricep Pushdown': 1.0,
    'Cable Overhead Tricep Extension': 0.95,
    'Dumbbell Tricep Overhead Extension': 0.95,
    Dips: 0.95,
    'Skull Crusher': 0.9,
    'Diamond / Close-Grip Push-Up': 0.8,
    'Tricep Kickback': 0.55,
    // Side / rear delt (shoulder_iso)
    'Lateral Raise': 1.0,
    'Dumbbell Lateral Raise': 1.0,
    'Face Pull': 0.95,
    'Dumbbell Face Pull (Bent-Over)': 0.95,
    'Rear Delt Fly': 0.95,
    'Dumbbell Reverse Fly': 0.9,
    'Upright Row': 0.85,
    // Arnold Press is tagged shoulder_iso / non-compound in the catalogue (it competes
    // for a shoulder_iso slot, not a vertical_push anchor), so its review score applies
    // here: a passable but low side/rear-delt isolation, below the lateral raises.
    'Arnold Press': 0.75,
    'Front Raise': 0.6,
    // Chest (chest_iso)
    'Cable Fly': 1.0,
    'Chest Fly': 0.9,
    // Back (back_iso)
    'Dumbbell Pullover': 0.85,
    'Dumbbell Shrug': 0.8,
};

// Quality for an unlisted isolation: above the explicitly poor scores (Tricep Kickback
// 0.55, Front Raise 0.60, Concentration Curl 0.70, Arnold Press 0.75) and below the
// good defaults, so a solid unscored option (Barbell Curl, Pec Deck) still beats the
// poor ones while the top-scored picks lead. Identical for every unlisted exercise, so
// nameless synthetic pools all tie on this key and stay byte-identical to base.
const NEUTRAL_QUALITY = 0.8;

/** Isolation-quality score for an exercise (higher = better). Reads the seeded `quality`
 *  column; absent -> NEUTRAL_QUALITY, so synthetic/nameless pools score neutrally and the
 *  layer is a no-op for them. ISOLATION_QUALITY (the constant) is retained only as the
 *  migration seed source + a parity test-oracle. */
export function isolationQuality(ex: ExerciseMeta): number {
    return ex.quality ?? NEUTRAL_QUALITY;
}

// ── Context score tunables (spec 2026-06-16-14-57-31, section 7) ─────────────────────
// Magnitude-banded so precedence is unambiguous; locked by ordering-invariant tests.
export const STYLE_AFFINITY_MAX = 0.25; // cap on the accessory style bump
export const ATTRIBUTE_BUMP = 0.1; // per matched preferred attribute
export const REP_FIT_BONUS_MAX = 0.1; // graded overlap tiebreak, below quality/style
// Saturating weekly-repeat penalty by prior-selection count (index = prior count, capped).
export const REPEAT_PENALTY = [0, -0.5, -0.75, -0.85] as const;

export function repeatPenaltyFor(priorCount: number): number {
    if (priorCount <= 0) return 0;
    return REPEAT_PENALTY[Math.min(priorCount, REPEAT_PENALTY.length - 1)];
}

export interface StyleProfile {
    preferredAttributes: ReadonlySet<string>;
    equipmentBias: Partial<Record<EquipmentKey, number>>;
    compoundBias: number; // + favours compounds, - favours isolation density
    canonicalReorder?: Partial<Record<MovementPattern, string[]>>;
}

// Balanced is the neutral identity: every term zero, no reorder, so a Balanced routine is
// byte-identical (the golden invariant). Powerbuilding/Strength lean barbell + compound but
// their reorder largely matches the canonical default (which already leads with barbell), so
// their primaries stay heavy-barbell on purpose; they diverge from Balanced via reps, not
// exercises. Bodybuilding is the style that visibly diverges (machine/cable/incline primaries).
export const STYLE_PROFILES: Record<TrainingStyle, StyleProfile> = {
    balanced: { preferredAttributes: new Set(), equipmentBias: {}, compoundBias: 0 },
    strength: {
        preferredAttributes: new Set(),
        equipmentBias: { barbell: 0.1 },
        compoundBias: 0.1,
    },
    powerbuilding: {
        preferredAttributes: new Set(),
        equipmentBias: { barbell: 0.1 },
        compoundBias: 0.1,
    },
    bodybuilding: {
        preferredAttributes: new Set(['incline', 'lengthened_bias']),
        equipmentBias: { machines: 0.1, cables: 0.1 },
        compoundBias: -0.05,
        canonicalReorder: {
            horizontal_push: [
                'Incline Dumbbell Press',
                'Incline Barbell Press',
                'Dumbbell Bench Press',
                'Machine Chest Press',
                'Barbell Bench Press',
            ],
            horizontal_pull: [
                'Seated Cable Row',
                'Chest-Supported Row',
                'Dumbbell Single-Arm Row',
                'T-Bar Row',
                'Barbell Row',
            ],
            squat: ['Hack Squat', 'Leg Press', 'Barbell Squat'],
        },
    },
};

export interface ScoreContext {
    goal?: Goal;
    style: TrainingStyle;
    focus: Focus;
    repBand: [number, number];
    priorCount: number; // routine-wide prior selections of this exercise
    sessionMode?: 'short' | 'normal'; // ~30 min sessions favour compounds slightly
}

export interface ScoreBreakdown {
    total: number;
    quality: number;
    styleAffinity: number;
    repFitBonus: number;
    repeatPenalty: number;
}

const NEUTRAL_BREAKDOWN: ScoreBreakdown = {
    total: NEUTRAL_QUALITY,
    quality: NEUTRAL_QUALITY,
    styleAffinity: 0,
    repFitBonus: 0,
    repeatPenalty: 0,
};

/** Style affinity for an exercise under a profile, clamped to [0, STYLE_AFFINITY_MAX]. */
function styleAffinity(ex: ExerciseMeta, profile: StyleProfile, sessionMode?: 'short' | 'normal'): number {
    let a = 0;
    for (const attr of ex.attributes ?? []) if (profile.preferredAttributes.has(attr)) a += ATTRIBUTE_BUMP;
    for (const eq of ex.equipment) a += profile.equipmentBias[eq] ?? 0;
    if (ex.is_compound) a += profile.compoundBias;
    if (sessionMode === 'short' && ex.is_compound) a += 0.05; // time-crunch overlay
    return Math.max(0, Math.min(STYLE_AFFINITY_MAX, a));
}

/** Graded rep-fit bonus for an overlapping window: tighter + better-centred windows score
 *  higher, capped at REP_FIT_BONUS_MAX. No window or no overlap -> 0 (overlap is the gross
 *  layer's job, not this one). */
function repFitBonus(ex: ExerciseMeta, band: [number, number]): number {
    const window = repWindow(ex);
    if (!window || !bandOverlapsWindow(band, window)) return 0;
    const overlap = Math.min(band[1], window[1]) - Math.max(band[0], window[0]);
    const span = Math.max(1, band[1] - band[0]);
    return REP_FIT_BONUS_MAX * Math.max(0, Math.min(1, (overlap + 1) / (span + 1)));
}

/** Context-sensitive selection score (spec section 2). Nameless/metadata-absent ->
 *  NEUTRAL_BREAKDOWN, so synthetic pools score uniformly and the comparator falls through
 *  exactly as the old ISOLATION_QUALITY layer did (the load-bearing golden guard: an
 *  ungated repeat penalty would reorder a nameless pool that repeats an id). Pure. */
export function contextScore(ex: ExerciseMeta, ctx: ScoreContext): ScoreBreakdown {
    if (!ex.name) return NEUTRAL_BREAKDOWN;
    const profile = STYLE_PROFILES[ctx.style];
    const quality = ex.quality ?? NEUTRAL_QUALITY;
    const sa = styleAffinity(ex, profile, ctx.sessionMode);
    const rf = repFitBonus(ex, ctx.repBand);
    const rp = repeatPenaltyFor(ctx.priorCount);
    return { total: quality + sa + rf + rp, quality, styleAffinity: sa, repFitBonus: rf, repeatPenalty: rp };
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
    experience?: ExperienceLevel,
    bias: Bias = 'balanced',
    goal?: Goal,
    style: TrainingStyle = 'balanced',
    usedCount: Map<string, number> = new Map(),
    sessionMode: 'short' | 'normal' = 'normal',
): { selected: Selected[]; floorUnmet: boolean } {
    const preferredKey = loadingLean ? LOADING_TO_EQUIPMENT[loadingLean] : null;
    // Resolved once per session so the byPattern comparator can use it for style-aware
    // anchorRank without re-indexing. Balanced has no canonicalReorder, so it is a no-op
    // for the golden tests and the byte-identity invariant holds.
    const styleProfile = STYLE_PROFILES[style];
    // The prescribed rep band for a candidate in slot `p` (mirrors the assignment-time
    // call, minus floorRepRangeForLoad which never widens past a window). Used by the
    // gross rep-mismatch layer. Pure of side effects.
    const bandFor = (ex: ExerciseMeta, p: MovementPattern): [number, number] => {
        const r = resolveRepRange(bias, p, ex.is_compound, goal, style, experience, focus);
        const lo = Number(r.split('-')[0]);
        const hi = Number(r.split('-')[1] ?? r.split('-')[0]);
        return [Number.isFinite(lo) ? lo : 1, Number.isFinite(hi) ? hi : 999];
    };
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
                // P3.1b: a beginner soft-deprioritises 'advanced'-difficulty lifts
                // (never excludes, so thin pools still fill). No-op for other
                // experience levels and for exercises without a difficulty tag, so
                // synthetic pools and the goldens are byte-identical.
                if (experience === 'beginner') {
                    const aHard = a.difficulty === 'advanced' ? 1 : 0;
                    const bHard = b.difficulty === 'advanced' ? 1 : 0;
                    if (aHard !== bHard) return aHard - bHard;
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
                // Gross rep-mismatch (context-scoring spec, all patterns): a candidate
                // whose window does not overlap its prescribed band sorts last. Dominant,
                // above the canonical-anchor rank. No window -> never a mismatch, so
                // nameless pools are unaffected and the goldens stay byte-identical.
                const aWin = repWindow(a);
                const bWin = repWindow(b);
                const aMiss = aWin && !bandOverlapsWindow(bandFor(a, p), aWin) ? 1 : 0;
                const bMiss = bWin && !bandOverlapsWindow(bandFor(b, p), bWin) ? 1 : 0;
                if (aMiss !== bMiss) return aMiss - bMiss;
                // (5) Canonical-anchor rank (Bug 2): for explicitly named anchors the
                // canonical primary compound is authoritative and is applied BEFORE the
                // fatigue heuristic (2026-06-10). This lets Romanian Deadlift anchor hinge
                // over higher-fatigue Deadlift / Sumo, and keeps Barbell Bench Press ahead
                // of Close-Grip Bench Press. Infinity for nameless / unlisted exercises
                // (Infinity !== Infinity is false -> falls through to fatigue), so synthetic
                // pools stay byte-identical to base.
                const aRank = anchorRank(a, p, styleProfile);
                const bRank = anchorRank(b, p, styleProfile);
                if (aRank !== bRank) return aRank - bRank;
                // (P0 3.1) Compound-first, below the named-anchor rank and above
                // fatigue (anchor > compound > fatigue): a compound beats an
                // isolation for the same slot regardless of fatigue cost. DEFENSIVE
                // ARTIFACT, not a general policy: it once disambiguated the mixed
                // `squat` (Leg Extension) / `hinge` (Leg Curl) patterns. Now that
                // quad_iso / hamstring_iso exist and the migration moved Leg Extension /
                // Leg Curl out of squat / hinge, it is effectively dead for the real
                // catalog (as predicted) but stays as a no-op safety net for synthetic /
                // legacy pools where an unnamed isolation still shares a compound
                // pattern. Do NOT propagate this to other ordering layers (the floor
                // already filters is_compound, pick / backfill walk fixed slots, the
                // role model orders post-selection).
                const aComp = a.is_compound ? 0 : 1;
                const bComp = b.is_compound ? 0 : 1;
                if (aComp !== bComp) return aComp - bComp;
                // (context-scoring spec 2026-06-16): replace the flat ISOLATION_QUALITY
                // layer with contextScore, which adds style affinity, rep-fit bonus, and
                // a saturating weekly-repeat penalty. Nameless/metadata-absent exercises
                // score NEUTRAL_QUALITY uniformly, so synthetic pools stay byte-identical
                // to base. Anchor patterns are gated off (they keep CANONICAL_ANCHORS).
                if (!anchorPattern) {
                    const aScore = contextScore(a, {
                        goal, style, focus, repBand: bandFor(a, p),
                        priorCount: usedCount.get(a.id) ?? 0,
                        sessionMode,
                    }).total;
                    const bScore = contextScore(b, {
                        goal, style, focus, repBand: bandFor(b, p),
                        priorCount: usedCount.get(b.id) ?? 0,
                        sessionMode,
                    }).total;
                    if (aScore !== bScore) return bScore - aScore;
                }
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
        usedCount.set(ex.id, (usedCount.get(ex.id) ?? 0) + 1);
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
    const pick = (
        slot: MovementPattern,
        relaxHeavyCap = false,
        relaxUnilateralCap = false,
        accessoryInHeavy = false,
    ): boolean => {
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
            // accessoryInHeavy (P2.1): when the heavy compound is already seated,
            // still allow a NON-COMPOUND accessory in this pattern (e.g. a leg curl
            // on the hinge) so a thin session can add real work instead of a
            // duplicate finisher. Never seats a 2nd heavy COMPOUND. Without the flag
            // the slot stays fully blocked (the original behaviour).
            if (!accessoryInHeavy) return false;
            const accessory = candidates.filter((ex) => !ex.is_compound);
            if (accessory.length === 0) return false;
            candidates = accessory;
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

    // First pass: one exercise per slot in emphasis order, reserving budget for
    // any still-uncovered ESSENTIAL group (P1.1) so a tight budget cannot starve
    // a defining pattern. An "optional" slot (one that does not serve a currently
    // uncovered essential group) is skipped when picking it would leave no room
    // for the remaining uncovered essentials. When essentials fit naturally the
    // reservation never bites and this is the exact original first pass.
    const essentialGroups = ESSENTIAL_PATTERNS[focus];
    const groupCovered = (group: MovementPattern[]) => chosen.some((c) => group.includes(c.pattern));
    const uncoveredEssentials = () => essentialGroups.reduce((n, g) => (groupCovered(g) ? n : n + 1), 0);
    for (const slot of emphasis.slots) {
        if (chosen.length >= count) break;
        const servesUncovered = essentialGroups.some((g) => !groupCovered(g) && g.includes(slot));
        if (!servesUncovered && chosen.length + uncoveredEssentials() >= count) continue;
        pick(slot);
    }
    // Inject any essential group still uncovered: its emphasis pattern had no
    // candidates, or no group pattern appears in the slot list. Try each pattern
    // in the group in preference order; degrade safely if all are unavailable
    // (the group stays uncovered, backfill fills the slot, and a later validation
    // pass surfaces the gap).
    for (const group of essentialGroups) {
        if (chosen.length >= count) break;
        if (groupCovered(group)) continue;
        for (const p of group) {
            if (pick(p)) break;
        }
    }

    // Minimum-compound floor guard (live-test Issue 1): runs BEFORE backfill,
    // separate from it. When equipment/restriction filtering left the first
    // pass below the per-focus floor, seat compounds from ANY pattern in the
    // usable pool (squat > hinge > lunge first), respecting the pattern cap,
    // the heavy-dedup cap, the unilateral cap, and the avoid-set. Never
    // relaxes anything and never rejects; an unmet floor is reported to the
    // caller, which surfaces LIMITED_VARIETY_WARNING.
    const compoundCount = () => chosen.reduce((n, c) => (c.ex.is_compound ? n + 1 : n), 0);
    const floor = COMPOUND_FLOOR[focus];
    if (compoundCount() < floor) {
        // Respect the emphasis-slot contract: never seat an off-contract lower
        // compound that would outrank the day's anchor (no squat on the posterior
        // lower_post day). lower_quad still reaches its accessory hinge; full_body /
        // upper are not gated. See isOffContractLowerCompound.
        const floorPatterns = FLOOR_FALLBACK_PATTERNS[FLOOR_REGION[focus]].filter(
            (p) => !isOffContractLowerCompound(p, emphasis, focus),
        );
        for (const p of floorPatterns) {
            if (compoundCount() >= floor || chosen.length >= count) break;
            if (patternCount(p) >= PATTERN_CAP) continue;
            if (HEAVY_DEDUP_PATTERNS.has(p) && heavyPatternFilled.has(p)) continue;
            let candidates = byPattern(p).filter((ex) => ex.is_compound && !chosenIds.has(ex.id));
            if (unilateralFilled && unilateralCapApplies(p)) candidates = candidates.filter((ex) => !ex.unilateral);
            if (candidates.length === 0) continue;
            const fresh = candidates.find((ex) => !used.has(ex.id));
            push(fresh ?? candidates[0], p);
        }
    }
    const floorUnmet = compoundCount() < floor;

    // Lower-bucket duress fallback (live-test Issue 1): on lower / legs /
    // full-body sessions, the patterns backfill may deflect to instead of
    // repeating a finisher. Empty for other focuses and for emphases that
    // already carry every lower-bucket pattern.
    const lowerBucketExtras =
        focus === 'lower' || focus === 'legs' || focus === 'full_body'
            ? LOWER_BUCKET_FALLBACK.filter(
                  (p) => !emphasis.slots.includes(p) && !isOffContractLowerCompound(p, emphasis, focus),
              )
            : [];

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
            // Finisher deflection (P2.1): before seating a REPEAT calf/core, prefer
            // adding a non-finisher exercise: (1) a fresh lower-bucket pattern
            // outside the emphasis (a Dumbbell RDL on the dumbbell-only quad day
            // beats a 2nd calf + 2nd core), or (2) a non-compound accessory in an
            // emphasis non-finisher pattern that the heavy cap would otherwise block
            // (a leg curl on the hinge). Deep pools fill the slot with a non-finisher
            // before reaching here, so this is duress-only and leaves goldens unchanged.
            if (FINISHER_PATTERNS.has(slot) && patternCount(slot) >= 1) {
                let deflected = false;
                for (const p of lowerBucketExtras) {
                    if (pick(p, relaxedHeavyCap, relaxedUnilateralCap)) {
                        deflected = true;
                        break;
                    }
                }
                if (!deflected) {
                    for (const p of emphasis.slots) {
                        if (FINISHER_PATTERNS.has(p) || patternCount(p) >= PATTERN_CAP) continue;
                        if (pick(p, relaxedHeavyCap, relaxedUnilateralCap, true)) {
                            deflected = true;
                            break;
                        }
                    }
                }
                if (deflected) {
                    added = true;
                    continue;
                }
            }
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

    return { selected: chosen, floorUnmet };
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

// ── Exercise role model (Item 4) ─────────────────────────────────────────────
// Replaces the old patternTier sort + the squat/hinge interleave. Each selected
// exercise is assigned a role; the session is ordered PRIMARY_LOWER -> PRIMARY_UPPER
// -> SECONDARY_LOWER -> SECONDARY_UPPER -> ISOLATION -> FINISHER, so the two heaviest
// compounds lead and are separated by the opposite category. Spec:
// docs/superpowers/specs/2026-06-10-22-41-05-exercise-role-model-design.md.
export type ExerciseRole =
    | 'PRIMARY_LOWER'
    | 'PRIMARY_UPPER'
    | 'SECONDARY_LOWER'
    | 'SECONDARY_UPPER'
    | 'ISOLATION'
    | 'FINISHER';

const ROLE_ORDER: Record<ExerciseRole, number> = {
    PRIMARY_LOWER: 0,
    PRIMARY_UPPER: 1,
    SECONDARY_LOWER: 2,
    SECONDARY_UPPER: 3,
    ISOLATION: 4,
    FINISHER: 5,
};

// Coarse buckets for role assignment (Q3): push + pull pool into one Upper bucket so
// each session has exactly one Primary Upper. The three fine categories (Upper-push /
// Upper-pull) are for the volume planner / reporting, not for roles.
const ROLE_LOWER_PATTERNS: ReadonlySet<MovementPattern> = new Set(['squat', 'hinge', 'lunge']);
const ROLE_UPPER_PATTERNS: ReadonlySet<MovementPattern> = new Set([
    'horizontal_push',
    'vertical_push',
    'horizontal_pull',
    'vertical_pull',
]);
// Lower pattern priority (Q1): squat anchors over hinge over lunge, applied BEFORE
// canonical rank when ranking the Lower bucket. Defined once above (LOWER_PATTERN_PRIORITY,
// shared with the duress-fallback contract).
const ROLE_FATIGUE_NEUTRAL = 3;

type RoleBucket = 'lower' | 'upper' | 'isolation' | 'finisher';
function roleBucket(pattern: MovementPattern, isCompound: boolean): RoleBucket {
    if (pattern === 'calf' || pattern === 'core') return 'finisher';
    if (!isCompound || pattern.endsWith('_iso')) return 'isolation';
    if (ROLE_LOWER_PATTERNS.has(pattern)) return 'lower';
    if (ROLE_UPPER_PATTERNS.has(pattern)) return 'upper';
    return 'isolation';
}

/** Pure role assignment (Item 4). `categoryRankWithinSession` is 1 for the highest-
 *  ranked compound in the exercise's coarse bucket (computed by the caller over the
 *  already-selected set), 2+ for the rest. `isLoneLowerCompound` is true only for a
 *  lunge when the session has no squat or hinge compound. No session context needed. */
export function assignRole(
    pattern: MovementPattern,
    isCompound: boolean,
    categoryRankWithinSession: number,
    isLoneLowerCompound: boolean,
): ExerciseRole {
    const bucket = roleBucket(pattern, isCompound);
    if (bucket === 'finisher') return 'FINISHER';
    if (bucket === 'isolation') return 'ISOLATION';
    if (bucket === 'lower') {
        // Lunge is never Primary unless it is the session's lone lower compound.
        if (pattern === 'lunge' && !isLoneLowerCompound) return 'SECONDARY_LOWER';
        return categoryRankWithinSession === 1 ? 'PRIMARY_LOWER' : 'SECONDARY_LOWER';
    }
    return categoryRankWithinSession === 1 ? 'PRIMARY_UPPER' : 'SECONDARY_UPPER';
}

// Lower bucket ranking: pattern priority squat>hinge>lunge, then canonical -> fatigue
// desc -> id.
function compareLowerRole(a: Selected, b: Selected): number {
    const pa = LOWER_PATTERN_PRIORITY[a.pattern] ?? 99;
    const pb = LOWER_PATTERN_PRIORITY[b.pattern] ?? 99;
    if (pa !== pb) return pa - pb;
    const ar = anchorRank(a.ex, a.pattern);
    const br = anchorRank(b.ex, b.pattern);
    if (ar !== br) return ar - br;
    const af = a.ex.fatigue ?? ROLE_FATIGUE_NEUTRAL;
    const bf = b.ex.fatigue ?? ROLE_FATIGUE_NEUTRAL;
    if (af !== bf) return bf - af;
    return a.ex.id.localeCompare(b.ex.id);
}

// Upper bucket ranking: canonical -> fatigue desc -> push-before-pull -> id (Q2). The
// push-before-pull step only breaks a true canonical+fatigue tie across patterns.
function compareUpperRole(a: Selected, b: Selected): number {
    const ar = anchorRank(a.ex, a.pattern);
    const br = anchorRank(b.ex, b.pattern);
    if (ar !== br) return ar - br;
    const af = a.ex.fatigue ?? ROLE_FATIGUE_NEUTRAL;
    const bf = b.ex.fatigue ?? ROLE_FATIGUE_NEUTRAL;
    if (af !== bf) return bf - af;
    const ap = a.pattern === 'horizontal_push' || a.pattern === 'vertical_push' ? 0 : 1;
    const bp = b.pattern === 'horizontal_push' || b.pattern === 'vertical_push' ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.ex.id.localeCompare(b.ex.id);
}

// Order a session's selected exercises by role. Ranks the Lower and Upper buckets to
// find the single primary of each, assigns roles, then stable-sorts by role rank.
// Within a role, compounds keep their bucket rank; isolation/finisher keep selection
// order. Position 0 stays a compound (when one exists) so the strength set-bump lands
// on the session's primary lift.
function orderByRole(selected: Selected[]): Selected[] {
    const lowerRanked = selected
        .filter((s) => roleBucket(s.pattern, s.ex.is_compound) === 'lower')
        .sort(compareLowerRole);
    const upperRanked = selected
        .filter((s) => roleBucket(s.pattern, s.ex.is_compound) === 'upper')
        .sort(compareUpperRole);
    const lowerRank = new Map(lowerRanked.map((s, i) => [s.ex.id, i + 1]));
    const upperRank = new Map(upperRanked.map((s, i) => [s.ex.id, i + 1]));
    const hasSquatOrHinge = lowerRanked.some((s) => s.pattern === 'squat' || s.pattern === 'hinge');

    return selected
        .map((s, selIdx) => {
            const bucket = roleBucket(s.pattern, s.ex.is_compound);
            const rank =
                bucket === 'lower' ? lowerRank.get(s.ex.id)! : bucket === 'upper' ? upperRank.get(s.ex.id)! : 0;
            const isLoneLunge = s.pattern === 'lunge' && !hasSquatOrHinge;
            const role = assignRole(s.pattern, s.ex.is_compound, rank, isLoneLunge);
            const within = bucket === 'lower' || bucket === 'upper' ? rank : selIdx;
            return { s, primary: ROLE_ORDER[role], within, selIdx };
        })
        .sort((x, y) => x.primary - y.primary || x.within - y.within || x.selIdx - y.selIdx)
        .map((k) => k.s);
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

/**
 * Per-session focus label for the quad/posterior lower-day split (Bug 6).
 * Returns a descriptive label for the spacious Plan/guided surfaces so a
 * posterior-focused lower day no longer reads as a generic "Legs" / "Lower"
 * day, and the two paired leg days of a routine are told apart by their actual
 * focus rather than only an A/B letter. Null for every other emphasis,
 * including the PHUL lower days (which train squat AND hinge together and are a
 * power/volume split, not a quad/posterior one). Tabs keep their compact
 * type+variant labels. Applies to every style that pairs these emphases
 * (ul-classic-4, ul-aesthetic-4, ulppl-5, fb-ul-hybrid-5, ppl-x2-6).
 */
export function focusLabelForEmphasis(emphasis: EmphasisKey): string | null {
    switch (emphasis) {
        case 'lower_quad':
        case 'lower_lean':
            return 'Lower (Quads)';
        case 'lower_post':
            return 'Lower (Hamstrings & Glutes)';
        default:
            return null;
    }
}

export interface RoutineBlueprint {
    schedule: Array<{
        day_of_week: number;
        workout_type: WorkoutType;
        variant: WorkoutVariant | null;
        label: string | null;
    }>;
    exercises: Array<{
        exercise_id: string;
        workout_type: WorkoutType;
        variant: WorkoutVariant | null;
        order: number;
        sets: string;
        reps: string;
        superset_group_id: string | null;
    }>;
    /** Non-blocking generation-time notice KEYS (e.g. 'limited_variety',
     *  'no_compound'). Empty in the normal case. The action persists these to the
     *  routine's `warnings` column; the Plan page renders WARNING_COPY for each as
     *  a dismissible notice. */
    warnings: string[];
}

// Item 2: surfaced when a session's compound patterns are all filtered out (by
// restrictions / equipment / hidden exercises) AND no safe compound exists anywhere
// in the pool, so the session can only be accessory work. Generation never blocks;
// it warns instead.
// Stable warning KEY (display copy in WARNING_COPY, constants.ts).
const NO_COMPOUND_WARNING = 'no_compound';

// Duration guard (P1.4). Upper bound (minutes) per session-time band; null = no
// cap ('90+ min' is open-ended). A generated session whose estimate exceeds its
// band is flagged with OVER_TIME_WARNING: the engine keeps the requested volume
// (decision: warn, do not trim) and surfaces a heads-up so the label is honest.
// The 5-minute rounding in estimateSessionMinutes is the tolerance, so the
// warning fires only when the rounded estimate strictly exceeds the band max.
const OVER_TIME_WARNING = 'over_time';
// Stable warning KEY for essential-coverage degradation (P1.2): equipment /
// restrictions emptied an essential movement group for a focus (e.g. a full-body
// session left without any pull). Display copy in WARNING_COPY (constants.ts).
const MISSING_PATTERN_WARNING = 'missing_pattern';
// Bounded heavy-work limit (P2.2). When more than this many sessions in the week
// are strength-biased (heavy), the week is flagged 'demanding': hard to recover
// from at high frequency (e.g. a 6-day split under the Strength style, which
// remaps every session to strength). Warning-only (keep the plan; the user opted
// into the style); a fatigue MODEL / auto-correction is out of scope.
const HEAVY_WEEK_SESSION_LIMIT = 4;
const DEMANDING_WEEK_WARNING = 'demanding_week';
const SESSION_TIME_MAX_MIN: Record<SessionTime, number | null> = {
    '~30 min': 30,
    '45–60 min': 60,
    '90+ min': null,
};

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
    const { exercises: baseExCount, sets } = volumeFor(sessionTime, answers.experience);
    // Hypertrophy full-body short sessions earn the fuller exercise budget so they
    // reach their isolation slots instead of collapsing to all compounds. Scoped to
    // PURE full-body styles + intermediate/advanced build-muscle (review consensus):
    // other splits and beginners keep the lean, coverage-first short session, and the
    // fuller session may run a little over 30 min (the supersetted hypertrophy trade).
    const exCount =
        answers.goal === 'build_muscle' &&
        sessionTime === '~30 min' &&
        answers.experience !== 'beginner' &&
        style.sessions.every((s) => s.focus === 'full_body')
            ? volumeFor('45–60 min', answers.experience).exercises
            : baseExCount;
    const isSuperset = sessionTime === '~30 min';

    const restrictions = new Set(input.restrictions ?? []);
    const usable = usablePool(pool, answers.equipment, restrictions);
    const poolById = new Map(pool.map((e) => [e.id, e]));
    const used = new Set<string>();
    // Routine-wide selection count map: tracks how many times each exercise has been
    // chosen across all sessions so far this routine. Used by contextScore's repeat
    // penalty to rotate variety across the week. Lives beside `used` so both persist
    // across sessions the same way.
    const usedCount = new Map<string, number>();
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
    const warnings: string[] = [];
    // P2.2: count strength-biased (heavy) sessions to flag an over-demanding week.
    let strengthSessions = 0;
    // P3.2: weekly budget of extra sets for the priority muscle, spent one-per-exercise
    // across the routine, and a running total of the muscle's direct sets so the bump
    // stops at the recoverable ceiling. Null priority -> 0, so the no-priority path is
    // byte-identical.
    const priorityPatterns = input.priority ? new Set(PRIORITY_PATTERNS[input.priority]) : null;
    // The priority dose is applied AFTER all sessions are selected, not inline,
    // so its ceiling can gate on the muscle's PROJECTED weekly total instead of a
    // mid-stream running count. Inline gating let early-session bumps land while
    // later-session baseline volume silently pushed the muscle past the ceiling.
    // We accumulate the baseline (pre-bump) priority-pattern set total and a list of
    // the rows eligible for a +1, then distribute the budget once the total is known.
    let baselinePrioritySets = 0;
    const priorityBumpables: Array<{ row: { sets: number }; ex: { sets: string; exercise_id: string } }> = [];
    // Each session's rows, kept so the over-time estimate runs AFTER the priority
    // bump (it must reflect the final set counts, not the pre-bump ones).
    const perSessionRows: Array<
        Array<{ sets: number; is_compound: boolean; reps: string; supersetGroupId: string | null }>
    > = [];
    // Per-session context for gap-fill: keyed `${workout_type}:${variant ?? ''}`.
    const sessionCtx = new Map<string, { focus: Focus; isoReps: string; baseSets: number }>();

    style.sessions.forEach((session, i) => {
        if (i >= days.length) return;
        const workout_type = FOCUS_TYPE[session.focus];
        const variant = session.variant;
        schedule.push({
            day_of_week: days[i],
            workout_type,
            variant,
            label: focusLabelForEmphasis(session.emphasis),
        });

        const emphasis = tiltEmphasis(emphasisFor(session.emphasis), input.priority ?? null);
        const trainingStyle = input.trainingStyle ?? 'balanced';
        // Split identity outranks training style (P1.5). PHUL's identity IS its
        // power-vs-hypertrophy day contrast, encoded in the per-day emphasis biases
        // (phul_*_power = strength, phul_*_hyp = hypertrophy). The style remap would
        // otherwise collapse both days to one bias (Powerbuilding -> all strength,
        // Bodybuilding -> all hypertrophy), erasing the split. So PHUL sessions
        // resolve their bias (and thus rep range + set bump) from their OWN
        // emphasis, ignoring the style remap. Byte-identical under Balanced (the
        // remap is the identity there), so the PHUL-under-Balanced goldens hold.
        const styleForBias: TrainingStyle = session.emphasis.startsWith('phul_') ? 'balanced' : trainingStyle;
        const effectiveBias = resolveBias(emphasis.bias, styleForBias);
        if (effectiveBias === 'strength') strengthSessions += 1;
        const { selected, floorUnmet } = selectForSession(
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
            answers.experience,
            effectiveBias,
            answers.goal,
            styleForBias,
            usedCount,
            isSuperset ? 'short' : 'normal',
        );

        // Live-test Issue 1: an unmet compound floor (some compounds, fewer
        // than the focus demands) surfaces the limited-variety warning. The
        // zero-compound case stays with the Item 2 guard below and its own
        // warning, so the two never stack for one cause.
        if (floorUnmet && selected.some((s) => s.ex.is_compound) && !warnings.includes(LIMITED_VARIETY_WARNING)) {
            warnings.push(LIMITED_VARIETY_WARNING);
        }

        // Item 2: minimum-compound guard. If restrictions / equipment / hidden
        // exercises emptied this session's compound patterns, selectForSession could
        // only backfill isolation, leaving an accessory-only session. Seat one safe
        // compound from anywhere in the pool (a cross-pattern fallback, since the
        // session's own compound patterns are exactly what got emptied) rather than
        // ship that. If the whole safe pool has no compound, never block, warn.
        if (selected.length > 0 && !selected.some((s) => s.ex.is_compound)) {
            const chosenIds = new Set(selected.map((s) => s.ex.id));
            // Cross-region prohibition (2026-06-11): a lower/legs session never
            // receives an upper compound, even here in the zero-compound case;
            // it ships as honest accessory work plus the warning instead. Other
            // focuses (incl. full_body, which legitimately spans regions) keep
            // the any-region fallback.
            const lowerOnly = session.focus === 'lower' || session.focus === 'legs';
            const fallback = usable.find(
                (ex) =>
                    ex.is_compound &&
                    ex.movement_pattern !== null &&
                    !chosenIds.has(ex.id) &&
                    (!lowerOnly || FLOOR_FALLBACK_PATTERNS.lower.includes(ex.movement_pattern)) &&
                    // Honor the emphasis-slot contract, exactly like the floor guard
                    // (above): never seat a lower compound that would outrank the day's
                    // anchor (a squat on the hinge-anchored posterior day), which would
                    // ship it PRIMARY_LOWER and hijack the session. A no-op for upper /
                    // full_body. If nothing in-contract survives, warn (below).
                    !isOffContractLowerCompound(ex.movement_pattern, emphasis, session.focus),
            );
            if (fallback) {
                // Keep the exercise count: drop the last (lowest-priority) isolation
                // when already at target. The tier sort leads with the compound
                // regardless of where it is pushed here.
                if (selected.length >= exCount) selected.pop();
                selected.push({ ex: fallback, pattern: fallback.movement_pattern! });
                used.add(fallback.id);
                if (fallback.substitution_class !== null) usedSubstitutionClasses.add(fallback.substitution_class);
            } else if (!warnings.includes(NO_COMPOUND_WARNING)) {
                warnings.push(NO_COMPOUND_WARNING);
            }
        }

        // Essential-coverage degradation (P1.2): if equipment / restrictions left an
        // essential movement group uncovered for this focus (e.g. a full-body session
        // with no pull after a shoulder restriction emptied every pull), flag it rather
        // than silently shipping a session missing a defining movement. Essential
        // groups are full_body-only today (see ESSENTIAL_PATTERNS); other focuses gain
        // coverage definitions with the post-generation validator (P2.3).
        const essentialFor = ESSENTIAL_PATTERNS[session.focus];
        if (
            essentialFor.length > 0 &&
            essentialFor.some((g) => !selected.some((s) => g.includes(s.pattern))) &&
            !warnings.includes(MISSING_PATTERN_WARNING)
        ) {
            warnings.push(MISSING_PATTERN_WARNING);
        }

        // Role ordering (Item 4): assign each selected exercise a role and order the
        // session PRIMARY_LOWER -> PRIMARY_UPPER -> SECONDARY_LOWER -> SECONDARY_UPPER
        // -> ISOLATION -> FINISHER, so the two heaviest compounds lead and are
        // separated by the opposite category. Replaces the tier sort + interleave.
        const orderedSelection = orderByRole(selected);

        // Sets: 3 normally; 4 for the first compound of a strength-bias session.
        let firstCompoundBumped = false;
        const baseSets = Math.max(3, sets);
        // Context gap-fill needs to add an isolation to this session later: an
        // isolation's reps depend on (bias, goal, style, focus), not the specific iso
        // pattern, so one resolved value per session is correct.
        sessionCtx.set(`${workout_type}:${variant ?? ''}`, {
            focus: session.focus,
            isoReps: resolveRepRange(effectiveBias, 'biceps_iso', false, answers.goal, styleForBias, answers.experience, session.focus),
            baseSets,
        });
        const sessionRows: Array<{ sets: number; is_compound: boolean; reps: string; supersetGroupId: string | null }> =
            [];

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
            const reps = clampRepsToWindow(
                floorRepRangeForLoad(
                    resolveRepRange(
                        effectiveBias,
                        pattern,
                        ex.is_compound,
                        answers.goal,
                        styleForBias,
                        answers.experience,
                        session.focus,
                    ),
                    ex,
                ),
                ex,
            );
            const rowObj = { sets: exSets, is_compound: ex.is_compound, reps, supersetGroupId: groupId };
            sessionRows.push(rowObj);
            const exObj = {
                exercise_id: ex.id,
                workout_type,
                variant,
                order,
                sets: String(exSets),
                reps,
                superset_group_id: groupId,
            };
            exercises.push(exObj);
            // P3.2: record this row as eligible for the priority +1 and add its
            // baseline sets to the weekly total. The bump is distributed after the
            // loop, gated on the projected total (see below). Order of records is the
            // session-then-position order, so the earliest priority lifts get the
            // budget first, as before.
            if (priorityPatterns && priorityPatterns.has(pattern)) {
                baselinePrioritySets += exSets;
                priorityBumpables.push({ row: rowObj, ex: exObj });
            }
        });

        perSessionRows.push(sessionRows);
    });

    // P3.2 priority dose: deepen the priority muscle by one set per priority-pattern
    // lift, up to the weekly budget AND only while the muscle's PROJECTED weekly total
    // stays under its recoverable ceiling (so a priority never tips an already-loaded
    // muscle into junk volume). Now that every session is selected, baselinePrioritySets
    // is the true week total, so the ceiling is enforced against it (not a mid-stream
    // count). Additive; never reduces other work. Null priority leaves this empty, so
    // the no-priority path stays byte-identical.
    if (input.priority && usable.some((e) => e.primary_muscle)) {
        // Item 3: reach-target dose on an attributed pool. Deepen the priority muscle's
        // OWN lifts (rows whose primary_muscle is the priority's) until the muscle's
        // weekly direct sets reach its band minimum, never exceeding the band maximum and
        // never adding more than +2 to one lift.
        const targets = PRIORITY_TARGET_MUSCLES[input.priority];
        const targetMin = targets.reduce((n, t) => n + MUSCLE_SET_TARGETS[t].min, 0);
        const targetMax = targets.reduce((n, t) => n + MUSCLE_SET_TARGETS[t].max, 0);
        const underlying = new Set<Muscle>();
        for (const t of targets) {
            if (t === 'back') {
                underlying.add('lats');
                underlying.add('upper_back');
            } else underlying.add(t as Muscle);
        }
        const measure = () => {
            const counts = weeklyMuscleSets({ schedule, exercises, warnings: [] }, pool);
            return targets.reduce(
                (n, t) => n + (t === 'back' ? counts.lats.direct + counts.upper_back.direct : counts[t as Muscle].direct),
                0,
            );
        };
        const eligible = priorityBumpables
            .filter((b) => {
                const pm = poolById.get(b.ex.exercise_id)?.primary_muscle;
                return pm != null && underlying.has(pm);
            })
            .map((b) => ({ b, base: b.row.sets }));
        let progressed = true;
        while (progressed) {
            progressed = false;
            for (const { b, base } of eligible) {
                const m = measure();
                if (m >= targetMin || m >= targetMax) break;
                if (b.row.sets - base >= PRIORITY_MAX_EXTRA_PER_LIFT) continue;
                b.row.sets += 1;
                b.ex.sets = String(b.row.sets);
                progressed = true;
            }
        }
    } else {
        // Legacy flat +4 dose (P3.2): one set per priority-pattern lift up to the weekly
        // budget and the recoverable ceiling. Byte-identical for unattributed / synthetic
        // pools (and the null-priority path, where priorityBumpables is empty).
        let budget = PRIORITY_EXTRA_SETS_PER_WEEK;
        let total = baselinePrioritySets;
        for (const b of priorityBumpables) {
            if (budget <= 0 || total + 1 > PRIORITY_MUSCLE_SET_CEILING) break;
            b.row.sets += 1;
            b.ex.sets = String(b.row.sets);
            total += 1;
            budget -= 1;
        }
    }

    // Tier-2 Spec 3: minimum-coverage gap-fill. Gated on muscle attribution, so on a
    // synthetic pool (no primary_muscle) nothing runs and the goldens stay byte-
    // identical. Runs AFTER the priority bump and BEFORE the duration guard so any
    // added work is reflected in the over_time estimate.
    if (usable.some((e) => e.primary_muscle)) {
        const filled = applyCoverageGapFill({
            exercises,
            schedule,
            pool,
            usable,
            sessionCtx,
            qualityOf: isolationQuality,
            bandMaxMin: SESSION_TIME_MAX_MIN[sessionTime],
        });
        // Replace the exercises list in place with the gap-filled one.
        exercises.length = 0;
        exercises.push(...filled);

        // Item 4: soft MRV ceiling (see trimToMrv). Trim the lowest-value ACCESSORY
        // (isolation) sets of any target muscle over its band max; compounds are never
        // trimmed (a split's structural compound volume is left to training-time deloads).
        // The priority dose caps at the band max, so this never undoes a priority.
        // Attributed-pool only (no-op on synthetic pools), so the goldens are unchanged.
        const trimmed = trimToMrv({ exercises, schedule, pool });
        exercises.length = 0;
        exercises.push(...trimmed);
        // Rebuild perSessionRows from the final exercises so the duration guard sees
        // the additions (group by session, derive is_compound from the pool).
        const bySession = new Map<string, Array<{ sets: number; is_compound: boolean; reps: string; supersetGroupId: string | null }>>();
        for (const s of schedule) bySession.set(`${s.workout_type}:${s.variant ?? ''}`, []);
        for (const e of exercises) {
            const key = `${e.workout_type}:${e.variant ?? ''}`;
            bySession.get(key)?.push({
                sets: Number(e.sets),
                is_compound: poolById.get(e.exercise_id)?.is_compound ?? false,
                reps: e.reps,
                supersetGroupId: e.superset_group_id,
            });
        }
        perSessionRows.length = 0;
        perSessionRows.push(...bySession.values());
    }

    // Duration guard (P1.4): flag (never trim) a session whose estimate exceeds its
    // time band, so a "45-60 min" routine that lands at ~65 min is honest about it.
    // Runs post-bump so the estimate reflects the final set counts.
    const bandMax = SESSION_TIME_MAX_MIN[sessionTime];
    if (bandMax !== null) {
        for (const rows of perSessionRows) {
            if (estimateSessionMinutes(rows) > bandMax) {
                warnings.push(OVER_TIME_WARNING);
                break;
            }
        }
    }

    // Heavy-work limit (P2.2): a week with too many strength-biased sessions is
    // hard to recover from (e.g. a 6-day split under the Strength style). Flag it;
    // keep the plan (warn, do not auto-correct).
    if (strengthSessions > HEAVY_WEEK_SESSION_LIMIT && !warnings.includes(DEMANDING_WEEK_WARNING)) {
        warnings.push(DEMANDING_WEEK_WARNING);
    }

    return { schedule, exercises, warnings };
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
/** True when a style trains one squat-led lower day (squat without hinge) and one
 *  posterior-led lower day (hinge without squat), e.g. ul-classic-4's lower_quad +
 *  lower_post. Drives the buildRationale clause that explains the deliberately
 *  squat-free posterior day. PHUL is false (both its lower days carry squat AND
 *  hinge: that split is power vs volume, not quad vs posterior). */
export function hasQuadPosteriorSplit(style: ProgramStyle): boolean {
    let quadLed = false;
    let posteriorLed = false;
    for (const session of style.sessions) {
        if (session.focus !== 'lower' && session.focus !== 'legs') continue;
        const slots = emphasisFor(session.emphasis).slots;
        const hasSquat = slots.includes('squat');
        const hasHinge = slots.includes('hinge');
        if (hasSquat && !hasHinge) quadLed = true;
        if (hasHinge && !hasSquat) posteriorLed = true;
    }
    return quadLed && posteriorLed;
}

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
    // Explain the deliberately squat-free posterior day when the style splits its
    // lower work quad-led vs posterior-led (ul-classic-4 / ul-aesthetic-4 / ulppl-5 /
    // ppl-x2-6). Silent for PHUL (power vs volume) and same-pattern leg days (ppl-fb-4).
    const splitClause = hasQuadPosteriorSplit(style)
        ? ' Your two lower days are split on purpose: one leads with squats for the quads, the other with hinges for the posterior chain (so the squat-free day is intentional).'
        : '';
    return `${withPriority}${styleClause}${splitClause}${behaviorClause}`;
}
