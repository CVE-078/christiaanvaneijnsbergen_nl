'use client';
import { useState, useTransition } from 'react';
import { usePulse } from '@/context/PulseContext';
import { toDisplay, toKg } from '@/lib/pulse/utils';
import type { DbExercise, ExerciseCategory, RoutineExercise, Unit } from '@/lib/pulse/types';

// ── Shared styles ──────────────────────────────────────────────────────────────
const INPUT =
    'bg-pulse-bg border border-pulse-border rounded-lg px-3 py-2 text-white font-pulse text-sm outline-none focus:border-pulse-accent/50';
const BTN_PRIMARY =
    'bg-pulse-accent text-black font-pulse text-sm font-semibold rounded-lg px-4 py-2 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_GHOST =
    'bg-transparent text-pulse-dim font-pulse text-sm border border-pulse-border rounded-lg px-3 py-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const CARD = 'bg-pulse-surface border border-pulse-border rounded-xl p-4';
const SECTION_LABEL = 'font-pulse text-[0.625rem] tracking-[0.1em] uppercase text-pulse-muted';

const CATEGORIES: ExerciseCategory[] = ['push', 'pull', 'legs', 'other'];

const CATEGORY_COLOR: Record<ExerciseCategory, string> = {
    push: 'text-orange-400',
    pull: 'text-sky-400',
    legs: 'text-violet-400',
    other: 'text-pulse-dim',
};

function CategoryBadge({ category }: { category: ExerciseCategory }) {
    return (
        <span
            className={`font-pulse text-[0.625rem] tracking-[0.08em] uppercase ${CATEGORY_COLOR[category]} bg-pulse-bg border border-pulse-border rounded-full px-2 py-0.5`}>
            {category}
        </span>
    );
}

