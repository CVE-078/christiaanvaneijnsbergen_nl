'use client';
import { useState } from 'react';
import ModalSheet from '@/components/pulse/ModalSheet';
import { parseRepRange, composeRepRange } from '@/lib/pulse/library';
import { EXERCISE_CATEGORIES, EQUIPMENT_KEYS, MOVEMENT_PATTERNS } from '@/lib/pulse/types';
import type { DbExercise, ExerciseCategory, EquipmentKey, MovementPattern } from '@/lib/pulse/types';

// Human-readable labels for the MovementPattern enum values.
export const PATTERN_LABELS: Record<MovementPattern, string> = {
    horizontal_push: 'Horizontal push (bench / push-up)',
    vertical_push: 'Vertical push (overhead press)',
    horizontal_pull: 'Horizontal pull (row)',
    vertical_pull: 'Vertical pull (pulldown / pull-up)',
    squat: 'Squat',
    hinge: 'Hip hinge (deadlift / RDL)',
    lunge: 'Lunge / single-leg',
    calf: 'Calf raise',
    core: 'Core / abs',
    chest_iso: 'Chest isolation (fly)',
    back_iso: 'Back isolation (pullover / rear delt)',
    shoulder_iso: 'Shoulder isolation (lateral raise)',
    biceps_iso: 'Biceps isolation',
    triceps_iso: 'Triceps isolation',
    glute_iso: 'Glute isolation',
};

