import { describe, it, expect } from 'vitest';
import { filterTemplates, type TemplateFilterState } from '../templateFilters';
import type { RoutineTemplate } from '../types';

function tpl(over: Partial<RoutineTemplate>): RoutineTemplate {
    return {
        id: over.slug ?? 'x',
        name: over.name ?? 'T',
        slug: over.slug ?? 'x',
        required_equipment: over.required_equipment ?? [],
        days_per_week: over.days_per_week ?? '4',
        experience_level: over.experience_level ?? 'intermediate',
        session_time: '45–60 min',
        description: '',
        schedule_pattern: [],
        default_days: [],
        goal: over.goal ?? 'build_muscle',
        gender_fit: over.gender_fit ?? 'any',
    };
}

const base: TemplateFilterState = {
    equip: 'all',
    goal: 'all',
    experience: 'all',
    days: 'all',
    forYou: false,
    gender: null,
};

const ts = [
    tpl({ slug: 'a', goal: 'build_muscle', gender_fit: 'any', experience_level: 'advanced', days_per_week: '5' }),
    tpl({ slug: 'b', goal: 'lose_fat', gender_fit: 'female', experience_level: 'beginner', days_per_week: '3' }),
    tpl({ slug: 'c', goal: 'general_fitness', gender_fit: 'any', experience_level: 'beginner', days_per_week: '3' }),
];

const slugs = (r: RoutineTemplate[]) => r.map((t) => t.slug).sort();

describe('filterTemplates', () => {
    it('returns all with no active filters', () => {
        expect(slugs(filterTemplates(ts, base))).toEqual(['a', 'b', 'c']);
    });

    it('filters by goal, experience, and days (AND)', () => {
        expect(slugs(filterTemplates(ts, { ...base, goal: 'lose_fat' }))).toEqual(['b']);
        expect(slugs(filterTemplates(ts, { ...base, experience: 'beginner' }))).toEqual(['b', 'c']);
        expect(slugs(filterTemplates(ts, { ...base, experience: 'beginner', days: '3' }))).toEqual(['b', 'c']);
        expect(slugs(filterTemplates(ts, { ...base, experience: 'beginner', goal: 'general_fitness' }))).toEqual(['c']);
    });

    it('"for you" keeps gender-neutral templates; female-fit only shows for female users', () => {
        // male/null user: female-fit template hidden
        expect(slugs(filterTemplates(ts, { ...base, forYou: true, gender: null }))).toEqual(['a', 'c']);
        // female user: female-fit template included
        expect(slugs(filterTemplates(ts, { ...base, forYou: true, gender: 'female' }))).toEqual(['a', 'b', 'c']);
    });
});
