import { describe, it, expect } from 'vitest';
import { classifyLift, scoreRatio, computeStrengthScore, STRENGTH_STANDARDS } from '../strength';

describe('classifyLift', () => {
    it('matches bench', () => {
        expect(classifyLift('Barbell Bench Press')).toBe('bench');
        expect(classifyLift('incline bench')).toBe('bench');
    });
    it('matches deadlift', () => {
        expect(classifyLift('Romanian Deadlift')).toBe('deadlift');
        expect(classifyLift('DEADLIFT')).toBe('deadlift');
    });
    it('matches squat', () => {
        expect(classifyLift('Back Squat')).toBe('squat');
        expect(classifyLift('goblet squat')).toBe('squat');
    });
    it('matches ohp via its keywords', () => {
        expect(classifyLift('Overhead Press')).toBe('ohp');
        expect(classifyLift('OHP')).toBe('ohp');
        expect(classifyLift('Seated Shoulder Press')).toBe('ohp');
        expect(classifyLift('Military Press')).toBe('ohp');
    });
    it('returns null for non-main lifts', () => {
        expect(classifyLift('Bicep Curl')).toBeNull();
        expect(classifyLift('Lateral Raise')).toBeNull();
        expect(classifyLift('')).toBeNull();
    });
});

describe('scoreRatio', () => {
    const t = [0.5, 0.75, 1.25, 1.75, 2.0];
    it('is 0 at or below the lowest threshold', () => {
        expect(scoreRatio(0.5, t)).toBe(0);
        expect(scoreRatio(0.2, t)).toBe(0);
    });
    it('is 100 at or above the highest threshold', () => {
        expect(scoreRatio(2.0, t)).toBe(100);
        expect(scoreRatio(3.0, t)).toBe(100);
    });
    it('lands on the band anchors', () => {
        expect(scoreRatio(0.75, t)).toBe(25);
        expect(scoreRatio(1.25, t)).toBe(50);
        expect(scoreRatio(1.75, t)).toBe(75);
    });
    it('interpolates midpoints between anchors', () => {
        // halfway from 0.5 (0) to 0.75 (25)
        expect(scoreRatio(0.625, t)).toBe(13);
        // halfway from 1.25 (50) to 1.75 (75)
        expect(scoreRatio(1.5, t)).toBe(63);
    });
    it('rounds the result', () => {
        expect(Number.isInteger(scoreRatio(0.6, t))).toBe(true);
    });
});

describe('STRENGTH_STANDARDS', () => {
    it('has 5 ascending thresholds per lift per gender', () => {
        for (const gender of ['male', 'female'] as const) {
            for (const lift of ['bench', 'squat', 'deadlift', 'ohp'] as const) {
                const arr = STRENGTH_STANDARDS[gender][lift];
                expect(arr).toHaveLength(5);
                for (let i = 1; i < arr.length; i++) {
                    expect(arr[i]).toBeGreaterThan(arr[i - 1]);
                }
            }
        }
    });
});

describe('computeStrengthScore', () => {
    it('returns a gender reason when gender is null', () => {
        const r = computeStrengthScore({ gender: null, bodyweightKg: 80, lifts: [{ name: 'Bench', e1rm: 100 }] });
        expect(r.score).toBeNull();
        expect(r.level).toBeNull();
        expect(r.reason).toBe('Set your gender in Profile to get a strength score.');
        expect(r.lifts).toEqual([]);
    });
    it('returns a bodyweight reason when bodyweight is null or <= 0', () => {
        const a = computeStrengthScore({ gender: 'male', bodyweightKg: null, lifts: [{ name: 'Bench', e1rm: 100 }] });
        expect(a.reason).toBe('Log your bodyweight to get a strength score.');
        const b = computeStrengthScore({ gender: 'male', bodyweightKg: 0, lifts: [{ name: 'Bench', e1rm: 100 }] });
        expect(b.reason).toBe('Log your bodyweight to get a strength score.');
        expect(b.score).toBeNull();
    });
    it('returns a main-lift reason when no input lift classifies', () => {
        const r = computeStrengthScore({
            gender: 'male',
            bodyweightKg: 80,
            lifts: [{ name: 'Bicep Curl', e1rm: 40 }],
        });
        expect(r.score).toBeNull();
        expect(r.reason).toBe('Log a main lift (bench, squat, deadlift, or overhead press) to get a strength score.');
    });
    it('scores a single lift and labels it', () => {
        // male bench thresholds [0.5,0.75,1.25,1.75,2.0]; ratio 1.25 -> 50
        const r = computeStrengthScore({ gender: 'male', bodyweightKg: 80, lifts: [{ name: 'Bench Press', e1rm: 100 }] });
        expect(r.score).toBe(50);
        expect(r.lifts).toHaveLength(1);
        expect(r.lifts[0]).toMatchObject({ lift: 'bench', label: 'Bench Press', subScore: 50, ratio: 1.25 });
        expect(r.level).toBe('Intermediate');
    });
    it('averages across multiple lifts', () => {
        // bench ratio 1.25 -> 50, squat ratio 1.5 -> 50, mean 50
        const r = computeStrengthScore({
            gender: 'male',
            bodyweightKg: 100,
            lifts: [
                { name: 'Bench Press', e1rm: 125 },
                { name: 'Back Squat', e1rm: 150 },
            ],
        });
        expect(r.lifts).toHaveLength(2);
        expect(r.score).toBe(50);
    });
    it('keeps the best e1rm per main lift', () => {
        const r = computeStrengthScore({
            gender: 'male',
            bodyweightKg: 80,
            lifts: [
                { name: 'Bench Press', e1rm: 60 },
                { name: 'Incline Bench', e1rm: 100 },
            ],
        });
        expect(r.lifts).toHaveLength(1);
        expect(r.lifts[0].ratio).toBe(1.25);
        expect(r.lifts[0].subScore).toBe(50);
    });
    it('labels score band boundaries', () => {
        const at = (subScore: number) => {
            // pick bodyweight + e1rm so a single bench lift hits the target subScore via anchors
            // anchors: 0->0, 0.75->25, 1.25->50, 1.75->75, 2.0->100
            const ratioFor: Record<number, number> = { 0: 0.5, 25: 0.75, 50: 1.25, 75: 1.75, 100: 2.0 };
            const ratio = ratioFor[subScore];
            return computeStrengthScore({
                gender: 'male',
                bodyweightKg: 100,
                lifts: [{ name: 'Bench Press', e1rm: ratio * 100 }],
            }).level;
        };
        expect(at(0)).toBe('Beginner');
        expect(at(25)).toBe('Novice');
        expect(at(50)).toBe('Intermediate');
        expect(at(75)).toBe('Advanced');
        expect(at(100)).toBe('Elite');
    });
});
