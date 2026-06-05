'use client';
import { useMemo, useState } from 'react';
import { logKey, parseMaxSets, computeLastSession, isSetPR, groupExercises, toDisplay } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { useToast } from '@/lib/pulse/toast';
import { useMediaQuery } from '@/hooks/pulse/useMediaQuery';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import SetLogger from './SetLogger';
import RestTimer from './RestTimer';
import type {
    RoutineExercise,
    Logs,
    LogEntry,
    Unit,
    WorkoutVariant,
    ExerciseItem,
    PRMap,
    DbExercise,
} from '@/lib/pulse/types';

interface Props {
    exercises: RoutineExercise[];
    sessionId: string | null;
    variant: WorkoutVariant | null;
    week: number;
    logs: Logs;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
    onComplete: () => Promise<void>;
    onClose: () => void;
    resolveDisplay?: (re: RoutineExercise) => DbExercise;
    onSwapExercise?: (re: RoutineExercise) => void;
}

// Pure decision for guided-mode auto-advance: only jump to the next step when the
// setting is on, there is a next step, and the current step is fully logged.
export function shouldAutoAdvance(autoAdvance: boolean, isLast: boolean, stepComplete: boolean): boolean {
    return autoAdvance && !isLast && stepComplete;
}

// --- pure set-count helpers (shared by the ring, the pips and the session track) ---
function savedSetsForExercise(re: RoutineExercise, week: number, logs: Logs): number {
    const max = parseMaxSets(re.sets);
    return Array.from({ length: max }, (_, i) => logKey(week, re.id, i)).filter((k) => logs[k]?.saved).length;
}
function totalSetsForStep(step: ExerciseItem): number {
    return Array.isArray(step) ? step.reduce((sum, re) => sum + parseMaxSets(re.sets), 0) : parseMaxSets(step.sets);
}
function doneSetsForStep(step: ExerciseItem, week: number, logs: Logs): number {
    return Array.isArray(step)
        ? step.reduce((sum, re) => sum + savedSetsForExercise(re, week, logs), 0)
        : savedSetsForExercise(step, week, logs);
}

// Shared visual tokens for the bold "Focus" treatment. The gradient and glow are
// derived from the (themeable) accent via color-mix, so the accent picker cascades.
const CTA_GRADIENT: React.CSSProperties = {
    background:
        'linear-gradient(100deg, var(--color-pulse-accent), color-mix(in srgb, var(--color-pulse-accent) 78%, #ffffff))',
    boxShadow: '0 14px 34px -12px color-mix(in srgb, var(--color-pulse-accent) 60%, transparent)',
};
const CTA_CLASS =
    'flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-none px-4 py-4 font-pulse-display text-lg font-extrabold uppercase tracking-[0.06em] text-pulse-bg transition-[transform,filter] duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50';
const ICON_BTN =
    'grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-pulse-border bg-white/[0.02] text-xl leading-none text-pulse-dim transition-colors hover:border-pulse-muted hover:text-pulse-text disabled:cursor-default disabled:opacity-30';

// Set-progress ring — the focal anchor of both layouts.
function ProgressRing({
    done,
    total,
    size,
    stroke,
    numClass,
    denClass,
    denText,
}: {
    done: number;
    total: number;
    size: number;
    stroke: number;
    numClass: string;
    denClass: string;
    denText: string;
}) {
    const r = (size - stroke) / 2;
    const circumference = 2 * Math.PI * r;
    const pct = total > 0 ? Math.min(1, done / total) : 0;
    const dashOffset = circumference * (1 - pct);
    const half = size / 2;
    return (
        <div
            className="relative shrink-0"
            style={{ width: size, height: size }}
            role="img"
            aria-label={`${done} of ${total} sets complete`}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block -rotate-90">
                <circle cx={half} cy={half} r={r} fill="none" stroke="var(--color-pulse-border)" strokeWidth={stroke} />
                {/* dashoffset is a runtime ratio — must stay inline */}
                <circle
                    cx={half}
                    cy={half}
                    r={r}
                    fill="none"
                    stroke="var(--color-pulse-accent)"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    style={{
                        strokeDashoffset: dashOffset,
                        filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--color-pulse-accent) 45%, transparent))',
                        transition: 'stroke-dashoffset .5s cubic-bezier(.4,0,.1,1)',
                    }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className={numClass}>{done}</span>
                <span className={denClass}>{denText}</span>
            </div>
        </div>
    );
}

