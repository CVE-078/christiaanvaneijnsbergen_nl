'use client';
import { useMemo, useState } from 'react';
import { PROGRAM_LENGTHS } from '@/lib/pulse/data';
import {
    getPhase,
    getRIR,
    weekInBlock,
    formatProgramStatus,
    estimateSessionMinutes,
    parseMaxSets,
    sessionTypeFor,
    sessionFocusLabel,
    swapCandidates,
    computeSessionTargets,
} from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import type { WorkoutType, WorkoutVariant, RoutineExercise, SwapReason } from '@/lib/pulse/types';
import SectionLabel from '../SectionLabel';
import PageTitle from '@/components/pulse/PageTitle';
import PageSkeleton, { ErrorState } from '../PageSkeleton';
import NextSessionCard from '../NextSessionCard';
import GenerateRoutineButton from '../GenerateRoutineButton';
import ExerciseInstructionModal from '../ExerciseInstructionModal';
import ExerciseSwapPicker from '../ExerciseSwapPicker';
import BlockArc from '../BlockArc';
import PlanSessionList, { type PlanSession } from '../PlanSessionList';
import GenerationWarningNotice from '../GenerationWarningNotice';

type Section = { type: WorkoutType; variant: WorkoutVariant | null; exercises: RoutineExercise[] };

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const GEN_BTN =
    'font-pulse text-xs font-semibold text-pulse-accent bg-pulse-accent/10 rounded-lg px-3 py-1.5 cursor-pointer border-none';
