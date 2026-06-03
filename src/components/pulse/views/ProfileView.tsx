'use client';
import { useTransition, useState } from 'react';
import { toDisplay, toKg, getInitials, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { useToast } from '@/lib/pulse/toast';
import type { BodyweightEntry } from '@/lib/pulse/types';
import SectionLabel from '../SectionLabel';
import { updateGoalWeight, logBodyMeasurement, logBodyWeight as logBodyWeightAction } from '@/app/pulse/actions';

// ── Shared styles (Slate) ───────────────────────────────────────────────────────
const INPUT =
    'bg-pulse-bg border border-pulse-border rounded-lg px-3 py-2 text-pulse-text font-pulse text-sm outline-none focus:border-pulse-accent';
const BTN_PRIMARY =
    'bg-pulse-accent text-pulse-bg font-pulse text-sm font-semibold rounded-lg px-4 py-2 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed';
const SECTION = '';

function BodyweightChart({ entries, unit }: { entries: BodyweightEntry[]; unit: 'kg' | 'lbs' }) {
    const sorted = [...entries].reverse().slice(-30);
    if (sorted.length < 2) return null;

    const W = 300,
        H = 80,
        PL = 34,
        PR = 8,
        PT = 10,
        PB = 4;
    const cw = W - PL - PR;
    const ch = H - PT - PB;

    const values = sorted.map((e) => toDisplay(e.weight_kg, unit));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    function px(i: number) {
        return PL + (i / (sorted.length - 1)) * cw;
    }
    function py(v: number) {
        if (range === 0) return PT + ch / 2;
        return PT + ch - ((v - minVal) / range) * ch;
    }

    const pts = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
    const lastX = px(sorted.length - 1);
    const lastY = py(values[values.length - 1]);
    const areaPath = `M ${pts[0]} L ${pts.slice(1).join(' L ')} L ${lastX.toFixed(1)},${(PT + ch).toFixed(1)} L ${PL},${(PT + ch).toFixed(1)} Z`;
    const fmt = (v: number) => (unit === 'lbs' ? v.toFixed(1) : String(v));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80, display: 'block' }} aria-hidden>
            <defs>
                <linearGradient id="bw-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-pulse-accent)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--color-pulse-accent)" stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#bw-fill)" />
            <polyline
                points={pts.join(' ')}
                fill="none"
                stroke="var(--color-pulse-accent)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <circle cx={lastX} cy={lastY} r={3} fill="var(--color-pulse-accent)" />
            {range > 0 && (
                <>
                    <text
                        x={PL - 3}
                        y={PT + ch}
                        textAnchor="end"
                        fontSize={8}
                        fontFamily="Sora, sans-serif"
                        fill="var(--color-pulse-dim)"
                        dy="0">
                        {fmt(minVal)}
                    </text>
                    <text
                        x={PL - 3}
                        y={PT}
                        textAnchor="end"
                        fontSize={8}
                        fontFamily="Sora, sans-serif"
                        fill="var(--color-pulse-dim)"
                        dy="8">
                        {fmt(maxVal)}
                    </text>
                </>
            )}
        </svg>
    );
}

