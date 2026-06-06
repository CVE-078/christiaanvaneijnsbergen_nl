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
        // Grouping conveyed by a tone shift (surface-2 tray) + whitespace, not a border.
        <div className="bg-pulse-surface-2 rounded-2xl overflow-hidden">
            {/* Header, always visible, shows exercise names in collapsed state */}
            <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? 'Collapse superset' : 'Expand superset'}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-transparent border-none cursor-pointer text-left">
                <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase font-semibold text-pulse-dim shrink-0">
                    Superset
                </span>
                <span className="font-pulse text-sm text-pulse-text flex-1 truncate">
                    <span>{first.exercise.name}</span>
                    <span className="text-pulse-dim"> + </span>
                    <span>{second.exercise.name}</span>
                </span>
                <svg
                    className={`w-4 h-4 text-pulse-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {/* Expanded body, two cards separated by whitespace */}
            {open && (
                <div className="flex flex-col gap-2 px-2 pb-2">
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
                </div>
            )}
        </div>
    );
}
