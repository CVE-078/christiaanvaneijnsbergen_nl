import { WORKOUTS, VOLUME, SCHEDULE, WEEK_NOTES } from '@/lib/pulse/data';
import { getPhase } from '@/lib/pulse/utils';
import { MONO, ACCENT, SURFACE, BORDER, DIM, MUTED } from '@/lib/pulse/theme';
import { usePulse } from '@/context/PulseContext';
import WeekSelector from '../WeekSelector';

const BAR_MAX_HEIGHT_PX = 44;

export default function ProgramView() {
    const { activeWeek, setActiveWeek, navigate, logs } = usePulse();
    const phase = getPhase(activeWeek);
    const maxSets = Math.max(...VOLUME.map((v) => v.sets));

    function handleSelectWeek(w: number) {
        setActiveWeek(w);
        navigate('log');
    }

    return (
        <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
            <WeekSelector activeWeek={activeWeek} onSelect={handleSelectWeek} logs={logs} />

            <div style={{ margin: '1.25rem 0', padding: '0.875rem 1rem', background: SURFACE, borderRadius: '4px', borderLeft: `3px solid ${ACCENT}` }}>
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: ACCENT }}>
                    {phase.label} — {phase.subtitle}
                </div>
                {WEEK_NOTES[activeWeek] && (
                    <div style={{ color: DIM, fontSize: '0.8125rem', marginTop: '0.375rem', lineHeight: 1.6 }}>
                        {WEEK_NOTES[activeWeek]}
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.5rem' }}>
                    Weekly Volume
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '54px' }}>
                    {VOLUME.map(({ week, sets }) => (
                        <div key={week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <div style={{ width: '100%', background: activeWeek === week ? ACCENT : '#1f1f1f', height: `${(sets / maxSets) * BAR_MAX_HEIGHT_PX}px`, borderRadius: '2px 2px 0 0', transition: 'background 0.15s' }} />
                            <span style={{ fontFamily: MONO, color: '#333', fontSize: '0.5rem' }}>{week}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.5rem' }}>
                    Weekly Schedule
                </div>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {SCHEDULE.map(({ day, type }) => {
                        const isRest = type === 'rest';
                        const label = isRest ? '—' : type.charAt(0).toUpperCase();
                        return (
                            <div key={day} style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontFamily: MONO, color: '#333', fontSize: '0.5rem', marginBottom: '0.25rem', textTransform: 'uppercase' }}>{day}</div>
                                <div style={{ padding: '0.375rem 0', borderRadius: '3px', fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, background: isRest ? '#0f0f0f' : `${ACCENT}18`, color: isRest ? '#222' : ACCENT, border: `1px solid ${isRest ? BORDER : `${ACCENT}33`}` }}>
                                    {label}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {(['push', 'pull', 'legs'] as const).map((type) => {
                const workout = WORKOUTS[type];
                return (
                    <div key={type} style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: '0.75rem' }}>
                            {workout.label} — {workout.description}
                        </div>
                        {workout.exercises.map((ex, i) => (
                            <div key={i} style={{ padding: '0.5rem 0', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
                                <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: MUTED, flexShrink: 0, width: '1.25rem' }}>{String(i + 1).padStart(2, '0')}</span>
                                <div>
                                    <div style={{ color: '#d4d4d4', fontSize: '0.875rem', fontWeight: 500 }}>{ex.name}</div>
                                    <div style={{ fontFamily: MONO, color: DIM, fontSize: '0.5625rem', letterSpacing: '0.04em', marginTop: '0.125rem' }}>{ex.sets} sets · {ex.reps} reps · {ex.load}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
