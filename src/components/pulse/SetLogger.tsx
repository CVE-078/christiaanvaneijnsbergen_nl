'use client';
import { useEffect, useState } from 'react';
import { getRIR, computeSuggestion, toDisplay, toKg, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
import type { LogEntry, WorkoutType, Unit } from '@/lib/pulse/types';

interface Props {
    setIdx: number;
    week: number;
    type: WorkoutType;
    entry: LogEntry | undefined;
    previousEntry?: LogEntry;
    isPR?: boolean;
    unit: Unit;
    onSave: (entry: LogEntry) => void;
    onDelete?: () => void;
}

const inputClass =
    'w-[3.75rem] h-10 px-2 bg-pulse-surface border border-pulse-border rounded-lg text-white font-pulse text-base font-semibold text-center outline-none focus:border-pulse-accent/50 transition-colors';

export default function SetLogger({ setIdx, week, entry, previousEntry, isPR, unit, onSave, onDelete }: Props) {
    const suggestion = computeSuggestion(previousEntry, week);

    function initKg() {
        if (entry?.kg !== undefined) return String(toDisplay(entry.kg, unit));
        if (suggestion !== null) return String(toDisplay(suggestion, unit));
        return '';
    }

    const [kg, setKg] = useState(initKg);
    const [reps, setReps] = useState(entry?.reps?.toString() ?? '');
    const [editing, setEditing] = useState(false);
    const [inputError, setInputError] = useState<string | null>(null);
    const targetRIR = getRIR(week);
    const saved = entry?.saved ?? false;

    // Intentionally only [unit]: re-syncs display value when unit changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!saved || editing) {
            const base = entry?.kg ?? (suggestion !== null ? suggestion : null);
            if (base !== null) setKg(String(toDisplay(base, unit)));
        }
    }, [unit]);

    const displayMin = toDisplay(MIN_KG, unit);
    const displayMax = toDisplay(MAX_KG, unit);
    const displayStep = unit === 'lbs' ? 1 : 0.5;

    function handleSave() {
        const displayNum = parseFloat(kg);
        if (isNaN(displayNum) || displayNum <= 0) {
            setInputError('Enter a valid weight');
            return;
        }
        const kgNum = toKg(displayNum, unit);
        if (kgNum <= 0 || kgNum > MAX_KG) {
            setInputError(`Max ${toDisplay(MAX_KG, unit)} ${unit}`);
            return;
        }
        const repsNum = parseInt(reps, 10);
        if (!repsNum || repsNum < 1 || repsNum > 100) {
            setInputError('Enter valid reps (1–100)');
            return;
        }
        setInputError(null);
        onSave({ kg: kgNum, reps: repsNum, rir: targetRIR, saved: true });
        setEditing(false);
    }

    function handleEdit() {
        setKg(entry?.kg !== undefined ? String(toDisplay(entry.kg, unit)) : '');
        setReps(entry?.reps?.toString() ?? '');
        setEditing(true);
        setInputError(null);
    }

    function handleCancel() {
        setKg(entry?.kg !== undefined ? String(toDisplay(entry.kg, unit)) : '');
        setReps(entry?.reps?.toString() ?? '');
        setEditing(false);
        setInputError(null);
    }

    const showInputs = !saved || editing;

    return (
        <div
            className={`flex items-center gap-2 py-[0.4375rem] border-b border-pulse-border ${saved && !editing ? 'bg-pulse-accent/5' : ''}`}>
            <span className="font-pulse text-[0.8125rem] text-pulse-muted w-6 shrink-0">
                {String(setIdx + 1).padStart(2, '0')}
            </span>

            {showInputs ? (
                <>
                    <div className="flex-1 min-w-0 flex flex-col gap-[0.25rem]">
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                aria-label={`Weight in ${unit}`}
                                placeholder={unit}
                                value={kg}
                                min={displayMin}
                                max={displayMax}
                                step={displayStep}
                                onChange={(e) => { setKg(e.target.value); setInputError(null); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                                className={inputClass}
                            />
                            <span className="font-pulse text-pulse-muted text-sm">×</span>
                            <input
                                type="number"
                                aria-label="Repetitions"
                                placeholder="reps"
                                value={reps}
                                min={1}
                                max={100}
                                onChange={(e) => { setReps(e.target.value); setInputError(null); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                                className={inputClass}
                            />
                            <span className="font-pulse text-[0.8125rem] text-pulse-dim shrink-0">{targetRIR} RIR</span>
                        </div>
                        {previousEntry && (
                            <span className="font-pulse text-[0.75rem] text-pulse-dim tracking-[0.04em]">
                                → {toDisplay(previousEntry.kg, unit)} {unit} × {previousEntry.reps}
                            </span>
                        )}
                        {inputError && (
                            <span className="font-pulse text-[0.6875rem] text-[#f43f5e]">{inputError}</span>
                        )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                        {editing && (
                            <button
                                onClick={handleCancel}
                                className="font-pulse text-[0.75rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border border-pulse-border rounded-sm py-1 px-2 cursor-pointer shrink-0">
                                Cancel
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            className="font-pulse text-[0.75rem] tracking-[0.06em] uppercase h-10 px-4 bg-pulse-accent border-none rounded-[6px] text-white cursor-pointer shrink-0 transition-opacity duration-100">
                            {editing ? 'Update' : 'Save'}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <span className="font-pulse text-[0.9375rem] text-pulse-text">
                        {toDisplay(entry!.kg, unit)} {unit} × {entry!.reps}
                    </span>
                    {isPR && (
                        <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-[2px] py-[0.1rem] px-[0.3rem] shrink-0">
                            PR
                        </span>
                    )}
                    <span className="font-pulse text-[0.8125rem] text-pulse-dim">{entry!.rir} RIR</span>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="font-pulse text-sm text-pulse-accent">✓</span>
                        <button
                            onClick={handleEdit}
                            className="font-pulse text-[0.75rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border-none cursor-pointer p-0">
                            Edit
                        </button>
                        {onDelete && (
                            <button
                                onClick={onDelete}
                                className="font-pulse text-[0.75rem] text-pulse-dim bg-transparent border-none cursor-pointer p-0">
                                ✕
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