// ── Exercises tab ────────────────────────────────────────────────────────────
function ExercisesTab() {
    const { exercises, createExercise, updateExercise, deleteExercise } = usePulse();
    const [, startTransition] = useTransition();

    const [filter, setFilter] = useState<'all' | ExerciseCategory>('all');
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState<ExerciseCategory>('push');
    const [newDefaultSets, setNewDefaultSets] = useState('3');
    const [newDefaultReps, setNewDefaultReps] = useState('8-12');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const filtered = exercises.filter((ex) => filter === 'all' || ex.category === filter);

    function handleAdd() {
        const name = newName.trim();
        const sets = newDefaultSets.trim();
        const reps = newDefaultReps.trim();
        if (!name || !sets || !reps) return;
        startTransition(async () => {
            await createExercise(name, newCategory, sets, reps);
            setNewName('');
            setNewCategory('push');
            setNewDefaultSets('3');
            setNewDefaultReps('8-12');
            setAdding(false);
        });
    }

    function startEdit(ex: DbExercise) {
        setEditingId(ex.id);
        setEditName(ex.name);
    }

    function handleEditSave(id: string) {
        const name = editName.trim();
        if (!name) return;
        startTransition(async () => {
            await updateExercise(id, name);
            setEditingId(null);
        });
    }

    function handleDelete(id: string) {
        startTransition(async () => {
            await deleteExercise(id);
        });
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Filter row */}
            <div className="flex flex-wrap gap-2">
                {(['all', ...CATEGORIES] as const).map((f) => {
                    const active = filter === f;
                    return (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`font-pulse text-xs tracking-[0.04em] uppercase rounded-full px-3 py-1.5 cursor-pointer border ${
                                active
                                    ? 'bg-pulse-accent text-black border-pulse-accent font-semibold'
                                    : 'bg-transparent text-pulse-dim border-pulse-border'
                            }`}>
                            {f}
                        </button>
                    );
                })}
            </div>

            {/* Add form */}
            {adding ? (
                <div className={`${CARD} flex flex-col gap-3`}>
                    <div className={SECTION_LABEL}>New exercise</div>
                    <input
                        autoFocus
                        aria-label="Exercise name"
                        placeholder="Exercise name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAdd();
                            if (e.key === 'Escape') setAdding(false);
                        }}
                        className={INPUT}
                    />
                    <select
                        aria-label="Category"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as ExerciseCategory)}
                        className={INPUT}>
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                                {c[0].toUpperCase() + c.slice(1)}
                            </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <label className="flex flex-col gap-1 flex-1">
                            <span className={SECTION_LABEL}>Default sets</span>
                            <input
                                aria-label="Default sets"
                                value={newDefaultSets}
                                onChange={(e) => setNewDefaultSets(e.target.value)}
                                className={INPUT}
                            />
                        </label>
                        <label className="flex flex-col gap-1 flex-1">
                            <span className={SECTION_LABEL}>Default reps</span>
                            <input
                                aria-label="Default reps"
                                value={newDefaultReps}
                                onChange={(e) => setNewDefaultReps(e.target.value)}
                                className={INPUT}
                            />
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleAdd} className={BTN_PRIMARY}>
                            Add
                        </button>
                        <button onClick={() => setAdding(false)} className={BTN_GHOST}>
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setAdding(true)} className={`${BTN_GHOST} self-start`}>
                    + Add
                </button>
            )}

            {/* Exercise list */}
            <div className="flex flex-col gap-2">
                {filtered.length === 0 ? (
                    <div className="font-pulse text-[0.8125rem] text-pulse-muted tracking-[0.04em]">
                        No exercises here yet.
                    </div>
                ) : (
                    filtered.map((ex) => {
                        const isUser = ex.user_id !== null;
                        const isEditing = editingId === ex.id;
                        return (
                            <div
                                key={ex.id}
                                className="flex items-center gap-3 bg-pulse-surface border border-pulse-border rounded-lg px-3 py-2.5">
                                {isEditing ? (
                                    <>
                                        <input
                                            autoFocus
                                            aria-label={`Rename ${ex.name}`}
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleEditSave(ex.id);
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                            className={`${INPUT} flex-1`}
                                        />
                                        <button
                                            onClick={() => handleEditSave(ex.id)}
                                            className={`${BTN_PRIMARY} shrink-0`}>
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className={`${BTN_GHOST} shrink-0`}>
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span className="font-pulse text-sm text-white flex-1 min-w-0 truncate">
                                            {ex.name}
                                        </span>
                                        <CategoryBadge category={ex.category} />
                                        {isUser && (
                                            <>
                                                <button
                                                    onClick={() => startEdit(ex)}
                                                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(ex.id)}
                                                    aria-label={`Delete ${ex.name}`}
                                                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ── Routine exercise row ───────────────────────────────────────────────────────
function RoutineExerciseRow({
    re,
    index,
    total,
    unit,
    onMove,
    onRemove,
    onUpdate,
}: {
    re: RoutineExercise;
    index: number;
    total: number;
    unit: Unit;
    onMove: (index: number, dir: -1 | 1) => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, sets: string, reps: string, startingWeightKg: number | null) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [sets, setSets] = useState(re.sets);
    const [reps, setReps] = useState(re.reps);
    const [weight, setWeight] = useState(
        re.starting_weight_kg !== null ? String(toDisplay(re.starting_weight_kg, unit)) : '',
    );

    function handleSave() {
        const trimmed = weight.trim();
        const parsed = trimmed === '' ? null : toKg(parseFloat(trimmed), unit);
        onUpdate(re.id, sets, reps, Number.isNaN(parsed as number) ? null : parsed);
        setEditing(false);
    }

    return (
        <div className="flex flex-col gap-2 bg-pulse-surface border border-pulse-border rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
                <span className="font-pulse text-xs text-pulse-dim w-5 shrink-0">{index + 1}</span>
                <span className="font-pulse text-sm text-white flex-1 min-w-0 truncate">{re.exercise.name}</span>
                {!editing && (
                    <span className="font-pulse text-xs text-pulse-dim shrink-0">
                        {re.sets} × {re.reps}
                        {re.starting_weight_kg !== null && (
                            <> · {toDisplay(re.starting_weight_kg, unit)} {unit}</>
                        )}
                    </span>
                )}
                <button
                    onClick={() => onMove(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${re.exercise.name} up`}
                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
                    ↑
                </button>
                <button
                    onClick={() => onMove(index, 1)}
                    disabled={index === total - 1}
                    aria-label={`Move ${re.exercise.name} down`}
                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
                    ↓
                </button>
                <button
                    onClick={() => setEditing((v) => !v)}
                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                    Edit
                </button>
                <button
                    onClick={() => onRemove(re.id)}
                    aria-label={`Remove ${re.exercise.name}`}
                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                    Remove
                </button>
            </div>
            {editing && (
                <div className="flex flex-wrap items-end gap-2 pl-8">
                    <label className="flex flex-col gap-1">
                        <span className={SECTION_LABEL}>Sets</span>
                        <input
                            aria-label={`${re.exercise.name} sets`}
                            value={sets}
                            onChange={(e) => setSets(e.target.value)}
                            className={`${INPUT} w-16`}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className={SECTION_LABEL}>Reps</span>
                        <input
                            aria-label={`${re.exercise.name} reps`}
                            value={reps}
                            onChange={(e) => setReps(e.target.value)}
                            className={`${INPUT} w-16`}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className={SECTION_LABEL}>Weight ({unit})</span>
                        <input
                            type="number"
                            aria-label={`${re.exercise.name} starting weight`}
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            className={`${INPUT} w-24`}
                        />
                    </label>
                    <button onClick={handleSave} className={BTN_PRIMARY}>
                        Save
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Routines tab ───────────────────────────────────────────────────────────────
function RoutinesTab() {
    const {
        routines,
        activeRoutine,
        exercises,
        profile,
        createRoutine,
        deleteRoutine,
        setActiveRoutine,
        addExerciseToRoutine,
        removeExerciseFromRoutine,
        updateRoutineExercise,
        reorderRoutineExercises,
    } = usePulse();
    const [, startTransition] = useTransition();

    const unit = profile.unit;

    const [routineName, setRoutineName] = useState('');

    const [pickExerciseId, setPickExerciseId] = useState('');
    const [addSets, setAddSets] = useState('3');
    const [addReps, setAddReps] = useState('8-12');
    const [addWeight, setAddWeight] = useState('');

    function handleCreateRoutine() {
        const name = routineName.trim();
        if (!name) return;
        startTransition(async () => {
            await createRoutine(name);
            setRoutineName('');
        });
    }

    function handleSetActive(id: string) {
        startTransition(async () => {
            await setActiveRoutine(id);
        });
    }

    function handleDeleteRoutine(id: string) {
        startTransition(async () => {
            await deleteRoutine(id);
        });
    }

    function handleAddExercise() {
        if (!activeRoutine || !pickExerciseId) return;
        const trimmed = addWeight.trim();
        const parsed = trimmed === '' ? null : toKg(parseFloat(trimmed), unit);
        startTransition(async () => {
            await addExerciseToRoutine(
                activeRoutine.id,
                pickExerciseId,
                addSets,
                addReps,
                Number.isNaN(parsed as number) ? null : parsed,
            );
            setPickExerciseId('');
            setAddWeight('');
        });
    }

    function handleMove(index: number, dir: -1 | 1) {
        if (!activeRoutine) return;
        const sorted = [...activeRoutine.exercises].sort((a, b) => a.order - b.order);
        const target = index + dir;
        if (target < 0 || target >= sorted.length) return;
        [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
        const orderedIds = sorted.map((re) => re.id);
        startTransition(async () => {
            await reorderRoutineExercises(activeRoutine.id, orderedIds);
        });
    }

    function handleRemove(id: string) {
        startTransition(async () => {
            await removeExerciseFromRoutine(id);
        });
    }

    function handleUpdateExercise(id: string, sets: string, reps: string, startingWeightKg: number | null) {
        startTransition(async () => {
            await updateRoutineExercise(id, sets, reps, startingWeightKg);
        });
    }

    const sortedActiveExercises = activeRoutine
        ? [...activeRoutine.exercises].sort((a, b) => a.order - b.order)
        : [];

    return (
        <div className="flex flex-col gap-4">
            {/* Create routine */}
            <div className={`${CARD} flex flex-col gap-3`}>
                <div className={SECTION_LABEL}>Create routine</div>
                <div className="flex gap-2">
                    <input
                        aria-label="Routine name"
                        placeholder="Routine name"
                        value={routineName}
                        onChange={(e) => setRoutineName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateRoutine();
                        }}
                        className={`${INPUT} flex-1`}
                    />
                    <button onClick={handleCreateRoutine} className={BTN_PRIMARY}>
                        Create
                    </button>
                </div>
            </div>

            {/* Routine list */}
            <div className="flex flex-col gap-2">
                {routines.length === 0 ? (
                    <div className="font-pulse text-[0.8125rem] text-pulse-muted tracking-[0.04em]">
                        No routines yet. Create one above.
                    </div>
                ) : (
                    routines.map((r) => {
                        const isActive = activeRoutine?.id === r.id;
                        return (
                            <div
                                key={r.id}
                                className={`flex items-center gap-3 bg-pulse-surface rounded-lg px-3 py-2.5 border ${
                                    isActive ? 'border-pulse-accent/40' : 'border-pulse-border'
                                }`}>
                                <div className="flex-1 min-w-0">
                                    <div className="font-pulse text-sm text-white truncate">{r.name}</div>
                                    <div className="font-pulse text-xs text-pulse-dim">
                                        {r.exercises.length} {r.exercises.length === 1 ? 'exercise' : 'exercises'}
                                    </div>
                                </div>
                                {isActive ? (
                                    <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-full px-2 py-0.5 shrink-0">
                                        Active
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => handleSetActive(r.id)}
                                        className="font-pulse text-xs text-pulse-dim bg-transparent border border-pulse-border rounded-lg px-3 py-1.5 cursor-pointer shrink-0">
                                        Set active
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDeleteRoutine(r.id)}
                                    aria-label={`Delete ${r.name}`}
                                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                                    Delete
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Active routine editor */}
            {activeRoutine && (
                <div className={`${CARD} flex flex-col gap-4`}>
                    <div className="font-pulse text-sm font-semibold text-white">
                        Active: <span className="text-pulse-accent">{activeRoutine.name}</span>
                    </div>

                    {/* Add exercise to routine */}
                    <div className="flex flex-col gap-2">
                        <div className={SECTION_LABEL}>Add exercise</div>
                        <select
                            aria-label="Exercise"
                            value={pickExerciseId}
                            onChange={(e) => setPickExerciseId(e.target.value)}
                            className={INPUT}>
                            <option value="">Select an exercise…</option>
                            {exercises.map((ex) => (
                                <option key={ex.id} value={ex.id}>
                                    {ex.name}
                                </option>
                            ))}
                        </select>
                        <div className="flex flex-wrap items-end gap-2">
                            <label className="flex flex-col gap-1">
                                <span className={SECTION_LABEL}>Sets</span>
                                <input
                                    aria-label="Sets"
                                    value={addSets}
                                    onChange={(e) => setAddSets(e.target.value)}
                                    className={`${INPUT} w-16`}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={SECTION_LABEL}>Reps</span>
                                <input
                                    aria-label="Reps"
                                    value={addReps}
                                    onChange={(e) => setAddReps(e.target.value)}
                                    className={`${INPUT} w-20`}
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className={SECTION_LABEL}>Weight ({unit})</span>
                                <input
                                    type="number"
                                    aria-label="Starting weight"
                                    placeholder="optional"
                                    value={addWeight}
                                    onChange={(e) => setAddWeight(e.target.value)}
                                    className={`${INPUT} w-24`}
                                />
                            </label>
                            <button
                                onClick={handleAddExercise}
                                disabled={!pickExerciseId}
                                className={BTN_PRIMARY}>
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Routine exercise list */}
                    <div className="flex flex-col gap-2">
                        {sortedActiveExercises.length === 0 ? (
                            <div className="font-pulse text-[0.8125rem] text-pulse-muted tracking-[0.04em]">
                                No exercises in this routine yet.
                            </div>
                        ) : (
                            sortedActiveExercises.map((re, i) => (
                                <RoutineExerciseRow
                                    key={re.id}
                                    re={re}
                                    index={i}
                                    total={sortedActiveExercises.length}
                                    unit={unit}
                                    onMove={handleMove}
                                    onRemove={handleRemove}
                                    onUpdate={handleUpdateExercise}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── LibraryView ──────────────────────────────────────────────────────────────
export default function LibraryView() {
    const [tab, setTab] = useState<'exercises' | 'routines'>('exercises');

    return (
        <div className="pt-5 px-4 pb-12 max-w-[600px] lg:max-w-[820px] mx-auto flex flex-col gap-5">
            {/* Tab switcher */}
            <div className="flex gap-2" role="tablist" aria-label="Library sections">
                {(['exercises', 'routines'] as const).map((t) => {
                    const active = tab === t;
                    return (
                        <button
                            key={t}
                            role="tab"
                            aria-selected={active}
                            onClick={() => setTab(t)}
                            className={`font-pulse text-sm tracking-[0.04em] capitalize rounded-lg px-4 py-2 cursor-pointer border ${
                                active
                                    ? 'bg-pulse-accent/10 text-pulse-accent border-pulse-accent/25 font-semibold'
                                    : 'bg-transparent text-pulse-dim border-pulse-border'
                            }`}>
                            {t}
                        </button>
                    );
                })}
            </div>

            {tab === 'exercises' ? <ExercisesTab /> : <RoutinesTab />}
        </div>
    );
}
