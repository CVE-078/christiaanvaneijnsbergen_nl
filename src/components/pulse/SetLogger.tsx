'use client';
import { useEffect, useState } from 'react';
import {
    getRIR,
    computeProgression,
    deloadTarget,
    toDisplay,
    toKg,
    parseDecimalInput,
    MIN_KG,
    MAX_KG,
    DEFAULT_HOLD,
} from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { BARBELL_KG } from '@/lib/pulse/constants';
import { explainCopy } from '@/lib/pulse/explainCopy';
import PlateCalculator from './PlateCalculator';
import Why from './Why';
import type { LogEntry, WorkoutType, Unit } from '@/lib/pulse/types';

interface Props {
    setIdx: number;
    week: number;
    type: WorkoutType;
    entry: LogEntry | undefined;
    previousEntry?: LogEntry;
    // The set logged just before this one in the SAME session (previous set index,
    // this week). When present, the guided quick-fill copies its weight + reps, the
    // common "every set at the same load" case. Only passed for set 2+ once the
    // prior set is saved, so its presence means there is a set to copy.
    prevSetEntry?: LogEntry;
    repsRange?: string;
    isPR?: boolean;
    unit: Unit;
    // When set, this lift is stalled and auto-deloading: the prefilled target
    // drops to ~90% of the previous weight with reps reset to the bottom of the
    // range, instead of the normal progression. Decided per-exercise in ExerciseCard.
    deload?: boolean;
    // Bodyweight exercise (no equipment): weight becomes optional (blank = pure
    // bodyweight, a number = added load) and progression is rep-based. The caller
    // derives this from the exercise's equipment via isBodyweight.
    bodyweight?: boolean;
    // 'editorial' is the guided-mode look: hairline rows with a "Set N" label and
    // a big display value, vs the surface card used on the Train screen ('card').
    variant?: 'card' | 'editorial';
    // Guided single-active focus (editorial only): when false, an unsaved set
    // renders as a dimmed "not started" preview instead of a full input form, so
    // only the next set you log shows inputs. Default true, so the Train card
    // variant and every existing caller are unaffected.
    active?: boolean;
    // Total sets for this exercise. Editorial shows "Set N / total" so you know
    // where you are; omitted (card variant) keeps the bare "Set N".
    totalSets?: number;
    // Whether the plate calculator applies (barbell / plate-loaded lifts). The
    // caller derives this from equipment via isPlateLoaded; default true keeps
    // existing callers unchanged. Off hides the calc on dumbbell / cable / machine.
    plateLoaded?: boolean;
    // P1.3b: a timed isometric hold (e.g. Plank), derived by the caller from the
    // exercise's prescription_unit === 'time'. Replaces the weight x reps form with
    // a single seconds input and logs a hold (duration_s, kg/reps 0). Default false
    // keeps every weight-based caller byte-identical. A hold carries no e1RM /
    // progression / deload / plate calc / drop set / RIR.
    timed?: boolean;
    // The hold prescription for a timed exercise, e.g. "30-60s" (from the
    // exercise's default_reps). Separate from repsRange, which always carries the
    // NUMERIC generated rep range even for a hold; the timed branch shows the
    // seconds prescription, not those reps. Falls back to DEFAULT_HOLD when absent.
    holdRange?: string;
    onSave: (entry: LogEntry) => void;
    onDelete?: () => void;
}

const inputClass =
    'w-[3.75rem] h-10 px-2 bg-pulse-surface-2 border border-pulse-border rounded-lg text-pulse-text font-pulse text-base font-semibold text-center outline-none focus:border-pulse-accent/50 transition-colors';

// Render-only stable id for drop-set rows so React keys survive removing a
// middle row (index keys would shift stateful inputs into the wrong row).
// Not persisted: the `drops` jsonb stays an array of { kg, reps } values.
type DropDraft = { id: string; kg: string; reps: string };
let dropIdSeq = 0;
function newDropId() {
    return `drop-${dropIdSeq++}`;
}

