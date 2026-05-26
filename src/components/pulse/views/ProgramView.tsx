import { WORKOUTS, VOLUME, SCHEDULE, WEEK_NOTES } from '@/lib/pulse/data';
import { getPhase } from '@/lib/pulse/utils';
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
        <div className="p-4 max-w-[600px] mx-auto">
            <WeekSelector activeWeek={activeWeek} onSelect={handleSelectWeek} logs={logs} />

            <div className="my-5 py-[0.875rem] px-4 bg-pulse-surface rounded border-l-[3px] border-pulse-accent">
                <div className="font-pulse font-bold text-sm tracking-[0.06em] uppercase text-pulse-accent">
                    {phase.label} — {phase.subtitle}
                </div>
                {WEEK_NOTES[activeWeek] && (
                    <div className="text-pulse-dim text-[0.9375rem] mt-[0.375rem] leading-[1.6]">
                        {WEEK_NOTES[activeWeek]}
                    </div>
                )}
            </div>

            <div className="mb-6">
                <div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
                    Weekly Volume
                </div>
                <div className="flex items-end gap-[3px] h-[54px]">
                    {VOLUME.map(({ week, sets }) => (
                        <div key={week} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                                className={`w-full rounded-t-sm transition-colors duration-150 ${activeWeek === week ? 'bg-pulse-accent' : 'bg-[#1f1f1f]'}`}
                                /* height is a runtime ratio — must stay inline */
                                style={{ height: `${(sets / maxSets) * BAR_MAX_HEIGHT_PX}px` }}
                            />
                            <span className="font-pulse text-[#333] text-[0.625rem]">{week}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
                    Weekly Schedule
                </div>
                <div className="flex gap-[0.375rem]">
                    {SCHEDULE.map(({ day, type }) => {
                        const isRest = type === 'rest';
                        const label = isRest ? '—' : type.charAt(0).toUpperCase();
                        return (
                            <div key={day} className="flex-1 text-center">
                                <div className="font-pulse text-[#333] text-[0.625rem] mb-1 uppercase">{day}</div>
                                <div
                                    className={`py-[0.375rem] rounded-[3px] font-pulse text-[0.75rem] font-bold ${isRest ? 'bg-[#0f0f0f] text-[#222] border border-pulse-border' : 'bg-pulse-accent/10 text-pulse-accent border border-pulse-accent/20'}`}>
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
                    <div key={type} className="mb-6">
                        <div className="font-pulse text-[0.75rem] tracking-[0.1em] uppercase text-pulse-accent font-bold mb-3">
                            {workout.label} — {workout.description}
                        </div>
                        {workout.exercises.map((ex, i) => (
                            <div key={i} className="py-2 border-b border-pulse-border flex gap-4 items-baseline">
                                <span className="font-pulse text-[0.75rem] text-pulse-muted shrink-0 w-5">
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                                <div>
                                    <div className="text-pulse-text text-[0.875rem] font-medium">{ex.name}</div>
                                    <div className="font-pulse text-pulse-dim text-[0.6875rem] tracking-[0.04em] mt-0.5">
                                        {ex.sets} sets · {ex.reps} reps · {ex.load}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
