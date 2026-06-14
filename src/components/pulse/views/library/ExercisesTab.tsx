'use client';
import { useMemo, useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { EXERCISE_CATEGORIES } from '@/lib/pulse/types';
import type { DbExercise, ExerciseCategory } from '@/lib/pulse/types';
import { resolveEquipmentPrefill, swapCandidates, rankSubstitutes } from '@/lib/pulse/utils';
import { filterExercises, groupExercises } from '@/lib/pulse/library';
import type { GroupBy } from '@/lib/pulse/library';
import { useMediaQuery } from '@/hooks/pulse/useMediaQuery';
import FilterChips, { type FilterChipItem } from './FilterChips';
import ExerciseRow from './ExerciseRow';
import ExerciseFilterControl, { type FilterState } from './ExerciseFilterControl';
import ExerciseDetailSheet from './ExerciseDetailSheet';
import ExerciseFormSheet from './ExerciseFormSheet';

export default function ExercisesTab() {
    const {
        exercises,
        hiddenExerciseIds,
        favoriteExerciseIds,
        toggleHideExercise,
        toggleFavorite,
        createExercise,
        updateExercise,
        deleteExercise,
        equipmentProfiles,
        profile,
    } = usePulse();

    const isDesktop = useMediaQuery('(min-width: 1024px)');

    // Category chip state.
    const [category, setCategory] = useState<'all' | ExerciseCategory>('all');

    // Free-text search.
    const [query, setQuery] = useState('');

    // Group-by mode for the non-search grouped view.
    const [groupBy, setGroupBy] = useState<GroupBy>('muscle');

    // Advanced filter state.
    const [filters, setFilters] = useState<FilterState>({
        favorites: false,
        fitsGear: false,
        respectsRestrictions: false,
        showHidden: false,
    });

    // Sheet state: detail and form are mutually exclusive (never stacked).
    const [detailExercise, setDetailExercise] = useState<DbExercise | null>(null);
    const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
    const [formInitial, setFormInitial] = useState<DbExercise | undefined>(undefined);
    const [formOpen, setFormOpen] = useState(false);

    // Derive the effective equipment set from travel-aware profile resolution.
    const nowIso = useMemo(() => new Date().toISOString(), []);
    const timezone = profile.timezone ?? undefined;
    const activeId = profile.active_equipment_profile_id ?? null;
    const effectiveEquipment = useMemo(
        () => resolveEquipmentPrefill(equipmentProfiles, activeId, nowIso, timezone),
        [equipmentProfiles, activeId, nowIso, timezone],
    );

    // Derive active profile name for the filter control label.
    const activeProfileName = useMemo(() => {
        if (!activeId) return equipmentProfiles[0]?.name ?? null;
        return equipmentProfiles.find((p) => p.id === activeId)?.name ?? null;
    }, [equipmentProfiles, activeId]);

    // Run the filter seam.
    const filtered = useMemo(
        () =>
            filterExercises(exercises, {
                query,
                category,
                favorites: filters.favorites,
                fitsGear: filters.fitsGear,
                respectsRestrictions: filters.respectsRestrictions,
                showHidden: filters.showHidden,
                equipmentSet: effectiveEquipment,
                restrictions: (profile.movement_restrictions as import('@/lib/pulse/types').RestrictionFlag[] | null) ?? [],
                hiddenIds: hiddenExerciseIds,
                favoriteIds: favoriteExerciseIds,
            }),
        [exercises, query, category, filters, effectiveEquipment, profile.movement_restrictions, hiddenExerciseIds, favoriteExerciseIds],
    );

    // Per-category counts for the chip rail.
    const categoryCounts = useMemo(() => {
        const m = new Map<ExerciseCategory, number>();
        for (const ex of exercises) m.set(ex.category, (m.get(ex.category) ?? 0) + 1);
        return m;
    }, [exercises]);

    const categoryItems = useMemo<FilterChipItem[]>(
        () => [
            { key: 'all', label: 'all', count: exercises.length },
            ...EXERCISE_CATEGORIES.map((c) => ({ key: c, label: c, count: categoryCounts.get(c) ?? 0 })),
        ],
        [exercises.length, categoryCounts],
    );

    // Compute active filter names for the empty-results message.
    const activeFilterNames: string[] = [];
    if (query) activeFilterNames.push(`"${query}"`);
    if (category !== 'all') activeFilterNames.push(category);
    if (filters.favorites) activeFilterNames.push('Favorites');
    if (filters.fitsGear) activeFilterNames.push('Fits my gear');
    if (filters.respectsRestrictions) activeFilterNames.push('Respects my restrictions');
    if (filters.showHidden) activeFilterNames.push('Show hidden');

    function clearFilters() {
        setQuery('');
        setCategory('all');
        setFilters({ favorites: false, fitsGear: false, respectsRestrictions: false, showHidden: false });
    }

    // Compute similar exercises for the detail sheet.
    function computeSimilar(ex: DbExercise): DbExercise[] {
        const candidates = swapCandidates(ex, exercises, { excludeIds: new Set([ex.id]) });
        return rankSubstitutes(ex, candidates);
    }

    // Sheet openers: detail and form never stack.
    function openDetail(ex: DbExercise) {
        setFormOpen(false);
        setDetailExercise(ex);
    }

    function openAdd() {
        setDetailExercise(null);
        setFormMode('add');
        setFormInitial(undefined);
        setFormOpen(true);
    }

    function openEdit(ex: DbExercise) {
        setDetailExercise(null);
        setFormMode('edit');
        setFormInitial(ex);
        setFormOpen(true);
    }

    // Grouped list: used when category='all' AND no query.
    const useGrouped = category === 'all' && !query;
    const groups = useMemo(
        () => (useGrouped ? groupExercises(filtered, groupBy, favoriteExerciseIds) : []),
        [useGrouped, filtered, groupBy, favoriteExerciseIds],
    );

    function renderRow(ex: DbExercise) {
        return (
            <ExerciseRow
                key={ex.id}
                exercise={ex}
                favorite={favoriteExerciseIds.has(ex.id)}
                hidden={hiddenExerciseIds.has(ex.id)}
                showCategory={!!query}
                onOpen={openDetail}
                onToggleFavorite={(e) => toggleFavorite(e.id, !favoriteExerciseIds.has(e.id))}
            />
        );
    }

    // Removable active-filter chips for quick removal.
    const filterChipKeys: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.favorites)
        filterChipKeys.push({ key: 'fav', label: 'Favorites', onRemove: () => setFilters((f) => ({ ...f, favorites: false })) });
    if (filters.fitsGear)
        filterChipKeys.push({ key: 'gear', label: 'Fits my gear', onRemove: () => setFilters((f) => ({ ...f, fitsGear: false })) });
    if (filters.respectsRestrictions)
        filterChipKeys.push({
            key: 'restrict',
            label: 'Respects my restrictions',
            onRemove: () => setFilters((f) => ({ ...f, respectsRestrictions: false })),
        });
    if (filters.showHidden)
        filterChipKeys.push({
            key: 'hidden',
            label: 'Show hidden',
            onRemove: () => setFilters((f) => ({ ...f, showHidden: false })),
        });

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar: search + filter control */}
            <div className="flex items-center gap-2">
                <input
                    type="search"
                    aria-label="Search exercises"
                    placeholder="Search exercises..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 min-w-0 rounded-[10px] border border-pulse-border bg-pulse-surface px-3 py-2 font-pulse text-[0.86rem] text-pulse-text placeholder:text-pulse-muted focus:outline-none focus:border-pulse-accent/60 transition-colors"
                />
                <ExerciseFilterControl
                    value={filters}
                    activeProfileName={activeProfileName}
                    onChange={setFilters}
                    groupBy={groupBy}
                    onGroupByChange={setGroupBy}
                />
            </div>

            {/* Removable active-filter chips */}
            {filterChipKeys.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {filterChipKeys.map((chip) => (
                        <button
                            key={chip.key}
                            type="button"
                            aria-label={`Remove filter: ${chip.label}`}
                            onClick={chip.onRemove}
                            className="inline-flex items-center gap-1 rounded-full border border-pulse-accent/40 bg-pulse-accent/10 px-2.5 py-1 font-pulse text-xs text-pulse-accent">
                            {chip.label}
                            <span aria-hidden className="ml-0.5 text-[0.7rem] leading-none">
                                ×
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Category chip rail */}
            <FilterChips
                items={categoryItems}
                activeKey={category}
                onSelect={(k) => setCategory(k as 'all' | ExerciseCategory)}
            />

            {/* Count row + New button */}
            <div className="flex items-center justify-between gap-2">
                <span className="font-pulse text-[0.82rem] text-pulse-muted shrink-0">{filtered.length} exercises</span>
                <button
                    type="button"
                    onClick={openAdd}
                    className="rounded-[9px] border border-pulse-border bg-transparent px-3 py-1.5 font-pulse text-[0.82rem] text-pulse-accent cursor-pointer transition-colors hover:border-pulse-accent shrink-0">
                    + New
                </button>
            </div>

            {/* Empty-results state (filters active but no results) */}
            {filtered.length === 0 && exercises.length > 0 && (
                <div className="flex flex-col items-center gap-3 rounded-[14px] bg-pulse-surface px-5 py-8 text-center">
                    <p className="font-pulse text-[0.86rem] text-pulse-dim">
                        No exercises match{' '}
                        {activeFilterNames.length > 0 ? activeFilterNames.join(', ') : 'the active filters'}.
                    </p>
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded-[9px] border border-pulse-border bg-transparent px-3.5 py-1.5 font-pulse text-[0.82rem] text-pulse-text transition-colors hover:border-pulse-accent hover:text-pulse-accent">
                        Clear filters
                    </button>
                </div>
            )}

            {/* Empty catalog state */}
            {exercises.length === 0 && (
                <div className="font-pulse text-[0.8125rem] text-pulse-muted tracking-[0.04em]">
                    No exercises in the catalog yet.
                </div>
            )}

            {/* Exercise list */}
            {filtered.length > 0 && (
                <>
                    {useGrouped ? (
                        // Grouped view: Favorites first, then category sections.
                        <div className="flex flex-col gap-5">
                            {groups.map((group) => (
                                <div key={group.key}>
                                    <h3 className="mb-2 font-pulse text-[0.625rem] uppercase tracking-[0.12em] text-pulse-muted">
                                        {group.label}
                                    </h3>
                                    <div
                                        data-testid={`group-grid-${group.key}`}
                                        className={isDesktop ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>
                                        {group.exercises.map(renderRow)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Flat view: specific category selected or query active.
                        <div className="flex flex-col gap-2">
                            {filtered.map(renderRow)}
                        </div>
                    )}
                </>
            )}

            {/* Detail sheet */}
            {detailExercise && (
                <ExerciseDetailSheet
                    exercise={detailExercise}
                    favorite={favoriteExerciseIds.has(detailExercise.id)}
                    hidden={hiddenExerciseIds.has(detailExercise.id)}
                    similar={computeSimilar(detailExercise)}
                    open={!!detailExercise}
                    onClose={() => setDetailExercise(null)}
                    onToggleFavorite={(ex) => toggleFavorite(ex.id, !favoriteExerciseIds.has(ex.id))}
                    onToggleHide={(ex) => toggleHideExercise(ex.id, !hiddenExerciseIds.has(ex.id))}
                    onEdit={detailExercise.user_id != null ? openEdit : undefined}
                />
            )}

            {/* Form sheet */}
            <ExerciseFormSheet
                mode={formMode}
                initial={formInitial}
                open={formOpen}
                onClose={() => setFormOpen(false)}
                onSubmit={async ({ name, category: cat, defaultSets, defaultReps, meta }) => {
                    if (formMode === 'add') {
                        await createExercise(name, cat, defaultSets, defaultReps, meta ?? undefined);
                    } else if (formInitial) {
                        await updateExercise(formInitial.id, name, cat, defaultSets, defaultReps, meta ?? undefined);
                    }
                    setFormOpen(false);
                }}
                onDelete={
                    formMode === 'edit' && formInitial
                        ? (ex) => {
                              if (!window.confirm(`Delete "${ex.name}"? This cannot be undone.`)) return;
                              deleteExercise(ex.id);
                              setFormOpen(false);
                          }
                        : undefined
                }
            />
        </div>
    );
}
