'use client';
import { useState, useEffect } from 'react';
import { WORKOUTS } from '@/lib/pulse/data';
import { getPhase, getRIR, weekHasData } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import WorkoutTabs from '../WorkoutTabs';
import ExerciseListItem from '../ExerciseListItem';
import ExerciseDetailPane from '../ExerciseDetailPane';
import type { LogEntry } from '@/lib/pulse/types';

const LAST_EX_KEY = 'pulse_last_ex';

export default function LogViewDesktop() {
    const {
        activeWeek, setActiveWeek,
        activeTab, setActiveTab,
        logs, profile, prMap,
        updateLog, deleteLog,
        timerTrigger, fireTrigger,
    } = usePulse();

    const unit = profile.unit;
    const workout = WORKOUTS[activeTab];
    const rir = getRIR(activeWeek);
    const phase = getPhase(activeWeek);

    const [activeExIdx, setActiveExIdx] = useState(() => {
        if (typeof window === 'undefined') return 0;
        const stored = Number(localStorage.getItem(LAST_EX_KEY));
        const maxIdx = WORKOUTS[activeTab].exercises.length - 1;
        return stored >= 0 && stored <= maxIdx ? stored : 0;
    });

    // Clamp index when tab changes (tabs have different exercise counts)
    useEffect(() => {
        const maxIdx = WORKOUTS[activeTab].exercises.length - 1;
        setActiveExIdx((prev) => Math.min(prev, maxIdx));
    }, [activeTab]);

    function handleSelectExercise(idx: number) {
        setActiveExIdx(idx);
        localStorage.setItem(LAST_EX_KEY, String(idx));
    }

    function handleSave(key: string, entry: LogEntry) {
        updateLog(key, entry);
        fireTrigger();
    }

    const activeExercise = workout.exercises[activeExIdx];

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left pane */}
            <div className="w-[300px] shrink-0 border-r border-pulse-border flex flex-col overflow-hidden">
                <WorkoutTabs activeTab={activeTab} onSelect={setActiveTab} logs={logs} week={activeWeek} />

                {/* Week strip */}
                <div className="flex px-2 overflow-x-auto [scrollbar-width:none] border-b border-pulse-border">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
                        const active = w === activeWeek;
                        return (
                            <button
                                key={w}
                                onClick={() => setActiveWeek(w)}
                                className={`font-pulse text-[0.6875rem] min-w-[2rem] pt-[0.4rem] pb-[0.3rem] text-center bg-transparent border-none border-b-2 cursor-pointer shrink-0 -mb-px ${active ? 'font-bold text-pulse-accent border-pulse-accent' : 'font-normal text-pulse-dim border-transparent'}`}>
                                {w}
                                <span
                                    className={`block w-[3px] h-[3px] rounded-full mt-0.5 mx-auto ${weekHasData(w, logs) ? 'bg-pulse-accent' : 'bg-transparent'}`}
                                />
                            </button>
                        );
                    })}
                </div>

                {/* Context bar */}
                <div className="flex items-baseline gap-2 py-2.5 px-4 border-b border-pulse-border shrink-0">
                    <span className="font-pulse text-[0.5625rem] tracking-[0.1em] uppercase text-pulse-dim">
                        {phase.label}
                    </span>
                    <span className="font-pulse text-[0.5625rem] font-bold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/15 py-[0.1rem] px-[0.35rem] rounded-[3px]">
                        {rir} RIR
                    </span>
                    <span className="font-pulse text-[0.625rem] text-pulse-dim ml-auto">{workout.description}</span>
                </div>

                {/* Exercise list */}
                <div className="flex-1 overflow-y-auto">
                    {workout.exercises.map((exercise, i) => (
                        <ExerciseListItem
                            key={`${activeTab}-${i}`}
                            exercise={exercise}
                            exIdx={i}
                            week={activeWeek}
                            type={activeTab}
                            logs={logs}
                            isActive={activeExIdx === i}
                            onClick={() => handleSelectExercise(i)}
                        />
                    ))}
                </div>
            </div>

            {/* Right pane */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {activeExercise && (
                    <ExerciseDetailPane
                        exercise={activeExercise}
                        exIdx={activeExIdx}
                        week={activeWeek}
                        type={activeTab}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={handleSave}
                        onDelete={deleteLog}
                        timerTrigger={timerTrigger}
                    />
                )}
            </div>
        </div>
    );
}
