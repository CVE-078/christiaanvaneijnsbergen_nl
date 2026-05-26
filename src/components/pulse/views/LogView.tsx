import { WORKOUTS } from '@/lib/pulse/data';
import { getPhase, getRIR, weekHasData, parseMaxSets, logKey } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import WorkoutTabs from '../WorkoutTabs';
import ExerciseCard from '../ExerciseCard';
import RestTimer from '../RestTimer';
import type { LogEntry } from '@/lib/pulse/types';

export default function LogView() {
    const {
        activeWeek,
        setActiveWeek,
        activeTab,
        setActiveTab,
        logs,
        profile,
        prMap,
        updateLog,
        deleteLog,
        timerTrigger,
        fireTrigger,
    } = usePulse();

    const workout = WORKOUTS[activeTab];
    const rir = getRIR(activeWeek);
    const phase = getPhase(activeWeek);
    const unit = profile.unit;

    const hasData = workout.exercises.some((ex, exIdx) =>
        Array.from(
            { length: parseMaxSets(ex.sets) },
            (_, s) => logs[logKey(activeWeek, activeTab, exIdx, s)]?.saved,
        ).some(Boolean),
    );

    function handleSave(key: string, entry: LogEntry) {
        updateLog(key, entry);
        fireTrigger();
    }

    return (
        <div>
            <WorkoutTabs activeTab={activeTab} onSelect={setActiveTab} />
            <RestTimer trigger={timerTrigger} />

            <div className="flex px-4 overflow-x-auto [scrollbar-width:none] border-b border-pulse-border">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
                    const active = w === activeWeek;
                    return (
                        <button
                            key={w}
                            onClick={() => setActiveWeek(w)}
                            className={`font-pulse text-xs min-w-[2.25rem] pt-2 pb-[0.375rem] text-center bg-transparent border-none border-b-2 cursor-pointer shrink-0 -mb-px ${active ? 'font-bold text-pulse-accent border-pulse-accent' : 'font-normal text-pulse-dim border-transparent'}`}>
                            {w}
                            <span
                                className={`block w-1 h-1 rounded-full mt-0.5 mx-auto ${weekHasData(w, logs) ? 'bg-pulse-accent' : 'bg-transparent'}`}
                            />
                        </button>
                    );
                })}
            </div>

            <div className="flex items-baseline gap-3 pt-[0.875rem] px-4 pb-2">
                <span className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-dim">
                    {phase.label}
                </span>
                <span className="font-pulse text-xs font-bold text-pulse-accent tracking-[0.04em]">{rir} RIR</span>
                <span className="text-[0.8125rem] text-pulse-dim ml-auto">{workout.description}</span>
            </div>

            <div
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeTab}`}
                className="pt-1 px-4 pb-8 max-w-[600px] mx-auto flex flex-col gap-1">
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
                        onSave={handleSave}
                        onDelete={deleteLog}
                    />
                ))}
                {!hasData && (
                    <div className="pt-6 text-center">
                        <div className="font-pulse text-[0.6875rem] text-[#333] tracking-[0.04em]">
                            Tap an exercise to start logging.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