const PILL_TONE: Record<'success' | 'warn' | 'muted', string> = {
    success: 'text-pulse-success bg-pulse-success/10',
    warn: 'text-pulse-warn bg-pulse-warn/10',
    muted: 'text-pulse-muted bg-pulse-surface-2',
};

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function ProgramView() {
    const {
        activeWeek,
        activeSchedule,
        activeRoutine,
        profile,
        exercises,
        logs,
        programPosition,
        routineExercisesByTabKey,
        resolveTabForEntry,
        setActiveTab,
        navigate,
        updateRoutineProgramWeeks,
        setProgramAnchor,
        swapRoutineExercisePermanently,
        favoriteExerciseIds,
        loading,
        errors,
        retry,
    } = usePulse();

    const [instructionFor, setInstructionFor] = useState<{ id: string; name: string } | null>(null);
    const [swapTarget, setSwapTarget] = useState<RoutineExercise | null>(null);
    const [showWhy, setShowWhy] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Permanent (plan-level) swaps do not capture a reason; the second arg exists
    // only to match the picker's onSelect signature.
    async function handlePermanentSwap(newExerciseId: string, _reason?: SwapReason | null) {
        if (!swapTarget) return;
        await swapRoutineExercisePermanently(swapTarget.id, newExerciseId);
        setSwapTarget(null);
    }

    const programWeeks = activeRoutine?.program_weeks ?? 12;
    // progressionIndex feeds phase / RIR / volume (ramp-back-adjusted); fall back
    // to the stepper week when there is no completion-paced position yet.
    const progIdx = programPosition?.progressionIndex ?? activeWeek;
    const phase = getPhase(progIdx, programWeeks);
    const rirThisWeek = getRIR(progIdx, programWeeks);
    const arcCurrentWeek = weekInBlock(progIdx, programWeeks);
    const status = programPosition ? formatProgramStatus(programPosition, programWeeks) : null;
    const weekOfBlock = programPosition ? weekInBlock(programPosition.weekInteger, programWeeks) : activeWeek;
    const deloadAway = status ? Math.max(0, status.nextDeloadWeek - weekOfBlock) : null;

    // Program start date (calendar anchor) as YYYY-MM-DD in the user's timezone,
    // matching how the adherence engine reads the anchor (dayIndex uses the same tz).
    const tz = profile?.timezone || 'UTC';
    const ymdInTz = (d: Date) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    const anchorDate = activeRoutine?.program_anchor ? ymdInTz(new Date(activeRoutine.program_anchor)) : '';
    const setStart = (ymd: string) => {
        if (activeRoutine && ymd) setProgramAnchor(activeRoutine.id, `${ymd}T12:00:00.000Z`);
    };
    const todayYmd = () => ymdInTz(new Date());

    // De-blob the persisted rationale: a " · "-joined lead of facts, then ". ",
    // then prose. Facts become chips (always shown); the prose collapses behind a
    // "Why this plan" affordance. Degrades to plain prose for older routines.
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

    // Group into the sessions the user trains: one section per distinct (session
    // type, variant), mirroring the /train tabs and the routine editor.
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

    // Per-session view-models for the responsive session list: derived duration
    // (is_compound rests longer), total sets, and a focus line from the distinct
    // muscle categories.
    const planSessions = useMemo<PlanSession[]>(
        () =>
            sections.map(({ type, variant, exercises: exs }) => ({
                key: `${type}:${variant ?? ''}`,
                label:
                    sessionFocusLabel(activeRoutine?.schedule ?? [], type, variant) ??
                    `${WORKOUT_TYPE_LABELS[type] ?? type}${variant ? ` ${variant}` : ''}`,
                durationMin: estimateSessionMinutes(
                    exs.map((re) => ({
                        sets: parseMaxSets(re.sets),
                        is_compound: re.exercise?.is_compound,
                        reps: re.reps,
                        supersetGroupId: re.superset_group_id,
                    })),
                ),
                setCount: exs.reduce((sum, re) => sum + parseMaxSets(re.sets), 0),
                focus: [...new Set(exs.map((re) => re.exercise?.category).filter(Boolean))]
                    .map((c) => cap(c as string))
                    .join(' · '),
                exercises: exs,
            })),
        [sections, activeRoutine],
    );

    // Next scheduled session + the weights Train will prefill for it.
    const nextSession = useMemo(() => {
        const entry = programPosition?.nextEntry;
        if (!entry) return null;
        const tabKey = resolveTabForEntry(entry);
        const exs = routineExercisesByTabKey[tabKey] ?? [];
        if (exs.length === 0) return null;
        const week = programPosition?.weekInteger ?? activeWeek;
        return {
            tabKey,
            rows: computeSessionTargets(exs, logs, week),
            sessionLabel:
                entry.label ??
                `${WORKOUT_TYPE_LABELS[entry.workout_type] ?? entry.workout_type}${entry.variant ? ` ${entry.variant}` : ''}`,
            dayLabel: DAY_LABELS[entry.day_of_week] ?? '',
        };
    }, [programPosition, routineExercisesByTabKey, resolveTabForEntry, logs, activeWeek]);

    if (errors?.routines || errors?.logs) return <ErrorState onRetry={retry} />;
    if (loading?.routines || loading?.logs) return <PageSkeleton />;

    const PAGE = 'px-4 pt-5 pb-12 mx-auto w-full max-w-[600px] lg:max-w-[1000px] lg:px-6 lg:pt-6 lg:pb-12';

    // Empty state: no active routine yet.
    if (!activeRoutine) {
        return (
            <div className={PAGE}>
                <div className="mb-6 flex items-center justify-between">
                    <PageTitle>Plan</PageTitle>
                </div>
                <div className="rounded-2xl bg-pulse-surface p-8 text-center">
                    <p className="font-pulse text-sm text-pulse-dim">No active plan yet.</p>
                    <p className="mb-4 mt-1 font-pulse text-xs text-pulse-muted">
                        Generate a routine to start a program.
                    </p>
                    <GenerateRoutineButton label="Generate routine" className={GEN_BTN} />
                </div>
            </div>
        );
    }

    return (
        <div className={PAGE}>
            <div className="mb-4 flex items-center justify-between">
                <PageTitle>Plan</PageTitle>
                <GenerateRoutineButton label="New routine" className={GEN_BTN} />
            </div>

            {(activeRoutine.warnings?.length ?? 0) > 0 && (
                <GenerationWarningNotice routineId={activeRoutine.id} warnings={activeRoutine.warnings ?? []} />
            )}

            {/* L4: single column on mobile, sticky summary rail + scrolling content on desktop */}
            <div className="flex flex-col lg:grid lg:grid-cols-[340px_1fr] lg:items-start lg:gap-6">
                {/* ── summary rail ───────────────────────────────────────────── */}
                {/* Sticky on desktop; scrolls internally when taller than the
                    viewport so the block arc at its foot stays reachable on
                    laptop-height screens (no-op when the rail fits). */}
                <div className="flex flex-col lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:pb-4 lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
                    {/* program identity */}
                    <div className="rounded-xl border-l-2 border-pulse-accent bg-pulse-surface p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="font-pulse text-[1.12rem] font-semibold tracking-[-0.01em] text-pulse-text">
                                    {activeRoutine.name}
                                </div>
                                <div className="mt-0.5 font-pulse text-[0.82rem] text-pulse-dim">
                                    {status ? status.weekLabel : `Week ${activeWeek}`} · {phase.label}, {phase.subtitle}
                                </div>
                            </div>
                            {status && (
                                <span
                                    className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 font-pulse text-[0.7rem] font-semibold ${PILL_TONE[status.statusTone]}`}>
                                    {status.statusLabel}
                                </span>
                            )}
                        </div>
                        {status && (
                            <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-pulse-bg">
                                <span
                                    className="block h-full rounded-full bg-pulse-accent"
                                    style={{ width: `${Math.round(status.progress * 100)}%` }}
                                />
                            </div>
                        )}
                        <div className="mt-3 flex gap-5">
                            <div className="font-pulse text-[0.78rem] text-pulse-muted">
                                <b className="mb-px block text-[0.92rem] font-semibold text-pulse-text">
                                    RIR {rirThisWeek}
                                </b>
                                target this week
                            </div>
                            {deloadAway !== null && (
                                <div className="font-pulse text-[0.78rem] text-pulse-muted">
                                    <b className="mb-px block text-[0.92rem] font-semibold text-pulse-text">
                                        Week {status!.nextDeloadWeek}
                                    </b>
                                    {deloadAway === 0 ? 'deload this week' : `next deload, ${deloadAway} wks`}
                                </div>
                            )}
                            {activeSchedule.length > 0 && (
                                <div className="font-pulse text-[0.78rem] text-pulse-muted">
                                    <b className="mb-px block text-[0.92rem] font-semibold text-pulse-text">
                                        {activeSchedule.length}×
                                    </b>
                                    per week
                                </div>
                            )}
                        </div>
                        {rationale && (
                            <div className="mt-3 border-t border-pulse-border pt-3">
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
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setShowWhy((v) => !v)}
                                            aria-expanded={showWhy}
                                            className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 font-pulse text-[0.76rem] font-medium text-pulse-accent">
                                            Why this plan
                                            <svg
                                                className={`h-3 w-3 transition-transform duration-150 ${showWhy ? 'rotate-180' : ''}`}
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth={2.4}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden>
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </button>
                                        {showWhy && (
                                            <p className="mt-2 font-pulse text-[0.82rem] leading-[1.55] text-pulse-dim">
                                                {rationale.prose}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* next session */}
                    {nextSession && (
                        <>
                            <SectionLabel className="mb-2 mt-5">Next session</SectionLabel>
                            <NextSessionCard
                                sessionLabel={nextSession.sessionLabel}
                                dayLabel={nextSession.dayLabel}
                                rows={nextSession.rows}
                                unit={profile?.unit ?? 'kg'}
                                onStart={() => {
                                    setActiveTab(nextSession.tabKey);
                                    navigate('train');
                                }}
                            />
                        </>
                    )}

                    {/* this week */}
                    {activeSchedule.length > 0 && (
                        <>
                            <SectionLabel className="mb-2 mt-5">This week</SectionLabel>
                            <div className="rounded-2xl bg-pulse-surface p-4">
                                <div className="flex gap-[0.375rem]">
                                    {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                                        const entry = activeSchedule.find((e) => e.day_of_week === dow);
                                        const isRest = !entry;
                                        const label = isRest ? '—' : entry!.workout_type.charAt(0).toUpperCase();
                                        return (
                                            <div key={dow} className="flex-1 text-center">
                                                <div className="mb-1 font-pulse text-[0.625rem] uppercase text-pulse-muted">
                                                    {DAY_SHORT[dow]}
                                                </div>
                                                <div
                                                    className={`rounded-lg py-[0.375rem] font-pulse text-[0.75rem] font-semibold ${isRest ? 'bg-pulse-surface-2 text-pulse-muted opacity-55' : 'bg-pulse-accent text-pulse-bg'}`}>
                                                    {label}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    {/* training block arc */}
                    <SectionLabel className="mb-2 mt-5">Training block</SectionLabel>
                    <BlockArc weeks={programWeeks} currentWeek={arcCurrentWeek} />
                </div>

                {/* ── content ────────────────────────────────────────────────── */}
                <div className="flex flex-col">
                    <SectionLabel className="mb-2 mt-5 lg:mt-0">Sessions</SectionLabel>
                    <PlanSessionList sessions={planSessions} onSwap={setSwapTarget} onInfo={setInstructionFor} />

                    <SectionLabel className="mb-2 mt-5">Program settings</SectionLabel>
                    <button
                        type="button"
                        onClick={() => setShowSettings((v) => !v)}
                        aria-expanded={showSettings}
                        className="flex w-full cursor-pointer items-center justify-between rounded-2xl border-none bg-pulse-surface p-4 font-pulse text-sm font-medium text-pulse-text">
                        Length, start date &amp; structure
                        <svg
                            className={`h-3.5 w-3.5 text-pulse-muted transition-transform duration-150 ${showSettings ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.4}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden>
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    {showSettings && (
                        <div className="mt-2 rounded-2xl bg-pulse-surface p-4">
                            <div className="flex items-center justify-between gap-3 border-b border-pulse-border py-3 first:pt-0">
                                <div>
                                    <div className="font-pulse text-[0.82rem] font-medium text-pulse-text">
                                        Program length
                                    </div>
                                    <div className="mt-0.5 font-pulse text-[0.7rem] leading-[1.4] text-pulse-muted">
                                        Weeks per cycle before it repeats.
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 rounded-lg bg-pulse-surface-2 p-[3px]">
                                    {PROGRAM_LENGTHS.map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            aria-pressed={programWeeks === n}
                                            onClick={() => updateRoutineProgramWeeks(activeRoutine.id, n)}
                                            className={`cursor-pointer rounded-md border-none px-2.5 py-1 font-pulse text-xs font-semibold transition-colors duration-150 ${programWeeks === n ? 'bg-pulse-accent text-pulse-bg' : 'text-pulse-dim'}`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 border-b border-pulse-border py-3">
                                <div className="min-w-0">
                                    <div className="font-pulse text-[0.82rem] font-medium text-pulse-text">
                                        Program start
                                    </div>
                                    <div className="mt-0.5 max-w-[210px] font-pulse text-[0.7rem] leading-[1.4] text-pulse-muted">
                                        When week 1 begins. Only re-aligns your schedule, not logged progress.
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <input
                                        type="date"
                                        aria-label="Program start date"
                                        value={anchorDate}
                                        onChange={(e) => setStart(e.target.value)}
                                        className="cursor-pointer rounded-md border-none bg-pulse-surface-2 px-2 py-1 font-pulse text-xs font-semibold text-pulse-text [color-scheme:dark]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setStart(todayYmd())}
                                        className="cursor-pointer rounded-md border-none bg-pulse-surface-2 px-2.5 py-1 font-pulse text-xs font-semibold text-pulse-dim hover:text-pulse-text">
                                        Today
                                    </button>
                                </div>
                            </div>
                            <div className="pt-3">
                                <GenerateRoutineButton
                                    label="Change split or days →"
                                    className="flex w-full cursor-pointer items-center justify-between rounded-lg border-none bg-pulse-surface-2 px-3 py-3 font-pulse text-[0.84rem] font-medium text-pulse-text"
                                />
                                <p className="mt-1.5 font-pulse text-[0.7rem] leading-[1.4] text-pulse-muted">
                                    Builds a fresh routine with a different split or weekly frequency. Your current plan
                                    is kept until you switch.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {instructionFor && (
                <ExerciseInstructionModal
                    exerciseId={instructionFor.id}
                    exerciseName={instructionFor.name}
                    onClose={() => setInstructionFor(null)}
                />
            )}

            {swapTarget && swapTarget.exercise && (
                <ExerciseSwapPicker
                    original={swapTarget.exercise}
                    week={activeWeek}
                    candidates={swapCandidates(swapTarget.exercise, exercises, {
                        excludeIds: new Set(
                            activeRoutine.exercises.filter((r) => r.id !== swapTarget.id).map((r) => r.exercise_id),
                        ),
                    })}
                    isSwapped={false}
                    favoriteIds={favoriteExerciseIds}
                    onSelect={handlePermanentSwap}
                    onRevert={() => setSwapTarget(null)}
                    onClose={() => setSwapTarget(null)}
                />
            )}
        </div>
    );
}
