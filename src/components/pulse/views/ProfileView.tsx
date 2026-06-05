'use client';
import { useTransition, useState } from 'react';
import { toDisplay, toKg, toLengthDisplay, toCm, getInitials, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { useToast } from '@/lib/pulse/toast';
import type { BodyweightEntry, Gender, LengthUnit, PriorityMuscle } from '@/lib/pulse/types';
import { genderDefault } from '@/lib/pulse/generation';
import { ACCENT_PRESETS, DEFAULT_ACCENT_KEY } from '@/lib/pulse/constants';
import SectionLabel from '../SectionLabel';
import PageTitle from '../PageTitle';
import PageSkeleton, { ErrorState } from '../PageSkeleton';
import { INPUT, BTN_PRIMARY } from '../ui';
import { updateGoalWeight, logBodyMeasurement, logBodyWeight as logBodyWeightAction } from '@/app/pulse/actions';

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
        updateGender,
        autoAdvance,
        setAutoAdvance,
        logBodyWeight,
        deleteBodyWeight,
        bodyMeasurements,
        refreshMeasurements,
        updateLengthUnit,
        updatePriorityMuscle,
        updateAccentColor,
        triggerOnboarding,
        handleExport,
        loading,
        errors,
        retry,
    } = usePulse();
    const toast = useToast();

    const { display_name: displayName, unit, gender, length_unit: lengthUnit } = profile;
    // What the priority control shows: the explicit choice, or the gender default
    // when never set. 'balanced' renders as the "Balanced" option.
    const priorityValue: PriorityMuscle | 'balanced' = profile.priority_muscle ?? genderDefault(gender);
    const PRIORITY_OPTIONS: (PriorityMuscle | 'balanced')[] = [
        'balanced',
        'glutes',
        'legs',
        'chest',
        'back',
        'shoulders',
        'arms',
    ];

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

    const latestMeasurement = bodyMeasurements[0];

    const bwTrend = bodyweightLogs.length >= 2 ? bodyweightLogs[0].weight_kg - bodyweightLogs[1].weight_kg : null;

    const waistPoints = bodyMeasurements.filter((m) => m.waist_cm != null);
    const waistTrend =
        waistPoints.length >= 2 ? (waistPoints[0].waist_cm as number) - (waistPoints[1].waist_cm as number) : null;

    function fmtMeasure(value_cm: number | null | undefined): string {
        if (value_cm == null) return '—';
        return `${toLengthDisplay(value_cm, lengthUnit)} ${lengthUnit}`;
    }

    function handleLengthUnitChange(newUnit: LengthUnit) {
        if (newUnit === lengthUnit) return;
        void updateLengthUnit(newUnit);
    }

    function handleUnitChange(newUnit: 'kg' | 'lbs') {
        if (newUnit === unit || isPending) return;
        startTransition(async () => {
            await updateProfile(displayName, newUnit);
            toast.show('Unit updated', 'success');
        });
    }

    function handlePriorityChange(value: PriorityMuscle | 'balanced') {
        if (value === priorityValue || isPending) return;
        startTransition(async () => {
            await updatePriorityMuscle(value);
            toast.show('Training priority updated', 'success');
        });
    }

    function handleGenderChange(newGender: Gender) {
        if (newGender === gender || isPending) return;
        startTransition(async () => {
            await updateGender(newGender);
            toast.show('Gender updated', 'success');
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

    if (errors?.profile || errors?.bodyweight) return <ErrorState onRetry={retry} />;
    if (loading?.profile || loading?.bodyweight) return <PageSkeleton rows={3} />;

    return (
        <div className="pt-5 px-4 pb-12 max-w-[480px] mx-auto lg:max-w-[860px] lg:pt-6 lg:px-6 lg:pb-12">
            <PageTitle>Profile</PageTitle>
            <div className="mt-6 flex flex-col gap-7 lg:flex-row lg:gap-10">
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

                    {/* Accent colour */}
                    <div>
                        <SectionLabel className="mb-2">Accent colour</SectionLabel>
                        <div className="flex flex-wrap gap-2.5">
                            {ACCENT_PRESETS.map((p) => {
                                const active = (profile.accent_color ?? DEFAULT_ACCENT_KEY) === p.key;
                                return (
                                    <button
                                        key={p.key}
                                        type="button"
                                        aria-label={p.label}
                                        aria-pressed={active}
                                        title={p.label}
                                        onClick={() => updateAccentColor(p.key)}
                                        className={`h-9 w-9 cursor-pointer rounded-full border-none transition-transform ${active ? 'scale-110' : 'hover:scale-105'}`}
                                        style={{
                                            backgroundColor: p.accent,
                                            boxShadow: active
                                                ? `0 0 0 2px var(--color-pulse-bg), 0 0 0 4px ${p.accent}`
                                                : 'none',
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* Gender toggle */}
                    <div>
                        <SectionLabel className="mb-2">Gender</SectionLabel>
                        <div className="flex gap-2">
                            {(['male', 'female'] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => handleGenderChange(s)}
                                    className={`font-pulse text-sm font-semibold tracking-[0.06em] uppercase py-2 px-4 rounded-lg cursor-pointer border-none ${gender === s ? 'bg-pulse-accent text-pulse-bg' : 'bg-pulse-surface-2 text-pulse-dim'}`}>
                                    {s === 'male' ? 'Male' : 'Female'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Training priority — tilts generated routines toward this muscle */}
                    <div>
                        <SectionLabel className="mb-2">Training priority</SectionLabel>
                        <select
                            aria-label="Training priority"
                            value={priorityValue}
                            onChange={(e) => handlePriorityChange(e.target.value as PriorityMuscle | 'balanced')}
                            disabled={isPending}
                            className={`${INPUT} capitalize`}>
                            {PRIORITY_OPTIONS.map((p) => (
                                <option key={p} value={p}>
                                    {p === 'balanced' ? 'Balanced' : p[0].toUpperCase() + p.slice(1)}
                                </option>
                            ))}
                        </select>
                        <p className="font-pulse text-[0.6875rem] text-pulse-muted mt-1.5">
                            New generated routines lean toward this muscle.
                        </p>
                    </div>

                    {/* Auto-advance rest timer */}
                    <div>
                        <SectionLabel className="mb-2">Auto-advance rest timer</SectionLabel>
                        <div className="flex items-center gap-3">
                            <button
                                role="switch"
                                aria-checked={autoAdvance}
                                aria-label="Auto-advance rest timer"
                                onClick={() => setAutoAdvance(!autoAdvance)}
                                className={`relative w-11 h-6 rounded-full shrink-0 cursor-pointer border-none transition-colors ${autoAdvance ? 'bg-pulse-accent' : 'bg-pulse-surface-2'}`}>
                                <span
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-pulse-bg transition-transform ${autoAdvance ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                            <span className="font-pulse text-[0.8125rem] text-pulse-dim">
                                In guided mode, jump to the next exercise when rest ends.
                            </span>
                        </div>
                    </div>

                    {/* Routine quiz */}
                    <div>
                        <SectionLabel className="mb-2">Routine</SectionLabel>
                        <button
                            onClick={triggerOnboarding}
                            className="font-pulse text-xs text-pulse-accent bg-transparent border-none cursor-pointer underline">
                            Retake quiz
                        </button>
                    </div>

                    {/* Data — export full history as CSV */}
                    <div>
                        <SectionLabel className="mb-2">Data</SectionLabel>
                        <button
                            onClick={handleExport}
                            className="font-pulse text-sm font-medium text-pulse-dim bg-pulse-surface-2 rounded-lg py-2 px-4 cursor-pointer border-none inline-flex items-center gap-2">
                            <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.8}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden>
                                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                            </svg>
                            Export CSV
                        </button>
                        <p className="font-pulse text-[0.6875rem] text-pulse-muted mt-1.5">
                            Download your full logged history as a spreadsheet.
                        </p>
                    </div>
                </div>
                <div className="lg:flex-1 lg:min-w-0 rounded-2xl bg-pulse-surface p-5 flex flex-col gap-6">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <SectionLabel>Body</SectionLabel>
                            <span className="font-pulse text-[0.625rem] uppercase tracking-wide text-pulse-muted border border-pulse-border rounded px-2 py-0.5">
                                feeds Recomp
                            </span>
                        </div>
                        <p className="font-pulse text-[0.6875rem] text-pulse-muted">
                            Everything Progress reads for the recomp verdict, logged in one place.
                        </p>
                    </div>

                    {/* Body weight */}
                    <div>
                        <div className="flex justify-between items-center mb-3 gap-2">
                            <SectionLabel>Body Weight</SectionLabel>
                            {bwTrend != null && (
                                <span
                                    className={`font-pulse text-[0.6875rem] font-medium tabular-nums rounded px-2 py-0.5 bg-pulse-surface-2 ${
                                        bwTrend < 0 ? 'text-pulse-success' : 'text-pulse-dim'
                                    }`}>
                                    {bwTrend < 0 ? '↓' : '↑'} {toDisplay(Math.abs(bwTrend), unit)} {unit}
                                </span>
                            )}
                        </div>
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
                                        {Math.abs(bodyweightLogs[0].weight_kg - profile.goal_weight_kg).toFixed(1)} kg
                                        to go
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
                    <section className={SECTION + ' border-t border-pulse-border pt-4'}>
                        <div className="flex justify-between items-center mb-3 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <SectionLabel>Measurements</SectionLabel>
                                {waistTrend != null && (
                                    <span
                                        className={`font-pulse text-[0.6875rem] font-medium tabular-nums rounded px-2 py-0.5 bg-pulse-surface-2 shrink-0 ${
                                            waistTrend < 0 ? 'text-pulse-success' : 'text-pulse-dim'
                                        }`}>
                                        {waistTrend < 0 ? '↓' : '↑'} {toLengthDisplay(Math.abs(waistTrend), lengthUnit)}{' '}
                                        {lengthUnit} waist
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <div
                                    className="inline-flex bg-pulse-surface-2 rounded-lg p-0.5 gap-0.5"
                                    role="group"
                                    aria-label="Measurement unit">
                                    {(['cm', 'in'] as const).map((u) => (
                                        <button
                                            key={u}
                                            onClick={() => handleLengthUnitChange(u)}
                                            aria-pressed={lengthUnit === u}
                                            className={`font-pulse text-[0.6875rem] font-semibold tracking-[0.04em] uppercase py-1 px-2.5 rounded-md cursor-pointer border-none ${lengthUnit === u ? 'bg-pulse-accent text-pulse-bg' : 'bg-transparent text-pulse-dim'}`}>
                                            {u}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setShowMeasurements(!showMeasurements)}
                                    className="font-pulse text-xs text-pulse-accent cursor-pointer bg-transparent border-none">
                                    {showMeasurements ? 'Cancel' : '+ Log'}
                                </button>
                            </div>
                        </div>

                        {/* Latest measurement readout */}
                        <div className="grid grid-cols-4 gap-2">
                            {(['waist', 'hips', 'chest', 'arms'] as const).map((field) => (
                                <div key={field} className="bg-pulse-bg rounded-xl py-2.5 px-1.5 text-center">
                                    <div className="font-pulse text-[0.625rem] text-pulse-muted capitalize">
                                        {field}
                                    </div>
                                    <div className="font-pulse text-sm font-medium text-pulse-text mt-0.5 tabular-nums">
                                        {fmtMeasure(latestMeasurement?.[`${field}_cm`])}
                                    </div>
                                </div>
                            ))}
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
                                        <label className="font-pulse text-xs text-pulse-dim w-12 capitalize">
                                            {field}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder={lengthUnit}
                                            aria-label={`${field} in ${lengthUnit}`}
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
                                            waist_cm: measurements.waist
                                                ? toCm(Number(measurements.waist), lengthUnit)
                                                : undefined,
                                            hips_cm: measurements.hips
                                                ? toCm(Number(measurements.hips), lengthUnit)
                                                : undefined,
                                            chest_cm: measurements.chest
                                                ? toCm(Number(measurements.chest), lengthUnit)
                                                : undefined,
                                            arms_cm: measurements.arms
                                                ? toCm(Number(measurements.arms), lengthUnit)
                                                : undefined,
                                        });
                                        refreshMeasurements();
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
        </div>
    );
}
