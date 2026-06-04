import type { EquipmentKey, Sex } from './types';

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const DAYS_PER_WEEK_OPTIONS = ['2-3', '4', '5-6'] as const;
export type DaysPerWeek = (typeof DAYS_PER_WEEK_OPTIONS)[number];

export const GOALS = ['build_muscle', 'lose_fat', 'general_fitness'] as const;
export type Goal = (typeof GOALS)[number];

export interface OnboardingAnswers {
    equipment: Set<EquipmentKey>;
    experience: ExperienceLevel;
    goal: Goal;
    days: DaysPerWeek;
    sex?: Sex | null;
}

export function getEquipmentTier(equipment: Set<EquipmentKey>): 'db' | 'home' | 'gym' {
    if (equipment.has('cables') || equipment.has('machines')) return 'gym';
    if (equipment.has('barbell')) return 'home';
    return 'db';
}

export function recommendTemplate(answers: OnboardingAnswers): string | null {
    const { experience, goal, days, equipment } = answers;
    if (goal === 'general_fitness') return null;
    const tier = getEquipmentTier(equipment);
    let structure: string;
    if (experience === 'beginner' || days === '2-3') {
        structure = 'full-body';
    } else if (days === '4') {
        structure = 'upper-lower';
    } else {
        structure = 'ppl';
    }
    return `${structure}-${tier}`;
}
