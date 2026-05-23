'use client';
import { useState } from 'react';
import { logKey, parseMaxSets } from '@/lib/weight-tracker/utils';
import ProgressBar from './ProgressBar';
import SetLogger from './SetLogger';
import type { Exercise, Logs, LogEntry, WorkoutType } from '@/lib/weight-tracker/types';

interface Props {
  exercise: Exercise;
  exIdx: number;
  week: number;
  type: WorkoutType;
  color: string;
  logs: Logs;
  onSave: (key: string, entry: LogEntry) => void;
  onDelete: (key: string) => void;
}

export default function ExerciseCard({ exercise, exIdx, week, type, color, logs, onSave, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const maxSets = parseMaxSets(exercise.sets);
  const savedCount = Array.from({ length: maxSets }, (_, i) => logKey(week, type, exIdx, i)).filter(
    k => logs[k]?.saved,
  ).length;

  return (
    <div style={{ background: '#1a1a1a', borderRadius: '10px', overflow: 'hidden', marginBottom: '0.5rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${exercise.name}`}
        style={{
          width: '100%',
          padding: '0.875rem 1rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {exercise.name}
          </div>
          <div style={{ color: '#555', fontSize: '0.6875rem', marginTop: '0.125rem' }}>
            {exercise.sets} sets · {exercise.reps} reps
          </div>
        </div>
        <ProgressBar filled={savedCount} total={maxSets} color={color} />
        <span aria-hidden="true" style={{ color: '#444', fontSize: '0.75rem', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid #222' }}>
          <p style={{ color: '#555', fontSize: '0.75rem', margin: '0.75rem 0', lineHeight: 1.6 }}>
            {exercise.load} · {exercise.note}
          </p>
          {Array.from({ length: maxSets }, (_, i) => (
            <SetLogger
              key={i}
              exIdx={exIdx}
              setIdx={i}
              week={week}
              type={type}
              entry={logs[logKey(week, type, exIdx, i)]}
              onSave={entry => onSave(logKey(week, type, exIdx, i), entry)}
              onDelete={() => onDelete(logKey(week, type, exIdx, i))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
