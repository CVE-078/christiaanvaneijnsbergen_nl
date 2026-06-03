import type {
    EquipmentKey,
    ExerciseCategory,
    MovementPattern,
    SessionTime,
    WorkoutType,
    WorkoutVariant,
} from './types';
import type { ExperienceLevel, DaysPerWeek, Goal, OnboardingAnswers } from './recommendation';

export type Focus = 'full_body' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';

export function selectSplit(experience: ExperienceLevel, days: DaysPerWeek, sessionCount: number): Focus[] {
    let pattern: Focus[];
    if (experience === 'beginner' || days === '2-3') pattern = ['full_body'];
    else if (days === '4') pattern = ['upper', 'lower'];
    else pattern = ['push', 'pull', 'legs'];
    return Array.from({ length: sessionCount }, (_, i) => pattern[i % pattern.length]);
}

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

export function repRangeFor(goal: Goal): string {
    if (goal === 'build_muscle') return '8-12';
    if (goal === 'lose_fat') return '12-15';
    return '10-12';
}

// Ordered slots per focus: compounds first, then isolation accessories.
const FOCUS_SLOTS: Record<Focus, MovementPattern[]> = {
    full_body: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'vertical_push', 'vertical_pull', 'core'],
    upper: [
        'horizontal_push',
        'horizontal_pull',
        'vertical_push',
        'vertical_pull',
        'chest_iso',
        'back_iso',
        'shoulder_iso',
        'biceps_iso',
        'triceps_iso',
    ],
    lower: ['squat', 'hinge', 'lunge', 'glute_iso', 'calf', 'core'],
    push: ['horizontal_push', 'vertical_push', 'chest_iso', 'shoulder_iso', 'triceps_iso'],
    pull: ['horizontal_pull', 'vertical_pull', 'back_iso', 'biceps_iso'],
    legs: ['squat', 'hinge', 'lunge', 'glute_iso', 'calf', 'core'],
};

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

// Pick exercises for one session. `rotation` offsets candidate choice so repeated
// focuses (e.g. full body on multiple days) select different exercises.
function selectForSession(
    focus: Focus,
    count: number,
    pool: ExerciseMeta[],
    have: Set<EquipmentKey>,
    rotation: number,
): string[] {
    const usable = pool.filter((ex) => hasEquipment(ex, have));
    const byPattern = (p: MovementPattern) =>
        usable.filter((ex) => ex.movement_pattern === p).sort((a, b) => a.id.localeCompare(b.id));
    const chosen: string[] = [];
    const slots = FOCUS_SLOTS[focus];
    // First pass: one exercise per slot in order, rotated for variation.
    for (const slot of slots) {
        if (chosen.length >= count) break;
        const candidates = byPattern(slot).filter((ex) => !chosen.includes(ex.id));
        if (candidates.length > 0) chosen.push(candidates[rotation % candidates.length].id);
    }
    // Backfill: keep filling from the slot list until we hit count or run dry.
    let guard = 0;
    while (chosen.length < count && guard < 50) {
        guard++;
        let added = false;
        for (const slot of slots) {
            if (chosen.length >= count) break;
            const candidates = byPattern(slot).filter((ex) => !chosen.includes(ex.id));
            if (candidates.length > 0) {
                chosen.push(candidates[0].id);
                added = true;
            }
        }
        if (!added) break; // pool exhausted for this focus
    }
    return chosen;
}

export interface GenerationInput {
    answers: OnboardingAnswers;
    sessionTime: SessionTime;
    trainingDays: number[];
    pool: ExerciseMeta[];
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
    }>;
}

export function generateRoutine(input: GenerationInput): RoutineBlueprint {
    const { answers, sessionTime, trainingDays, pool } = input;
    const days = [...trainingDays].sort((a, b) => a - b);
    const focuses = selectSplit(answers.experience, answers.days, days.length);
    const { exercises: exCount, sets } = volumeFor(sessionTime, answers.experience);
    const reps = repRangeFor(answers.goal);
    const setsStr = String(sets);

    // Variant per focus occurrence: a focus that appears more than once across the
    // week alternates A/B (cycling); a focus that appears once gets no variant.
    const focusTotal: Record<string, number> = {};
    for (const f of focuses) focusTotal[f] = (focusTotal[f] ?? 0) + 1;
    const focusSeen: Record<string, number> = {};

    const schedule: RoutineBlueprint['schedule'] = [];
    const exercises: RoutineBlueprint['exercises'] = [];

    const emitted = new Set<string>();
    focuses.forEach((focus, i) => {
        const occ = focusSeen[focus] ?? 0;
        focusSeen[focus] = occ + 1;
        const workout_type = FOCUS_TYPE[focus];
        const variant: WorkoutVariant | null = focusTotal[focus] > 1 ? (occ % 2 === 0 ? 'A' : 'B') : null;
        schedule.push({ day_of_week: days[i], workout_type, variant });

        // Exercises are keyed by (workout_type, variant): emit each distinct
        // session once. With only A/B variants, a focus repeated 3+ times reuses
        // a variant's exercises (the documented two-distinct-versions cap), so we
        // must not emit duplicate rows. Rotation is tied to the variant (A->0,
        // B->1) so A and B differ while a reused variant stays consistent.
        const key = `${workout_type}:${variant ?? ''}`;
        if (emitted.has(key)) return;
        emitted.add(key);
        const rotation = variant === 'B' ? 1 : 0;
        const ids = selectForSession(focus, exCount, pool, answers.equipment, rotation);
        ids.forEach((exercise_id, order) => {
            exercises.push({ exercise_id, workout_type, variant, order, sets: setsStr, reps });
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
