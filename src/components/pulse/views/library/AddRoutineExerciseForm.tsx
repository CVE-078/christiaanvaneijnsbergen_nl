'use client';
import { useEffect, useState } from 'react';
import { toKg } from '@/lib/pulse/utils';
import { floatFavorites } from '@/lib/pulse/library';
import { defaultWorkoutType } from '@/lib/pulse/types';
import type { DbExercise, ExerciseCategory, Unit, WorkoutType } from '@/lib/pulse/types';
import { WORKOUT_TYPE_OPTIONS } from '@/lib/pulse/constants';
import { INPUT, BTN_PRIMARY } from '@/components/pulse/ui';
import { usePulse } from '@/context/PulseContext';

const SECTION_LABEL = 'font-pulse text-[0.625rem] tracking-[0.1em] uppercase text-pulse-muted';

export default function AddRoutineExerciseForm({
    exercises,
    unit,
    onAdd,
}: {
    exercises: DbExercise[];
    unit: Unit;
    onAdd: (
        exerciseId: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
        workoutType: WorkoutType,
    ) => void;
}) {
    const { favoriteExerciseIds } = usePulse();

    const [pickExerciseId, setPickExerciseId] = useState('');
    const [addSets, setAddSets] = useState('3');
    const [addReps, setAddReps] = useState('8-12');
    const [addWeight, setAddWeight] = useState('');
    const [addWorkoutType, setAddWorkoutType] = useState<WorkoutType>('push');

    const selectedEx = exercises.find((e) => e.id === pickExerciseId);
    const sortedExercises = floatFavorites(exercises, favoriteExerciseIds);
    useEffect(() => {
        if (selectedEx) {
            const suggested = defaultWorkoutType(selectedEx.category as ExerciseCategory);
            if (suggested) setAddWorkoutType(suggested);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickExerciseId]);

    function handleAddExercise() {
        if (!pickExerciseId) return;
        const trimmed = addWeight.trim();
        const raw = trimmed === '' ? NaN : parseFloat(trimmed);
        const kgValue = Number.isNaN(raw) ? null : toKg(raw, unit);
        onAdd(pickExerciseId, addSets, addReps, kgValue, addWorkoutType);
        setPickExerciseId('');
        setAddWeight('');
        setAddWorkoutType('push');
    }

    return (
        <div className="flex flex-col gap-2">
            <div className={SECTION_LABEL}>Add exercise</div>
            <select
                aria-label="Exercise"
                value={pickExerciseId}
                onChange={(e) => setPickExerciseId(e.target.value)}
                className={INPUT}>
                <option value="">Select an exercise…</option>
                {sortedExercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                        {ex.name}
                    </option>
                ))}
            </select>
            <select
                aria-label="Workout type"
                value={addWorkoutType}
                onChange={(e) => setAddWorkoutType(e.target.value as WorkoutType)}
                className={INPUT}>
                {WORKOUT_TYPE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                        {label}
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
                <button onClick={handleAddExercise} disabled={!pickExerciseId} className={BTN_PRIMARY}>
                    Add
                </button>
            </div>
        </div>
    );
}
