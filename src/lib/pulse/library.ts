import { EXERCISE_CATEGORIES } from './types';
import type { DbExercise, ExerciseCategory, EquipmentKey, RestrictionFlag } from './types';
import { EQUIPMENT_LABELS } from './constants';

// NOTE: hasEquipment and isContraindicated in generation.ts are private (not exported)
// and take ExerciseMeta + Set parameters. Equivalent logic is inlined here for
// DbExercise, which has optional equipment/contraindications fields.

function hasEquipment(ex: DbExercise, equipmentSet: EquipmentKey[]): boolean {
    const eq = ex.equipment ?? [];
    if (eq.length === 0) return true; // bodyweight: always available
    const have = new Set(equipmentSet);
    return eq.every((e) => have.has(e));
}

function isContraindicated(ex: DbExercise, restrictions: Set<RestrictionFlag>): boolean {
    if (restrictions.size === 0) return false;
    return (ex.contraindications ?? []).some((c) => restrictions.has(c));
}

export interface ExerciseFilter {
    query?: string;
    category?: 'all' | ExerciseCategory;
    favorites?: boolean;
    fitsGear?: boolean;
    respectsRestrictions?: boolean;
    showHidden?: boolean;
    equipmentSet?: EquipmentKey[];
    restrictions?: RestrictionFlag[];
    hiddenIds?: Set<string>;
    favoriteIds?: Set<string>;
}

// Single, testable filter seam. Order: hidden visibility, then category, then
// favorites, then fits-gear, then respects-restrictions, then free-text query.
export function filterExercises(list: DbExercise[], f: ExerciseFilter): DbExercise[] {
    const q = (f.query ?? '').trim().toLowerCase();
    const restrictions = new Set(f.restrictions ?? []);
    return list.filter((ex) => {
        if (!f.showHidden && f.hiddenIds?.has(ex.id)) return false;
        if (f.category && f.category !== 'all' && ex.category !== f.category) return false;
        if (f.favorites && !f.favoriteIds?.has(ex.id)) return false;
        if (f.fitsGear && !hasEquipment(ex, f.equipmentSet ?? [])) return false;
        if (f.respectsRestrictions && isContraindicated(ex, restrictions)) return false;
        if (q) {
            const hay = `${ex.name} ${ex.category} ${(ex.equipment ?? []).join(' ')}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

export interface ExerciseGroup {
    key: string;
    label: string;
    count: number;
    exercises: DbExercise[];
}

export type GroupBy = 'muscle' | 'equipment' | 'type';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Equipment bucketing priority: barbell > dumbbells > machines > cables > pull_up_bar > Bodyweight.
// bench is never a primary bucket.
const EQUIPMENT_BUCKET_ORDER: EquipmentKey[] = ['barbell', 'dumbbells', 'machines', 'cables', 'pull_up_bar'];
const BODYWEIGHT_LABEL = 'Bodyweight';

function primaryEquipmentBucket(ex: DbExercise): string {
    const eq = new Set(ex.equipment ?? []);
    for (const key of EQUIPMENT_BUCKET_ORDER) {
        if (eq.has(key)) return EQUIPMENT_LABELS[key];
    }
    return BODYWEIGHT_LABEL;
}

// Groups a list by the specified dimension. Favorites are always pinned first
// (when any). Input order (alphabetical by name) is preserved within each group.
export function groupExercises(list: DbExercise[], by: GroupBy, favoriteIds: Set<string>): ExerciseGroup[] {
    const groups: ExerciseGroup[] = [];

    // Favorites pinned first in every mode.
    const favs = list.filter((e) => favoriteIds.has(e.id));
    if (favs.length > 0) groups.push({ key: 'favorites', label: 'Favorites', count: favs.length, exercises: favs });

    if (by === 'muscle') {
        for (const cat of EXERCISE_CATEGORIES) {
            const inCat = list.filter((e) => e.category === cat);
            if (inCat.length > 0) groups.push({ key: cat, label: cap(cat), count: inCat.length, exercises: inCat });
        }
    } else if (by === 'equipment') {
        // Build buckets in priority order.
        const bucketKeys = [...EQUIPMENT_BUCKET_ORDER.map((k) => EQUIPMENT_LABELS[k]), BODYWEIGHT_LABEL];
        const buckets = new Map<string, DbExercise[]>();
        for (const label of bucketKeys) buckets.set(label, []);
        for (const ex of list) {
            const label = primaryEquipmentBucket(ex);
            buckets.get(label)!.push(ex);
        }
        for (const label of bucketKeys) {
            const exercises = buckets.get(label)!;
            if (exercises.length > 0) groups.push({ key: label, label, count: exercises.length, exercises });
        }
    } else {
        // by === 'type'
        const compounds = list.filter((e) => e.is_compound === true);
        const isolations = list.filter((e) => e.is_compound !== true);
        if (compounds.length > 0)
            groups.push({ key: 'Compound', label: 'Compound', count: compounds.length, exercises: compounds });
        if (isolations.length > 0)
            groups.push({ key: 'Isolation', label: 'Isolation', count: isolations.length, exercises: isolations });
    }

    return groups;
}

// Favorites pinned first (when any), then categories in catalog order. Empty
// categories are omitted. The caller decides whether to render grouped (category
// = 'all') or flat (a specific category chip selected).
export function groupByCategory(list: DbExercise[], favoriteIds: Set<string>): ExerciseGroup[] {
    return groupExercises(list, 'muscle', favoriteIds);
}

export interface RepRange {
    from: string;
    to: string;
    freeform: string | null;
}

const RANGE_RE = /^(\d+)\s*-\s*(\d+)$/;
const SINGLE_RE = /^(\d+)$/;

// Parse the stored default_reps string into the two-field model. A value that is
// neither "min-max" nor a single number is preserved verbatim as `freeform` so
// editing cannot corrupt it (data-integrity, spec 3.4).
export function parseRepRange(reps: string): RepRange {
    const s = (reps ?? '').trim();
    const range = s.match(RANGE_RE);
    if (range) return { from: range[1], to: range[2], freeform: null };
    const single = s.match(SINGLE_RE);
    if (single) return { from: single[1], to: '', freeform: null };
    return { from: '', to: '', freeform: s };
}

export function composeRepRange(r: RepRange): string {
    if (r.freeform !== null && r.freeform !== '') return r.freeform.trim();
    const from = r.from.trim();
    const to = r.to.trim();
    if (from && to) return `${from}-${to}`;
    return from;
}

export function floatFavorites(list: DbExercise[], favoriteIds: Set<string>): DbExercise[] {
    const fav = list.filter((e) => favoriteIds.has(e.id));
    const rest = list.filter((e) => !favoriteIds.has(e.id));
    return [...fav, ...rest];
}
