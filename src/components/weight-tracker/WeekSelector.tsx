'use client';
import { PHASES } from '@/lib/weight-tracker/data';

interface Props {
  activeWeek: number;
  onSelect: (w: number) => void;
}

export default function WeekSelector({ activeWeek, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {PHASES.map(phase => (
        <div key={phase.label}>
          <div
            style={{
              color: '#555',
              fontSize: '0.6875rem',
              marginBottom: '0.25rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
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
                    padding: '0.5rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    background: active ? phase.color : '#1a1a1a',
                    color: active ? '#000' : '#777',
                    border: `2px solid ${active ? phase.color : '#2a2a2a'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {w}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
