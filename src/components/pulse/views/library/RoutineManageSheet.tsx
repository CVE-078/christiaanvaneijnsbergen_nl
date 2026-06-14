'use client';
import { useState } from 'react';
import ModalSheet from '@/components/pulse/ModalSheet';
import RoutineExerciseRow from './RoutineExerciseRow';
import AddRoutineExerciseForm from './AddRoutineExerciseForm';
import { reorderWithinSession } from '@/lib/pulse/library';
import { sessionTypeFor } from '@/lib/pulse/utils';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import type {
    DbExercise,
    RoutineExercise,
    RoutineWithExercises,
    Unit,
    WorkoutType,
    WorkoutVariant,
} from '@/lib/pulse/types';

interface SessionGroup {
    type: WorkoutType;
    variant: WorkoutVariant | null;
    items: RoutineExercise[];
}

// Group a routine's exercises into sessions by (sessionType, variant), mirroring
// the Plan/Train rollup: a full-body routine tags exercises push/pull/legs but
// rolls up to one Full Body session via sessionTypeFor. For an ad-hoc routine
// (no schedule) sessionTypeFor returns each exercise's own type, so the groups
// are the type buckets the user has added.
function groupSessions(routine: RoutineWithExercises): SessionGroup[] {
    const scheduleTypes = [...new Set(routine.schedule.map((s) => s.workout_type))];
    const sorted = [...routine.exercises].sort((a, b) => a.order - b.order);
    const byKey = new Map<string, number>();
    const groups: SessionGroup[] = [];
    for (const re of sorted) {
        const type = sessionTypeFor(re.workout_type, scheduleTypes);
        const variant = re.variant ?? null;
        const key = `${type}:${variant ?? ''}`;
        let gi = byKey.get(key);
        if (gi === undefined) {
            gi = groups.length;
            byKey.set(key, gi);
            groups.push({ type, variant, items: [] });
        }
        groups[gi].items.push(re);
    }
    return groups;
}

function sessionLabel(g: SessionGroup): string {
    const base = WORKOUT_TYPE_LABELS[g.type];
    return g.variant ? `${base} ${g.variant}` : base;
}

const ACTION_BTN =
    'flex-1 rounded-[10px] border border-pulse-border bg-transparent py-2.5 text-center font-pulse text-[0.8rem] font-medium text-pulse-text disabled:opacity-50';

