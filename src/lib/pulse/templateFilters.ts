import { templateMatchesEquipment } from './types';
import type { RoutineTemplate, EquipmentKey, Gender } from './types';

export type EquipmentFilter = 'all' | 'dumbbells' | 'home' | 'gym';
export type GoalFilter = 'all' | RoutineTemplate['goal'];
export type ExperienceFilter = 'all' | RoutineTemplate['experience_level'];

// Equipment a filter implies you have; a template matches if all its required
// equipment is covered.
export const EQUIPMENT_SETS: Record<Exclude<EquipmentFilter, 'all'>, Set<EquipmentKey>> = {
    dumbbells: new Set(['dumbbells']),
    home: new Set(['dumbbells', 'barbell', 'bench']),
    gym: new Set(['barbell', 'bench', 'cables', 'machines']),
};

export const EQUIPMENT_LABELS: Record<EquipmentFilter, string> = {
    all: 'All',
    dumbbells: 'Dumbbells',
    home: 'Home Gym',
    gym: 'Full Gym',
};

export const GOAL_LABELS: Record<GoalFilter, string> = {
    all: 'All goals',
    build_muscle: 'Build muscle',
    lose_fat: 'Lose fat',
    general_fitness: 'General fitness',
};

export const EXPERIENCE_LABELS: Record<ExperienceFilter, string> = {
    all: 'All levels',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
};

export interface TemplateFilterState {
    equip: EquipmentFilter;
    goal: GoalFilter;
    experience: ExperienceFilter;
    /** A `days_per_week` value, or 'all'. */
    days: string;
    /** "For you": match gender_fit to the user's gender. */
    forYou: boolean;
    gender: Gender | null;
}

// AND-combine every active filter. 'For you' keeps gender-neutral templates plus
// ones matching the user's gender (female-fit shows only for female users).
export function filterTemplates(templates: RoutineTemplate[], f: TemplateFilterState): RoutineTemplate[] {
    return templates.filter(
        (t) =>
            (f.equip === 'all' || templateMatchesEquipment(t, EQUIPMENT_SETS[f.equip])) &&
            (f.goal === 'all' || t.goal === f.goal) &&
            (f.experience === 'all' || t.experience_level === f.experience) &&
            (f.days === 'all' || t.days_per_week === f.days) &&
            (!f.forYou || t.gender_fit === 'any' || (f.gender === 'female' && t.gender_fit === 'female')),
    );
}
