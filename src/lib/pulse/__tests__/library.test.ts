import { describe, it, expect } from 'vitest';
import { filterExercises, groupByCategory, parseRepRange, composeRepRange, floatFavorites } from '../library';
import type { DbExercise } from '../types';

const ex = (over: Partial<DbExercise>): DbExercise =>
    ({
        id: over.id ?? 'x', name: over.name ?? 'Bench Press', category: over.category ?? 'chest',
        default_sets: '3', default_reps: '8-12', user_id: over.user_id ?? null,
        equipment: over.equipment, movement_pattern: over.movement_pattern, is_compound: over.is_compound,
        substitution_class: null, contraindications: over.contraindications,
    }) as DbExercise;

describe('filterExercises', () => {
    const list = [
        ex({ id: 'a', name: 'Barbell Bench Press', category: 'chest', equipment: ['barbell', 'bench'] }),
        ex({ id: 'b', name: 'Dumbbell Lateral Raise', category: 'shoulders', equipment: ['dumbbells'] }),
        ex({ id: 'c', name: 'Back Squat', category: 'legs', equipment: ['barbell'], contraindications: ['knee'] }),
    ];

    it('matches the query across name, category, and equipment (case-insensitive)', () => {
        expect(filterExercises(list, { query: 'bench' }).map((e) => e.id)).toEqual(['a']);
        expect(filterExercises(list, { query: 'shoulders' }).map((e) => e.id)).toEqual(['b']);
        expect(filterExercises(list, { query: 'dumbbell' }).map((e) => e.id)).toEqual(['b']);
    });

    it('narrows by category', () => {
        expect(filterExercises(list, { category: 'legs' }).map((e) => e.id)).toEqual(['c']);
    });

    it('fits-my-gear keeps only exercises usable with the equipment set', () => {
        expect(filterExercises(list, { fitsGear: true, equipmentSet: ['dumbbells'] }).map((e) => e.id)).toEqual(['b']);
    });

    it('respects-restrictions hides contraindicated exercises', () => {
        expect(filterExercises(list, { respectsRestrictions: true, restrictions: ['knee'] }).map((e) => e.id)).toEqual([
            'a',
            'b',
        ]);
    });

    it('hides hidden exercises unless showHidden is set', () => {
        expect(filterExercises(list, { hiddenIds: new Set(['a']) }).map((e) => e.id)).toEqual(['b', 'c']);
        expect(filterExercises(list, { hiddenIds: new Set(['a']), showHidden: true }).map((e) => e.id)).toEqual([
            'a',
            'b',
            'c',
        ]);
    });

    it('favorites filter keeps only favorited', () => {
        expect(filterExercises(list, { favorites: true, favoriteIds: new Set(['c']) }).map((e) => e.id)).toEqual(['c']);
    });
});

describe('groupByCategory', () => {
    it('returns a Favorites group first (when any), then categories in catalog order, each with a count', () => {
        const list = [ex({ id: 'a', category: 'chest' }), ex({ id: 'b', category: 'legs' }), ex({ id: 'c', category: 'chest' })];
        const groups = groupByCategory(list, new Set(['b']));
        expect(groups[0]).toMatchObject({ key: 'favorites', label: 'Favorites', count: 1 });
        expect(groups.find((g) => g.key === 'chest')).toMatchObject({ count: 2 });
        expect(groups.some((g) => g.count === 0)).toBe(false); // empty categories omitted
    });

    it('omits the Favorites group when there are none', () => {
        const groups = groupByCategory([ex({ id: 'a', category: 'chest' })], new Set());
        expect(groups.some((g) => g.key === 'favorites')).toBe(false);
    });
});

describe('parseRepRange / composeRepRange', () => {
    it('parses a min-max range', () => {
        expect(parseRepRange('8-12')).toEqual({ from: '8', to: '12', freeform: null });
    });
    it('parses a single value as from only', () => {
        expect(parseRepRange('5')).toEqual({ from: '5', to: '', freeform: null });
    });
    it('keeps a non-conforming value as freeform (data-integrity fallback)', () => {
        expect(parseRepRange('AMRAP')).toEqual({ from: '', to: '', freeform: 'AMRAP' });
        expect(parseRepRange('8 to 12')).toEqual({ from: '', to: '', freeform: '8 to 12' });
    });
    it('composes from/to back to the canonical string', () => {
        expect(composeRepRange({ from: '8', to: '12', freeform: null })).toBe('8-12');
        expect(composeRepRange({ from: '5', to: '', freeform: null })).toBe('5');
        expect(composeRepRange({ from: '', to: '', freeform: 'AMRAP' })).toBe('AMRAP');
    });
});

describe('floatFavorites', () => {
    it('moves favorited exercises to the front, preserving relative order otherwise', () => {
        const list = [ex({ id: 'a' }), ex({ id: 'b' }), ex({ id: 'c' })];
        expect(floatFavorites(list, new Set(['c'])).map((e) => e.id)).toEqual(['c', 'a', 'b']);
    });
});