// Per-step progress pips: filled when fully logged, a partial glow on the current step.
function PipTrack({
    steps,
    currentIdx,
    week,
    logs,
}: {
    steps: ExerciseItem[];
    currentIdx: number;
    week: number;
    logs: Logs;
}) {
    return (
        <div className="flex gap-[5px]">
            {steps.map((st, i) => {
                const total = totalSetsForStep(st);
                const done = total > 0 && doneSetsForStep(st, week, logs) === total;
                const current = i === currentIdx;
                return (
                    <span
                        key={i}
                        className={`relative h-[4px] flex-1 overflow-hidden rounded-full ${done ? 'bg-pulse-accent' : 'bg-pulse-surface-2'}`}>
                        {current && !done && (
                            <span
                                className="absolute inset-y-0 left-0 w-3/5 rounded-full bg-pulse-accent"
                                style={{ boxShadow: '0 0 10px var(--color-pulse-accent)' }}
                            />
                        )}
                    </span>
                );
            })}
        </div>
    );
}

// The set-logger rows for a single exercise. SetLogger owns all logging logic
// (progression target, drop sets, plate calc, validation, edit/delete, PR tag).
function ExerciseSetRows({
    re,
    week,
    logs,
    unit,
    prMap,
    onSave,
    onDelete,
}: {
    re: RoutineExercise;
    week: number;
    logs: Logs;
    unit: Unit;
    prMap: PRMap;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
}) {
    const maxSets = parseMaxSets(re.sets);
    return (
        <div className="flex flex-col gap-2">
            {Array.from({ length: maxSets }, (_, s) => {
                const key = logKey(week, re.id, s);
                const prevKey = logKey(week - 1, re.id, s);
                const entry = logs[key];
                const isPR = !!(entry?.saved && isSetPR(entry.kg, entry.reps, re.id, prMap));
                return (
                    <SetLogger
                        key={key}
                        setIdx={s}
                        week={week}
                        type={re.workout_type}
                        entry={entry}
                        previousEntry={week > 1 && logs[prevKey]?.saved ? logs[prevKey] : undefined}
                        repsRange={re.reps}
                        unit={unit}
                        isPR={isPR}
                        onSave={(e) => onSave(key, e)}
                        onDelete={() => onDelete(key)}
                    />
                );
            })}
        </div>
    );
}

// The current step's logger rows. A superset renders both exercises, each under
// its own name so the pair reads clearly; the hero shows "Superset" above.
function StepBody({
    step,
    week,
    logs,
    unit,
    prMap,
    nameOf,
    onSave,
    onDelete,
}: {
    step: ExerciseItem;
    week: number;
    logs: Logs;
    unit: Unit;
    prMap: PRMap;
    nameOf: (re: RoutineExercise) => string;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
}) {
    if (Array.isArray(step)) {
        return (
            <div className="flex flex-col gap-5">
                {step.map((re) => (
                    <div key={re.id} className="flex flex-col gap-2">
                        <h3 className="font-pulse text-sm font-semibold text-pulse-text">{nameOf(re)}</h3>
                        <ExerciseSetRows
                            re={re}
                            week={week}
                            logs={logs}
                            unit={unit}
                            prMap={prMap}
                            onSave={onSave}
                            onDelete={onDelete}
                        />
                    </div>
                ))}
            </div>
        );
    }
    return (
        <ExerciseSetRows
            re={step}
            week={week}
            logs={logs}
            unit={unit}
            prMap={prMap}
            onSave={onSave}
            onDelete={onDelete}
        />
    );
}

function HeroChip({ b, k, last }: { b: string; k: string; last?: boolean }) {
    return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-pulse-border bg-white/[0.015] px-3.5 py-1.5">
            {last && <span className="text-[0.6875rem] tracking-[0.04em] text-pulse-muted">{k}</span>}
            <b className={`font-semibold ${last ? 'text-pulse-dim' : 'text-pulse-text'}`}>{b}</b>
            {!last && <span className="text-[0.6875rem] tracking-[0.04em] text-pulse-muted">{k}</span>}
        </span>
    );
}

