'use client';
import { useState } from 'react';
import { logKey, parseMaxSets, calcE1RM, toDisplay, computeLastSession, computeSuggestion, computeWarmupSets } from '@/lib/pulse/utils';
import SetLogger from './SetLogger';
import type { Logs, LogEntry, Unit } from '@/lib/pulse/types';
import type { RoutineExercise } from '@/lib/pulse/types';

interface Props {
    routineExercise: RoutineExercise;
    exIdx: number;
    week: number;
    logs: Logs;
    prMap: Record<string, number>;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
    note?: string;
    onSaveNote: (note: string) => Promise<void>;
    onDeleteNote: () => Promise<void>;
}

export default function ExerciseCard({ routineExercise: re, exIdx, week, logs, prMap, unit, onSave, onDelete, note, onSaveNote, onDeleteNote }: Props) {
    const [open, setOpen] = useState(false);
    const [noteEditing, setNoteEditing] = useState(false);
    const [noteDraft, setNoteDraft] = useState('');
    const maxSets = parseMaxSets(re.sets);
    const savedCount = Array.from({ length: maxSets }, (_, i) => logKey(week, re.id, i)).filter(
        (k) => logs[k]?.saved,
    ).length;
    const complete = savedCount >= maxSets;
    const bestE1RM = prMap[re.id] ?? 0;
    const lastSession = computeLastSession(logs, re.id, week);
    const prevKey0 = logKey(week - 1, re.id, 0);
    const prevEntry0 = week > 1 ? logs[prevKey0] : undefined;
    const workingWeightKg =
        computeSuggestion(prevEntry0?.saved ? prevEntry0 : undefined, week) ??
        re.starting_weight_kg ??
        null;
    const warmupSets = workingWeightKg !== null ? computeWarmupSets(workingWeightKg, unit) : [];

    return (
        <div
            className={`rounded-2xl overflow-hidden border transition-colors duration-150 ${
                complete ? 'border-pulse-accent/25 bg-pulse-surface' : 'border-pulse-border bg-pulse-surface'
            }`}>
            <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${re.exercise.name}${complete ? ' — all sets done' : ''}`}
                className="w-full py-3.5 px-4 bg-transparent border-none cursor-pointer flex items-center gap-3 text-left">
                {/* Small index chip */}
                <span
                    className={`font-pulse text-[0.6875rem] font-bold w-6 h-6 rounded-md flex items-center justify-center shrink-0 select-none ${
                        complete ? 'bg-pulse-accent/15 text-pulse-accent' : 'bg-pulse-surface-2 text-pulse-dim'
                    }`}>
                    {exIdx + 1}
                </span>
                <div className="flex-1 min-w-0">
                    <div className={`font-pulse text-[0.9375rem] font-semibold truncate ${complete ? 'text-pulse-text' : 'text-white'}`}>
                        {re.exercise.name}
                    </div>
                    <div className="font-pulse text-xs text-pulse-dim mt-0.5">
                        {re.sets} sets · {re.reps} reps
                        {re.starting_weight_kg !== null && (
                            <> · {toDisplay(re.starting_weight_kg, unit)} {unit} start</>
                        )}
                    </div>
                    {lastSession && (
                        <div className="font-pulse text-xs text-pulse-dim mt-0.5">
                            Last: {toDisplay(lastSession.kg, unit)} {unit} × {lastSession.reps} × {lastSession.setCount} sets
                        </div>
                    )}
                </div>
                {/* Progress pips + count */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-pulse text-xs font-semibold">
                        <span className="text-pulse-text">{savedCount}</span>
                        <span className="text-pulse-muted">/{maxSets}</span>
                    </span>
                    <div className="flex gap-[3px]">
                        {Array.from({ length: maxSets }, (_, i) => (
                            <span
                                key={i}
                                className="block w-[5px] h-[5px] rounded-sm transition-colors duration-200"
                                style={{
                                    background:
                                        i < savedCount
                                            ? 'var(--color-pulse-accent)'
                                            : 'var(--color-pulse-muted)',
                                }}
                            />
                        ))}
                    </div>
                </div>
                {complete && (
                    <span aria-label="All sets done" className="font-pulse text-xs text-pulse-accent shrink-0">
                        ✓
                    </span>
                )}
                <svg
                    className={`w-3.5 h-3.5 text-pulse-dim shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden>
                    <polyline points="6,3 11,8 6,13" />
                </svg>
            </button>

            {open && (
                <div className="border-t border-pulse-border px-4 pt-1 pb-4">
                    {warmupSets.length > 0 && (
                        <div className="pb-3 border-b border-pulse-border mb-1">
                            <div className="font-pulse text-[0.625rem] tracking-[0.1em] uppercase text-pulse-muted mb-1.5">
                                Warm-up
                            </div>
                            {warmupSets.map(({ percent, displayWeight, reps }) => (
                                <div key={percent} className="flex items-center gap-2 py-[0.3rem]">
                                    <span className="font-pulse text-[0.6875rem] text-pulse-muted w-8 shrink-0">
                                        {percent}%
                                    </span>
                                    <span className="font-pulse text-[0.8125rem] text-pulse-dim">
                                        {displayWeight} {unit} × {reps}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    {Array.from({ length: maxSets }, (_, i) => {
                        const key = logKey(week, re.id, i);
                        const entry = logs[key];
                        const isPR = !!(entry?.saved && bestE1RM > 0 && calcE1RM(entry.kg, entry.reps) >= bestE1RM);
                        const prevKey = logKey(week - 1, re.id, i);
                        const prevEntry = week > 1 ? logs[prevKey] : undefined;
                        return (
                            <SetLogger
                                key={`${week}-${i}`}
                                setIdx={i}
                                week={week}
                                type="push"
                                entry={entry}
                                previousEntry={prevEntry?.saved ? prevEntry : undefined}
                                isPR={isPR}
                                unit={unit}
                                onSave={(e) => onSave(key, e)}
                                onDelete={() => onDelete(key)}
                            />
                        );
                    })}
                    <div className="border-t border-pulse-border pt-3 mt-1">
                        {noteEditing ? (
                            <textarea
                                autoFocus
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                onBlur={async () => {
                                    setNoteEditing(false);
                                    const trimmed = noteDraft.trim();
                                    if (trimmed) {
                                        await onSaveNote(trimmed);
                                    } else {
                                        await onDeleteNote();
                                    }
                                }}
                                placeholder="Add a note for this exercise…"
                                maxLength={500}
                                className="w-full bg-pulse-bg border border-pulse-border rounded-lg text-pulse-text font-pulse text-[0.8125rem] px-3 py-2 resize-none min-h-[60px] outline-none focus:border-pulse-accent/50"
                            />
                        ) : note ? (
                            <div>
                                <p className="font-pulse text-[0.8125rem] text-pulse-dim leading-relaxed">{note}</p>
                                <div className="flex gap-3 mt-1 justify-end">
                                    <button
                                        onClick={() => { setNoteDraft(note); setNoteEditing(true); }}
                                        className="font-pulse text-[0.6875rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border-none cursor-pointer">
                                        Edit
                                    </button>
                                    <button
                                        onClick={onDeleteNote}
                                        className="font-pulse text-[0.6875rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border-none cursor-pointer">
                                        Clear
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setNoteDraft(''); setNoteEditing(true); }}
                                className="w-full text-left font-pulse text-[0.8125rem] text-pulse-dim border border-dashed border-pulse-border rounded-lg px-3 py-2 cursor-pointer bg-transparent tracking-[0.02em]">
                                + Add note
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
