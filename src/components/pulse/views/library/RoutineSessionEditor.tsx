'use client';
import ModalSheet from '@/components/pulse/ModalSheet';
import RoutineExerciseRow from './RoutineExerciseRow';
import AddRoutineExerciseForm from './AddRoutineExerciseForm';
import { reorderWithinSession } from '@/lib/pulse/library';
import type { DbExercise, RoutineExercise, Unit, WorkoutType } from '@/lib/pulse/types';

export default function RoutineSessionEditor({
    open,
    onClose,
    onBack,
    title,
    subtitle,
    sessionExercises,
    allExerciseIds,
    type,
    exercises,
    unit,
    onReorder,
    onRemove,
    onUpdate,
    onAdd,
    onPair,
    onUnpair,
}: {
    open: boolean;
    onClose: () => void;
    onBack: () => void;
    title: string;
    subtitle?: string;
    sessionExercises: RoutineExercise[]; // this session's rows, in order
    allExerciseIds: string[]; // full routine order (for reorderWithinSession)
    type: WorkoutType;
    exercises: DbExercise[];
    unit: Unit;
    onReorder: (orderedIds: string[]) => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, sets: string, reps: string, kg: number | null, rest: number | null) => void;
    onAdd: (exerciseId: string, sets: string, reps: string, kg: number | null, workoutType: WorkoutType) => void;
    onPair: (aId: string, bId: string) => void;
    onUnpair: (groupId: string) => void;
}) {
    const sessionIds = sessionExercises.map((re) => re.id);
    const groupOf = (id: string) => sessionExercises.find((re) => re.id === id)?.superset_group_id ?? null;

    const handleMove = (index: number, dir: -1 | 1) => {
        onReorder(reorderWithinSession(allExerciseIds, sessionIds, index, dir, groupOf));
    };

    return (
        <ModalSheet open={open} onClose={onClose} onBack={onBack} title={title} subtitle={subtitle}>
            <div className="flex flex-col gap-2 px-6">
                {sessionExercises.map((re, i) => {
                    const isPaired = re.superset_group_id !== null;
                    const pairIdx = isPaired
                        ? sessionExercises
                              .map((r, idx) => (r.superset_group_id === re.superset_group_id ? idx : -1))
                              .filter((x) => x !== -1)
                        : null;
                    const isFirstInPair = isPaired && i === (pairIdx?.[0] ?? i);
                    const next = sessionExercises[i + 1];
                    const canPairWithNext = !isPaired && next !== undefined && next.superset_group_id === null;
                    return (
                        <RoutineExerciseRow
                            key={re.id}
                            re={re}
                            index={i}
                            displayNumber={i + 1}
                            total={sessionExercises.length}
                            unit={unit}
                            onMove={handleMove}
                            onRemove={onRemove}
                            onUpdate={onUpdate}
                            canMoveUp={i > 0}
                            canMoveDown={i < sessionExercises.length - 1}
                            onPair={canPairWithNext ? () => onPair(re.id, next.id) : undefined}
                            onUnpair={isFirstInPair ? () => onUnpair(re.superset_group_id!) : undefined}
                        />
                    );
                })}
                <p className="mt-3 font-pulse text-[0.6rem] uppercase tracking-[0.12em] text-pulse-muted">
                    Add to this session
                </p>
                <AddRoutineExerciseForm exercises={exercises} unit={unit} onAdd={onAdd} fixedType={type} />
            </div>
        </ModalSheet>
    );
}
