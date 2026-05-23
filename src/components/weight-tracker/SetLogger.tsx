'use client';
import { useState, useTransition } from 'react';
import { getRIR } from '@/lib/weight-tracker/utils';
import type { LogEntry, WorkoutType } from '@/lib/weight-tracker/types';

interface Props {
  exIdx: number;
  setIdx: number;
  week: number;
  type: WorkoutType;
  entry: LogEntry | undefined;
  onSave: (entry: LogEntry) => void;
}

export default function SetLogger({ setIdx, week, entry, onSave }: Props) {
  const [kg, setKg] = useState(entry?.kg?.toString() ?? '');
  const [reps, setReps] = useState(entry?.reps?.toString() ?? '');
  const [isPending, startTransition] = useTransition();
  const targetRIR = getRIR(week);
  const saved = entry?.saved ?? false;

  function handleSave() {
    const kgNum = parseFloat(kg);
    const repsNum = parseInt(reps);
    if (!kgNum || kgNum <= 0 || kgNum > 500) return;
    if (!repsNum || repsNum < 1 || repsNum > 100) return;
    startTransition(() => {
      onSave({ kg: kgNum, reps: repsNum, rir: targetRIR, saved: true });
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0',
        opacity: saved ? 0.55 : 1,
      }}
    >
      <span style={{ color: '#555', fontSize: '0.75rem', width: '2rem', flexShrink: 0 }}>
        #{setIdx + 1}
      </span>
      <input
        type="number"
        aria-label="Weight in kilograms"
        placeholder="kg"
        value={kg}
        min={0.5}
        max={500}
        step={0.5}
        onChange={e => setKg(e.target.value)}
        style={{
          width: '4rem',
          padding: '0.375rem',
          background: '#111',
          border: '1px solid #2a2a2a',
          borderRadius: '6px',
          color: '#fff',
          fontSize: '0.875rem',
          textAlign: 'center',
        }}
      />
      <span style={{ color: '#444' }}>×</span>
      <input
        type="number"
        aria-label="Repetitions"
        placeholder="reps"
        value={reps}
        min={1}
        max={100}
        onChange={e => setReps(e.target.value)}
        style={{
          width: '4rem',
          padding: '0.375rem',
          background: '#111',
          border: '1px solid #2a2a2a',
          borderRadius: '6px',
          color: '#fff',
          fontSize: '0.875rem',
          textAlign: 'center',
        }}
      />
      <span style={{ color: '#444', fontSize: '0.75rem', flexShrink: 0 }}>@RIR {targetRIR}</span>
      {saved ? (
        <span style={{ color: '#4ade80', fontSize: '0.9rem', marginLeft: 'auto' }}>✓</span>
      ) : (
        <button
          onClick={handleSave}
          disabled={isPending}
          style={{
            marginLeft: 'auto',
            padding: '0.375rem 0.75rem',
            background: '#222',
            border: '1px solid #3a3a3a',
            borderRadius: '6px',
            color: isPending ? '#555' : '#ccc',
            fontSize: '0.75rem',
            cursor: isPending ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          {isPending ? '…' : 'Save'}
        </button>
      )}
    </div>
  );
}
