'use client';
import { PHASES } from '@/lib/weight-tracker/data';

const MONO = "var(--pulse-mono, 'JetBrains Mono', 'Courier New', monospace)";
const ACCENT = '#ff6c2f';
const BORDER = '#1f1f1f';
const DIM = '#555';
const MUTED = '#3a3a3a';

interface Props {
  activeWeek: number;
  onSelect: (w: number) => void;
}

export default function WeekSelector({ activeWeek, onSelect }: Props) {
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
                    padding: '0.5rem',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontFamily: MONO,
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    background: active ? ACCENT : '#141414',
                    color: active ? '#000' : DIM,
                    border: `1px solid ${active ? ACCENT : BORDER}`,
                    transition: 'all 0.12s',
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
