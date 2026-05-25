'use client';
import { useTransition, useState } from 'react';
import { toDisplay, toKg, getInitials, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
import { MONO, ACCENT, SURFACE, BORDER, DIM, MUTED } from '@/lib/pulse/theme';
import { usePulse } from '@/context/PulseContext';
import type { BodyweightEntry } from '@/lib/pulse/types';

function BodyweightChart({ entries, unit }: { entries: BodyweightEntry[]; unit: 'kg' | 'lbs' }) {
    const sorted = [...entries].reverse().slice(-30);
    if (sorted.length < 2) return null;

    const W = 300, H = 80, PL = 34, PR = 8, PT = 10, PB = 4;
    const cw = W - PL - PR;
    const ch = H - PT - PB;

    const values = sorted.map((e) => toDisplay(e.weight_kg, unit));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    function px(i: number) { return PL + (i / (sorted.length - 1)) * cw; }
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
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#bw-fill)" />
            <polyline points={pts.join(' ')} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={lastX} cy={lastY} r={3} fill={ACCENT} />
            {range > 0 && (
                <>
                    <text x={PL - 3} y={PT + ch} textAnchor="end" fontSize={8} fontFamily="monospace" fill={DIM} dy="0">{fmt(minVal)}</text>
                    <text x={PL - 3} y={PT} textAnchor="end" fontSize={8} fontFamily="monospace" fill={DIM} dy="8">{fmt(maxVal)}</text>
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
    } = usePulse();

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
        if (isNaN(val) || val <= 0) { setBwError('Enter a valid weight'); return; }
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

    return (
        <div style={{ padding: '1.25rem 1rem 3rem', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 56, height: 56, borderRadius: 6, flexShrink: 0, background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: '1.25rem', fontWeight: 700, color: ACCENT, letterSpacing: '-0.02em' }}>
                    {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {editingName ? (
                        <input
                            autoFocus
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onBlur={handleNameSave}
                            onKeyDown={handleNameKeyDown}
                            placeholder="Display name"
                            style={{ fontFamily: MONO, fontSize: '0.9375rem', fontWeight: 600, color: '#fff', background: 'transparent', border: 'none', borderBottom: `1px solid ${ACCENT}`, outline: 'none', width: '100%', padding: '0 0 2px' }}
                        />
                    ) : (
                        <button
                            onClick={() => { setNameInput(displayName ?? ''); setEditingName(true); }}
                            style={{ fontFamily: MONO, fontSize: '0.9375rem', fontWeight: 600, color: displayName ? '#fff' : DIM, background: 'none', border: 'none', padding: 0, cursor: 'text', textAlign: 'left', display: 'block', width: '100%' }}>
                            {displayName ?? 'Add display name'}
                        </button>
                    )}
                    <div style={{ fontFamily: MONO, fontSize: '0.6875rem', color: DIM, marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
                    {nameSaved && !editingName && (
                        <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: '#4ade80', letterSpacing: '0.04em', marginTop: '0.125rem', display: 'block' }}>Saved ✓</span>
                    )}
                </div>
            </div>

            {/* Unit toggle */}
            <div>
                <div style={{ fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.5rem' }}>Weight Unit</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['kg', 'lbs'] as const).map((u) => (
                        <button key={u} onClick={() => handleUnitChange(u)} style={{ fontFamily: MONO, fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.375rem 1rem', background: unit === u ? ACCENT : 'transparent', border: `1px solid ${unit === u ? ACCENT : BORDER}`, borderRadius: 3, color: unit === u ? '#000' : DIM, cursor: 'pointer' }}>
                            {u}
                        </button>
                    ))}
                </div>
            </div>

            {/* Body weight */}
            <div>
                <div style={{ fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: '0.75rem' }}>Body Weight</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="number"
                                aria-label={`Body weight in ${unit}`}
                                placeholder={unit}
                                value={bwInput}
                                min={toDisplay(MIN_KG, unit)}
                                max={toDisplay(MAX_KG, unit)}
                                step={0.1}
                                onChange={(e) => { setBwInput(e.target.value); setBwError(null); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleLogBodyweight(); }}
                                style={{ width: '5.5rem', padding: '0.375rem 0.5rem', background: '#0a0a0a', border: `1px solid ${bwError ? '#f43f5e' : BORDER}`, borderRadius: 3, color: '#fff', fontFamily: MONO, fontSize: '0.8125rem', outline: 'none' }}
                            />
                            <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: DIM }}>{today}</span>
                        </div>
                        {bwError && <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: '#f43f5e', marginTop: '0.25rem' }}>{bwError}</div>}
                    </div>
                    <button
                        onClick={handleLogBodyweight}
                        disabled={isPending}
                        style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.4375rem 0.75rem', background: 'transparent', border: `1px solid ${MUTED}`, borderRadius: 3, color: '#aaa', cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.5 : 1, flexShrink: 0 }}>
                        Log
                    </button>
                </div>

                {bodyweightLogs.length >= 2 && (
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '0.625rem 0.5rem 0.5rem', marginBottom: '0.75rem' }}>
                        <BodyweightChart entries={bodyweightLogs} unit={unit} />
                    </div>
                )}

                {bodyweightLogs.length > 0 ? (
                    <div>
                        {bodyweightLogs.map((entry) => (
                            <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4375rem 0', borderBottom: '1px solid #111' }}>
                                <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: DIM, flex: 1 }}>{entry.logged_at}</span>
                                <span style={{ fontFamily: MONO, fontSize: '0.8125rem', color: '#d4d4d4', fontWeight: 600 }}>{toDisplay(entry.weight_kg, unit)} {unit}</span>
                                <button onClick={() => handleDeleteBodyweight(entry.id)} disabled={isPending} aria-label={`Delete entry for ${entry.logged_at}`} style={{ fontFamily: MONO, fontSize: '0.625rem', color: '#444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>✕</button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: '#333', letterSpacing: '0.04em' }}>No entries yet.</div>
                )}
            </div>
        </div>
    );
}
