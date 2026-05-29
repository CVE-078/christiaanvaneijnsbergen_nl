import { describe, it, expect } from 'vitest';
import { nextVariant } from '../sessions';

describe('nextVariant', () => {
    it('returns A when no history', () => {
        expect(nextVariant(null)).toBe('A');
    });

    it('alternates A to B', () => {
        expect(nextVariant('A')).toBe('B');
    });

    it('alternates B to A', () => {
        expect(nextVariant('B')).toBe('A');
    });
});
