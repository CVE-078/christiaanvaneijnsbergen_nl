import { WORKOUTS, VOLUME, SCHEDULE, WEEK_NOTES } from '@/lib/weight-tracker/data';
import { getPhase } from '@/lib/weight-tracker/utils';
import WeekSelector from '../WeekSelector';

interface Props {
  activeWeek: number;
  onSelectWeek: (w: number) => void;
}

export default function ProgramView({ activeWeek, onSelectWeek }: Props) {
  const phase = getPhase(activeWeek);
  const maxSets = Math.max(...VOLUME.map(v => v.sets));

  return (
    <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
      <WeekSelector activeWeek={activeWeek} onSelect={onSelectWeek} />

      {/* Phase badge + week note */}
      <div
        style={{
          margin: '1.25rem 0',
          padding: '0.875rem 1rem',
          background: '#1a1a1a',
          borderRadius: '10px',
          borderLeft: `3px solid ${phase.color}`,
        }}
      >
        <div style={{ color: phase.color, fontWeight: 700, fontSize: '0.875rem' }}>
          {phase.label} — {phase.subtitle}
        </div>
        {WEEK_NOTES[activeWeek] && (
          <div style={{ color: '#999', fontSize: '0.8125rem', marginTop: '0.375rem', lineHeight: 1.6 }}>
            {WEEK_NOTES[activeWeek]}
          </div>
        )}
      </div>

      {/* Volume bar chart */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            color: '#555',
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.5rem',
          }}
        >
          Weekly Volume (sets)
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '54px' }}>
          {VOLUME.map(({ week, sets }) => {
            const ph = getPhase(week);
            return (
              <div
                key={week}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
              >
                <div
                  style={{
                    width: '100%',
                    background: activeWeek === week ? ph.color : '#222',
                    height: `${(sets / maxSets) * 44}px`,
                    borderRadius: '2px 2px 0 0',
                    transition: 'background 0.15s',
                  }}
                />
                <span style={{ color: '#444', fontSize: '0.5rem' }}>{week}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly schedule */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            color: '#555',
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.5rem',
          }}
        >
          Weekly Schedule
        </div>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {SCHEDULE.map(({ day, type }) => {
            const workout = type !== 'rest' ? WORKOUTS[type] : null;
            return (
              <div key={day} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ color: '#444', fontSize: '0.5625rem', marginBottom: '0.25rem' }}>{day}</div>
                <div
                  style={{
                    padding: '0.375rem 0',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: workout ? `${workout.color}22` : '#1a1a1a',
                    color: workout ? workout.color : '#2a2a2a',
                  }}
                >
                  {workout ? workout.icon : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exercise reference */}
      {(['push', 'pull', 'legs'] as const).map(type => {
        const workout = WORKOUTS[type];
        return (
          <div key={type} style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                color: workout.color,
                fontWeight: 700,
                fontSize: '0.875rem',
                marginBottom: '0.625rem',
              }}
            >
              {workout.icon} {workout.label} — {workout.description}
            </div>
            {workout.exercises.map((ex, i) => (
              <div
                key={i}
                style={{ padding: '0.5rem 0', borderBottom: '1px solid #1a1a1a' }}
              >
                <div style={{ color: '#ccc', fontSize: '0.875rem' }}>{ex.name}</div>
                <div style={{ color: '#555', fontSize: '0.75rem', marginTop: '0.125rem' }}>
                  {ex.sets} sets · {ex.reps} reps · {ex.load}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
