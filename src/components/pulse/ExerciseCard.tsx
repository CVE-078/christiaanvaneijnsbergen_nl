'use client';
import { memo, useState } from 'react';
import {
    logKey,
    parseMaxSets,
    isSetPR,
    toDisplay,
    computeLastSession,
    computeSuggestion,
    computeWarmupSets,
} from '@/lib/pulse/utils';
import { useToast } from '@/lib/pulse/toast';
import SetLogger from './SetLogger';
import ExerciseInstructionModal from './ExerciseInstructionModal';
import type { Logs, LogEntry, Unit, LastSession, DbExercise } from '@/lib/pulse/types';
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
    // Optional precomputed last session. When omitted (e.g. SupersetCard), it is
    // computed from `logs` here. Callers rendering many cards pass it to avoid
    // each card scanning the whole log set.
    lastSession?: LastSession | null;
    // Display exercise for the active week (may differ from re.exercise when a
    // swap is active). Defaults to re.exercise. Swap controls render only when
    // onSwap is provided.
    displayExercise?: DbExercise;
    isSwapped?: boolean;
    originalName?: string;
    onSwap?: () => void;
    onRevert?: () => void;
}

function ExerciseCard({
    routineExercise: re,
    week,
    logs,
    prMap,
    unit,
    onSave,
    onDelete,
    note,
    onSaveNote,
    onDeleteNote,
    lastSession: lastSessionProp,
    displayExercise,
    isSwapped = false,
    originalName,
    onSwap,
    onRevert,
}: Props) {
    const { show: showToast } = useToast();
    const display = displayExercise ?? re.exercise;
    const [open, setOpen] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [noteEditing, setNoteEditing] = useState(false);
    const [noteDraft, setNoteDraft] = useState('');
    const maxSets = parseMaxSets(re.sets);

    // Wrap the save so a newly qualifying PR fires a quiet success toast.
    // Guard on the save transition: skip when the stored entry was already a
    // saved PR, so re-saving or editing an existing PR stays silent.
    function handleSetSave(key: string, entry: LogEntry) {
        const prev = logs[key];
        const wasPR = !!(prev?.saved && isSetPR(prev.kg, prev.reps, re.id, prMap));
        const isNowPR = isSetPR(entry.kg, entry.reps, re.id, prMap);
        if (isNowPR && !wasPR) {
            showToast(`New PR on ${display.name}`, 'success');
        }
        onSave(key, entry);
    }
    const savedCount = Array.from({ length: maxSets }, (_, i) => logKey(week, re.id, i)).filter(
        (k) => logs[k]?.saved,
    ).length;
    const complete = savedCount >= maxSets;
    const lastSession = lastSessionProp !== undefined ? lastSessionProp : computeLastSession(logs, re.id, week);
    const prevKey0 = logKey(week - 1, re.id, 0);
    const prevEntry0 = week > 1 ? logs[prevKey0] : undefined;
    const workingWeightKg =
        computeSuggestion(prevEntry0?.saved ? prevEntry0 : undefined, week) ?? re.starting_weight_kg ?? null;
    const warmupSets = workingWeightKg !== null ? computeWarmupSets(workingWeightKg, unit) : [];

    return (
        <>
            <div className="rounded-2xl overflow-hidden bg-pulse-surface transition-colors duration-150">
                <button
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    aria-label={`${open ? 'Collapse' : 'Expand'} ${display.name}${complete ? ' — all sets done' : ''}`}
                    className="w-full py-4 px-[1.125rem] bg-transparent border-none cursor-pointer flex items-center gap-3.5 text-left">
                    <div className="flex-1 min-w-0">
                        <div className="font-pulse text-[1.1875rem] font-medium tracking-[-0.01em] truncate text-pulse-text">
                            {display.name}
                        </div>
                        <div className="font-pulse text-[0.78125rem] tracking-[0.03em] text-pulse-muted mt-1">
                            {re.sets} × {re.reps} reps
                            {re.starting_weight_kg !== null && (
                                <>
                                    {' '}
                                    · {toDisplay(re.starting_weight_kg, unit)} {unit} start
                                </>
                            )}
                        </div>
                        {lastSession && (
                            <div className="font-pulse text-[0.8125rem] text-pulse-dim mt-1">
                                Last: {toDisplay(lastSession.kg, unit)} {unit} × {lastSession.reps} ×{' '}
                                {lastSession.setCount} sets
                            </div>
                        )}
                    </div>
                    {/* Progress count + pips */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="font-pulse text-[0.8125rem] font-semibold">
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
                                            i < savedCount ? 'var(--color-pulse-accent)' : 'var(--color-pulse-muted)',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    {complete && (
                        <span
                            aria-label="All sets done"
                            className="font-pulse text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-pulse-accent shrink-0">
                            Done
                        </span>
                    )}
                    <svg
                        className={`w-3.5 h-3.5 text-pulse-muted shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
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
                    <div className="px-[1.125rem] pt-1 pb-4 flex flex-col gap-2.5">
                        {display.user_id === null && (
                            <button
                                onClick={() => setShowInstructions(true)}
                                aria-label={`How to perform ${display.name}`}
                                className="self-start flex items-center gap-1.5 font-pulse text-[0.8125rem] text-pulse-dim bg-transparent border-none cursor-pointer hover:text-pulse-accent">
                                <svg
                                    className="w-3.5 h-3.5"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                    aria-hidden>
                                    <circle cx="8" cy="8" r="6.5" />
                                    <line x1="8" y1="7" x2="8" y2="11" strokeLinecap="round" />
                                    <circle cx="8" cy="4.75" r="0.6" fill="currentColor" stroke="none" />
                                </svg>
                                How to perform
                            </button>
                        )}
                        {onSwap && (
                            <div className="self-start flex items-center gap-3">
                                <button
                                    onClick={onSwap}
                                    className="flex items-center gap-1.5 font-pulse text-[0.8125rem] text-pulse-dim bg-transparent border-none cursor-pointer hover:text-pulse-accent">
                                    ⇄ Swap exercise
                                </button>
                                {isSwapped && (
                                    <span className="font-pulse text-[0.75rem] text-pulse-muted">
                                        Swapped from {originalName}
                                        {onRevert && (
                                            <button
                                                onClick={onRevert}
                                                className="ml-1.5 text-pulse-accent bg-transparent border-none cursor-pointer">
                                                Revert
                                            </button>
                                        )}
                                    </span>
                                )}
                            </div>
                        )}
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
                            const isPR = !!(entry?.saved && isSetPR(entry.kg, entry.reps, re.id, prMap));
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
                                    repsRange={re.reps}
                                    isPR={isPR}
                                    unit={unit}
                                    onSave={(e) => handleSetSave(key, e)}
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
                                            onClick={() => {
                                                setNoteDraft(note);
                                                setNoteEditing(true);
                                            }}
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
                                    onClick={() => {
                                        setNoteDraft('');
                                        setNoteEditing(true);
                                    }}
                                    className="w-full text-left font-pulse text-[0.8125rem] text-pulse-dim border border-dashed border-pulse-border rounded-lg px-3 py-2 cursor-pointer bg-transparent tracking-[0.02em]">
                                    + Add note
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {showInstructions && (
                <ExerciseInstructionModal
                    exerciseId={display.id}
                    exerciseName={display.name}
                    onClose={() => setShowInstructions(false)}
                />
            )}
        </>
    );
}

export default memo(ExerciseCard);
