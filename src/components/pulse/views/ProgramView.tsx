'use client';
import { useMemo } from 'react';
import { VOLUME, WEEK_NOTES } from '@/lib/pulse/data';
import { getPhase } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import type { WorkoutType, RoutineExercise } from '@/lib/pulse/types';
import WeekSelector from '../WeekSelector';
import SectionLabel from '../SectionLabel';
import GenerateRoutineButton from '../GenerateRoutineButton';
import PageSkeleton, { ErrorState } from '../PageSkeleton';

type Section = { type: WorkoutType; exercises: RoutineExercise[] };

const BAR_MAX_HEIGHT_PX = 44;

export default function ProgramView() {
    const {
        activeWeek,
        setActiveWeek,
        logs,
        activeSchedule,
        activeRoutine,
        routineExercisesByType,
        loading,
        errors,
        retry,
    } = usePulse();
    const phase = getPhase(activeWeek);
    const maxSets = Math.max(...VOLUME.map((v) => v.sets));

    function handleSelectWeek(w: number) {
        setActiveWeek(w);
    }

    const sections = useMemo((): Section[] => {
        if (activeSchedule.length === 0) {
            return Object.keys(routineExercisesByType)
                .filter((t) => (routineExercisesByType[t as WorkoutType] ?? []).length > 0)
                .map((t) => ({ type: t as WorkoutType, exercises: routineExercisesByType[t as WorkoutType]! }));
        }

        const uniqueTypes = [...new Set(activeSchedule.map((e) => e.workout_type))];

        if (uniqueTypes.length === 1) {
            const allExercises = activeRoutine
                ? [...activeRoutine.exercises].sort((a, b) => a.order - b.order)
                : (Object.values(routineExercisesByType).flat() as RoutineExercise[]);
            return [{ type: uniqueTypes[0], exercises: allExercises }];
        }

        return uniqueTypes
            .map((type) => ({ type, exercises: (routineExercisesByType[type] ?? []) as RoutineExercise[] }))
            .filter((s) => s.exercises.length > 0);
    }, [activeSchedule, activeRoutine, routineExercisesByType]);

    if (errors?.routines || errors?.logs) return <ErrorState onRetry={retry} />;
    if (loading?.routines || loading?.logs) return <PageSkeleton />;

    return (
        <div className="p-4 max-w-[600px] mx-auto">
            <div className="flex justify-end mb-3">
                <GenerateRoutineButton
                    label="Generate routine"
                    className="font-pulse text-xs font-semibold text-pulse-accent bg-pulse-accent/10 rounded-lg px-3 py-1.5 cursor-pointer border-none"
                />
            </div>
            <WeekSelector activeWeek={activeWeek} onSelect={handleSelectWeek} logs={logs} />

            <div className="my-5 py-[0.875rem] px-4 bg-pulse-surface rounded-xl border-l-[3px] border-pulse-accent">
                <div className="font-pulse font-semibold text-sm tracking-[0.06em] uppercase text-pulse-accent">
                    {phase.label} — {phase.subtitle}
                </div>
                {WEEK_NOTES[activeWeek] && (
                    <div className="text-pulse-dim text-[0.9375rem] mt-[0.375rem] leading-[1.6]">
                        {WEEK_NOTES[activeWeek]}
                    </div>
                )}
            </div>

            <div className="mb-6">
                <SectionLabel className="mb-2">Weekly Volume</SectionLabel>
                <div className="flex items-end gap-[3px] h-[54px]">
                    {VOLUME.map(({ week, sets }) => (
                        <div key={week} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                                className={`w-full rounded-t-sm transition-colors duration-150 ${activeWeek === week ? 'bg-pulse-accent' : 'bg-pulse-surface-2'}`}
                                /* height is a runtime ratio — must stay inline */
                                style={{ height: `${(sets / maxSets) * BAR_MAX_HEIGHT_PX}px` }}
                            />
                            <span className="font-pulse text-pulse-muted text-[0.625rem]">{week}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <SectionLabel className="mb-2">Weekly Schedule</SectionLabel>
                {activeSchedule.length > 0 ? (
                    <div className="flex gap-[0.375rem]">
                        {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                            const entry = activeSchedule.find((e) => e.day_of_week === dow);
                            const isRest = !entry;
                            const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
                            const label = isRest ? '—' : entry!.workout_type.charAt(0).toUpperCase();
                            return (
                                <div key={dow} className="flex-1 text-center">
                                    <div className="font-pulse text-pulse-muted text-[0.625rem] mb-1 uppercase">
                                        {DAY_SHORT[dow]}
                                    </div>
                                    <div
                                        className={`py-[0.375rem] rounded-lg font-pulse text-[0.75rem] font-semibold ${isRest ? 'bg-pulse-surface text-pulse-muted opacity-55' : 'bg-pulse-accent text-pulse-bg'}`}>
                                        {label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="font-pulse text-xs text-pulse-muted">
                        No schedule set — add a routine with a weekly schedule.
                    </p>
                )}
            </div>

            {sections.map(({ type, exercises }) => (
                <div key={type} className="mb-6">
                    <div className="font-pulse text-[0.75rem] tracking-[0.16em] uppercase text-pulse-muted font-medium mb-3">
                        {WORKOUT_TYPE_LABELS[type as WorkoutType] ?? type}
                    </div>
                    {exercises.map((re, i) => (
                        <div
                            key={re.id}
                            className="py-3 border-b border-pulse-border last:border-b-0 flex gap-4 items-baseline">
                            <span className="font-pulse text-[0.75rem] text-pulse-muted shrink-0 w-5">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <div>
                                <div className="font-pulse text-pulse-text text-[1.0625rem] font-medium tracking-[-0.01em]">
                                    {re.exercise?.name ?? ''}
                                </div>
                                <div className="font-pulse-body text-pulse-dim text-[0.6875rem] tracking-[0.04em] mt-1">
                                    {re.sets} sets · {re.reps} reps
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
