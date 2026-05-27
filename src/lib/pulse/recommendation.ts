import type { EquipmentKey } from './types';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type DaysPerWeek = '2-3' | '4' | '5-6';
export type Goal = 'build_muscle' | 'lose_fat' | 'general_fitness';

export interface OnboardingAnswers {
    equipment: Set<EquipmentKey>;
    experience: ExperienceLevel;
    goal: Goal;
    days: DaysPerWeek;
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
