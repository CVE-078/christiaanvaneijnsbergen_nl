'use client';
import { useMemo, useState } from 'react';
import { WEEK_NOTES, buildProgram, PROGRAM_LENGTHS } from '@/lib/pulse/data';
import { getPhase, sessionTypeFor, weekInBlock } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { WORKOUT_TYPE_LABELS, EQUIPMENT_LABELS } from '@/lib/pulse/constants';
import type { WorkoutType, WorkoutVariant, RoutineExercise } from '@/lib/pulse/types';
import SectionLabel from '../SectionLabel';
import GenerateRoutineButton from '../GenerateRoutineButton';
import PageTitle from '@/components/pulse/PageTitle';
import PageSkeleton, { ErrorState } from '../PageSkeleton';
import ExerciseInstructionModal from '../ExerciseInstructionModal';

type Section = { type: WorkoutType; variant: WorkoutVariant | null; exercises: RoutineExercise[] };

const BAR_MAX_HEIGHT_PX = 64;

export default function ProgramView() {
    const {
        activeWeek,
        setActiveWeek,
        activeSchedule,
        activeRoutine,
        profile,
        updateRoutineProgramWeeks,
        setProgramAnchor,
        loading,
        errors,
        retry,
    } = usePulse();
    // Which exercise's how-to-perform modal is open (parity with the Train card +
    // guided mode). Built-in exercises only, the ones that carry instructions.
    const [instructionFor, setInstructionFor] = useState<{ id: string; name: string } | null>(null);
    const programWeeks = activeRoutine?.program_weeks ?? 12;
    const phase = getPhase(activeWeek, programWeeks);
    const volume = useMemo(() => buildProgram(programWeeks).volume, [programWeeks]);
    const maxSets = Math.max(...volume.map((v) => v.sets));
    const inBlockWeek = weekInBlock(activeWeek, programWeeks);

    // Program start date (the calendar anchor) as a YYYY-MM-DD value for the date
    // input. Resolved in the user's timezone so the displayed day matches how the
    // adherence engine reads the anchor (dayIndex uses the same tz). We store noon
    // UTC of the chosen day, which lands on that day for all but the ±12h-fringe
    // timezones (a re-pick corrects those). en-CA formats as YYYY-MM-DD.
    const tz = profile?.timezone || 'UTC';
    const ymdInTz = (d: Date) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    const anchorDate = activeRoutine?.program_anchor ? ymdInTz(new Date(activeRoutine.program_anchor)) : '';
    const setStart = (ymd: string) => {
        if (activeRoutine && ymd) setProgramAnchor(activeRoutine.id, `${ymd}T12:00:00.000Z`);
    };
    const todayYmd = () => ymdInTz(new Date());

    function handleSelectWeek(w: number) {
        setActiveWeek(w);
    }

    // De-blob the persisted rationale: buildRationale emits a " · "-joined lead of
    // facts then a ". " then prose. Split the lead into scannable chips and keep the
    // prose below. Degrades to plain prose for any string not in that shape (older
    // routines), so no data migration is needed.
    const rationale = useMemo(() => {
        const r = activeRoutine?.rationale?.trim();
        if (!r) return null;
        const cut = r.indexOf('. ');
        const lead = cut === -1 ? r : r.slice(0, cut);
        const prose = cut === -1 ? '' : r.slice(cut + 2);
        const facts = lead
            .split(' · ')
            .map((f) => f.trim())
            .filter(Boolean);
        return facts.length > 1 ? { facts, prose } : { facts: [] as string[], prose: r };
    }, [activeRoutine?.rationale]);

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

            {/* program header, phase + rationale, with an inline week stepper */}
            <div className="mb-6 rounded-xl border-l-2 border-pulse-accent bg-pulse-surface p-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="font-pulse font-semibold text-sm tracking-[0.06em] uppercase text-pulse-accent">
                            {phase.label}, {phase.subtitle}
                        </div>
                        {WEEK_NOTES[activeWeek] && (
                            <div className="text-pulse-dim text-[0.9375rem] mt-[0.375rem] leading-[1.6]">
                                {WEEK_NOTES[activeWeek]}
                            </div>
                        )}
                        {rationale && (
                            <div className="mt-[0.5rem] flex flex-col gap-2">
                                {rationale.facts.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {rationale.facts.map((f, i) => (
                                            <span
                                                key={i}
                                                className="rounded-md border border-pulse-border bg-pulse-surface-2 px-2 py-0.5 font-pulse text-[0.6875rem] tracking-[0.01em] text-pulse-dim">
                                                {f}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {rationale.prose && (
                                    <p className="font-pulse text-[0.9375rem] text-pulse-dim leading-[1.6]">
                                        {rationale.prose}
                                    </p>
                                )}
                            </div>
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
                            No schedule set, add a routine with a weekly schedule.
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
                                /* height is a runtime ratio, must stay inline */
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
                                    <div className="min-w-0 flex-1">
                                        <div className="font-pulse text-pulse-text text-[1.0625rem] font-medium tracking-[-0.01em]">
                                            {re.exercise?.name ?? ''}
                                        </div>
                                        <div className="font-pulse-body text-pulse-dim text-[0.6875rem] tracking-[0.04em] mt-1">
                                            {re.sets} sets · {re.reps} reps
                                        </div>
                                        {/* Resolved equipment per exercise, so an equipment mis-tag
                                            (e.g. a bench-only lift in a no-bench setup) is visible here,
                                            not only by reading the seed. */}
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {(re.exercise?.equipment ?? []).length === 0 ? (
                                                <span className="rounded border border-pulse-border px-1.5 py-0.5 font-pulse text-[0.625rem] tracking-[0.02em] text-pulse-muted">
                                                    Bodyweight
                                                </span>
                                            ) : (
                                                (re.exercise?.equipment ?? []).map((eq) => (
                                                    <span
                                                        key={eq}
                                                        className="rounded border border-pulse-border px-1.5 py-0.5 font-pulse text-[0.625rem] tracking-[0.02em] text-pulse-muted">
                                                        {EQUIPMENT_LABELS[eq] ?? eq}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                    {re.exercise && re.exercise.user_id === null && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setInstructionFor({ id: re.exercise!.id, name: re.exercise!.name })
                                            }
                                            aria-label={`How to perform ${re.exercise.name}`}
                                            className="grid h-7 w-7 shrink-0 place-items-center self-center rounded-lg bg-pulse-surface-2 text-pulse-dim border-none cursor-pointer hover:text-pulse-accent">
                                            <svg
                                                className="h-3.5 w-3.5"
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth={1.5}
                                                aria-hidden>
                                                <circle cx="8" cy="8" r="6.5" />
                                                <line x1="8" y1="7" x2="8" y2="11" strokeLinecap="round" />
                                                <circle cx="8" cy="4.75" r="0.6" fill="currentColor" stroke="none" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {instructionFor && (
                <ExerciseInstructionModal
                    exerciseId={instructionFor.id}
                    exerciseName={instructionFor.name}
                    onClose={() => setInstructionFor(null)}
                />
            )}
        </div>
    );
}
