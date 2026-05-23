'use client';
import { useState, useTransition } from 'react';
import { getRIR } from '@/lib/weight-tracker/utils';
import type { LogEntry, WorkoutType } from '@/lib/weight-tracker/types';

const MONO = "var(--pulse-mono, 'JetBrains Mono', 'Courier New', monospace)";
const ACCENT = '#ff6c2f';
const BORDER = '#1f1f1f';
const DIM = '#555';
const MUTED = '#3a3a3a';

interface Props {
  exIdx: number;
  setIdx: number;
  week: number;
  type: WorkoutType;
  entry: LogEntry | undefined;
  previousEntry?: LogEntry;
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

export default function SetLogger({ setIdx, week, entry, previousEntry, onSave, onDelete }: Props) {
  const [kg, setKg] = useState(entry?.kg?.toString() ?? '');
  const [reps, setReps] = useState(entry?.reps?.toString() ?? '');
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const targetRIR = getRIR(week);
  const saved = entry?.saved ?? false;

  function handleSave() {
    const kgNum = parseFloat(kg);
    const repsNum = parseInt(reps, 10);
    if (!kgNum || kgNum <= 0 || kgNum > 500) return;
    if (!repsNum || repsNum < 1 || repsNum > 100) return;
    startTransition(() => {
      onSave({ kg: kgNum, reps: repsNum, rir: targetRIR, saved: true });
      setEditing(false);
    });
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
            <span style={{
              fontFamily: MONO,
              fontSize: '0.5625rem',
              color: '#444',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
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
              disabled={isPending}
              style={{
                fontFamily: MONO,
                fontSize: '0.625rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '0.25rem 0.625rem',
                background: 'transparent',
                border: `1px solid ${isPending ? BORDER : '#3a3a3a'}`,
                borderRadius: '3px',
                color: isPending ? DIM : '#aaa',
                cursor: isPending ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            >
              {isPending ? '…' : editing ? 'Update' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <>
          <span style={{ fontFamily: MONO, fontSize: '0.8125rem', color: '#d4d4d4' }}>
            {entry!.kg} kg × {entry!.reps}
          </span>
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
