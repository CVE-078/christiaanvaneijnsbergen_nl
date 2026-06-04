'use client';
import { useMemo, useState } from 'react';
import { logKey, parseMaxSets, computeLastSession, isSetPR, groupExercises } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { useToast } from '@/lib/pulse/toast';
import SetLogger from './SetLogger';
import RestTimer from './RestTimer';
import { BTN_PRIMARY_BLOCK } from './ui';
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

function SingleStep({
    re,
    week,
    logs,
    unit,
    prMap,
    displayName,
    onSwap,
    onSave,
    onDelete,
}: {
    re: RoutineExercise;
    week: number;
    logs: Logs;
    unit: Unit;
    prMap: PRMap;
    displayName: string;
    onSwap?: () => void;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
}) {
    const maxSets = parseMaxSets(re.sets);
    const lastSession = computeLastSession(logs, re.id, week);
    return (
        <>
            <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="font-pulse text-xl font-bold text-pulse-text">{displayName}</h2>
                {onSwap && (
                    <button
                        onClick={onSwap}
                        className="font-pulse text-[0.8125rem] text-pulse-dim bg-transparent border-none cursor-pointer hover:text-pulse-accent shrink-0 mt-1">
                        ⇄ Swap
                    </button>
                )}
            </div>
            <p className="font-pulse text-sm text-pulse-muted mb-5">
                {re.sets} sets · {re.reps} reps
                {lastSession ? ` · Last: ${lastSession.kg}kg × ${lastSession.reps}` : ''}
            </p>
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
        </>
    );
}

