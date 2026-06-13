import { describe, it, expect } from 'vitest';
import { explainCopy, type ExplainConcept } from '@/lib/pulse/explainCopy';

const ALL_CONCEPTS: ExplainConcept[] = [
    'stalled',
    'deload',
    'progression',
    'behind',
    'lapsed',
    'e1rm',
    'warmup',
    'volume_target',
    'recovery',
    'strength_score',
    'rir',
    'phase',
    'deload_week',
];

describe('explainCopy', () => {
    it('returns a non-empty title and why for every concept', () => {
        for (const concept of ALL_CONCEPTS) {
            const c = explainCopy(concept);
            expect(c.title.trim().length, `${concept} title`).toBeGreaterThan(0);
            expect(c.why.trim().length, `${concept} why`).toBeGreaterThan(0);
        }
    });

    it('never returns an em dash in any string (house copy rule)', () => {
        for (const concept of ALL_CONCEPTS) {
            const c = explainCopy(concept, { isRepAdvance: true, daysAway: 11, behindBy: 2 });
            for (const s of [c.title, c.why, c.next ?? '']) {
                expect(s, `${concept}: "${s}"`).not.toContain('—');
            }
        }
    });

    it('branches progression copy on isRepAdvance', () => {
        const rep = explainCopy('progression', { isRepAdvance: true });
        const weight = explainCopy('progression', { isRepAdvance: false });
        expect(rep.next).toMatch(/rep/i);
        expect(rep.next).not.toMatch(/heavier/i);
        expect(weight.next).toMatch(/heavier/i);
        expect(rep.why).not.toBe(weight.why);
    });

    it('keeps stalled (diagnosis) and deload (consequence) as distinct sentences', () => {
        expect(explainCopy('stalled').why).not.toBe(explainCopy('deload').why);
        // The deload why is the one decisionCopy reuses verbatim; keep "3 weeks".
        expect(explainCopy('deload').why).toContain('3 weeks');
    });

    it('interpolates a finite daysAway for lapsed', () => {
        const c = explainCopy('lapsed', { daysAway: 11 });
        expect(c.why).toContain('11 days');
    });

    it('tolerates a non-finite daysAway for lapsed', () => {
        const inf = explainCopy('lapsed', { daysAway: Infinity });
        const nan = explainCopy('lapsed', { daysAway: NaN });
        const none = explainCopy('lapsed');
        for (const c of [inf, nan, none]) {
            expect(c.why).not.toMatch(/\d+ days/);
            expect(c.why.trim().length).toBeGreaterThan(0);
        }
    });

    it('does not lead the behind / lapsed titles with the word "behind"', () => {
        expect(explainCopy('behind', { behindBy: 2 }).title.toLowerCase()).not.toContain('behind');
        expect(explainCopy('lapsed', { daysAway: 11 }).title.toLowerCase()).not.toContain('behind');
    });

    it('keeps glossary concepts as definitions (no "next")', () => {
        for (const concept of [
            'e1rm',
            'warmup',
            'volume_target',
            'recovery',
            'strength_score',
            'rir',
            'phase',
            'deload_week',
        ] as const) {
            expect(explainCopy(concept).next, concept).toBeUndefined();
        }
    });

    it('keeps the planned deload_week distinct from the stalled-lift deload, with no strength-jump overclaim', () => {
        expect(explainCopy('deload_week').why).not.toBe(explainCopy('deload').why);
        expect(explainCopy('deload_week').why).not.toMatch(/stronger/i);
        expect(explainCopy('rir').why.toLowerCase()).toContain('reserve');
        expect(explainCopy('phase').why.toLowerCase()).toContain('phase');
    });
});
