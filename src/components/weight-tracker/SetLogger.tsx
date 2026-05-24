'use client';
import { useState } from 'react';
import { getRIR, computeSuggestion } from '@/lib/weight-tracker/utils';
import { MONO, ACCENT, BORDER, DIM, MUTED } from '@/lib/weight-tracker/theme';
import type { LogEntry, WorkoutType } from '@/lib/weight-tracker/types';

interface Props {
  setIdx: number;
  week: number;
  type: WorkoutType;
  entry: LogEntry | undefined;
  previousEntry?: LogEntry;
  isPR?: boolean;
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

export default function SetLogger({ setIdx, week, entry, previousEntry, isPR, onSave, onDelete }: Props) {
  const suggestion = computeSuggestion(previousEntry, week);
  const [kg, setKg] = useState(entry?.kg?.toString() ?? (suggestion !== null ? String(suggestion) : ''));
  const [reps, setReps] = useState(entry?.reps?.toString() ?? '');
  const [editing, setEditing] = useState(false);
  const targetRIR = getRIR(week);
  const saved = entry?.saved ?? false;

  function handleSave() {
    const kgNum = parseFloat(kg);
    const repsNum = parseInt(reps, 10);
    if (isNaN(kgNum) || kgNum <= 0 || kgNum > 500) return;
    if (!repsNum || repsNum < 1 || repsNum > 100) return;
    onSave({ kg: kgNum, reps: repsNum, rir: targetRIR, saved: true });
    setEditing(false);
  }

  function handleEdit() {
    setKg(entry?.kg?.toString() ?? '');
    setReps(entry?.reps?.toString() ?? '');
    setEditing(true);
  }

  function handleCancel() {
    setKg(entry?.kg?.toString() ?? '');
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
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: MUTED, width: '1.5rem', flexShrink: 0 }}>
        {String(setIdx + 1).padStart(2, '0')}
      </span>

      {showInputs ? (
        <>
          <input
            type="number"
            aria-label="Weight in kilograms"
            placeholder="kg"
            value={kg}
            min={0.5}
            max={500}
            step={0.5}
            onChange={e => setKg(e.target.value)}
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
            onChange={e => setReps(e.target.value)}
            style={inputStyle}
          />
          <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: DIM, flexShrink: 0 }}>{targetRIR} RIR</span>
          {previousEntry && (
            <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: '#444', letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ↑ {previousEntry.kg} kg × {previousEntry.reps}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.375rem' }}>
            {editing && (
              <button
                onClick={handleCancel}
                style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: DIM, background: 'none', border: `1px solid ${BORDER}`, borderRadius: '3px', padding: '0.25rem 0.5rem', cursor: 'pointer', flexShrink: 0 }}
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.25rem 0.625rem', background: 'transparent', border: `1px solid #3a3a3a`, borderRadius: '3px', color: '#aaa', cursor: 'pointer', flexShrink: 0 }}
            >
              {editing ? 'Update' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <>
          <span style={{ fontFamily: MONO, fontSize: '0.8125rem', color: '#d4d4d4' }}>
            {entry!.kg} kg × {entry!.reps}
          </span>
          {isPR && (
            <span style={{ fontFamily: MONO, fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT, background: `${ACCENT}18`, border: `1px solid ${ACCENT}44`, borderRadius: '2px', padding: '0.1rem 0.3rem', flexShrink: 0 }}>
              PR
            </span>
          )}
          <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: DIM }}>{entry!.rir} RIR</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontFamily: MONO, fontSize: '0.75rem', color: ACCENT }}>✓</span>
            <button
              onClick={handleEdit}
              style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: DIM, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Edit
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                style={{ fontFamily: MONO, fontSize: '0.625rem', color: '#444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
