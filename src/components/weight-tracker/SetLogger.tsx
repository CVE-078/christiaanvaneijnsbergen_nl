'use client';
import { useEffect, useState } from 'react';
import { getRIR, computeSuggestion, toDisplay, toKg, MIN_KG, MAX_KG } from '@/lib/weight-tracker/utils';
import { MONO, ACCENT, BORDER, DIM, MUTED } from '@/lib/weight-tracker/theme';
import type { LogEntry, WorkoutType, Unit } from '@/lib/weight-tracker/types';

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

const inputStyle = {
    width: '3.75rem',
    padding: '0.375rem 0.5rem',
    background: '#0a0a0a',
    border: `1px solid #1f1f1f`,
    borderRadius: '3px',
    color: '#fff',
    fontFamily: MONO,
    fontSize: '0.8125rem',
    textAlign: 'center' as const,
    outline: 'none',
};

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
    const targetRIR = getRIR(week);
    const saved = entry?.saved ?? false;

    // Sync display value when unit changes while input is visible
    useEffect(() => {
        if (!saved || editing) {
            const base = entry?.kg ?? (suggestion !== null ? suggestion : null);
            if (base !== null) setKg(String(toDisplay(base, unit)));
        }
        // Intentionally only [unit]: re-syncs display value when unit changes.
        // entry and suggestion are captured at mount; they don't change independently.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unit]);

    const displayMin = toDisplay(MIN_KG, unit);
    const displayMax = toDisplay(MAX_KG, unit);
    const displayStep = unit === 'lbs' ? 1 : 0.5;

    function handleSave() {
        const displayNum = parseFloat(kg);
        const repsNum = parseInt(reps, 10);
        if (isNaN(displayNum) || displayNum <= 0) return;
        const kgNum = toKg(displayNum, unit);
        if (kgNum <= 0 || kgNum > MAX_KG) return;
        if (!repsNum || repsNum < 1 || repsNum > 100) return;
        onSave({ kg: kgNum, reps: repsNum, rir: targetRIR, saved: true });
        setEditing(false);
    }

    function handleEdit() {
        setKg(entry?.kg !== undefined ? String(toDisplay(entry.kg, unit)) : '');
        setReps(entry?.reps?.toString() ?? '');
        setEditing(true);
    }

    function handleCancel() {
        setKg(entry?.kg !== undefined ? String(toDisplay(entry.kg, unit)) : '');
        setReps(entry?.reps?.toString() ?? '');
        setEditing(false);
    }

    const showInputs = !saved || editing;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4375rem 0',
                borderBottom: '1px solid #111',
                opacity: saved && !editing ? 0.55 : 1,
            }}>
            <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: MUTED, width: '1.5rem', flexShrink: 0 }}>
                {String(setIdx + 1).padStart(2, '0')}
            </span>

            {showInputs ? (
                <>
                    <input
                        type="number"
                        aria-label={`Weight in ${unit}`}
                        placeholder={unit}
                        value={kg}
                        min={displayMin}
                        max={displayMax}
                        step={displayStep}
                        onChange={(e) => setKg(e.target.value)}
                        style={inputStyle}
                    />
                    <span style={{ fontFamily: MONO, color: MUTED, fontSize: '0.75rem' }}>×</span>
                    <input
                        type="number"
                        aria-label="Repetitions"
                        placeholder="reps"
                        value={reps}
                        min={1}
                        max={100}
                        onChange={(e) => setReps(e.target.value)}
                        style={inputStyle}
                    />
                    <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: DIM, flexShrink: 0 }}>
                        {targetRIR} RIR
                    </span>
                    {previousEntry && (
                        <span
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.5625rem',
                                color: '#444',
                                letterSpacing: '0.04em',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                            }}>
                            ↑ {toDisplay(previousEntry.kg, unit)} {unit} × {previousEntry.reps}
                        </span>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.375rem' }}>
                        {editing && (
                            <button
                                onClick={handleCancel}
                                style={{
                                    fontFamily: MONO,
                                    fontSize: '0.625rem',
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    color: DIM,
                                    background: 'none',
                                    border: `1px solid ${BORDER}`,
                                    borderRadius: '3px',
                                    padding: '0.25rem 0.5rem',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                }}>
                                Cancel
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.625rem',
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                padding: '0.25rem 0.625rem',
                                background: 'transparent',
                                border: `1px solid #3a3a3a`,
                                borderRadius: '3px',
                                color: '#aaa',
                                cursor: 'pointer',
                                flexShrink: 0,
                            }}>
                            {editing ? 'Update' : 'Save'}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <span style={{ fontFamily: MONO, fontSize: '0.8125rem', color: '#d4d4d4' }}>
                        {toDisplay(entry!.kg, unit)} {unit} × {entry!.reps}
                    </span>
                    {isPR && (
                        <span
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.5rem',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: ACCENT,
                                background: `${ACCENT}18`,
                                border: `1px solid ${ACCENT}44`,
                                borderRadius: '2px',
                                padding: '0.1rem 0.3rem',
                                flexShrink: 0,
                            }}>
                            PR
                        </span>
                    )}
                    <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: DIM }}>{entry!.rir} RIR</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: MONO, fontSize: '0.75rem', color: ACCENT }}>✓</span>
                        <button
                            onClick={handleEdit}
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.625rem',
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                color: DIM,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                            }}>
                            Edit
                        </button>
                        {onDelete && (
                            <button
                                onClick={onDelete}
                                style={{
                                    fontFamily: MONO,
                                    fontSize: '0.625rem',
                                    color: '#444',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                }}>
                                ✕
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
