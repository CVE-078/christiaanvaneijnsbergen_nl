'use client';
import { useState, useTransition } from 'react';
import { usePulse } from '@/context/PulseContext';
import { EXERCISE_CATEGORIES } from '@/lib/pulse/types';
import type { DbExercise, ExerciseCategory } from '@/lib/pulse/types';
import { INPUT, BTN_PRIMARY, BTN_GHOST, CARD } from '@/components/pulse/ui';
import CategoryBadge from './CategoryBadge';

const SECTION_LABEL = 'font-pulse text-[0.625rem] tracking-[0.1em] uppercase text-pulse-muted';

export default function ExercisesTab() {
    const { exercises, createExercise, updateExercise, deleteExercise } = usePulse();
    const [, startTransition] = useTransition();

    const [filter, setFilter] = useState<'all' | ExerciseCategory>('all');
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState<ExerciseCategory>('chest');
    const [newDefaultSets, setNewDefaultSets] = useState('3');
    const [newDefaultReps, setNewDefaultReps] = useState('8-12');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDefaultSets, setEditDefaultSets] = useState('');
    const [editDefaultReps, setEditDefaultReps] = useState('');

    const filtered = exercises.filter((ex) => filter === 'all' || ex.category === filter);

    function handleAdd() {
        const name = newName.trim();
        const sets = newDefaultSets.trim();
        const reps = newDefaultReps.trim();
        if (!name || !sets || !reps) return;
        startTransition(async () => {
            await createExercise(name, newCategory, sets, reps);
            setNewName('');
            setNewCategory('chest');
            setNewDefaultSets('3');
            setNewDefaultReps('8-12');
            setAdding(false);
        });
    }

    function startEdit(ex: DbExercise) {
        setEditingId(ex.id);
        setEditName(ex.name);
        setEditDefaultSets(ex.default_sets);
        setEditDefaultReps(ex.default_reps);
    }

    function handleEditSave(id: string) {
        const name = editName.trim();
        if (!name) return;
        startTransition(async () => {
            await updateExercise(id, name, editDefaultSets.trim() || '3', editDefaultReps.trim() || '8-12');
            setEditingId(null);
        });
    }

    function handleDelete(id: string, name: string) {
        if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
        startTransition(async () => {
            await deleteExercise(id);
        });
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Filter row */}
            <div className="flex flex-wrap gap-2">
                {(['all', ...EXERCISE_CATEGORIES] as const).map((f) => {
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
                        {EXERCISE_CATEGORIES.map((c) => (
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
                                    <div className="flex-1 flex flex-col gap-2">
                                        <input
                                            autoFocus
                                            aria-label={`Rename ${ex.name}`}
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleEditSave(ex.id);
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                            className={`${INPUT} w-full`}
                                        />
                                        <div className="flex gap-2">
                                            <label className="flex flex-col gap-0.5 flex-1">
                                                <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-muted">
                                                    Default sets
                                                </span>
                                                <input
                                                    aria-label="Default sets"
                                                    value={editDefaultSets}
                                                    onChange={(e) => setEditDefaultSets(e.target.value)}
                                                    className={INPUT}
                                                />
                                            </label>
                                            <label className="flex flex-col gap-0.5 flex-1">
                                                <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-muted">
                                                    Default reps
                                                </span>
                                                <input
                                                    aria-label="Default reps"
                                                    value={editDefaultReps}
                                                    onChange={(e) => setEditDefaultReps(e.target.value)}
                                                    className={INPUT}
                                                />
                                            </label>
                                        </div>
                                        <div className="flex gap-2">
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
                                        </div>
                                    </div>
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
                                                    aria-label={`Edit ${ex.name}`}
                                                    className="font-pulse text-xs text-pulse-dim bg-transparent border-none cursor-pointer shrink-0">
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(ex.id, ex.name)}
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
