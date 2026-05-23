'use client';
import type { WorkoutType } from '@/lib/weight-tracker/types';

const MONO = "var(--pulse-mono, 'JetBrains Mono', 'Courier New', monospace)";
const ACCENT = '#ff6c2f';
const BORDER = '#1f1f1f';

interface Props {
  activeTab: WorkoutType;
  onSelect: (t: WorkoutType) => void;
}

const TABS: { type: WorkoutType; label: string }[] = [
  { type: 'push', label: 'Push' },
  { type: 'pull', label: 'Pull' },
  { type: 'legs', label: 'Legs' },
];

export default function WorkoutTabs({ activeTab, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
      {TABS.map(({ type, label }) => {
        const active = activeTab === type;
        return (
          <button
            key={type}
            onClick={() => onSelect(type)}
            style={{
              flex: 1,
              padding: '0.875rem 0',
              textAlign: 'center',
              fontFamily: MONO,
              fontSize: '0.6875rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: active ? '#fff' : '#555',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`,
              marginBottom: '-1px',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
