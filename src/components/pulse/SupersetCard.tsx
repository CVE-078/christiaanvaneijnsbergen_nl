'use client';
import { useState } from 'react';
import ExerciseCard from './ExerciseCard';
import type { RoutineExercise, Logs, LogEntry, Unit, Notes } from '@/lib/pulse/types';

interface Props {
    pair: [RoutineExercise, RoutineExercise];
    pairIdx: number;
    week: number;
    logs: Logs;
    prMap: Record<string, number>;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
    notes: Notes;
    onSaveNote: (routineExerciseId: string, note: string) => Promise<void>;
    onDeleteNote: (routineExerciseId: string) => Promise<void>;
}

export default function SupersetCard({
    pair,
    pairIdx,
    week,
    logs,
    prMap,
    unit,
    onSave,
    onDelete,
    notes,
    onSaveNote,
    onDeleteNote,
}: Props) {
    const [open, setOpen] = useState(false);
    const [first, second] = pair;

    return (
        <div className="border border-pulse-accent/35 rounded-xl overflow-hidden bg-pulse-surface">
            {/* Header — always visible, shows exercise names in collapsed state */}
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-pulse-accent/10 border-b border-pulse-accent/20 cursor-pointer text-left">
                <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase font-bold text-pulse-accent shrink-0">
                    ⚡ Superset
                </span>
                <span className="font-pulse text-sm text-pulse-text flex-1 truncate">
                    <span>{first.exercise.name}</span>
                    <span className="text-pulse-dim"> + </span>
                    <span>{second.exercise.name}</span>
                </span>
                <span className="font-pulse text-xs text-pulse-dim shrink-0">{open ? '▲' : '▼'}</span>
            </button>

            {/* Expanded body */}
            {open && (
                <>
                    <ExerciseCard
                        routineExercise={first}
                        exIdx={pairIdx}
                        week={week}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={onSave}
                        onDelete={onDelete}
                        note={notes[`${week}-${first.id}`]}
                        onSaveNote={(n) => onSaveNote(first.id, n)}
                        onDeleteNote={() => onDeleteNote(first.id)}
                    />
                    <div className="h-px bg-pulse-border mx-4" />
                    <ExerciseCard
                        routineExercise={second}
                        exIdx={pairIdx + 1}
                        week={week}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={onSave}
                        onDelete={onDelete}
                        note={notes[`${week}-${second.id}`]}
                        onSaveNote={(n) => onSaveNote(second.id, n)}
                        onDeleteNote={() => onDeleteNote(second.id)}
                    />
                </>
            )}
        </div>
    );
}