export default function RoutineManageSheet({
    open,
    routine,
    isActive,
    exercises,
    unit,
    onClose,
    onSetActive,
    onRename,
    onDelete,
    onOpenSession,
    onReorder,
    onRemove,
    onUpdate,
    onAdd,
    onPair,
    onUnpair,
}: {
    open: boolean;
    routine: RoutineWithExercises;
    isActive: boolean;
    exercises: DbExercise[];
    unit: Unit;
    onClose: () => void;
    onSetActive: () => void;
    onRename: (name: string) => void;
    onDelete: () => void;
    onOpenSession: (group: { type: WorkoutType; variant: WorkoutVariant | null }) => void;
    onReorder: (orderedIds: string[]) => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, sets: string, reps: string, kg: number | null, rest: number | null) => void;
    onAdd: (exerciseId: string, sets: string, reps: string, kg: number | null, workoutType: WorkoutType) => void;
    onPair: (aId: string, bId: string) => void;
    onUnpair: (groupId: string) => void;
}) {
    const [renaming, setRenaming] = useState(false);
    const [nameInput, setNameInput] = useState(routine.name);

    const scheduled = routine.schedule.length > 0;
    const groups = groupSessions(routine);
    const allIds = [...routine.exercises].sort((a, b) => a.order - b.order).map((re) => re.id);

    function saveRename() {
        const n = nameInput.trim();
        setRenaming(false);
        if (n && n !== routine.name) onRename(n);
    }

    function confirmDelete() {
        if (window.confirm(`Delete routine "${routine.name}"? This cannot be undone.`)) onDelete();
    }

    // Within-group reorder for the ad-hoc inline editor: scope reorderWithinSession
    // to one type group's ids, splice back into the full order.
    const moveInGroup = (items: RoutineExercise[]) => (index: number, dir: -1 | 1) => {
        const groupIds = items.map((re) => re.id);
        const groupOf = (id: string) => items.find((re) => re.id === id)?.superset_group_id ?? null;
        onReorder(reorderWithinSession(allIds, groupIds, index, dir, groupOf));
    };

    function renderGroupRows(items: RoutineExercise[]) {
        const onMove = moveInGroup(items);
        return items.map((re, i) => {
            const isPaired = re.superset_group_id !== null;
            const pairIdx = isPaired
                ? items
                      .map((r, idx) => (r.superset_group_id === re.superset_group_id ? idx : -1))
                      .filter((x) => x !== -1)
                : null;
            const isFirstInPair = isPaired && i === (pairIdx?.[0] ?? i);
            const next = items[i + 1];
            const canPairWithNext = !isPaired && next !== undefined && next.superset_group_id === null;
            return (
                <RoutineExerciseRow
                    key={re.id}
                    re={re}
                    index={i}
                    displayNumber={i + 1}
                    total={items.length}
                    unit={unit}
                    onMove={onMove}
                    onRemove={onRemove}
                    onUpdate={onUpdate}
                    canMoveUp={i > 0}
                    canMoveDown={i < items.length - 1}
                    onPair={canPairWithNext ? () => onPair(re.id, next.id) : undefined}
                    onUnpair={isFirstInPair ? () => onUnpair(re.superset_group_id!) : undefined}
                />
            );
        });
    }

    const subtitle = scheduled
        ? `${groups.length} ${groups.length === 1 ? 'session' : 'sessions'}`
        : 'Ad-hoc · no fixed sessions';

    return (
        <ModalSheet open={open} onClose={onClose} title={routine.name} subtitle={subtitle}>
            <div className="flex flex-col gap-4 px-6">
                {/* Action row / inline rename */}
                {renaming ? (
                    <div className="flex gap-2">
                        <input
                            autoFocus
                            aria-label={`Rename ${routine.name}`}
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename();
                                if (e.key === 'Escape') setRenaming(false);
                            }}
                            className="flex-1 rounded-[10px] border border-pulse-border bg-pulse-bg px-3 py-2.5 font-pulse text-sm text-pulse-text outline-none focus:border-pulse-accent"
                        />
                        <button
                            type="button"
                            onClick={saveRename}
                            className="rounded-[10px] bg-pulse-accent px-4 font-pulse text-sm font-semibold text-pulse-bg">
                            Save
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onSetActive}
                            disabled={isActive}
                            className={
                                isActive
                                    ? 'flex-1 rounded-[10px] border border-transparent bg-pulse-accent/10 py-2.5 text-center font-pulse text-[0.8rem] font-medium text-pulse-accent'
                                    : 'flex-1 rounded-[10px] border border-transparent bg-pulse-accent py-2.5 text-center font-pulse text-[0.8rem] font-semibold text-pulse-bg'
                            }>
                            {isActive ? 'Active' : 'Set active'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setNameInput(routine.name);
                                setRenaming(true);
                            }}
                            aria-label={`Rename ${routine.name}`}
                            className={ACTION_BTN}>
                            Rename
                        </button>
                        <button
                            type="button"
                            onClick={confirmDelete}
                            aria-label={`Delete ${routine.name}`}
                            className="flex-1 rounded-[10px] border border-pulse-error/35 bg-transparent py-2.5 text-center font-pulse text-[0.8rem] font-medium text-pulse-error">
                            Delete
                        </button>
                    </div>
                )}

                {scheduled ? (
                    // Scheduled routine: a tappable session list (drill into the editor).
                    <div>
                        <p className="mb-2 font-pulse text-[0.6rem] uppercase tracking-[0.12em] text-pulse-muted">
                            Sessions
                        </p>
                        <div className="flex flex-col gap-1.5">
                            {groups.map((g) => (
                                <button
                                    key={`${g.type}:${g.variant ?? ''}`}
                                    type="button"
                                    onClick={() => onOpenSession({ type: g.type, variant: g.variant })}
                                    aria-label={`Edit ${sessionLabel(g)}`}
                                    className="flex items-center justify-between rounded-[10px] bg-pulse-surface-2 px-3 py-2.5 text-left">
                                    <span className="font-pulse text-[0.86rem] text-pulse-text">{sessionLabel(g)}</span>
                                    <span className="flex items-center gap-2 font-pulse text-[0.7rem] text-pulse-dim">
                                        {g.items.length} {g.items.length === 1 ? 'exercise' : 'exercises'}
                                        <svg
                                            width="13"
                                            height="13"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.6"
                                            className="text-pulse-muted"
                                            aria-hidden>
                                            <polyline
                                                points="6 3 11 8 6 13"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    // Ad-hoc routine: inline editor (rows grouped by type) + add form WITH the type picker.
                    <div className="flex flex-col gap-3">
                        {groups.length === 0 ? (
                            <p className="font-pulse text-[0.82rem] text-pulse-muted">
                                No exercises yet. Add your first one below.
                            </p>
                        ) : (
                            groups.map((g) => (
                                <div key={`${g.type}:${g.variant ?? ''}`} className="flex flex-col gap-1.5">
                                    <p className="font-pulse text-[0.6rem] uppercase tracking-[0.1em] text-pulse-muted">
                                        {sessionLabel(g)}
                                    </p>
                                    {renderGroupRows(g.items)}
                                </div>
                            ))
                        )}
                        <div>
                            <p className="mb-2 mt-1 font-pulse text-[0.6rem] uppercase tracking-[0.12em] text-pulse-muted">
                                Add exercise
                            </p>
                            <AddRoutineExerciseForm exercises={exercises} unit={unit} onAdd={onAdd} />
                        </div>
                    </div>
                )}
            </div>
        </ModalSheet>
    );
}
