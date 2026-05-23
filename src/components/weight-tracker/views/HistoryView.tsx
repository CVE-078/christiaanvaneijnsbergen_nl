'use client';
import { useMemo } from 'react';
import { buildHistory } from '@/lib/weight-tracker/utils';
import { WORKOUTS } from '@/lib/weight-tracker/data';
import type { Logs } from '@/lib/weight-tracker/types';

interface Props {
  logs: Logs;
}

export default function HistoryView({ logs }: Props) {
  const sessions = useMemo(() => buildHistory(logs), [logs]);

  if (sessions.length === 0) {
    return (
      <div
        style={{
          padding: '4rem 1rem',
          textAlign: 'center',
          color: '#444',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>—</div>
        <div style={{ fontSize: '0.9375rem' }}>No logged sets yet.</div>
        <div style={{ fontSize: '0.8125rem', marginTop: '0.375rem', color: '#333' }}>
          Head to Log to get started.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
      {sessions.map((session, si) => {
        const workout = WORKOUTS[session.type];
        return (
          <div
            key={si}
            style={{ marginBottom: '1rem', background: '#1a1a1a', borderRadius: '10px', overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid #222',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <span style={{ color: workout.color, fontWeight: 700, fontSize: '0.9375rem' }}>
                {workout.icon} {workout.label}
              </span>
              <span style={{ color: '#555', fontSize: '0.8125rem' }}>Week {session.week}</span>
              <span style={{ color: '#333', fontSize: '0.75rem', marginLeft: 'auto' }}>
                {session.sets.length} sets
              </span>
            </div>
            <div style={{ padding: '0.625rem 1rem 0.75rem' }}>
              {session.sets.map((set, i) => {
                const exercise = workout.exercises[set.exIdx];
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.25rem 0',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <span style={{ color: '#444', width: '1.5rem', flexShrink: 0 }}>#{set.setIdx + 1}</span>
                    <span style={{ color: '#999', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exercise?.name ?? `Exercise ${set.exIdx + 1}`}
                    </span>
                    <span style={{ color: '#fff', fontWeight: 600, flexShrink: 0 }}>
                      {set.kg}kg × {set.reps}
                    </span>
                    <span style={{ color: '#444', flexShrink: 0 }}>@{set.rir}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