function SessionStat({ v, k }: { v: number; k: string }) {
    return (
        <div className="flex-1 rounded-2xl border border-pulse-border bg-white/[0.015] px-4 py-3">
            <div className="font-pulse-display text-3xl font-extrabold leading-none text-pulse-text">{v}</div>
            <div className="mt-2 font-pulse-body text-[0.625rem] uppercase tracking-[0.14em] text-pulse-dim">{k}</div>
        </div>
    );
}

export default function WorkoutModeScreen({
    exercises,
    sessionId,
    variant,
    week,
    logs,
    unit,
    onSave,
    onDelete,
    onComplete,
    onClose,
    resolveDisplay,
    onSwapExercise,
}: Props) {
    const { prMap, autoAdvance, timerTrigger, timerDuration } = usePulse();
    const { show: showToast } = useToast();
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const steps = useMemo(() => groupExercises(exercises), [exercises]);
    const [stepIdx, setStepIdx] = useState(0);
    const [completing, setCompleting] = useState(false);

    // Clamp at read time: `steps` can shrink mid-session (revalidation, A/B swap),
    // which would otherwise leave stepIdx out of range and make `step` undefined.
    const safeIdx = steps.length === 0 ? 0 : Math.min(stepIdx, steps.length - 1);
    const step = steps[safeIdx];
    const isPair = Array.isArray(step);
    const isFirst = safeIdx === 0;
    const isLast = safeIdx === steps.length - 1;

    if (!step) return null;

    const nameOf = (re: RoutineExercise) => (resolveDisplay?.(re) ?? re.exercise).name;
    const single = Array.isArray(step) ? null : step;
    const pair = Array.isArray(step) ? step : null;
    const lastSession = single ? computeLastSession(logs, single.id, week) : null;

    // Fire a quiet success toast only on the save transition into a PR.
    function handleSetSave(key: string, entry: LogEntry) {
        const prev = logs[key];
        const firstDash = key.indexOf('-');
        const lastDash = key.lastIndexOf('-');
        const rid = key.slice(firstDash + 1, lastDash);
        const re = exercises.find((e) => e.id === rid);
        if (re) {
            const wasPR = !!(prev?.saved && isSetPR(prev.kg, prev.reps, re.id, prMap));
            const isNowPR = isSetPR(entry.kg, entry.reps, re.id, prMap);
            if (isNowPR && !wasPR) {
                showToast(`New PR on ${(resolveDisplay?.(re) ?? re.exercise).name}`, 'success');
            }
        }
        onSave(key, entry);
    }

    const currentDone = doneSetsForStep(step, week, logs);
    const currentTotal = totalSetsForStep(step);

    // Per the spec, a superset step can only advance after a completed round:
    // at least one saved set from each exercise in the pair. Singles are unchanged.
    const canAdvance = pair ? pair.every((re) => savedSetsForExercise(re, week, logs) >= 1) : true;

    // Step is fully logged: every set of every exercise in the step is saved.
    const stepComplete = currentTotal > 0 && currentDone === currentTotal;

    // Session-wide rollups for the pips, the desktop track and the stat tiles.
    const sessionDone = steps.reduce((sum, st) => sum + doneSetsForStep(st, week, logs), 0);
    const sessionTotal = steps.reduce((sum, st) => sum + totalSetsForStep(st), 0);
    const stepsDone = steps.filter((st) => {
        const t = totalSetsForStep(st);
        return t > 0 && doneSetsForStep(st, week, logs) === t;
    }).length;

    // When the rest timer hits 0 in guided mode, advance to the next step if the
    // setting is on and the current step is fully logged. Otherwise the timer just
    // resets as today.
    function handleRestComplete() {
        if (shouldAutoAdvance(autoAdvance, isLast, stepComplete)) {
            setStepIdx((i) => i + 1);
        }
    }

    async function handleFinish() {
        if (!sessionId) return;
        setCompleting(true);
        await onComplete();
        setCompleting(false);
    }

    // "Superset" lives in the hero name (not here) so it reads once; the topbar
    // stays the step counter the tests and navigation rely on.
    const stepLabel = isPair ? `Step ${safeIdx + 1} of ${steps.length}` : `Exercise ${safeIdx + 1} of ${steps.length}`;
    const sessionType = (Array.isArray(steps[0]) ? steps[0][0] : steps[0])?.workout_type;
    const sessionSubtitle = `${sessionType ? WORKOUT_TYPE_LABELS[sessionType] : 'Workout'}${variant ? ` ${variant}` : ''} · ${exercises.length} ${exercises.length === 1 ? 'exercise' : 'exercises'}`;
    // Desktop track spine fill: accent up to the current step, then border.
    const spineFill = steps.length > 1 ? (safeIdx / (steps.length - 1)) * 100 : 0;

    // Shared elements (each rendered in exactly one of the two layout branches).
    const stepBody = (
        <StepBody
            step={step}
            week={week}
            logs={logs}
            unit={unit}
            prMap={prMap}
            nameOf={nameOf}
            onSave={handleSetSave}
            onDelete={onDelete}
        />
    );
    const setsCount = (
        <span className="font-pulse-body text-pulse-muted">
            <b className="font-semibold text-pulse-accent">
                {currentDone} {currentDone === 1 ? 'set' : 'sets'} logged
            </b>{' '}
            · this exercise
        </span>
    );
    const pipsMeta = (
        <div className="mt-2 flex justify-between font-pulse-body text-[0.65625rem] tracking-[0.04em] text-pulse-dim">
            <span>
                <b className="font-semibold text-pulse-text">{stepsDone}</b> done
            </span>
            <span>{steps.length - stepsDone} to go</span>
        </div>
    );
    const primaryCta = !isLast ? (
        <button
            aria-label="next exercise"
            onClick={() => setStepIdx((i) => i + 1)}
            disabled={!canAdvance}
            className={CTA_CLASS}
            style={CTA_GRADIENT}>
            Next exercise <span aria-hidden>→</span>
        </button>
    ) : (
        <button
            aria-label="finish workout"
            onClick={handleFinish}
            disabled={completing || sessionId === null}
            className={CTA_CLASS}
            style={CTA_GRADIENT}>
            {completing ? (
                'Finishing…'
            ) : (
                <>
                    Finish workout <span aria-hidden>✓</span>
                </>
            )}
        </button>
    );
    const earlyFinish = !isLast ? (
        <button
            aria-label="finish workout early"
            onClick={handleFinish}
            disabled={completing || sessionId === null}
            className="cursor-pointer border-none bg-transparent px-2 py-1 font-pulse-body text-[0.6875rem] tracking-[0.04em] text-pulse-muted hover:text-pulse-dim disabled:opacity-50">
            Finish workout early
        </button>
    ) : null;

    // ---------------------------------------------------------------- MOBILE (Focus)
    if (!isDesktop) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-pulse-bg">
                <div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-0 z-0 h-[420px] w-[520px] -translate-x-1/2"
                    style={{
                        background:
                            'radial-gradient(circle, color-mix(in srgb, var(--color-pulse-accent) 13%, transparent) 0%, transparent 65%)',
                    }}
                />
                <div
                    className="relative z-10 flex h-full flex-col px-5"
                    style={{
                        paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
                        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
                    }}>
                    {/* Topbar */}
                    <div className="flex flex-shrink-0 items-center justify-between">
                        <button
                            aria-label="previous exercise"
                            onClick={() => setStepIdx((i) => i - 1)}
                            disabled={isFirst}
                            className={ICON_BTN}>
                            ‹
                        </button>
                        <div className="text-center leading-tight">
                            <div className="font-pulse-display text-[0.8125rem] font-bold uppercase tracking-[0.16em] text-pulse-text">
                                {stepLabel}
                            </div>
                            {variant && (
                                <div className="mt-0.5 font-pulse-body text-[0.65625rem] tracking-[0.1em] text-pulse-muted">
                                    VARIANT <b className="font-semibold text-pulse-accent">{variant}</b>
                                </div>
                            )}
                        </div>
                        <button aria-label="close" onClick={onClose} className={ICON_BTN}>
                            ✕
                        </button>
                    </div>

                    {/* Overall progress */}
                    <div className="mt-4 flex-shrink-0">
                        <PipTrack steps={steps} currentIdx={safeIdx} week={week} logs={logs} />
                        {pipsMeta}
                    </div>

                    {/* Hero */}
                    <div className="mt-5 flex flex-shrink-0 items-center gap-3.5">
                        <div className="min-w-0 flex-1">
                            <div className="font-pulse-body text-[0.65625rem] font-semibold uppercase tracking-[0.22em] text-pulse-accent">
                                Now lifting
                            </div>
                            <h2 className="mt-1.5 break-words text-balance font-pulse-display text-[2.5rem] font-bold uppercase leading-[0.92] tracking-[-0.01em] text-pulse-text">
                                {single ? nameOf(single) : 'Superset'}
                            </h2>
                            <div className="mt-2.5 font-pulse-body text-[0.71875rem] leading-relaxed text-pulse-dim">
                                {single ? (
                                    <>
                                        {single.sets} sets <span className="text-pulse-muted">·</span> {single.reps}{' '}
                                        reps
                                        {lastSession && (
                                            <>
                                                <br />
                                                <span className="text-pulse-muted">Last: </span>
                                                <b className="font-semibold text-pulse-dim">
                                                    {toDisplay(lastSession.kg, unit)} {unit} × {lastSession.reps}
                                                </b>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    pair && (
                                        <>
                                            {pair.length} exercises <span className="text-pulse-muted">·</span>{' '}
                                            alternate sets
                                        </>
                                    )
                                )}
                            </div>
                            {single && onSwapExercise && (
                                <button
                                    aria-label="swap exercise"
                                    onClick={() => onSwapExercise(single)}
                                    className="mt-2 cursor-pointer border-none bg-transparent p-0 font-pulse-body text-[0.71875rem] text-pulse-dim hover:text-pulse-accent">
                                    <span aria-hidden>⇄</span> Swap exercise
                                </button>
                            )}
                        </div>
                        <ProgressRing
                            done={currentDone}
                            total={currentTotal}
                            size={96}
                            stroke={6}
                            numClass="font-pulse-display text-[2.125rem] font-extrabold text-pulse-text"
                            denClass="mt-0.5 font-pulse text-[0.625rem] uppercase tracking-[0.18em] text-pulse-muted"
                            denText={`of ${currentTotal}`}
                        />
                    </div>

                    {/* Sets */}
                    <div className="mt-5 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
                        <div className="flex flex-shrink-0 items-baseline justify-between">
                            <span className="font-pulse-display text-[0.8125rem] font-semibold uppercase tracking-[0.14em] text-pulse-dim">
                                Sets
                            </span>
                            <span className="text-[0.65625rem]">{setsCount}</span>
                        </div>
                        {stepBody}
                    </div>

                    {/* Rest */}
                    <div className="mt-3 flex-shrink-0">
                        <RestTimer
                            trigger={timerTrigger}
                            duration={timerDuration ?? undefined}
                            onComplete={handleRestComplete}
                        />
                    </div>

                    {/* Footer */}
                    <div className="mt-3 flex flex-shrink-0 flex-col items-center gap-2.5">
                        {primaryCta}
                        {earlyFinish}
                    </div>
                </div>
            </div>
        );
    }

    // --------------------------------------------------------------- DESKTOP (two-pane)
    return (
        <div className="fixed inset-0 z-50 flex overflow-hidden bg-pulse-bg">
            <div
                aria-hidden
                className="pointer-events-none absolute left-[18%] top-[-260px] z-0 h-[640px] w-[780px]"
                style={{
                    background:
                        'radial-gradient(circle, color-mix(in srgb, var(--color-pulse-accent) 12%, transparent) 0%, transparent 64%)',
                }}
            />

            {/* LEFT — main focus pane */}
            <main className="relative z-10 flex h-full min-w-0 flex-1 flex-col px-14 py-10">
                <div className="flex flex-shrink-0 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            aria-label="previous exercise"
                            onClick={() => setStepIdx((i) => i - 1)}
                            disabled={isFirst}
                            className={ICON_BTN}>
                            ‹
                        </button>
                        <div>
                            <div className="font-pulse-display text-[0.9375rem] font-bold uppercase tracking-[0.16em] text-pulse-text">
                                {stepLabel}
                            </div>
                            {variant && (
                                <div className="mt-0.5 font-pulse-body text-[0.6875rem] tracking-[0.1em] text-pulse-muted">
                                    VARIANT <b className="font-semibold text-pulse-accent">{variant}</b>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 font-pulse-body text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-pulse-accent">
                        <span
                            className="h-[7px] w-[7px] animate-pulse rounded-full bg-pulse-accent"
                            style={{ boxShadow: '0 0 10px var(--color-pulse-accent)' }}
                        />
                        Now lifting
                    </div>
                </div>

                <div className="mt-10 flex flex-shrink-0 items-start justify-between gap-10">
                    <div className="min-w-0">
                        <div className="font-pulse-body text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-pulse-accent">
                            {isPair ? 'Current set' : 'Current exercise'}
                        </div>
                        <h2 className="mt-3 break-words font-pulse-display text-[5.25rem] font-bold uppercase leading-[0.88] tracking-[-0.015em] text-pulse-text">
                            {single ? nameOf(single) : 'Superset'}
                        </h2>
                        <div className="mt-5 flex flex-wrap items-center gap-2.5 font-pulse-body text-[0.84375rem] text-pulse-dim">
                            {single ? (
                                <>
                                    <HeroChip b={single.sets} k="sets" />
                                    <HeroChip b={single.reps} k="reps" />
                                    {lastSession && (
                                        <HeroChip
                                            last
                                            k="Last"
                                            b={`${toDisplay(lastSession.kg, unit)} ${unit} × ${lastSession.reps}`}
                                        />
                                    )}
                                </>
                            ) : (
                                pair && <HeroChip b={String(pair.length)} k="exercises" />
                            )}
                            {single && onSwapExercise && (
                                <button
                                    aria-label="swap exercise"
                                    onClick={() => onSwapExercise(single)}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-pulse-border bg-white/[0.015] px-3.5 py-1.5 font-pulse-body text-[0.84375rem] text-pulse-dim transition-colors hover:border-pulse-muted hover:text-pulse-accent">
                                    <span aria-hidden>⇄</span> Swap
                                </button>
                            )}
                        </div>
                    </div>
                    <ProgressRing
                        done={currentDone}
                        total={currentTotal}
                        size={138}
                        stroke={8}
                        numClass="font-pulse-display text-[3.25rem] font-extrabold text-pulse-text"
                        denClass="mt-1 font-pulse text-[0.6875rem] uppercase tracking-[0.2em] text-pulse-muted"
                        denText={`of ${currentTotal} sets`}
                    />
                </div>

                <section className="mt-9 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                    <div className="flex flex-shrink-0 items-baseline justify-between">
                        <span className="font-pulse-display text-base font-semibold uppercase tracking-[0.14em] text-pulse-dim">
                            Sets
                        </span>
                        <span className="text-xs">{setsCount}</span>
                    </div>
                    {stepBody}
                </section>
            </main>

            {/* RIGHT — session sidebar */}
            <aside
                className="relative z-20 flex h-full w-[392px] flex-shrink-0 flex-col border-l border-pulse-border"
                style={{
                    background:
                        'linear-gradient(180deg, color-mix(in srgb, var(--color-pulse-surface) 72%, transparent), color-mix(in srgb, var(--color-pulse-bg) 86%, transparent))',
                    backdropFilter: 'blur(10px)',
                }}>
                <div className="flex-shrink-0 px-[1.875rem] pb-5 pt-9">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="font-pulse-display text-[1.0625rem] font-bold uppercase tracking-[0.16em] text-pulse-text">
                                This session
                            </div>
                            <div className="mt-1.5 font-pulse-body text-[0.6875rem] tracking-[0.04em] text-pulse-dim">
                                {sessionSubtitle}
                            </div>
                        </div>
                        <button aria-label="close" onClick={onClose} className={ICON_BTN}>
                            ✕
                        </button>
                    </div>
                    <div className="mt-4">
                        <PipTrack steps={steps} currentIdx={safeIdx} week={week} logs={logs} />
                        {pipsMeta}
                    </div>
                </div>

                {/* Whole-session track — click any step to jump */}
                <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-2.5 pt-1.5">
                    {steps.length > 1 && (
                        <div
                            aria-hidden
                            className="pointer-events-none absolute bottom-[2.125rem] left-[2.4375rem] top-[1.875rem] z-0 w-0.5"
                            style={{
                                background: `linear-gradient(180deg, var(--color-pulse-accent) 0%, var(--color-pulse-accent) ${spineFill}%, var(--color-pulse-border) ${spineFill}%)`,
                            }}
                        />
                    )}
                    {steps.map((st, i) => {
                        const total = totalSetsForStep(st);
                        const d = doneSetsForStep(st, week, logs);
                        const done = total > 0 && d === total;
                        const current = i === safeIdx;
                        const rowName = Array.isArray(st) ? st.map((re) => nameOf(re)).join(' + ') : nameOf(st);
                        const detail = Array.isArray(st) ? 'Superset' : `${st.sets} × ${st.reps}`;
                        return (
                            <button
                                key={Array.isArray(st) ? st[0].id : st.id}
                                onClick={() => setStepIdx(i)}
                                aria-current={current ? 'step' : undefined}
                                className={`relative z-10 flex w-full items-center gap-3.5 rounded-xl px-2 py-3 text-left transition-colors ${
                                    current
                                        ? 'border border-pulse-accent/25 bg-pulse-accent/10'
                                        : 'border border-transparent hover:bg-pulse-surface/60'
                                }`}>
                                <span
                                    aria-hidden
                                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-pulse-display text-[0.8125rem] font-bold ${
                                        done
                                            ? 'bg-pulse-accent/15 text-pulse-accent'
                                            : current
                                              ? 'bg-pulse-accent text-pulse-bg'
                                              : 'border-2 border-pulse-border bg-pulse-bg text-pulse-muted'
                                    }`}
                                    style={
                                        current
                                            ? {
                                                  boxShadow:
                                                      '0 0 0 5px color-mix(in srgb, var(--color-pulse-accent) 14%, transparent)',
                                              }
                                            : undefined
                                    }>
                                    {done ? '✓' : i + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span
                                        className={`block truncate font-pulse text-sm font-semibold ${
                                            current ? 'text-pulse-text' : 'text-pulse-dim'
                                        }`}>
                                        {rowName}
                                    </span>
                                    <span
                                        className={`mt-0.5 block font-pulse-body text-[0.65625rem] tracking-[0.02em] ${
                                            current ? 'text-pulse-accent' : 'text-pulse-dim'
                                        }`}>
                                        {detail}
                                        {done ? ' · done' : current ? ' · in progress' : ''}
                                    </span>
                                </span>
                                {current ? (
                                    <span className="shrink-0 font-pulse-body text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-pulse-accent">
                                        Now
                                    </span>
                                ) : (
                                    <span
                                        aria-hidden
                                        className={`shrink-0 font-pulse-display text-[0.8125rem] font-semibold tracking-[0.04em] ${
                                            done ? 'text-pulse-accent' : 'text-pulse-dim'
                                        }`}>
                                        {d}/{total}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Docked rest timer + stats + actions */}
                <div
                    className="flex-shrink-0 border-t border-pulse-border px-6 pb-6 pt-[1.125rem]"
                    style={{ background: 'color-mix(in srgb, var(--color-pulse-bg) 50%, transparent)' }}>
                    <RestTimer
                        trigger={timerTrigger}
                        duration={timerDuration ?? undefined}
                        onComplete={handleRestComplete}
                    />
                    <div className="mt-4 flex gap-3">
                        <SessionStat v={sessionDone} k="Sets logged" />
                        <SessionStat v={Math.max(0, sessionTotal - sessionDone)} k="Sets left" />
                    </div>
                    <div className="mt-4 flex flex-col items-center gap-3">
                        {primaryCta}
                        {earlyFinish}
                    </div>
                </div>
            </aside>
        </div>
    );
}
