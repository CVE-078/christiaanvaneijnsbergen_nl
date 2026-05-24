'use client';
import { useState } from 'react';
import { logKey, parseMaxSets, calcE1RM } from '@/lib/weight-tracker/utils';
import { MONO, ACCENT, SURFACE, BORDER, DIM, MUTED } from '@/lib/weight-tracker/theme';
import SetLogger from './SetLogger';
import type { Exercise, Logs, LogEntry, WorkoutType, Unit } from '@/lib/weight-tracker/types';

interface Props {
    exercise: Exercise;
    exIdx: number;
    week: number;
    type: WorkoutType;
    logs: Logs;
    prMap: Record<string, number>;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
}

export default function ExerciseCard({ exercise, exIdx, week, type, logs, prMap, unit, onSave, onDelete }: Props) {
    const [open, setOpen] = useState(false);
    const maxSets = parseMaxSets(exercise.sets);
    const savedCount = Array.from({ length: maxSets }, (_, i) => logKey(week, type, exIdx, i)).filter(
        (k) => logs[k]?.saved,
    ).length;
    const complete = savedCount >= maxSets;
    const bestE1RM = prMap[`${type}-${exIdx}`] ?? 0;

    return (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '4px', overflow: 'hidden' }}>
            <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${exercise.name}${complete ? ' — all sets done' : ''}`}
                style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    textAlign: 'left',
                }}>
                <span
                    style={{
                        fontFamily: MONO,
                        fontSize: '1.75rem',
                        fontWeight: 700,
                        color: '#222',
                        lineHeight: 1,
                        width: '2.25rem',
                        flexShrink: 0,
                        letterSpacing: '-0.04em',
                        userSelect: 'none',
                    }}>
                    {String(exIdx + 1).padStart(2, '0')}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.9375rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                        {exercise.name}
                    </div>
                    <div
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.625rem',
                            letterSpacing: '0.06em',
                            color: DIM,
                            marginTop: '0.25rem',
                            textTransform: 'uppercase',
                        }}>
                        {exercise.sets} sets · {exercise.reps} reps
                    </div>
                </div>
                <span style={{ fontFamily: MONO, fontSize: '0.875rem', letterSpacing: '0.05em', flexShrink: 0 }}>
                    {Array.from({ length: maxSets }, (_, i) => (
                        <span key={i} style={{ color: i < savedCount ? ACCENT : MUTED }}>
                            {i < savedCount ? '█' : '░'}
                        </span>
                    ))}
                </span>
                {complete && (
                    <span
                        aria-label="All sets done"
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.625rem',
                            color: ACCENT,
                            marginLeft: '0.375rem',
                            flexShrink: 0,
                        }}>
                        ✓
                    </span>
                )}
            </button>

            {open && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: '0.25rem 1rem 0.875rem' }}>
                    <p
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.6875rem',
                            color: DIM,
                            padding: '0.625rem 0 0.375rem',
                            lineHeight: 1.6,
                        }}>
                        {exercise.load} · {exercise.note}
                    </p>
                    {Array.from({ length: maxSets }, (_, i) => {
                        const entry = logs[logKey(week, type, exIdx, i)];
                        const isPR = !!(entry?.saved && bestE1RM > 0 && calcE1RM(entry.kg, entry.reps) >= bestE1RM);
                        // Only pass saved previous entries to avoid driving suggestions from unsaved drafts
                        const prevEntry = week > 1 ? logs[logKey(week - 1, type, exIdx, i)] : undefined;
                        return (
                            <SetLogger
                                key={`${week}-${i}`}
                                setIdx={i}
                                week={week}
                                type={type}
                                entry={entry}
                                previousEntry={prevEntry?.saved ? prevEntry : undefined}
                                isPR={isPR}
                                unit={unit}
                                onSave={(e) => onSave(logKey(week, type, exIdx, i), e)}
                                onDelete={() => onDelete(logKey(week, type, exIdx, i))}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
