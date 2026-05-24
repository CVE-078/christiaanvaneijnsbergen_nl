'use client';
import { PHASES } from '@/lib/weight-tracker/data';
import { weekHasData } from '@/lib/weight-tracker/utils';
import { MONO, ACCENT, SURFACE, BORDER, DIM, MUTED } from '@/lib/weight-tracker/theme';
import type { Logs } from '@/lib/weight-tracker/types';

interface Props {
  activeWeek: number;
  onSelect: (w: number) => void;
  logs: Logs;
}

export default function WeekSelector({ activeWeek, onSelect, logs }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {PHASES.map(phase => (
        <div key={phase.label}>
          <div style={{ fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.5rem' }}>
            {phase.label} · {phase.subtitle}
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {phase.weeks.map(w => {
              const active = activeWeek === w;
              return (
                <button
                  key={w}
                  onClick={() => onSelect(w)}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.5rem 0.375rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontFamily: MONO,
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    background: active ? ACCENT : SURFACE,
                    color: active ? '#000' : DIM,
                    border: `1px solid ${active ? ACCENT : BORDER}`,
                    transition: 'all 0.12s',
                  }}
                >
                  {w}
                  <span style={{
                    display: 'block',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: weekHasData(w, logs) ? (active ? '#000' : ACCENT) : 'transparent',
                    margin: '2px auto 0',
                  }} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
