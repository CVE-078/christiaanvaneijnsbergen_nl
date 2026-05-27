'use client';
import { useTransition, useState } from 'react';
import { toDisplay, toKg, getInitials, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import type { BodyweightEntry } from '@/lib/pulse/types';

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
                        fontFamily="Outfit, sans-serif"
                        fill="var(--color-pulse-dim)"
                        dy="0">
                        {fmt(minVal)}
                    </text>
                    <text
                        x={PL - 3}
                        y={PT}
                        textAnchor="end"
                        fontSize={8}
                        fontFamily="Outfit, sans-serif"
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
    const { email, profile, bodyweightLogs, updateProfile, logBodyWeight, deleteBodyWeight, triggerOnboarding } = usePulse();

    const { display_name: displayName, unit } = profile;

    const [isPending, startTransition] = useTransition();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(displayName ?? '');
    const [nameSaved, setNameSaved] = useState(false);
    const [bwInput, setBwInput] = useState('');
    const [bwError, setBwError] = useState<string | null>(null);

    const initials = displayName ? getInitials(displayName, 2) : (email[0]?.toUpperCase() ?? '?');

    function handleUnitChange(newUnit: 'kg' | 'lbs') {
        if (newUnit === unit || isPending) return;
        startTransition(async () => {
            await updateProfile(displayName, newUnit);
        });
    }

    function handleNameSave() {
        const trimmed = nameInput.trim() || null;
        setEditingName(false);
        if (trimmed === displayName) return;
        startTransition(async () => {
            await updateProfile(trimmed, unit);
            setNameSaved(true);
            setTimeout(() => setNameSaved(false), 2000);
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
                await logBodyWeight(kgVal);
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

    const today = new Date().toISOString().slice(0, 10);

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
                    <div className="w-14 h-14 rounded-[6px] shrink-0 bg-pulse-surface border border-pulse-border flex items-center justify-center font-pulse text-xl font-bold text-pulse-accent tracking-[-0.02em]">
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
                                className="font-pulse text-base font-semibold text-white bg-transparent border-none border-b border-pulse-accent outline-none w-full pb-0.5"
                            />
                        ) : (
                            <button
                                onClick={() => {
                                    setNameInput(displayName ?? '');
                                    setEditingName(true);
                                }}
                                className={`font-pulse text-base font-semibold bg-transparent border-none p-0 cursor-text text-left block w-full ${displayName ? 'text-white' : 'text-pulse-dim'}`}>
                                {displayName ?? 'Add display name'}
                            </button>
                        )}
                        <div className="font-pulse text-[0.8125rem] text-pulse-dim mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
                            {email}
                        </div>
                        {nameSaved && !editingName && (
                            <span className="font-pulse text-[0.6875rem] text-[#4ade80] tracking-[0.04em] mt-0.5 block">
                                Saved ✓
                            </span>
                        )}
                    </div>
                </div>

                {/* Unit toggle */}
                <div>
                    <div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
                        Weight Unit
                    </div>
                    <div className="flex gap-2">
                        {(['kg', 'lbs'] as const).map((u) => (
                            <button
                                key={u}
                                onClick={() => handleUnitChange(u)}
                                className={`font-pulse text-[0.9375rem] font-semibold tracking-[0.06em] uppercase py-[0.375rem] px-4 rounded-[3px] cursor-pointer ${unit === u ? 'bg-pulse-accent border border-pulse-accent text-black' : 'bg-transparent border border-pulse-border text-pulse-dim'}`}>
                                {u}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Routine quiz */}
                <div>
                    <div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
                        Routine
                    </div>
                    <button
                        onClick={triggerOnboarding}
                        className="font-pulse text-xs text-pulse-accent bg-transparent border-none cursor-pointer underline">
                        Retake quiz
                    </button>
                </div>
            </div>
            <div className="lg:flex-1 lg:min-w-0">
                {/* Body weight */}
                <div>
                    <div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-3">
                        Body Weight
                    </div>
                    <div className="flex gap-2 items-start mb-[0.875rem]">
                        <div className="flex-1">
                            <div className="flex gap-2 items-center">
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
                                    className={`w-[5.5rem] py-[0.375rem] px-2 bg-pulse-bg rounded-[3px] text-white font-pulse text-[0.9375rem] outline-none border ${bwError ? 'border-[#f43f5e]' : 'border-pulse-border'}`}
                                />
                                <span className="font-pulse text-[0.8125rem] text-pulse-dim">{fmtDate(today)}</span>
                            </div>
                            {bwError && <div className="font-pulse text-[0.75rem] text-[#f43f5e] mt-1">{bwError}</div>}
                        </div>
                        <button
                            onClick={handleLogBodyweight}
                            disabled={isPending}
                            /* opacity/cursor are runtime booleans — must stay inline */
                            style={{ opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer' }}
                            className="font-pulse text-[0.75rem] tracking-[0.06em] uppercase py-[0.4375rem] px-3 bg-transparent border border-pulse-border rounded-[3px] text-pulse-dim shrink-0">
                            Log
                        </button>
                    </div>

                    {bodyweightLogs.length >= 2 && (
                        <div className="bg-pulse-surface border border-pulse-border rounded pt-[0.625rem] px-2 pb-2 mb-3">
                            <BodyweightChart entries={bodyweightLogs} unit={unit} />
                        </div>
                    )}

                    {bodyweightLogs.length > 0 ? (
                        <div>
                            {bodyweightLogs.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="flex items-center gap-3 py-[0.4375rem] border-b border-[#111]">
                                    <span className="font-pulse text-[0.8125rem] text-pulse-dim flex-1">
                                        {fmtDate(entry.logged_at)}
                                    </span>
                                    <span className="font-pulse text-[0.9375rem] text-pulse-text font-semibold">
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
                        <div className="font-pulse text-[0.75rem] text-pulse-muted tracking-[0.04em]">No entries yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