export default function SetLogger({
    setIdx,
    week,
    entry,
    previousEntry,
    prevSetEntry,
    repsRange,
    isPR,
    unit,
    deload,
    bodyweight = false,
    variant = 'card',
    active = true,
    totalSets,
    plateLoaded = true,
    timed = false,
    holdRange,
    onSave,
    onDelete,
}: Props) {
    const progression = computeProgression(previousEntry, repsRange ?? '', week, bodyweight);
    // A deload overrides the normal progression target when the lift is stalled.
    // Never for bodyweight: there is no external load to back off.
    const deloadTgt =
        !bodyweight && deload && previousEntry && week > 1 ? deloadTarget(previousEntry, repsRange ?? '') : null;
    const target = deloadTgt ?? progression;
    // A rep advance holds the weight and adds a rep; a weight advance bumps the
    // load and resets reps. Mirrors decisionCopy's read so the "why" matches the
    // logged DecisionEvent. (Drives the explain-layer affordance on the target.)
    const isRepAdvance =
        !!previousEntry && !!progression && progression.kg <= previousEntry.kg && progression.reps > previousEntry.reps;

    function initKg() {
        // Bodyweight with no added load shows a blank field (placeholder), not "0".
        if (entry?.kg !== undefined) return bodyweight && entry.kg === 0 ? '' : String(toDisplay(entry.kg, unit));
        if (target) return bodyweight && target.kg === 0 ? '' : String(toDisplay(target.kg, unit));
        return '';
    }

    function initReps() {
        if (entry?.reps !== undefined) return String(entry.reps);
        if (target) return String(target.reps);
        return '';
    }

    const [kg, setKg] = useState(initKg);
    const [reps, setReps] = useState(initReps);
    const [drops, setDrops] = useState<DropDraft[]>(
        () =>
            entry?.drops?.map((d) => ({ id: newDropId(), kg: String(toDisplay(d.kg, unit)), reps: String(d.reps) })) ??
            [],
    );
    // P1.3b timed-hold input (whole seconds). Prefilled from the saved hold, else
    // the first number of the hold prescription (e.g. "30-60s" -> "30"). Uses
    // holdRange (default_reps), NOT repsRange (which carries the numeric rep range).
    const [seconds, setSeconds] = useState(() => {
        if (entry?.duration_s != null) return String(entry.duration_s);
        const firstNum = ((holdRange ?? '').trim() || DEFAULT_HOLD).match(/\d+/)?.[0];
        return firstNum ?? '';
    });
    const [editing, setEditing] = useState(false);
    const [inputError, setInputError] = useState<string | null>(null);
    const [platesOpen, setPlatesOpen] = useState(false);
    // Editorial per-set overflow menu (currently just "Add drop set"; the home for
    // future per-set actions like swap). Card variant keeps Add-drop inline.
    const [overflowOpen, setOverflowOpen] = useState(false);
    // SetLogger always renders inside the Pulse provider (Train and guided mode),
    // so the active routine's block length drives the RIR target; the program
    // repeats past the block, so getRIR wraps. Defaults to a 12-week block.
    const { activeRoutine } = usePulse();
    const targetRIR = getRIR(week, activeRoutine?.program_weeks ?? 12);
    const saved = entry?.saved ?? false;

    // Intentionally only [unit]: re-syncs display value when unit changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!saved || editing) {
            const baseKg = entry?.kg ?? target?.kg ?? null;
            if (baseKg !== null) setKg(bodyweight && baseKg === 0 ? '' : String(toDisplay(baseKg, unit)));
            const baseReps = entry?.reps ?? target?.reps ?? null;
            if (baseReps !== null) setReps(String(baseReps));
            setDrops(
                entry?.drops?.map((d) => ({
                    id: newDropId(),
                    kg: String(toDisplay(d.kg, unit)),
                    reps: String(d.reps),
                })) ?? [],
            );
        }
    }, [unit]);

    const displayMin = toDisplay(MIN_KG, unit);
    const displayMax = toDisplay(MAX_KG, unit);
    const displayStep = unit === 'lbs' ? 1 : 0.5;

    function handleSave() {
        // Bodyweight: a blank weight is valid (pure bodyweight = 0 kg); a number is
        // optional added load. Every other exercise still requires a positive weight.
        let kgNum: number;
        if (bodyweight && kg.trim() === '') {
            kgNum = 0;
        } else {
            const displayNum = parseDecimalInput(kg);
            if (isNaN(displayNum) || displayNum <= 0) {
                setInputError(bodyweight ? 'Enter added weight or leave blank' : 'Enter a valid weight');
                return;
            }
            kgNum = toKg(displayNum, unit);
            if (kgNum <= 0 || kgNum > MAX_KG) {
                setInputError(`Max ${toDisplay(MAX_KG, unit)} ${unit}`);
                return;
            }
        }
        const repsNum = parseInt(reps, 10);
        if (!repsNum || repsNum < 1 || repsNum > 100) {
            setInputError('Enter valid reps (1–100)');
            return;
        }
        setInputError(null);
        const savedDrops = drops
            .map((d) => ({ kg: toKg(parseDecimalInput(d.kg), unit), reps: parseInt(d.reps, 10) }))
            .filter((d) => d.kg > 0 && d.reps > 0);
        onSave({
            kg: kgNum,
            reps: repsNum,
            rir: targetRIR,
            saved: true,
            ...(savedDrops.length > 0 ? { drops: savedDrops } : {}),
        });
        setEditing(false);
        // The plate calc and overflow are input-time aids; close them on save so the
        // logged row stays clean (and the panel does not get stranded open).
        setPlatesOpen(false);
        setOverflowOpen(false);
    }

    function resetDrafts() {
        // A pure-bodyweight set (kg 0) resets to a blank field, matching initKg.
        setKg(entry?.kg !== undefined && !(bodyweight && entry.kg === 0) ? String(toDisplay(entry.kg, unit)) : '');
        setReps(entry?.reps?.toString() ?? '');
        setDrops(
            entry?.drops?.map((d) => ({ id: newDropId(), kg: String(toDisplay(d.kg, unit)), reps: String(d.reps) })) ??
                [],
        );
    }

    function handleEdit() {
        resetDrafts();
        setEditing(true);
        setInputError(null);
    }

    function handleCancel() {
        resetDrafts();
        setEditing(false);
        setInputError(null);
    }

    // "Same as last": copy the previous set's weight + reps into the inputs, the
    // common case for identical 3-4 set blocks. A pure-bodyweight previous set
    // (kg 0) leaves the weight field blank, matching initKg.
    function applyPrevious() {
        if (!previousEntry) return;
        setKg(bodyweight && previousEntry.kg === 0 ? '' : String(toDisplay(previousEntry.kg, unit)));
        setReps(String(previousEntry.reps));
        setInputError(null);
    }

    // "Same as set N": copy the set you just logged in this session into the inputs,
    // the common case of holding the same load across a block's sets.
    function applyPrevSet() {
        if (!prevSetEntry) return;
        setKg(bodyweight && prevSetEntry.kg === 0 ? '' : String(toDisplay(prevSetEntry.kg, unit)));
        setReps(String(prevSetEntry.reps));
        setInputError(null);
    }

    function addDrop() {
        setDrops((prev) => [...prev, { id: newDropId(), kg: '', reps: '' }]);
    }

    const showInputs = !saved || editing;
    const editorial = variant === 'editorial';
    // "Set 2 / 3" when the caller passes the total (guided), else bare "Set 2".
    const setLabel = totalSets ? `Set ${setIdx + 1} / ${totalSets}` : `Set ${setIdx + 1}`;
    // Bodyweight weight field is optional added load; hint that with the placeholder.
    const weightPlaceholder = bodyweight ? '+kg' : unit;

    // Target weight (kg) for the plate calculator: the editable input while
    // logging, otherwise the saved weight. The affordance is hidden when this
    // sits below the lightest base (a dumbbell handle), where no plates apply.
    const parsedTarget = showInputs ? parseDecimalInput(kg) : (entry?.kg ?? NaN);
    const targetKg = showInputs && !isNaN(parsedTarget) ? toKg(parsedTarget, unit) : parsedTarget;
    // Barbell / plate-loaded lifts only, and only once there is at least an empty
    // bar's worth to load.
    const showPlates = plateLoaded && !isNaN(targetKg) && targetKg >= BARBELL_KG;

    // Plain-language RIR clause for the guided (editorial) coaching sentence: how
    // hard to push (reps left), with a failure cue at RIR 0 so "0 reps left" never shows.
    const rirClause =
        targetRIR > 0 ? `stop with about ${targetRIR} rep${targetRIR === 1 ? '' : 's'} left` : 'push close to failure';
    const deloadTankClause = targetRIR > 0 ? ` and keep ${targetRIR} rep${targetRIR === 1 ? '' : 's'} in the tank` : '';

    // ── P1.3b: timed isometric hold ─────────────────────────────────────────────
    // A self-contained branch: one seconds input, logs a hold (duration_s, kg/reps
    // 0). No weight x reps, e1RM, progression, deload, plate calc, drop set, or RIR,
    // so it leaves the entire weight-based render path below untouched.
    if (timed) {
        // holdRange (default_reps) already carries the unit, e.g. "30-60s"; fall back
        // to DEFAULT_HOLD. Never repsRange (the numeric generated rep range).
        const targetText = (holdRange ?? '').trim() || DEFAULT_HOLD;
        const handleSaveTimed = () => {
            const s = parseInt(seconds, 10);
            if (!Number.isFinite(s) || s < 1 || s > 3600) {
                setInputError('Enter seconds (1–3600)');
                return;
            }
            setInputError(null);
            onSave({ kg: 0, reps: 0, rir: 0, saved: true, duration_s: s });
            setEditing(false);
        };
        const resetSeconds = () => setSeconds(entry?.duration_s != null ? String(entry.duration_s) : '');
        const handleEditTimed = () => {
            resetSeconds();
            setEditing(true);
            setInputError(null);
        };
        const handleCancelTimed = () => {
            resetSeconds();
            setEditing(false);
            setInputError(null);
        };

        // Guided single-active focus: dimmed "not started" preview.
        if (editorial && !saved && !editing && !active) {
            return (
                <div className="flex items-center gap-3.5 border-b border-pulse-border py-3 opacity-50">
                    <span className="w-[3.75rem] shrink-0 font-pulse-body text-[0.625rem] uppercase tracking-[0.16em] text-pulse-muted">
                        {setLabel}
                    </span>
                    <span className="font-pulse-body text-[0.8125rem] tracking-[0.02em] text-pulse-muted">
                        Not started · hold {targetText}
                    </span>
                </div>
            );
        }

        const secondsInput = (
            <input
                type="number"
                aria-label="Hold time in seconds"
                placeholder="sec"
                inputMode="numeric"
                value={seconds}
                min={1}
                max={3600}
                step={5}
                onChange={(e) => {
                    setSeconds(e.target.value);
                    setInputError(null);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTimed();
                }}
                className={
                    editorial
                        ? 'w-16 min-w-0 bg-transparent font-pulse-display text-2xl font-bold leading-none text-pulse-text outline-none [appearance:textfield] placeholder:text-pulse-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                        : inputClass
                }
            />
        );

        return (
            <div className="flex flex-col">
                <div
                    className={
                        editorial
                            ? 'group flex items-center gap-3.5 border-b border-pulse-border py-3 transition-colors duration-200'
                            : `flex items-center gap-3 rounded-[11px] px-3.5 py-[0.6875rem] transition-colors duration-200 ${
                                  showInputs
                                      ? 'bg-transparent shadow-[inset_0_0_0_1px_var(--color-pulse-border)]'
                                      : 'bg-pulse-surface'
                              }`
                    }>
                    {editorial ? (
                        <span
                            className={`w-[3.75rem] shrink-0 font-pulse-body text-[0.625rem] uppercase tracking-[0.16em] ${
                                saved ? 'text-pulse-accent' : 'text-pulse-muted'
                            }`}>
                            {setLabel}
                        </span>
                    ) : (
                        <span
                            className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full ${
                                showInputs
                                    ? 'shadow-[inset_0_0_0_1.5px_var(--color-pulse-border)]'
                                    : 'bg-pulse-accent text-pulse-bg'
                            }`}>
                            {!showInputs && (
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={3.2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-3 w-3"
                                    aria-hidden>
                                    <path d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </span>
                    )}

                    {showInputs ? (
                        <>
                            <div className={`flex min-w-0 flex-1 flex-col ${editorial ? 'gap-2' : 'gap-[0.25rem]'}`}>
                                {editorial ? (
                                    <>
                                        <label className="flex w-fit flex-col gap-0.5 rounded-xl border border-pulse-border bg-pulse-bg px-3 py-1.5 transition-colors focus-within:border-pulse-accent/60">
                                            <span className="font-pulse-body text-[0.5625rem] uppercase tracking-[0.16em] text-pulse-muted">
                                                Hold
                                            </span>
                                            <span className="flex items-baseline gap-1">
                                                {secondsInput}
                                                <span className="font-pulse text-[0.6875rem] font-medium text-pulse-dim">
                                                    sec
                                                </span>
                                            </span>
                                        </label>
                                        <p className="font-pulse-body text-[0.75rem] leading-snug tracking-[0.01em] text-pulse-dim">
                                            Hold steady for {targetText}. Brace and breathe.
                                        </p>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="font-pulse-body text-[0.5625rem] uppercase tracking-[0.16em] text-pulse-muted">
                                            Hold
                                        </span>
                                        <span className="font-pulse text-[0.75rem] text-pulse-dim">
                                            target {targetText}
                                        </span>
                                    </div>
                                )}
                                {inputError && (
                                    <span className="font-pulse text-[0.6875rem] text-pulse-accent">{inputError}</span>
                                )}
                            </div>
                            {!editorial && (
                                <span className="flex shrink-0 items-baseline gap-1">
                                    {secondsInput}
                                    <span className="font-pulse text-[0.6875rem] font-medium text-pulse-dim">s</span>
                                </span>
                            )}
                            {editing && (
                                <button
                                    onClick={handleCancelTimed}
                                    className="shrink-0 cursor-pointer rounded-sm border border-pulse-border bg-transparent px-2 py-1 font-pulse text-[0.75rem] uppercase tracking-[0.06em] text-pulse-dim">
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={handleSaveTimed}
                                className="h-10 shrink-0 cursor-pointer rounded-[6px] border-none bg-pulse-accent px-4 font-pulse text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-pulse-bg transition-opacity duration-100">
                                {editing ? 'Update' : 'Save'}
                            </button>
                        </>
                    ) : (
                        <>
                            {editorial ? (
                                <span className="font-pulse-display text-xl font-semibold leading-none text-pulse-text">
                                    {entry!.duration_s}
                                    <span className="font-pulse text-[0.8125rem] font-medium text-pulse-dim">
                                        {' '}
                                        s hold
                                    </span>
                                </span>
                            ) : (
                                <span className="font-pulse text-[0.90625rem] tracking-[0.01em] text-pulse-text">
                                    {entry!.duration_s}s hold
                                </span>
                            )}
                            <div className="ml-auto flex shrink-0 items-center gap-3">
                                <div
                                    className={
                                        editorial
                                            ? 'flex items-center gap-3 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100'
                                            : 'contents'
                                    }>
                                    <button
                                        onClick={handleEditTimed}
                                        className="cursor-pointer border-none bg-transparent p-0 font-pulse text-[0.75rem] uppercase tracking-[0.06em] text-pulse-dim">
                                        Edit
                                    </button>
                                    {onDelete && (
                                        <button
                                            onClick={onDelete}
                                            className="cursor-pointer border-none bg-transparent p-0 font-pulse text-[0.75rem] text-pulse-dim">
                                            ✕
                                        </button>
                                    )}
                                </div>
                                {editorial && (
                                    <span className="grid h-[1.375rem] w-[1.375rem] place-items-center rounded-full bg-pulse-accent text-pulse-bg">
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={3.2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="h-3 w-3"
                                            aria-hidden>
                                            <path d="M5 13l4 4L19 7" />
                                        </svg>
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Guided single-active focus: an unsaved set that is not the active one shows a
    // dimmed "not started" preview instead of a full input form (Editorial draft C).
    if (editorial && !saved && !editing && !active) {
        return (
            <div className="flex items-center gap-3.5 border-b border-pulse-border py-3 opacity-50">
                <span className="w-[3.75rem] shrink-0 font-pulse-body text-[0.625rem] uppercase tracking-[0.16em] text-pulse-muted">
                    {setLabel}
                </span>
                <span className="font-pulse-body text-[0.8125rem] tracking-[0.02em] text-pulse-muted">
                    Not started · target RIR {targetRIR}
                </span>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <div
                className={
                    editorial
                        ? 'group flex items-center gap-3.5 border-b border-pulse-border py-3 transition-colors duration-200'
                        : `flex items-center gap-3 rounded-[11px] px-3.5 py-[0.6875rem] transition-colors duration-200 ${
                              showInputs
                                  ? 'bg-transparent shadow-[inset_0_0_0_1px_var(--color-pulse-border)]'
                                  : 'bg-pulse-surface'
                          }`
                }>
                {editorial ? (
                    <span
                        className={`w-[3.75rem] shrink-0 font-pulse-body text-[0.625rem] uppercase tracking-[0.16em] ${
                            saved ? 'text-pulse-accent' : 'text-pulse-muted'
                        }`}>
                        {setLabel}
                    </span>
                ) : (
                    /* check / pending indicator */
                    <span
                        className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full ${
                            showInputs
                                ? 'shadow-[inset_0_0_0_1.5px_var(--color-pulse-border)]'
                                : 'bg-pulse-accent text-pulse-bg'
                        }`}>
                        {!showInputs && (
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={3.2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-3 w-3"
                                aria-hidden>
                                <path d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </span>
                )}

                {showInputs ? (
                    <>
                        <div className={`flex min-w-0 flex-1 flex-col ${editorial ? 'gap-2' : 'gap-[0.25rem]'}`}>
                            {editorial ? (
                                <>
                                    <div className="flex items-stretch gap-2.5">
                                        <label className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border border-pulse-border bg-pulse-bg px-3 py-1.5 transition-colors focus-within:border-pulse-accent/60">
                                            <span className="font-pulse-body text-[0.5625rem] uppercase tracking-[0.16em] text-pulse-muted">
                                                {bodyweight ? 'Added' : 'Weight'}
                                            </span>
                                            <span className="flex items-baseline gap-1">
                                                <input
                                                    type="number"
                                                    aria-label={
                                                        bodyweight ? 'Added weight in ' + unit : `Weight in ${unit}`
                                                    }
                                                    placeholder={weightPlaceholder}
                                                    inputMode="decimal"
                                                    value={kg}
                                                    min={displayMin}
                                                    max={displayMax}
                                                    step={displayStep}
                                                    onChange={(e) => {
                                                        setKg(e.target.value);
                                                        setInputError(null);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSave();
                                                    }}
                                                    className="w-full min-w-0 bg-transparent font-pulse-display text-2xl font-bold leading-none text-pulse-text outline-none [appearance:textfield] placeholder:text-pulse-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                />
                                                <span className="font-pulse text-[0.6875rem] font-medium text-pulse-dim">
                                                    {unit}
                                                </span>
                                            </span>
                                        </label>
                                        <label className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border border-pulse-border bg-pulse-bg px-3 py-1.5 transition-colors focus-within:border-pulse-accent/60">
                                            <span className="font-pulse-body text-[0.5625rem] uppercase tracking-[0.16em] text-pulse-muted">
                                                Reps
                                            </span>
                                            <input
                                                type="number"
                                                aria-label="Repetitions"
                                                placeholder="reps"
                                                inputMode="numeric"
                                                value={reps}
                                                min={1}
                                                max={100}
                                                onChange={(e) => {
                                                    setReps(e.target.value);
                                                    setInputError(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSave();
                                                }}
                                                className="w-full min-w-0 bg-transparent font-pulse-display text-2xl font-bold leading-none text-pulse-text outline-none [appearance:textfield] placeholder:text-pulse-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                            />
                                        </label>
                                        <button
                                            onClick={handleSave}
                                            className="shrink-0 cursor-pointer self-stretch rounded-xl border-none bg-pulse-accent px-4 font-pulse text-sm font-semibold text-pulse-bg">
                                            {editing ? 'Update' : 'Save'}
                                        </button>
                                    </div>
                                    {/* Prescription chips: the rep target and RIR, shown by the
                                        inputs and visible even first-time (the rail only shows the
                                        target for upcoming exercises, not the one in progress). */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {repsRange && (
                                            <span className="rounded-md border border-pulse-accent/35 bg-pulse-surface px-2 py-0.5 font-pulse-body text-[0.625rem] tracking-[0.02em] text-pulse-text">
                                                {repsRange} reps
                                            </span>
                                        )}
                                        <span className="rounded-md border border-pulse-border bg-pulse-surface px-2 py-0.5 font-pulse-body text-[0.625rem] tracking-[0.02em] text-pulse-dim">
                                            RIR {targetRIR}
                                        </span>
                                    </div>
                                    {/* Coaching line: progression / deload target, last-time recall,
                                        or a first-time "start light" cue. */}
                                    {target && previousEntry ? (
                                        <span
                                            aria-label={deloadTgt ? 'Deload target' : 'Auto-progression target'}
                                            className="font-pulse-body text-[0.6875rem] font-medium leading-[1.45] tracking-[0.02em] text-pulse-accent">
                                            {deloadTgt
                                                ? `${explainCopy('deload').why} Drop to ${toDisplay(target.kg, unit)} ${unit} × ${target.reps}${deloadTankClause} to reset.`
                                                : bodyweight
                                                  ? `Last time you hit ${previousEntry.reps} reps${previousEntry.kg > 0 ? ` at +${toDisplay(previousEntry.kg, unit)} ${unit}` : ''}. Go for ${target.reps} and ${rirClause}.`
                                                  : `Last time you hit ${toDisplay(previousEntry.kg, unit)} ${unit} × ${previousEntry.reps}. Go for ${toDisplay(target.kg, unit)} ${unit} × ${target.reps} and ${rirClause}.`}
                                        </span>
                                    ) : previousEntry ? (
                                        <span className="font-pulse-body text-[0.6875rem] tracking-[0.02em] text-pulse-muted">
                                            Last{' '}
                                            {bodyweight
                                                ? `${previousEntry.reps} reps${previousEntry.kg > 0 ? ` at +${toDisplay(previousEntry.kg, unit)} ${unit}` : ''}`
                                                : `${toDisplay(previousEntry.kg, unit)} ${unit} × ${previousEntry.reps}`}
                                        </span>
                                    ) : (
                                        <span className="font-pulse-body text-[0.6875rem] tracking-[0.02em] text-pulse-muted">
                                            First time on this lift. Start light and {rirClause}.
                                        </span>
                                    )}
                                    {inputError && (
                                        <span className="font-pulse text-[0.6875rem] text-[#f43f5e]">{inputError}</span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            aria-label={bodyweight ? 'Added weight in ' + unit : `Weight in ${unit}`}
                                            placeholder={weightPlaceholder}
                                            inputMode="decimal"
                                            value={kg}
                                            min={displayMin}
                                            max={displayMax}
                                            step={displayStep}
                                            onChange={(e) => {
                                                setKg(e.target.value);
                                                setInputError(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSave();
                                            }}
                                            className={inputClass}
                                        />
                                        <span className="font-pulse text-pulse-muted text-sm">×</span>
                                        <input
                                            type="number"
                                            aria-label="Repetitions"
                                            placeholder="reps"
                                            inputMode="numeric"
                                            value={reps}
                                            min={1}
                                            max={100}
                                            onChange={(e) => {
                                                setReps(e.target.value);
                                                setInputError(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSave();
                                            }}
                                            className={inputClass}
                                        />
                                        <span className="font-pulse text-[0.8125rem] text-pulse-dim shrink-0">
                                            {targetRIR} RIR
                                        </span>
                                    </div>
                                    {previousEntry && (
                                        <span className="font-pulse text-[0.75rem] text-pulse-dim tracking-[0.04em]">
                                            Last{' '}
                                            {bodyweight
                                                ? `${previousEntry.reps} reps${previousEntry.kg > 0 ? ` at +${toDisplay(previousEntry.kg, unit)} ${unit}` : ''}`
                                                : `${toDisplay(previousEntry.kg, unit)} ${unit} × ${previousEntry.reps}`}
                                        </span>
                                    )}
                                    {target &&
                                        (bodyweight ? (
                                            <span
                                                aria-label="Auto-progression target"
                                                className="font-pulse text-[0.75rem] text-pulse-accent tracking-[0.04em]">
                                                Aim for {target.reps} reps
                                            </span>
                                        ) : deloadTgt ? (
                                            <span className="font-pulse text-[0.75rem] text-pulse-accent tracking-[0.04em]">
                                                Back off to{' '}
                                                <Why concept="deload" variant="why">
                                                    {toDisplay(target.kg, unit)} {unit} × {target.reps}
                                                </Why>
                                            </span>
                                        ) : (
                                            <span className="font-pulse text-[0.75rem] text-pulse-accent tracking-[0.04em]">
                                                Go{' '}
                                                <Why concept="progression" params={{ isRepAdvance }} variant="why">
                                                    {toDisplay(target.kg, unit)} {unit} × {target.reps}
                                                </Why>
                                            </span>
                                        ))}
                                    {inputError && (
                                        <span className="font-pulse text-[0.6875rem] text-[#f43f5e]">{inputError}</span>
                                    )}
                                </>
                            )}
                            {drops.map((d, di) => (
                                <div key={d.id} className="flex items-center gap-2">
                                    <span className="font-pulse text-pulse-dim text-sm shrink-0">↓</span>
                                    <input
                                        type="number"
                                        aria-label={`Drop ${di + 1} weight in ${unit}`}
                                        placeholder={unit}
                                        inputMode="decimal"
                                        value={d.kg}
                                        min={displayMin}
                                        max={displayMax}
                                        step={displayStep}
                                        onChange={(e) =>
                                            setDrops((prev) =>
                                                prev.map((p) => (p.id === d.id ? { ...p, kg: e.target.value } : p)),
                                            )
                                        }
                                        className={inputClass}
                                    />
                                    <span className="font-pulse text-pulse-muted text-sm">×</span>
                                    <input
                                        type="number"
                                        aria-label={`Drop ${di + 1} repetitions`}
                                        placeholder="reps"
                                        inputMode="numeric"
                                        value={d.reps}
                                        min={1}
                                        max={100}
                                        onChange={(e) =>
                                            setDrops((prev) =>
                                                prev.map((p) => (p.id === d.id ? { ...p, reps: e.target.value } : p)),
                                            )
                                        }
                                        className={inputClass}
                                    />
                                    <button
                                        type="button"
                                        aria-label={`Remove drop ${di + 1}`}
                                        onClick={() => setDrops((prev) => prev.filter((p) => p.id !== d.id))}
                                        className="font-pulse text-[0.75rem] text-pulse-dim bg-transparent border-none cursor-pointer p-0 shrink-0">
                                        ✕
                                    </button>
                                </div>
                            ))}
                            {/* Card keeps Add-drop inline; editorial tucks it in the ⋯ overflow below. */}
                            {!editorial && drops.length < 6 && (
                                <button
                                    type="button"
                                    onClick={addDrop}
                                    className="font-pulse text-[0.6875rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border-none cursor-pointer p-0 self-start">
                                    + Add drop
                                </button>
                            )}
                            {/* Editorial actions row: quick fill, plate calc, and the ⋯ overflow.
                                Save lives in the input row; Cancel (when editing) joins here. */}
                            {editorial && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {/* One contextual quick-fill: copy the set you just logged this
                                        session when there is one (set 2+), else recall last week's
                                        same set. Showing one button keeps the actions row uncluttered. */}
                                    {prevSetEntry ? (
                                        <button
                                            type="button"
                                            onClick={applyPrevSet}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-pulse-border bg-transparent px-2.5 py-1 font-pulse text-[0.6875rem] font-medium text-pulse-dim cursor-pointer transition-colors hover:border-pulse-muted hover:text-pulse-text">
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-3 w-3"
                                                aria-hidden>
                                                <rect x="9" y="9" width="11" height="11" rx="2" />
                                                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                                            </svg>
                                            Same as set {setIdx}
                                        </button>
                                    ) : (
                                        previousEntry && (
                                            <button
                                                type="button"
                                                onClick={applyPrevious}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-pulse-border bg-transparent px-2.5 py-1 font-pulse text-[0.6875rem] font-medium text-pulse-dim cursor-pointer transition-colors hover:border-pulse-muted hover:text-pulse-text">
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="h-3 w-3"
                                                    aria-hidden>
                                                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                                    <path d="M3 3v5h5" />
                                                </svg>
                                                Same as last
                                            </button>
                                        )
                                    )}
                                    {showPlates && (
                                        <button
                                            type="button"
                                            aria-label="Plate calculator"
                                            aria-expanded={platesOpen}
                                            onClick={() => setPlatesOpen((o) => !o)}
                                            className={`inline-flex items-center gap-1.5 rounded-lg border bg-transparent px-2.5 py-1 font-pulse text-[0.6875rem] font-medium cursor-pointer transition-colors ${
                                                platesOpen
                                                    ? 'border-pulse-accent/50 text-pulse-accent'
                                                    : 'border-pulse-border text-pulse-dim hover:border-pulse-muted hover:text-pulse-text'
                                            }`}>
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-3 w-3"
                                                aria-hidden>
                                                <rect x="3" y="8" width="3" height="8" rx="1" />
                                                <rect x="18" y="8" width="3" height="8" rx="1" />
                                                <line x1="6" y1="12" x2="18" y2="12" />
                                            </svg>
                                            Plate calculator
                                        </button>
                                    )}
                                    {editing && (
                                        <button
                                            type="button"
                                            onClick={handleCancel}
                                            className="rounded-lg border border-pulse-border bg-transparent px-2.5 py-1 font-pulse text-[0.6875rem] font-medium text-pulse-dim cursor-pointer transition-colors hover:border-pulse-muted hover:text-pulse-text">
                                            Cancel
                                        </button>
                                    )}
                                    {drops.length < 6 && (
                                        <div className="relative">
                                            <button
                                                type="button"
                                                aria-label="More set actions"
                                                aria-expanded={overflowOpen}
                                                onClick={() => setOverflowOpen((o) => !o)}
                                                className="grid h-7 w-[1.875rem] place-items-center rounded-lg border border-pulse-border bg-transparent text-pulse-muted cursor-pointer transition-colors hover:border-pulse-muted hover:text-pulse-text">
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    className="h-4 w-4"
                                                    aria-hidden>
                                                    <circle cx="5" cy="12" r="1.6" />
                                                    <circle cx="12" cy="12" r="1.6" />
                                                    <circle cx="19" cy="12" r="1.6" />
                                                </svg>
                                            </button>
                                            {overflowOpen && (
                                                <div className="absolute left-0 top-full z-10 mt-1.5 min-w-[10rem] rounded-xl border border-pulse-border bg-pulse-surface-2 p-1.5 shadow-lg">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            addDrop();
                                                            setOverflowOpen(false);
                                                        }}
                                                        className="w-full rounded-lg bg-transparent px-2.5 py-2 text-left font-pulse text-[0.8125rem] text-pulse-text cursor-pointer hover:bg-pulse-bg">
                                                        Add drop set
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Card right cluster: plate calc, Cancel, Save. Editorial moves these
                            into the input row (Save) and the actions row (plate calc, Cancel). */}
                        {!editorial && (
                            <div className="flex items-center gap-1.5 shrink-0">
                                {showPlates && (
                                    <button
                                        type="button"
                                        aria-label="Plate calculator"
                                        aria-expanded={platesOpen}
                                        onClick={() => setPlatesOpen((o) => !o)}
                                        className={`grid h-10 w-9 place-items-center rounded-[6px] bg-transparent border-none cursor-pointer shrink-0 transition-colors ${
                                            platesOpen ? 'text-pulse-accent' : 'text-pulse-dim'
                                        }`}>
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="h-[1.05rem] w-[1.05rem]"
                                            aria-hidden>
                                            <rect x="3" y="8" width="3" height="8" rx="1" />
                                            <rect x="18" y="8" width="3" height="8" rx="1" />
                                            <line x1="6" y1="12" x2="18" y2="12" />
                                        </svg>
                                    </button>
                                )}
                                {editing && (
                                    <button
                                        onClick={handleCancel}
                                        className="font-pulse text-[0.75rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border border-pulse-border rounded-sm py-1 px-2 cursor-pointer shrink-0">
                                        Cancel
                                    </button>
                                )}
                                <button
                                    onClick={handleSave}
                                    className="h-10 shrink-0 cursor-pointer rounded-[6px] border-none bg-pulse-accent px-4 font-pulse text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-pulse-bg transition-opacity duration-100">
                                    {editing ? 'Update' : 'Save'}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {editorial ? (
                            <span className="font-pulse-display text-xl font-semibold leading-none text-pulse-text">
                                {bodyweight && entry!.kg === 0 ? (
                                    'Bodyweight'
                                ) : (
                                    <>
                                        {bodyweight ? '+' : ''}
                                        {toDisplay(entry!.kg, unit)}
                                        <span className="font-pulse text-[0.8125rem] font-medium text-pulse-dim">
                                            {' '}
                                            {unit}
                                        </span>
                                    </>
                                )}
                                <span className="mx-1.5 text-pulse-muted">×</span>
                                {entry!.reps}
                            </span>
                        ) : (
                            <span className="font-pulse text-[0.90625rem] text-pulse-text tracking-[0.01em]">
                                {bodyweight && entry!.kg === 0
                                    ? 'Bodyweight'
                                    : `${bodyweight ? '+' : ''}${toDisplay(entry!.kg, unit)} ${unit}`}
                                <span className="text-pulse-muted mx-[5px]">×</span>
                                {entry!.reps}
                                <span className="text-pulse-dim ml-1.5">@ RIR {entry!.rir}</span>
                            </span>
                        )}
                        <div className="ml-auto flex items-center gap-3 shrink-0">
                            {editorial && (
                                <span className="rounded-md bg-pulse-surface-2 px-2 py-0.5 font-pulse-body text-[0.625rem] tracking-[0.04em] text-pulse-dim">
                                    RIR {entry!.rir}
                                </span>
                            )}
                            {entry?.rir === 0 && (
                                <span
                                    className="font-pulse text-[0.625rem] uppercase tracking-[0.08em] text-pulse-accent"
                                    title="Taken to failure">
                                    Failure
                                </span>
                            )}
                            {isPR && (
                                <span className="font-pulse text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-pulse-accent">
                                    PR
                                </span>
                            )}
                            {showPlates && !editorial && (
                                <button
                                    type="button"
                                    aria-label="Plate calculator"
                                    aria-expanded={platesOpen}
                                    onClick={() => setPlatesOpen((o) => !o)}
                                    className={`grid place-items-center bg-transparent border-none cursor-pointer p-0 transition-colors ${
                                        platesOpen ? 'text-pulse-accent' : 'text-pulse-dim'
                                    }`}>
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-[1.05rem] w-[1.05rem]"
                                        aria-hidden>
                                        <rect x="3" y="8" width="3" height="8" rx="1" />
                                        <rect x="18" y="8" width="3" height="8" rx="1" />
                                        <line x1="6" y1="12" x2="18" y2="12" />
                                    </svg>
                                </button>
                            )}
                            {/* Editorial keeps the logged row clean: Edit/delete are de-emphasized
                                and brighten on hover/focus; the Train card keeps them inline. */}
                            <div
                                className={
                                    editorial
                                        ? 'flex items-center gap-3 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100'
                                        : 'contents'
                                }>
                                <button
                                    onClick={handleEdit}
                                    className="font-pulse text-[0.75rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border-none cursor-pointer p-0">
                                    Edit
                                </button>
                                {onDelete && (
                                    <button
                                        onClick={onDelete}
                                        className="font-pulse text-[0.75rem] text-pulse-dim bg-transparent border-none cursor-pointer p-0">
                                        ✕
                                    </button>
                                )}
                            </div>
                            {editorial && (
                                <span className="grid h-[1.375rem] w-[1.375rem] place-items-center rounded-full bg-pulse-accent text-pulse-bg">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={3.2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-3 w-3"
                                        aria-hidden>
                                        <path d="M5 13l4 4L19 7" />
                                    </svg>
                                </span>
                            )}
                        </div>
                    </>
                )}
            </div>
            {!showInputs && entry?.drops && entry.drops.length > 0 && (
                <div className="font-pulse text-[0.75rem] text-pulse-dim pl-[2.375rem] mt-0.5">
                    ↓{' '}
                    {entry.drops.map((d, di) => (
                        <span key={di}>
                            {di > 0 && <span className="text-pulse-muted"> · </span>}
                            {toDisplay(d.kg, unit)} × {d.reps}
                        </span>
                    ))}
                </div>
            )}
            {showPlates && platesOpen && (
                <PlateCalculator targetKg={targetKg} unit={unit} onClose={() => setPlatesOpen(false)} />
            )}
        </div>
    );
}