// Human-readable labels for EquipmentKey values (title-case, matching the mockup).
const EQUIPMENT_LABELS: Record<EquipmentKey, string> = {
    barbell: 'Barbell',
    dumbbells: 'Dumbbell',
    bench: 'Bench',
    cables: 'Cable',
    machines: 'Machine',
    pull_up_bar: 'Pull-up bar',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface ExerciseFormSheetProps {
    mode: 'add' | 'edit';
    initial?: DbExercise;
    open: boolean;
    onClose: () => void;
    onSubmit: (input: {
        name: string;
        category: ExerciseCategory;
        defaultSets: string;
        defaultReps: string;
        meta: { movement_pattern: string | null; equipment: string[] | null; is_compound: boolean | null } | null;
    }) => Promise<void>;
    onDelete?: (ex: DbExercise) => void;
}

export default function ExerciseFormSheet({ mode, initial, open, onClose, onSubmit, onDelete }: ExerciseFormSheetProps) {
    // Determine initial toggle state: ON if initial has a movement_pattern set.
    const initialToggleOn = mode === 'edit' && initial != null && (initial.movement_pattern ?? null) !== null;

    // Parse reps for initial state.
    const initialRepRange = parseRepRange(initial?.default_reps ?? '');
    const hasFreeform = initialRepRange.freeform !== null && initialRepRange.freeform !== '';

    const [name, setName] = useState(initial?.name ?? '');
    const [category, setCategory] = useState<ExerciseCategory>(initial?.category ?? 'other');
    const [defaultSets, setDefaultSets] = useState(initial?.default_sets ?? '3');
    // Reps state: when freeform, use a single field; otherwise use from/to.
    const [repsFrom, setRepsFrom] = useState(initialRepRange.from);
    const [repsTo, setRepsTo] = useState(initialRepRange.to);
    const [repsFreeform, setRepsFreeform] = useState(initialRepRange.freeform ?? '');
    const [isFreeformReps] = useState(hasFreeform);

    // Generation metadata toggle.
    const [genOn, setGenOn] = useState(initialToggleOn);
    const [movementPattern, setMovementPattern] = useState<MovementPattern | ''>(
        (initial?.movement_pattern as MovementPattern | null | undefined) ?? '',
    );
    const [equipment, setEquipment] = useState<EquipmentKey[]>(
        (initial?.equipment as EquipmentKey[] | undefined) ?? [],
    );
    // is_compound: null = not chosen yet. Default to true (Compound) when toggle is turned on.
    const [isCompound, setIsCompound] = useState<boolean | null>(
        initialToggleOn ? (initial?.is_compound ?? null) : null,
    );

    const [submitting, setSubmitting] = useState(false);

    function toggleEquipment(key: EquipmentKey) {
        setEquipment((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    }

    function handleToggleGen() {
        const next = !genOn;
        setGenOn(next);
        // When turning on for the first time, default Compound to true.
        if (next && isCompound === null) {
            setIsCompound(true);
        }
    }

    async function handleSubmit() {
        const composedReps = isFreeformReps
            ? composeRepRange({ from: '', to: '', freeform: repsFreeform })
            : composeRepRange({ from: repsFrom, to: repsTo, freeform: null });

        // Category-change confirmation in edit mode.
        if (mode === 'edit' && initial && category !== initial.category) {
            const ok = window.confirm(
                'Changing the category rewrites this exercise\'s past volume in Progress. Continue?',
            );
            if (!ok) return;
        }

        const meta = genOn
            ? {
                  movement_pattern: movementPattern || null,
                  equipment: equipment.length > 0 ? equipment : null,
                  is_compound: isCompound,
              }
            : null;

        setSubmitting(true);
        try {
            await onSubmit({
                name: name.trim(),
                category,
                defaultSets: defaultSets.trim(),
                defaultReps: composedReps,
                meta,
            });
        } finally {
            setSubmitting(false);
        }
    }

    const title = mode === 'add' ? 'New exercise' : 'Edit exercise';
    const saveLabel = mode === 'add' ? 'Add exercise' : 'Save';

    return (
        <ModalSheet open={open} onClose={onClose} title={title}>
            <div className="flex-1 overflow-y-auto px-6">
                {/* Name */}
                <div className="mt-1 mb-4">
                    <label htmlFor="exf-name" className="mb-1.5 block font-pulse-body text-[0.62rem] uppercase tracking-widest text-pulse-muted">
                        Name
                    </label>
                    <input
                        id="exf-name"
                        aria-label="Name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Hack Squat"
                        className="w-full rounded-[9px] border border-pulse-border bg-pulse-surface-2 px-3 py-2.5 font-pulse text-[0.86rem] text-pulse-text placeholder:text-pulse-muted focus:outline-none"
                    />
                </div>

                {/* Category */}
                <div className="mb-4">
                    <label htmlFor="exf-category" className="mb-1.5 block font-pulse-body text-[0.62rem] uppercase tracking-widest text-pulse-muted">
                        Category
                    </label>
                    <select
                        id="exf-category"
                        aria-label="Category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
                        className="w-full rounded-[9px] border border-pulse-border bg-pulse-surface-2 px-3 py-2.5 font-pulse text-[0.86rem] text-pulse-text focus:outline-none">
                        {EXERCISE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                                {cap(cat)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Default sets + reps */}
                <div className="mb-4 flex gap-3">
                    <div className="flex-1">
                        <label htmlFor="exf-sets" className="mb-1.5 block font-pulse-body text-[0.62rem] uppercase tracking-widest text-pulse-muted">
                            Default sets
                        </label>
                        <input
                            id="exf-sets"
                            aria-label="Default sets"
                            type="text"
                            inputMode="numeric"
                            value={defaultSets}
                            onChange={(e) => setDefaultSets(e.target.value)}
                            className="w-full rounded-[9px] border border-pulse-border bg-pulse-surface-2 px-3 py-2.5 font-pulse text-[0.86rem] text-pulse-text focus:outline-none"
                        />
                    </div>
                    <div className="flex-1">
                        <p className="mb-1.5 font-pulse-body text-[0.62rem] uppercase tracking-widest text-pulse-muted">
                            Default reps
                        </p>
                        {isFreeformReps ? (
                            // Freeform fallback: one field for non-conforming values (e.g. "AMRAP").
                            <input
                                id="exf-reps"
                                aria-label="Reps"
                                type="text"
                                value={repsFreeform}
                                onChange={(e) => setRepsFreeform(e.target.value)}
                                className="w-full rounded-[9px] border border-pulse-border bg-pulse-surface-2 px-3 py-2.5 font-pulse text-[0.86rem] text-pulse-text focus:outline-none"
                            />
                        ) : (
                            // Normal two-field from/to.
                            <div className="flex items-center gap-2">
                                <input
                                    id="exf-reps-from"
                                    aria-label="Reps from"
                                    type="text"
                                    inputMode="numeric"
                                    value={repsFrom}
                                    onChange={(e) => setRepsFrom(e.target.value)}
                                    placeholder="8"
                                    className="w-full rounded-[9px] border border-pulse-border bg-pulse-surface-2 px-3 py-2.5 text-center font-pulse text-[0.86rem] text-pulse-text focus:outline-none"
                                />
                                <span className="shrink-0 font-pulse-body text-[0.78rem] text-pulse-muted">to</span>
                                <input
                                    id="exf-reps-to"
                                    aria-label="Reps to"
                                    type="text"
                                    inputMode="numeric"
                                    value={repsTo}
                                    onChange={(e) => setRepsTo(e.target.value)}
                                    placeholder="12"
                                    className="w-full rounded-[9px] border border-pulse-border bg-pulse-surface-2 px-3 py-2.5 text-center font-pulse text-[0.86rem] text-pulse-text focus:outline-none"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Generation toggle */}
                <button
                    type="button"
                    role="switch"
                    aria-checked={genOn}
                    aria-label="Use in auto-generated routines"
                    onClick={handleToggleGen}
                    className="mt-1 mb-2 flex w-full cursor-pointer items-start justify-between gap-3 rounded-[11px] border border-pulse-border bg-pulse-surface-2 px-3 py-3 text-left">
                    <div>
                        <p className="font-pulse text-[0.86rem] font-medium text-pulse-text">Use in auto-generated routines</p>
                        <p className="mt-0.5 font-pulse-body text-[0.73rem] leading-[1.4] text-pulse-dim">
                            Tell the generator how this lift moves so it can program it for you. Off = logging only, add it to routines yourself.
                        </p>
                    </div>
                    {/* Toggle track */}
                    <span
                        aria-hidden
                        className={`mt-0.5 flex h-[23px] w-[40px] shrink-0 items-center rounded-full transition-colors ${genOn ? 'bg-pulse-accent' : 'bg-pulse-border'}`}>
                        <span
                            className={`ml-[2px] h-[19px] w-[19px] rounded-full bg-white shadow transition-transform ${genOn ? 'translate-x-[17px]' : 'translate-x-0'}`}
                        />
                    </span>
                </button>

                {/* Generation metadata section (revealed when toggle is ON) */}
                {genOn && (
                    <div className="mb-4 rounded-[11px] border border-pulse-accent/25 bg-pulse-accent/[0.04] px-3 py-3">
                        {/* Movement pattern */}
                        <div className="mb-3">
                            <label htmlFor="exf-pattern" className="mb-1.5 block font-pulse-body text-[0.62rem] uppercase tracking-widest text-pulse-muted">
                                Movement pattern
                            </label>
                            <select
                                id="exf-pattern"
                                aria-label="Movement pattern"
                                value={movementPattern}
                                onChange={(e) => setMovementPattern(e.target.value as MovementPattern | '')}
                                className="w-full rounded-[9px] border border-pulse-border bg-pulse-surface-2 px-3 py-2.5 font-pulse text-[0.86rem] text-pulse-text focus:outline-none">
                                <option value="">Select a pattern...</option>
                                {MOVEMENT_PATTERNS.map((p) => (
                                    <option key={p} value={p}>
                                        {PATTERN_LABELS[p]}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Equipment multi-select chips */}
                        <div className="mb-3">
                            <p className="mb-1.5 font-pulse-body text-[0.62rem] uppercase tracking-widest text-pulse-muted">
                                Equipment <span className="normal-case tracking-normal text-pulse-dim">· pick all that apply</span>
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {EQUIPMENT_KEYS.map((key) => {
                                    const active = equipment.includes(key);
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => toggleEquipment(key)}
                                            className={`rounded-[8px] border px-[11px] py-[6px] font-pulse text-[0.76rem] transition-colors ${
                                                active
                                                    ? 'border-pulse-accent/40 bg-pulse-accent/10 text-pulse-accent'
                                                    : 'border-pulse-border text-pulse-dim hover:border-pulse-muted'
                                            }`}>
                                            {EQUIPMENT_LABELS[key]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Compound / Isolation */}
                        <div>
                            <p className="mb-1.5 font-pulse-body text-[0.62rem] uppercase tracking-widest text-pulse-muted">Type</p>
                            <div className="flex gap-1 rounded-[9px] border border-pulse-border bg-pulse-surface-2 p-[3px]">
                                {(['Compound', 'Isolation'] as const).map((label) => {
                                    const val = label === 'Compound';
                                    const active = isCompound === val;
                                    return (
                                        <button
                                            key={label}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            aria-label={label}
                                            onClick={() => setIsCompound(val)}
                                            className={`flex-1 rounded-[7px] py-[7px] text-center font-pulse text-[0.8rem] transition-colors ${
                                                active
                                                    ? 'bg-pulse-accent font-medium text-white'
                                                    : 'text-pulse-dim'
                                            }`}>
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete (edit mode + onDelete provided) */}
                {mode === 'edit' && onDelete && initial && (
                    <div className="mb-4 mt-2">
                        <button
                            type="button"
                            aria-label="Delete exercise"
                            onClick={() => onDelete(initial)}
                            className="w-full rounded-[10px] border border-red-500/35 bg-transparent py-[10px] text-center font-pulse text-[0.82rem] text-red-400 transition-colors hover:border-red-500/60 hover:text-red-300">
                            Delete exercise
                        </button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex gap-2.5 px-6 pt-3 pb-2">
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    aria-label={saveLabel}
                    className="flex-1 rounded-[10px] bg-pulse-accent py-[11px] text-center font-pulse text-[0.88rem] font-semibold text-white disabled:opacity-60">
                    {saveLabel}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cancel"
                    className="rounded-[10px] border border-pulse-border px-[18px] py-[11px] text-center font-pulse text-[0.88rem] text-pulse-dim hover:text-pulse-text">
                    Cancel
                </button>
            </div>
        </ModalSheet>
    );
}
