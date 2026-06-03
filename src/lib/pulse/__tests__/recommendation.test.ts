import { describe, it, expect } from 'vitest';
import { recommendTemplate, getEquipmentTier } from '../recommendation';
import type { OnboardingAnswers } from '../recommendation';

describe('getEquipmentTier', () => {
    it('returns gym when cables present', () => expect(getEquipmentTier(new Set(['cables']))).toBe('gym'));
    it('returns gym when machines present', () =>
        expect(getEquipmentTier(new Set(['machines', 'barbell']))).toBe('gym'));
    it('returns home when barbell but no cables/machines', () =>
        expect(getEquipmentTier(new Set(['dumbbells', 'barbell', 'bench']))).toBe('home'));
    it('returns db when only dumbbells', () => expect(getEquipmentTier(new Set(['dumbbells']))).toBe('db'));
    it('returns db for bench + dumbbells', () => expect(getEquipmentTier(new Set(['dumbbells', 'bench']))).toBe('db'));
});

describe('recommendTemplate', () => {
    it('beginner any days → full-body-db (dumbbell tier)', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['dumbbells']),
            experience: 'beginner',
            goal: 'build_muscle',
            days: '5-6',
        };
        expect(recommendTemplate(answers)).toBe('full-body-db');
    });
    it('intermediate 2-3 days gym → full-body-gym', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['barbell', 'bench', 'cables', 'machines']),
            experience: 'intermediate',
            goal: 'build_muscle',
            days: '2-3',
        };
        expect(recommendTemplate(answers)).toBe('full-body-gym');
    });
    it('intermediate 4 days gym → upper-lower-gym', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['barbell', 'bench', 'cables', 'machines']),
            experience: 'intermediate',
            goal: 'build_muscle',
            days: '4',
        };
        expect(recommendTemplate(answers)).toBe('upper-lower-gym');
    });
    it('intermediate 5-6 days home → ppl-home', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['dumbbells', 'barbell', 'bench']),
            experience: 'intermediate',
            goal: 'lose_fat',
            days: '5-6',
        };
        expect(recommendTemplate(answers)).toBe('ppl-home');
    });
    it('advanced 4 days db → upper-lower-db', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['dumbbells', 'bench']),
            experience: 'advanced',
            goal: 'build_muscle',
            days: '4',
        };
        expect(recommendTemplate(answers)).toBe('upper-lower-db');
    });
    it('general_fitness → null', () => {
        const answers: OnboardingAnswers = {
            equipment: new Set(['dumbbells']),
            experience: 'intermediate',
            goal: 'general_fitness',
            days: '4',
        };
        expect(recommendTemplate(answers)).toBeNull();
    });
});
