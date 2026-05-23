'use client';
import { useMemo } from 'react';
import { buildHistory, computePRMap, calcE1RM } from '@/lib/weight-tracker/utils';
import { WORKOUTS } from '@/lib/weight-tracker/data';
import type { Logs } from '@/lib/weight-tracker/types';

const MONO = "var(--pulse-mono, 'JetBrains Mono', 'Courier New', monospace)";
const ACCENT = '#ff6c2f';
const SURFACE = '#141414';
const BORDER = '#1f1f1f';
const DIM = '#555';
const MUTED = '#3a3a3a';

interface Props {
  logs: Logs;
}

export default function HistoryView({ logs }: Props) {
  const sessions = useMemo(() => buildHistory(logs), [logs]);
  const prMap = useMemo(() => computePRMap(logs), [logs]);

  if (sessions.length === 0) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.75rem' }}>
          No sessions yet
        </div>
        <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: '#333', letterSpacing: '0.04em' }}>
          Head to Log to get started.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {sessions.map((session, si) => {
        const workout = WORKOUTS[session.type];
        return (
          <div key={si} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, color: ACCENT }}>
                {workout.label}
              </span>
              <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: DIM, letterSpacing: '0.04em' }}>
                Week {session.week}
              </span>
              <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: MUTED, marginLeft: 'auto' }}>
                {session.sets.length} sets
              </span>
            </div>
            <div style={{ padding: '0.5rem 1rem 0.75rem' }}>
              {session.sets.map((set, i) => {
                const exercise = workout.exercises[set.exIdx];
                const exKey = `${session.type}-${set.exIdx}`;
                const bestE1RM = prMap[exKey] ?? 0;
                const isPR = bestE1RM > 0 && calcE1RM(set.kg, set.reps) >= bestE1RM;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.25rem 0',
                      borderBottom: i < session.sets.length - 1 ? '1px solid #111' : 'none',
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: MUTED, width: '1.25rem', flexShrink: 0 }}>
                      {String(set.setIdx + 1).padStart(2, '0')}
                    </span>
                    <span style={{ color: DIM, fontSize: '0.75rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exercise?.name ?? `Exercise ${set.exIdx + 1}`}
                    </span>
                    <span style={{ fontFamily: MONO, color: '#fff', fontWeight: 600, fontSize: '0.75rem', flexShrink: 0 }}>
                      {set.kg} kg × {set.reps}
                    </span>
                    {isPR && (
                      <span style={{
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
                    <span style={{ fontFamily: MONO, color: MUTED, fontSize: '0.625rem', flexShrink: 0 }}>
                      {set.rir} RIR
                    </span>
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