export default function ProfileView() {
    const {
        email,
        profile,
        bodyweightLogs,
        updateProfile,
        logBodyWeight,
        deleteBodyWeight,
        triggerOnboarding,
        streak,
        prMap,
        routines,
    } = usePulse();
    const toast = useToast();

    const { display_name: displayName, unit } = profile;

    const [isPending, startTransition] = useTransition();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(displayName ?? '');
    const [bwInput, setBwInput] = useState('');
    const [bwError, setBwError] = useState<string | null>(null);
    const [bwDate, setBwDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [showMeasurements, setShowMeasurements] = useState(false);
    const [measurements, setMeasurements] = useState({ waist: '', hips: '', chest: '', arms: '' });
    const [goalWeightInput, setGoalWeightInput] = useState('');

    const today = new Date().toISOString().split('T')[0];

    const [measureDate, setMeasureDate] = useState<string>(today);

    const initials = displayName ? getInitials(displayName, 2) : (email[0]?.toUpperCase() ?? '?');

    // prMap keys are routineExerciseIds; resolve names via routine exercises
    const reNameMap = new Map(routines.flatMap((r) => r.exercises).map((re) => [re.id, re.exercise.name]));
    const topPRs = Object.entries(prMap)
        .map(([reId, e1rm]) => ({
            name: reNameMap.get(reId) ?? reId,
            e1rm,
        }))
        .sort((a, b) => b.e1rm - a.e1rm)
        .slice(0, 5);

    function handleUnitChange(newUnit: 'kg' | 'lbs') {
        if (newUnit === unit || isPending) return;
        startTransition(async () => {
            await updateProfile(displayName, newUnit);
            toast.show('Unit updated', 'success');
        });
    }

    function handleNameSave() {
        const trimmed = nameInput.trim() || null;
        setEditingName(false);
        if (trimmed === displayName) return;
        startTransition(async () => {
            await updateProfile(trimmed, unit);
            toast.show('Name saved', 'success');
        });
    }

    function handleNameKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleNameSave();
        if (e.key === 'Escape') {
            setNameInput(displayName ?? '');
            setEditingName(false);
        }
    }

    function handleLogBodyweight() {
        const val = parseFloat(bwInput);
        if (isNaN(val) || val <= 0) {
            setBwError('Enter a valid weight');
            return;
        }
        const kgVal = toKg(val, unit);
        if (kgVal < MIN_KG || kgVal > MAX_KG) {
            setBwError(`Must be between ${toDisplay(MIN_KG, unit)} and ${toDisplay(MAX_KG, unit)} ${unit}`);
            return;
        }
        setBwError(null);
        startTransition(async () => {
            try {
                // Use direct action so we can pass the selected date
                if (bwDate === today) {
                    await logBodyWeight(kgVal);
                } else {
                    await logBodyWeightAction(kgVal, bwDate);
                }
                setBwInput('');
            } catch {
                setBwError('Failed to save. Try again.');
            }
        });
    }

    function handleDeleteBodyweight(id: string) {
        startTransition(async () => {
            await deleteBodyWeight(id);
        });
    }

    function fmtDate(iso: string) {
        if (iso === today) return 'Today';
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    return (
        <div className="pt-5 px-4 pb-12 max-w-[480px] mx-auto flex flex-col gap-7 lg:flex-row lg:max-w-[860px] lg:pt-6 lg:px-6 lg:pb-12 lg:gap-10">
            <div className="flex flex-col gap-7 lg:w-[280px] lg:shrink-0">
                {/* Identity */}
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl shrink-0 bg-pulse-accent flex items-center justify-center font-pulse text-xl font-semibold text-pulse-bg tracking-[-0.02em]">
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        {editingName ? (
                            <input
                                autoFocus
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                onBlur={handleNameSave}
                                onKeyDown={handleNameKeyDown}
                                placeholder="Display name"
                                className="font-pulse text-base font-semibold text-pulse-text bg-transparent border-none border-b border-pulse-accent outline-none w-full pb-0.5"
                            />
                        ) : (
                            <button
                                onClick={() => {
                                    setNameInput(displayName ?? '');
                                    setEditingName(true);
                                }}
                                className={`font-pulse text-base font-semibold bg-transparent border-none p-0 cursor-text text-left block w-full ${displayName ? 'text-pulse-text' : 'text-pulse-dim'}`}>
                                {displayName ?? 'Add display name'}
                            </button>
                        )}
                        <div className="font-pulse text-[0.8125rem] text-pulse-dim mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
                            {email}
                        </div>
                    </div>
                </div>

                {/* Unit toggle */}
                <div>
                    <SectionLabel className="mb-2">Weight Unit</SectionLabel>
                    <div className="flex gap-2">
                        {(['kg', 'lbs'] as const).map((u) => (
                            <button
                                key={u}
                                onClick={() => handleUnitChange(u)}
                                className={`font-pulse text-sm font-semibold tracking-[0.06em] uppercase py-2 px-4 rounded-lg cursor-pointer border-none ${unit === u ? 'bg-pulse-accent text-pulse-bg' : 'bg-pulse-surface-2 text-pulse-dim'}`}>
                                {u}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Streak — hero stat */}
                <section className={SECTION}>
                    <SectionLabel className="mb-2">Streak</SectionLabel>
                    <div className="flex items-baseline gap-3">
                        <span className="font-pulse text-6xl font-bold leading-none tracking-[-0.03em] text-pulse-accent tabular-nums">
                            {streak}
                        </span>
                        <span className="font-pulse text-sm text-pulse-dim leading-tight">
                            consecutive
                            <br />
                            {streak === 1 ? 'week' : 'weeks'} trained
                        </span>
                    </div>
                </section>

                {/* Routine quiz */}
                <div>
                    <SectionLabel className="mb-2">Routine</SectionLabel>
                    <button
                        onClick={triggerOnboarding}
                        className="font-pulse text-xs text-pulse-accent bg-transparent border-none cursor-pointer underline">
                        Retake quiz
                    </button>
                </div>
            </div>
            <div className="lg:flex-1 lg:min-w-0 flex flex-col gap-7">
                {/* Personal Records */}
                <section className={SECTION}>
                    <SectionLabel className="mb-2">Personal Records</SectionLabel>
                    {topPRs.length === 0 ? (
                        <p className="font-pulse text-xs text-pulse-muted">No records yet — start logging sets.</p>
                    ) : (
                        <div className="flex flex-col">
                            {topPRs.map((pr) => (
                                <div
                                    key={pr.name}
                                    className="flex justify-between items-baseline py-[0.8125rem] border-b border-pulse-border last:border-b-0">
                                    <span className="font-pulse-body text-[0.9375rem] text-pulse-text">{pr.name}</span>
                                    <span className="font-pulse text-base text-pulse-accent font-medium tracking-[-0.005em]">
                                        {unit === 'lbs'
                                            ? `${toDisplay(pr.e1rm, 'lbs').toFixed(1)} lbs`
                                            : `${pr.e1rm.toFixed(1)} kg`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Body weight */}
                <div>
                    <SectionLabel className="mb-3">Body Weight</SectionLabel>
                    <div className="flex gap-2 items-start mb-[0.875rem]">
                        <div className="flex-1">
                            <div className="flex gap-2 items-center flex-wrap">
                                <input
                                    type="date"
                                    value={bwDate}
                                    max={today}
                                    onChange={(e) => setBwDate(e.target.value)}
                                    className={INPUT}
                                />
                                <input
                                    type="number"
                                    aria-label={`Body weight in ${unit}`}
                                    placeholder={unit}
                                    value={bwInput}
                                    min={toDisplay(MIN_KG, unit)}
                                    max={toDisplay(MAX_KG, unit)}
                                    step={0.1}
                                    onChange={(e) => {
                                        setBwInput(e.target.value);
                                        setBwError(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleLogBodyweight();
                                    }}
                                    className={`w-[5.5rem] py-2 px-3 bg-pulse-bg rounded-lg text-pulse-text font-pulse text-sm outline-none border focus:border-pulse-accent ${bwError ? 'border-pulse-error' : 'border-pulse-border'}`}
                                />
                            </div>
                            {bwError && (
                                <div className="font-pulse text-[0.75rem] text-pulse-error mt-1">{bwError}</div>
                            )}
                        </div>
                        <button
                            onClick={handleLogBodyweight}
                            disabled={isPending}
                            /* opacity/cursor are runtime booleans — must stay inline */
                            style={{ opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer' }}
                            className="font-pulse text-[0.75rem] tracking-[0.06em] uppercase py-2 px-4 bg-pulse-surface-2 border-none rounded-lg text-pulse-dim shrink-0">
                            Log
                        </button>
                    </div>

                    {bodyweightLogs.length >= 2 && (
                        <div className="bg-pulse-surface rounded-xl pt-[0.625rem] px-2 pb-2 mb-3">
                            <BodyweightChart entries={bodyweightLogs} unit={unit} />
                        </div>
                    )}

                    {bodyweightLogs.length > 0 ? (
                        <div>
                            {bodyweightLogs.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="flex items-center gap-3 py-[0.5rem] border-b border-pulse-border last:border-b-0">
                                    <span className="font-pulse-body text-[0.8125rem] text-pulse-dim flex-1">
                                        {fmtDate(entry.logged_at)}
                                    </span>
                                    <span className="font-pulse text-[0.9375rem] text-pulse-text font-medium">
                                        {toDisplay(entry.weight_kg, unit)} {unit}
                                    </span>
                                    <button
                                        onClick={() => handleDeleteBodyweight(entry.id)}
                                        disabled={isPending}
                                        aria-label={`Delete entry for ${entry.logged_at}`}
                                        className="font-pulse text-[0.75rem] text-pulse-dim bg-transparent border-none cursor-pointer p-0 shrink-0">
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="font-pulse text-[0.75rem] text-pulse-muted tracking-[0.04em]">
                            No entries yet.
                        </div>
                    )}
                </div>

                {/* Goal Weight */}
                <section className={SECTION}>
                    <SectionLabel className="mb-2">Goal Weight</SectionLabel>
                    {profile.goal_weight_kg ? (
                        <div className="flex items-center gap-3">
                            <span className="font-pulse text-lg font-medium text-pulse-text tracking-[-0.005em]">
                                {unit === 'lbs'
                                    ? `${toDisplay(profile.goal_weight_kg, 'lbs').toFixed(1)} lbs`
                                    : `${profile.goal_weight_kg} kg`}
                            </span>
                            {bodyweightLogs[0] && (
                                <span
                                    className={`font-pulse text-xs ${
                                        bodyweightLogs[0].weight_kg <= profile.goal_weight_kg
                                            ? 'text-pulse-success'
                                            : 'text-pulse-dim'
                                    }`}>
                                    {Math.abs(bodyweightLogs[0].weight_kg - profile.goal_weight_kg).toFixed(1)} kg to go
                                </span>
                            )}
                            <button
                                onClick={() => void updateGoalWeight(null)}
                                className="font-pulse text-xs text-pulse-dim cursor-pointer bg-transparent border-none">
                                Clear
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder={`Goal (${unit})`}
                                value={goalWeightInput}
                                onChange={(e) => setGoalWeightInput(e.target.value)}
                                className={INPUT}
                                step="0.1"
                            />
                            <button
                                onClick={() => {
                                    const val = parseFloat(goalWeightInput);
                                    if (!isNaN(val)) void updateGoalWeight(toKg(val, unit));
                                }}
                                className={BTN_PRIMARY}>
                                Set
                            </button>
                        </div>
                    )}
                </section>

                {/* Body Measurements */}
                <section className={SECTION}>
                    <div className="flex justify-between items-center mb-2">
                        <SectionLabel>Body Measurements</SectionLabel>
                        <button
                            onClick={() => setShowMeasurements(!showMeasurements)}
                            className="font-pulse text-xs text-pulse-accent cursor-pointer bg-transparent border-none">
                            {showMeasurements ? 'Cancel' : '+ Log'}
                        </button>
                    </div>
                    {showMeasurements && (
                        <div className="flex flex-col gap-2 mt-2">
                            <input
                                type="date"
                                max={today}
                                value={measureDate}
                                onChange={(e) => setMeasureDate(e.target.value)}
                                className={INPUT}
                            />
                            {(['waist', 'hips', 'chest', 'arms'] as const).map((field) => (
                                <div key={field} className="flex items-center gap-2">
                                    <label className="font-pulse text-xs text-pulse-dim w-12 capitalize">{field}</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        placeholder="cm"
                                        value={measurements[field]}
                                        onChange={(e) =>
                                            setMeasurements((prev) => ({ ...prev, [field]: e.target.value }))
                                        }
                                        className={INPUT + ' flex-1'}
                                    />
                                </div>
                            ))}
                            <button
                                onClick={async () => {
                                    await logBodyMeasurement({
                                        measured_at: measureDate,
                                        waist_cm: measurements.waist ? Number(measurements.waist) : undefined,
                                        hips_cm: measurements.hips ? Number(measurements.hips) : undefined,
                                        chest_cm: measurements.chest ? Number(measurements.chest) : undefined,
                                        arms_cm: measurements.arms ? Number(measurements.arms) : undefined,
                                    });
                                    setShowMeasurements(false);
                                    setMeasurements({ waist: '', hips: '', chest: '', arms: '' });
                                    setMeasureDate(today);
                                }}
                                className={BTN_PRIMARY}>
                                Save
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
