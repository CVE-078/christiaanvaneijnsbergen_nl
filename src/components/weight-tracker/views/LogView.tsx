import { WORKOUTS } from '@/lib/weight-tracker/data';
import { getRIR, rirColor } from '@/lib/weight-tracker/utils';
import WorkoutTabs from '../WorkoutTabs';
import ExerciseCard from '../ExerciseCard';
import type { Logs, LogEntry, WorkoutType } from '@/lib/weight-tracker/types';

interface Props {
  activeWeek: number;
  activeTab: WorkoutType;
  setActiveTab: (t: WorkoutType) => void;
  logs: Logs;
  updateLog: (key: string, entry: LogEntry) => void;
}

export default function LogView({ activeWeek, activeTab, setActiveTab, logs, updateLog }: Props) {
  const workout = WORKOUTS[activeTab];
  const rir = getRIR(activeWeek);
  const accent = rirColor(rir);

  return (
    <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
      <WorkoutTabs activeTab={activeTab} onSelect={setActiveTab} />

      {/* Week + RIR banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          margin: '1rem 0',
          padding: '0.75rem 1rem',
          background: '#1a1a1a',
          borderRadius: '10px',
        }}
      >
        <span style={{ color: '#666', fontSize: '0.875rem' }}>Week {activeWeek}</span>
        <span style={{ color: '#2a2a2a' }}>·</span>
        <span style={{ color: workout.color, fontSize: '0.875rem', fontWeight: 600 }}>
          {workout.description}
        </span>
        <div
          style={{
            marginLeft: 'auto',
            padding: '0.25rem 0.625rem',
            borderRadius: '20px',
            background: `${accent}22`,
            color: accent,
            fontSize: '0.75rem',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          RIR {rir}
        </div>
      </div>

      {/* Exercise cards */}
      {workout.exercises.map((exercise, i) => (
        <ExerciseCard
          key={i}
          exercise={exercise}
          exIdx={i}
          week={activeWeek}
          type={activeTab}
          color={workout.color}
          logs={logs}
          onSave={updateLog}
        />
      ))}
    </div>
  );
}