function PairStep({
    pair,
    week,
    logs,
    unit,
    prMap,
    onSave,
    onDelete,
}: {
    pair: [RoutineExercise, RoutineExercise];
    week: number;
    logs: Logs;
    unit: Unit;
    prMap: PRMap;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
}) {
    const [first, second] = pair;
    const firstMax = parseMaxSets(first.sets);
    const secondMax = parseMaxSets(second.sets);
    const firstLast = computeLastSession(logs, first.id, week);
    const secondLast = computeLastSession(logs, second.id, week);
    return (
        <>
            {/* Exercise A */}
            <div className="mb-5">
                <h2 className="font-pulse text-lg font-bold text-pulse-text mb-0.5">{first.exercise.name}</h2>
                <p className="font-pulse text-sm text-pulse-muted mb-3">
                    {first.sets} sets · {first.reps} reps
                    {firstLast ? ` · Last: ${firstLast.kg}kg × ${firstLast.reps}` : ''}
                </p>
                <div className="flex flex-col gap-2">
                    {Array.from({ length: firstMax }, (_, s) => {
                        const key = logKey(week, first.id, s);
                        const prevKey = logKey(week - 1, first.id, s);
                        const entry = logs[key];
                        const isPR = !!(entry?.saved && isSetPR(entry.kg, entry.reps, first.id, prMap));
                        return (
                            <SetLogger
                                key={key}
                                setIdx={s}
                                week={week}
                                type={first.workout_type}
                                entry={entry}
                                previousEntry={week > 1 && logs[prevKey]?.saved ? logs[prevKey] : undefined}
                                repsRange={first.reps}
                                unit={unit}
                                isPR={isPR}
                                onSave={(e) => onSave(key, e)}
                                onDelete={() => onDelete(key)}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="h-px bg-pulse-border mb-5" />
            {/* Exercise B */}
            <div>
                <h2 className="font-pulse text-lg font-bold text-pulse-text mb-0.5">{second.exercise.name}</h2>
                <p className="font-pulse text-sm text-pulse-muted mb-3">
                    {second.sets} sets · {second.reps} reps
                    {secondLast ? ` · Last: ${secondLast.kg}kg × ${secondLast.reps}` : ''}
                </p>
                <div className="flex flex-col gap-2">
                    {Array.from({ length: secondMax }, (_, s) => {
                        const key = logKey(week, second.id, s);
                        const prevKey = logKey(week - 1, second.id, s);
                        const entry = logs[key];
                        const isPR = !!(entry?.saved && isSetPR(entry.kg, entry.reps, second.id, prMap));
                        return (
                            <SetLogger
                                key={key}
                                setIdx={s}
                                week={week}
                                type={second.workout_type}
                                entry={entry}
                                previousEntry={week > 1 && logs[prevKey]?.saved ? logs[prevKey] : undefined}
                                repsRange={second.reps}
                                unit={unit}
                                isPR={isPR}
                                onSave={(e) => onSave(key, e)}
                                onDelete={() => onDelete(key)}
                            />
                        );
                    })}
                </div>
            </div>
        </>
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

    const savedCount = isPair
        ? [step[0], step[1]].reduce((sum, re) => {
              const max = parseMaxSets(re.sets);
              return (
                  sum +
                  Array.from({ length: max }, (_, i) => logKey(week, re.id, i)).filter((k) => logs[k]?.saved).length
              );
          }, 0)
        : (() => {
              const re = step as RoutineExercise;
              const max = parseMaxSets(re.sets);
              return Array.from({ length: max }, (_, i) => logKey(week, re.id, i)).filter((k) => logs[k]?.saved).length;
          })();

    // Per the spec, a superset step can only advance after a completed round:
    // at least one saved set from each exercise in the pair. Singles are unchanged.
    const canAdvance = !isPair
        ? true
        : (step as [RoutineExercise, RoutineExercise]).every((re) => {
              const max = parseMaxSets(re.sets);
              return Array.from({ length: max }, (_, i) => logKey(week, re.id, i)).some((k) => logs[k]?.saved);
          });

    // Step is fully logged: single -> all sets saved; pair -> both exercises fully saved.
    const stepComplete = isPair
        ? (step as [RoutineExercise, RoutineExercise]).every((re) => {
              const max = parseMaxSets(re.sets);
              return Array.from({ length: max }, (_, i) => logKey(week, re.id, i)).every((k) => logs[k]?.saved);
          })
        : (() => {
              const re = step as RoutineExercise;
              const max = parseMaxSets(re.sets);
              return savedCount === max;
          })();

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

    const headerLabel = isPair
        ? `Superset · Step ${stepIdx + 1} of ${steps.length}${variant ? ` · Variant ${variant}` : ''}`
        : `Exercise ${stepIdx + 1} of ${steps.length}${variant ? ` · Variant ${variant}` : ''}`;

    return (
        <div className="fixed inset-0 z-50 bg-pulse-bg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-pulse-border">
                <button
                    aria-label="previous exercise"
                    onClick={() => setStepIdx((i) => i - 1)}
                    disabled={isFirst}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-pulse-border text-pulse-dim disabled:opacity-30 cursor-pointer disabled:cursor-default">
                    ‹
                </button>
                <div className="text-center">
                    <div className="font-pulse text-[0.6875rem] tracking-[0.08em] uppercase text-pulse-muted">
                        {headerLabel}
                    </div>
                </div>
                <button
                    aria-label="close"
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-pulse-border text-pulse-dim cursor-pointer">
                    ✕
                </button>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-4 py-5">
                {isPair ? (
                    <PairStep
                        pair={step as [RoutineExercise, RoutineExercise]}
                        week={week}
                        logs={logs}
                        unit={unit}
                        prMap={prMap}
                        onSave={handleSetSave}
                        onDelete={onDelete}
                    />
                ) : (
                    <SingleStep
                        re={step as RoutineExercise}
                        week={week}
                        logs={logs}
                        unit={unit}
                        prMap={prMap}
                        displayName={
                            (resolveDisplay?.(step as RoutineExercise) ?? (step as RoutineExercise).exercise).name
                        }
                        onSwap={onSwapExercise ? () => onSwapExercise(step as RoutineExercise) : undefined}
                        onSave={handleSetSave}
                        onDelete={onDelete}
                    />
                )}
                <div className="mt-3 font-pulse text-xs text-pulse-muted">{savedCount} sets logged</div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-6 pt-3 border-t border-pulse-border flex flex-col gap-2">
                <RestTimer
                    trigger={timerTrigger}
                    duration={timerDuration ?? undefined}
                    onComplete={handleRestComplete}
                />
                {!isLast ? (
                    <button
                        aria-label="next exercise"
                        onClick={() => setStepIdx((i) => i + 1)}
                        disabled={!canAdvance}
                        className={BTN_PRIMARY_BLOCK}>
                        Next exercise →
                    </button>
                ) : (
                    <button
                        aria-label="finish workout"
                        onClick={handleFinish}
                        disabled={completing || sessionId === null}
                        className={BTN_PRIMARY_BLOCK}>
                        {completing ? 'Finishing…' : 'Finish workout ✓'}
                    </button>
                )}
                {!isLast && (
                    <button
                        aria-label="finish workout early"
                        onClick={handleFinish}
                        disabled={completing || sessionId === null}
                        className="font-pulse w-full py-2 rounded-xl text-pulse-muted text-sm cursor-pointer border-none bg-transparent">
                        Finish workout early
                    </button>
                )}
            </div>
        </div>
    );
}
