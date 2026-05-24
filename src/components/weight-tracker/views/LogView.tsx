import { useMemo } from 'react';
import { WORKOUTS } from '@/lib/weight-tracker/data';
import { getPhase, getRIR, weekHasData, computePRMap } from '@/lib/weight-tracker/utils';
import { MONO, ACCENT, BORDER, DIM } from '@/lib/weight-tracker/theme';
import WorkoutTabs from '../WorkoutTabs';
import ExerciseCard from '../ExerciseCard';
import RestTimer from '../RestTimer';
import type { Logs, LogEntry, WorkoutType, Unit } from '@/lib/weight-tracker/types';

interface Props {
  activeWeek: number;
  onSelectWeek: (w: number) => void;
  activeTab: WorkoutType;
  setActiveTab: (t: WorkoutType) => void;
  logs: Logs;
  unit: Unit;
  updateLog: (key: string, entry: LogEntry) => void;
  deleteLog: (key: string) => void;
  timerTrigger: number;
}

export default function LogView({ activeWeek, onSelectWeek, activeTab, setActiveTab, logs, unit, updateLog, deleteLog, timerTrigger }: Props) {
  const workout = WORKOUTS[activeTab];
  const rir = getRIR(activeWeek);
  const phase = getPhase(activeWeek);
  // Computed once here — passed down to all ExerciseCards to avoid redundant work
  const prMap = useMemo(() => computePRMap(logs), [logs]);

  return (
    <div>
      <WorkoutTabs activeTab={activeTab} onSelect={setActiveTab} />
      <RestTimer trigger={timerTrigger} />

      {/* Week row */}
      <div style={{ display: 'flex', padding: '0 1rem', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: `1px solid ${BORDER}` }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(w => {
          const active = w === activeWeek;
          return (
            <button
              key={w}
              onClick={() => onSelectWeek(w)}
              style={{
                fontFamily: MONO,
                fontSize: '0.75rem',
                fontWeight: active ? 700 : 400,
                minWidth: '2.25rem',
                padding: '0.5rem 0 0.375rem',
                textAlign: 'center',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`,
                color: active ? ACCENT : DIM,
                cursor: 'pointer',
                flexShrink: 0,
                marginBottom: '-1px',
              }}
            >
              {w}
              <span style={{ display: 'block', width: 4, height: 4, borderRadius: '50%', background: weekHasData(w, logs) ? ACCENT : 'transparent', margin: '2px auto 0' }} />
            </button>
          );
        })}
      </div>

      {/* Context bar */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', padding: '0.875rem 1rem 0.5rem' }}>
        <span style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: DIM }}>
          {phase.label}
        </span>
        <span style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700, color: ACCENT, letterSpacing: '0.04em' }}>
          {rir} RIR
        </span>
        <span style={{ fontSize: '0.8125rem', color: DIM, marginLeft: 'auto' }}>
          {workout.description}
        </span>
      </div>

      {/* Exercise cards — keyed on activeTab+index so open state resets on tab switch */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        style={{ padding: '0.25rem 1rem 2rem', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
      >
        {workout.exercises.map((exercise, i) => (
          <ExerciseCard
            key={`${activeTab}-${i}`}
            exercise={exercise}
            exIdx={i}
            week={activeWeek}
            type={activeTab}
            logs={logs}
            prMap={prMap}
            unit={unit}
            onSave={updateLog}
            onDelete={deleteLog}
          />
        ))}
      </div>
    </div>
  );
}
