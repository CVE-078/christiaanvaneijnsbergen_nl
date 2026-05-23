'use client';
import { WORKOUTS } from '@/lib/weight-tracker/data';
import type { WorkoutType } from '@/lib/weight-tracker/types';

interface Props {
  activeTab: WorkoutType;
  onSelect: (t: WorkoutType) => void;
}

export default function WorkoutTabs({ activeTab, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {(['push', 'pull', 'legs'] as WorkoutType[]).map(type => {
        const w = WORKOUTS[type];
        const active = activeTab === type;
        return (
          <button
            key={type}
            onClick={() => onSelect(type)}
            style={{
              flex: 1,
              padding: '0.625rem',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 700,
              background: active ? w.color : 'transparent',
              color: active ? '#000' : w.color,
              border: `2px solid ${w.color}`,
              transition: 'all 0.15s',
            }}
          >
            {w.icon} {w.label}
          </button>
        );
      })}
    </div>
  );
}
