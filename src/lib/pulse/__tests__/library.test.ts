import { describe, it, expect } from 'vitest';
import { filterExercises, groupByCategory, groupExercises, parseRepRange, composeRepRange, floatFavorites } from '../library';
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

describe('groupExercises', () => {
    const chest = ex({ id: 'a', name: 'Bench Press', category: 'chest', equipment: ['barbell', 'bench'], is_compound: true });
    const legs = ex({ id: 'b', name: 'Back Squat', category: 'legs', equipment: ['barbell'], is_compound: true });
    const shoulders = ex({ id: 'c', name: 'Lateral Raise', category: 'shoulders', equipment: ['dumbbells'], is_compound: false });
    const cables = ex({ id: 'd', name: 'Cable Fly', category: 'chest', equipment: ['cables'], is_compound: false });
    const bodyweight = ex({ id: 'e', name: 'Push-Up', category: 'chest', equipment: [], is_compound: true });
    const machine = ex({ id: 'f', name: 'Chest Press Machine', category: 'chest', equipment: ['machines', 'bench'], is_compound: true });
    const pullup = ex({ id: 'g', name: 'Pull-Up', category: 'back', equipment: ['pull_up_bar'], is_compound: true });
    const list = [chest, legs, shoulders, cables, bodyweight, machine, pullup];

    describe("'muscle' mode", () => {
        it("matches groupByCategory output exactly", () => {
            const fav = new Set(['b']);
            expect(groupExercises(list, 'muscle', fav)).toEqual(groupByCategory(list, fav));
        });

        it("pins Favorites first, then categories in catalog order", () => {
            const groups = groupExercises(list, 'muscle', new Set(['c']));
            expect(groups[0]).toMatchObject({ key: 'favorites', label: 'Favorites', count: 1 });
            // chest comes before legs/shoulders in EXERCISE_CATEGORIES order
            const keys = groups.map((g) => g.key);
            expect(keys).toContain('chest');
            expect(keys).toContain('legs');
            expect(keys).toContain('shoulders');
            expect(keys.indexOf('chest')).toBeLessThan(keys.indexOf('legs'));
        });
    });

    describe("'equipment' mode", () => {
        it("buckets by primary equipment using barbell > dumbbells > machines > cables > pull_up_bar priority", () => {
            // chest (barbell+bench) -> Barbell; legs (barbell) -> Barbell; shoulders (dumbbells) -> Dumbbells
            // cables (cables) -> Cables; bodyweight (empty) -> Bodyweight; machine (machines+bench) -> Machine; pullup -> Pull-up bar
            const groups = groupExercises(list, 'equipment', new Set());
            const byLabel = Object.fromEntries(groups.map((g) => [g.label, g.exercises.map((e) => e.id)]));
            expect(byLabel['Barbell']).toEqual(['a', 'b']); // chest + legs
            expect(byLabel['Dumbbells']).toEqual(['c']);
            expect(byLabel['Machine']).toEqual(['f']);
            expect(byLabel['Cables']).toEqual(['d']);
            expect(byLabel['Pull-up bar']).toEqual(['g']);
            expect(byLabel['Bodyweight']).toEqual(['e']);
        });

        it("orders groups: Barbell, Dumbbells, Machine, Cables, Pull-up bar, Bodyweight (priority order)", () => {
            const groups = groupExercises(list, 'equipment', new Set());
            const labels = groups.map((g) => g.label);
            expect(labels).toEqual(['Barbell', 'Dumbbells', 'Machine', 'Cables', 'Pull-up bar', 'Bodyweight']);
        });

        it("omits empty buckets", () => {
            // Only dumbbells exercise in list
            const groups = groupExercises([shoulders], 'equipment', new Set());
            expect(groups.map((g) => g.label)).toEqual(['Dumbbells']);
        });

        it("uses human-readable labels from EQUIPMENT_LABELS", () => {
            const groups = groupExercises([chest, shoulders], 'equipment', new Set());
            const labels = groups.map((g) => g.label);
            expect(labels).toContain('Barbell');
            expect(labels).toContain('Dumbbells');
        });

        it("pins Favorites first in equipment mode", () => {
            const groups = groupExercises([chest, shoulders], 'equipment', new Set(['c']));
            expect(groups[0]).toMatchObject({ key: 'favorites', label: 'Favorites', count: 1 });
        });

        it("exercise with no primary equipment (empty array) goes into Bodyweight bucket", () => {
            const groups = groupExercises([bodyweight], 'equipment', new Set());
            expect(groups[0]).toMatchObject({ key: 'Bodyweight', label: 'Bodyweight', count: 1 });
        });
    });

    describe("'type' mode", () => {
        it("puts is_compound=true exercises in Compound group first, then Isolation", () => {
            const groups = groupExercises(list, 'type', new Set());
            expect(groups[0]).toMatchObject({ key: 'Compound', label: 'Compound' });
            expect(groups[1]).toMatchObject({ key: 'Isolation', label: 'Isolation' });
        });

        it("correctly classifies each exercise", () => {
            const groups = groupExercises(list, 'type', new Set());
            const compoundIds = groups.find((g) => g.key === 'Compound')!.exercises.map((e) => e.id);
            const isolationIds = groups.find((g) => g.key === 'Isolation')!.exercises.map((e) => e.id);
            // chest (compound), legs (compound), bodyweight (compound), machine (compound), pullup (compound)
            expect(compoundIds).toContain('a');
            expect(compoundIds).toContain('b');
            expect(compoundIds).toContain('e');
            expect(compoundIds).toContain('f');
            expect(compoundIds).toContain('g');
            // shoulders (isolation), cables (isolation)
            expect(isolationIds).toContain('c');
            expect(isolationIds).toContain('d');
        });

        it("omits Isolation group when all exercises are compounds", () => {
            const groups = groupExercises([chest, legs], 'type', new Set());
            expect(groups.map((g) => g.key)).toEqual(['Compound']);
        });

        it("omits Compound group when all exercises are isolations", () => {
            const groups = groupExercises([shoulders, cables], 'type', new Set());
            expect(groups.map((g) => g.key)).toEqual(['Isolation']);
        });

        it("pins Favorites first in type mode", () => {
            const groups = groupExercises([chest, shoulders], 'type', new Set(['c']));
            expect(groups[0]).toMatchObject({ key: 'favorites', label: 'Favorites', count: 1 });
        });
    });

    describe("Favorites pinned in all modes", () => {
        it("no Favorites group when favoriteIds is empty", () => {
            for (const by of ['muscle', 'equipment', 'type'] as const) {
                const groups = groupExercises(list, by, new Set());
                expect(groups.some((g) => g.key === 'favorites')).toBe(false);
            }
        });
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
