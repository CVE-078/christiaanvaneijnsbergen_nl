'use client';
import { useEffect, useState } from 'react';
import { getRIR, computeProgression, deloadTarget, toDisplay, toKg, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { DUMBBELL_HANDLE_KG } from '@/lib/pulse/constants';
import PlateCalculator from './PlateCalculator';
import type { LogEntry, WorkoutType, Unit } from '@/lib/pulse/types';

interface Props {
    setIdx: number;
    week: number;
    type: WorkoutType;
    entry: LogEntry | undefined;
    previousEntry?: LogEntry;
    repsRange?: string;
    isPR?: boolean;
    unit: Unit;
    // When set, this lift is stalled and auto-deloading: the prefilled target
    // drops to ~90% of the previous weight with reps reset to the bottom of the
    // range, instead of the normal progression. Decided per-exercise in ExerciseCard.
    deload?: boolean;
    // 'editorial' is the guided-mode look: hairline rows with a "Set N" label and
    // a big display value, vs the surface card used on the Train screen ('card').
    variant?: 'card' | 'editorial';
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
    repsRange,
    isPR,
    unit,
    deload,
    variant = 'card',
    onSave,
    onDelete,
}: Props) {
    const progression = computeProgression(previousEntry, repsRange ?? '', week);
    // A deload overrides the normal progression target when the lift is stalled.
    const deloadTgt = deload && previousEntry && week > 1 ? deloadTarget(previousEntry, repsRange ?? '') : null;
    const target = deloadTgt ?? progression;

    function initKg() {
        if (entry?.kg !== undefined) return String(toDisplay(entry.kg, unit));
        if (target) return String(toDisplay(target.kg, unit));
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
    const [editing, setEditing] = useState(false);
    const [inputError, setInputError] = useState<string | null>(null);
    const [platesOpen, setPlatesOpen] = useState(false);
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
            if (baseKg !== null) setKg(String(toDisplay(baseKg, unit)));
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
        const displayNum = parseFloat(kg);
        if (isNaN(displayNum) || displayNum <= 0) {
            setInputError('Enter a valid weight');
            return;
        }
        const kgNum = toKg(displayNum, unit);
        if (kgNum <= 0 || kgNum > MAX_KG) {
            setInputError(`Max ${toDisplay(MAX_KG, unit)} ${unit}`);
            return;
        }
        const repsNum = parseInt(reps, 10);
        if (!repsNum || repsNum < 1 || repsNum > 100) {
            setInputError('Enter valid reps (1–100)');
            return;
        }
        setInputError(null);
        const savedDrops = drops
            .map((d) => ({ kg: toKg(parseFloat(d.kg), unit), reps: parseInt(d.reps, 10) }))
            .filter((d) => d.kg > 0 && d.reps > 0);
        onSave({
            kg: kgNum,
            reps: repsNum,
            rir: targetRIR,
            saved: true,
            ...(savedDrops.length > 0 ? { drops: savedDrops } : {}),
        });
        setEditing(false);
    }

    function resetDrafts() {
        setKg(entry?.kg !== undefined ? String(toDisplay(entry.kg, unit)) : '');
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

    const showInputs = !saved || editing;
    const editorial = variant === 'editorial';

    // Target weight (kg) for the plate calculator: the editable input while
    // logging, otherwise the saved weight. The affordance is hidden when this
    // sits below the lightest base (a dumbbell handle), where no plates apply.
    const parsedTarget = showInputs ? parseFloat(kg) : (entry?.kg ?? NaN);
    const targetKg = showInputs && !isNaN(parsedTarget) ? toKg(parsedTarget, unit) : parsedTarget;
    const showPlates = !isNaN(targetKg) && targetKg >= DUMBBELL_HANDLE_KG;

    return (
        <div className="flex flex-col">
            <div
                className={
                    editorial
                        ? 'flex items-center gap-3.5 border-b border-pulse-border py-3 transition-colors duration-200'
                        : `flex items-center gap-3 rounded-[11px] px-3.5 py-[0.6875rem] transition-colors duration-200 ${
                              showInputs
                                  ? 'bg-transparent shadow-[inset_0_0_0_1px_var(--color-pulse-border)]'
                                  : 'bg-pulse-surface'
                          }`
                }>
                {editorial ? (
                    <span
                        className={`w-[3.25rem] shrink-0 font-pulse-body text-[0.625rem] uppercase tracking-[0.16em] ${
                            saved ? 'text-pulse-accent' : 'text-pulse-muted'
                        }`}>
                        Set {setIdx + 1}
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
                                                Weight
                                            </span>
                                            <span className="flex items-baseline gap-1">
                                                <input
                                                    type="number"
                                                    aria-label={`Weight in ${unit}`}
                                                    placeholder={unit}
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
                                        <label className="flex w-[4.75rem] flex-col gap-0.5 rounded-xl border border-pulse-border bg-pulse-bg px-3 py-1.5 transition-colors focus-within:border-pulse-accent/60">
                                            <span className="font-pulse-body text-[0.5625rem] uppercase tracking-[0.16em] text-pulse-muted">
                                                Reps
                                            </span>
                                            <input
                                                type="number"
                                                aria-label="Repetitions"
                                                placeholder="reps"
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
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span className="rounded-md border border-pulse-border bg-pulse-surface px-2 py-0.5 font-pulse-body text-[0.625rem] tracking-[0.02em] text-pulse-dim">
                                            Target RIR {targetRIR}
                                        </span>
                                        {target && (
                                            <span
                                                aria-label={deloadTgt ? 'Deload target' : 'Auto-progression target'}
                                                className="font-pulse-body text-[0.6875rem] font-medium tracking-[0.02em] text-pulse-accent">
                                                {deloadTgt ? '↓ deload' : '↑ target'} {toDisplay(target.kg, unit)}{' '}
                                                {unit} × {target.reps}
                                            </span>
                                        )}
                                        {previousEntry && (
                                            <span className="font-pulse-body text-[0.6875rem] tracking-[0.02em] text-pulse-muted">
                                                Last {toDisplay(previousEntry.kg, unit)} {unit} × {previousEntry.reps}
                                            </span>
                                        )}
                                        {inputError && (
                                            <span className="font-pulse text-[0.6875rem] text-[#f43f5e]">
                                                {inputError}
                                            </span>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            aria-label={`Weight in ${unit}`}
                                            placeholder={unit}
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
                                            → {toDisplay(previousEntry.kg, unit)} {unit} × {previousEntry.reps}
                                        </span>
                                    )}
                                    {target && (
                                        <span
                                            aria-label={deloadTgt ? 'Deload target' : 'Auto-progression target'}
                                            className="font-pulse text-[0.75rem] text-pulse-accent tracking-[0.04em]">
                                            {deloadTgt ? '↓ deload target' : '↑ target'} {toDisplay(target.kg, unit)}{' '}
                                            {unit} × {target.reps}
                                        </span>
                                    )}
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
                            {drops.length < 6 && (
                                <button
                                    type="button"
                                    onClick={() => setDrops((prev) => [...prev, { id: newDropId(), kg: '', reps: '' }])}
                                    className="font-pulse text-[0.6875rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border-none cursor-pointer p-0 self-start">
                                    + Add drop
                                </button>
                            )}
                        </div>
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
                                className={`shrink-0 cursor-pointer border-none bg-pulse-accent font-pulse font-semibold text-pulse-bg transition-opacity duration-100 ${
                                    editorial
                                        ? 'h-12 rounded-xl px-5 text-sm'
                                        : 'h-10 rounded-[6px] px-4 text-[0.75rem] uppercase tracking-[0.06em]'
                                }`}>
                                {editing ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {editorial ? (
                            <span className="font-pulse-display text-xl font-semibold leading-none text-pulse-text">
                                {toDisplay(entry!.kg, unit)}
                                <span className="font-pulse text-[0.8125rem] font-medium text-pulse-dim"> {unit}</span>
                                <span className="mx-1.5 text-pulse-muted">×</span>
                                {entry!.reps}
                            </span>
                        ) : (
                            <span className="font-pulse text-[0.90625rem] text-pulse-text tracking-[0.01em]">
                                {toDisplay(entry!.kg, unit)} {unit}
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
                            {showPlates && (
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
            {showPlates && platesOpen && <PlateCalculator targetKg={targetKg} unit={unit} />}
        </div>
    );
}
