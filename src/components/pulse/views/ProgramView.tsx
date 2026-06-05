'use client';
import { useMemo } from 'react';
import { WEEK_NOTES, buildProgram, PROGRAM_LENGTHS } from '@/lib/pulse/data';
import { getPhase, sessionTypeFor, weekInBlock } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import type { WorkoutType, WorkoutVariant, RoutineExercise } from '@/lib/pulse/types';
import SectionLabel from '../SectionLabel';
import GenerateRoutineButton from '../GenerateRoutineButton';
import PageTitle from '@/components/pulse/PageTitle';
import PageSkeleton, { ErrorState } from '../PageSkeleton';

type Section = { type: WorkoutType; variant: WorkoutVariant | null; exercises: RoutineExercise[] };

const BAR_MAX_HEIGHT_PX = 64;

export default function ProgramView() {
    const {
        activeWeek,
        setActiveWeek,
        activeSchedule,
        activeRoutine,
        updateRoutineProgramWeeks,
        setProgramAnchor,
        loading,
        errors,
        retry,
    } = usePulse();
    const programWeeks = activeRoutine?.program_weeks ?? 12;
    const phase = getPhase(activeWeek, programWeeks);
    const volume = useMemo(() => buildProgram(programWeeks).volume, [programWeeks]);
    const maxSets = Math.max(...volume.map((v) => v.sets));
    const inBlockWeek = weekInBlock(activeWeek, programWeeks);

    // Program start date (the calendar anchor) as a YYYY-MM-DD value for the date
    // input, and a setter that anchors to noon UTC of the chosen day so the date
    // resolves consistently across timezones.
    const anchorDate = activeRoutine?.program_anchor ? activeRoutine.program_anchor.slice(0, 10) : '';
    const setStart = (ymd: string) => {
        if (activeRoutine && ymd) setProgramAnchor(activeRoutine.id, `${ymd}T12:00:00.000Z`);
    };
    const todayYmd = () => {
        const n = new Date();
        const p = (x: number) => String(x).padStart(2, '0');
        return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
    };

    function handleSelectWeek(w: number) {
        setActiveWeek(w);
    }

    // Group into the sessions the user actually trains: one section per distinct
    // (session type, variant). This mirrors the /train tabs and the routine editor,
    // so a split with two same-type days (e.g. Upper A + Upper B) shows as two
    // sections rather than one merged list. A full-body routine tags its exercises
    // push/pull/legs but schedules a single full_body session, so those roll up via
    // sessionTypeFor; with no schedule the exercise's own type is used.
    const sections = useMemo((): Section[] => {
        if (!activeRoutine) return [];
        const sorted = [...activeRoutine.exercises].sort((a, b) => a.order - b.order);
        const scheduleTypes = [...new Set(activeRoutine.schedule.map((s) => s.workout_type))];
        const groups: Section[] = [];
        const byKey = new Map<string, number>();
        for (const re of sorted) {
            const type = sessionTypeFor(re.workout_type, scheduleTypes);
            const key = `${type}:${re.variant ?? ''}`;
            let gi = byKey.get(key);
            if (gi === undefined) {
                gi = groups.length;
                byKey.set(key, gi);
                groups.push({ type, variant: re.variant ?? null, exercises: [] });
            }
            groups[gi].exercises.push(re);
        }
        return groups;
    }, [activeRoutine]);

    if (errors?.routines || errors?.logs) return <ErrorState onRetry={retry} />;
    if (loading?.routines || loading?.logs) return <PageSkeleton />;

    return (
        <div className="p-4 max-w-[600px] lg:max-w-[820px] mx-auto">
            <div className="flex items-center justify-between mb-6">
                <PageTitle>Plan</PageTitle>
                <GenerateRoutineButton
                    label="Generate routine"
                    className="font-pulse text-xs font-semibold text-pulse-accent bg-pulse-accent/10 rounded-lg px-3 py-1.5 cursor-pointer border-none"
                />
            </div>

            {/* program header — phase + rationale, with an inline week stepper */}
            <div className="mb-6 rounded-xl border-l-2 border-pulse-accent bg-pulse-surface p-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="font-pulse font-semibold text-sm tracking-[0.06em] uppercase text-pulse-accent">
                            {phase.label} — {phase.subtitle}
                        </div>
                        {WEEK_NOTES[activeWeek] && (
                            <div className="text-pulse-dim text-[0.9375rem] mt-[0.375rem] leading-[1.6]">
                                {WEEK_NOTES[activeWeek]}
                            </div>
                        )}
                        {activeRoutine?.rationale && (
                            <p className="font-pulse text-[0.9375rem] text-pulse-dim leading-[1.6] mt-[0.375rem]">
                                {activeRoutine.rationale}
                            </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 self-start rounded-lg bg-pulse-surface-2 p-[3px]">
                        <button
                            type="button"
                            aria-label="Previous week"
                            disabled={activeWeek <= 1}
                            onClick={() => handleSelectWeek(Math.max(1, activeWeek - 1))}
                            className="rounded-md px-2 py-1 font-pulse text-sm font-semibold text-pulse-dim cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed">
                            ‹
                        </button>
                        <span className="rounded-md bg-pulse-accent px-2.5 py-1 font-pulse text-xs font-semibold text-pulse-bg">
                            Wk {activeWeek}
                        </span>
                        <button
                            type="button"
                            aria-label="Next week"
                            onClick={() => handleSelectWeek(activeWeek + 1)}
                            className="rounded-md px-2 py-1 font-pulse text-sm font-semibold text-pulse-dim cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed">
                            ›
                        </button>
                    </div>
                </div>

                {activeRoutine && (
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-pulse-border pt-3">
                        <span className="font-pulse text-[0.75rem] tracking-[0.06em] uppercase text-pulse-muted font-medium">
                            Program length
                        </span>
                        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-pulse-surface-2 p-[3px]">
                            {PROGRAM_LENGTHS.map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    aria-pressed={programWeeks === n}
                                    onClick={() => updateRoutineProgramWeeks(activeRoutine.id, n)}
                                    className={`rounded-md px-2.5 py-1 font-pulse text-xs font-semibold cursor-pointer border-none transition-colors duration-150 ${programWeeks === n ? 'bg-pulse-accent text-pulse-bg' : 'text-pulse-dim'}`}>
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {activeRoutine && (
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-pulse-border pt-3">
                        <div className="min-w-0">
                            <span className="font-pulse text-[0.75rem] tracking-[0.06em] uppercase text-pulse-muted font-medium">
                                Program start
                            </span>
                            <p className="font-pulse text-[0.6875rem] text-pulse-muted mt-0.5 leading-[1.5]">
                                When week 1 begins. Only re-aligns your schedule, not logged progress.
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            <input
                                type="date"
                                aria-label="Program start date"
                                value={anchorDate}
                                onChange={(e) => setStart(e.target.value)}
                                className="font-pulse text-xs font-semibold text-pulse-text bg-pulse-surface-2 rounded-md px-2 py-1 border-none cursor-pointer [color-scheme:dark]"
                            />
                            <button
                                type="button"
                                onClick={() => setStart(todayYmd())}
                                className="rounded-md bg-pulse-surface-2 px-2.5 py-1 font-pulse text-xs font-semibold text-pulse-dim cursor-pointer border-none hover:text-pulse-text">
                                Today
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-4">
                {/* weekly schedule + weekly volume */}
                <div className="bg-pulse-surface rounded-2xl p-4">
                    <SectionLabel className="mb-3">Weekly Schedule</SectionLabel>
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
                                            className={`py-[0.375rem] rounded-lg font-pulse text-[0.75rem] font-semibold ${isRest ? 'bg-pulse-surface-2 text-pulse-muted opacity-55' : 'bg-pulse-accent text-pulse-bg'}`}>
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

                    <SectionLabel className="mt-5 mb-2">Weekly Volume · {programWeeks} weeks</SectionLabel>
                    <div className="flex items-end gap-[3px] h-20">
                        {volume.map(({ week, sets }) => (
                            <button
                                key={week}
                                type="button"
                                onClick={() => handleSelectWeek(activeWeek - inBlockWeek + week)}
                                aria-label={`Jump to week ${week} (${sets} sets)`}
                                aria-pressed={inBlockWeek === week}
                                title={`Week ${week} · ${sets} sets`}
                                className={`flex-1 self-end rounded-t-sm border-none cursor-pointer transition-colors duration-150 hover:opacity-80 ${inBlockWeek === week ? 'bg-pulse-accent' : 'bg-pulse-surface-2'}`}
                                /* height is a runtime ratio — must stay inline */
                                style={{ height: `${(sets / maxSets) * BAR_MAX_HEIGHT_PX}px` }}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between mt-[5px] font-pulse text-pulse-muted text-[0.625rem]">
                        <span>Wk 1</span>
                        <span>Wk {programWeeks}</span>
                    </div>
                </div>

                {/* right: per-session exercise breakdown */}
                <div className="bg-pulse-surface rounded-2xl p-4">
                    {sections.map(({ type, variant, exercises }) => (
                        <div key={`${type}:${variant ?? ''}`} className="mb-6 last:mb-0">
                            <div className="font-pulse text-[0.75rem] tracking-[0.16em] uppercase text-pulse-muted font-medium mb-3">
                                {WORKOUT_TYPE_LABELS[type as WorkoutType] ?? type}
                                {variant ? ` · ${variant}` : ''}
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
            </div>
        </div>
    );
}
