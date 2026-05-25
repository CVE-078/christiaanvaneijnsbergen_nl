'use client';
import { useEffect, useRef, useState } from 'react';
import { MONO, ACCENT, BORDER, SURFACE, DIM } from '@/lib/pulse/theme';

const DURATIONS = [60, 90, 120, 180];
const DEFAULT_IDX = 1; // 90s

interface Props {
    trigger: number; // increment to start/restart the timer
}

function fmt(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function beep() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch {
        // AudioContext unavailable (SSR or restricted browser)
    }
}

export default function RestTimer({ trigger }: Props) {
    const [durationIdx, setDurationIdx] = useState(() => {
        if (typeof window === 'undefined') return DEFAULT_IDX;
        const stored = Number(localStorage.getItem('pulse_timer_idx'));
        return stored >= 0 && stored < DURATIONS.length ? stored : DEFAULT_IDX;
    });
    const [remaining, setRemaining] = useState<number | null>(null);
    const totalRef = useRef(DURATIONS[durationIdx]);

    // Start/restart when a set is saved
    useEffect(() => {
        if (trigger === 0) return;
        totalRef.current = DURATIONS[durationIdx];
        setRemaining(DURATIONS[durationIdx]);
    }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

    // Persist selected duration index
    useEffect(() => {
        localStorage.setItem('pulse_timer_idx', String(durationIdx));
    }, [durationIdx]);

    // Countdown tick
    useEffect(() => {
        if (remaining === null || remaining <= 0) {
            if (remaining === 0) {
                beep();
                const t = setTimeout(() => setRemaining(null), 2000);
                return () => clearTimeout(t);
            }
            return;
        }
        const id = setTimeout(() => setRemaining((r) => (r ?? 1) - 1), 1000);
        return () => clearTimeout(id);
    }, [remaining]);

    function skip() {
        setRemaining(null);
    }

    function addTime() {
        totalRef.current += 30;
        setRemaining((r) => (r ?? 0) + 30);
    }

    function cycleDuration() {
        const nextIdx = (durationIdx + 1) % DURATIONS.length;
        setDurationIdx(nextIdx);
        if (remaining !== null) {
            const delta = DURATIONS[nextIdx] - DURATIONS[durationIdx];
            totalRef.current = DURATIONS[nextIdx];
            setRemaining((r) => Math.max(0, (r ?? 0) + delta));
        }
    }

    if (remaining === null) return null;

    const done = remaining === 0;
    const pct = Math.max(0, remaining / totalRef.current);

    return (
        <div style={{ borderBottom: `1px solid ${BORDER}`, background: SURFACE, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem' }}>
                <span
                    style={{
                        fontFamily: MONO,
                        fontSize: '0.625rem',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: done ? ACCENT : DIM,
                    }}>
                    {done ? 'Go!' : 'Rest'}
                </span>
                <span
                    style={{
                        fontFamily: MONO,
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: done ? ACCENT : '#fff',
                        letterSpacing: '0.04em',
                        minWidth: '2.75rem',
                    }}>
                    {fmt(remaining)}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {!done && (
                        <button
                            onClick={addTime}
                            aria-label="Add 30 seconds"
                            style={{
                                fontFamily: MONO,
                                fontSize: '0.625rem',
                                letterSpacing: '0.06em',
                                color: DIM,
                                background: 'none',
                                border: '1px solid #2a2a2a',
                                borderRadius: '3px',
                                padding: '0.2rem 0.4rem',
                                cursor: 'pointer',
                            }}>
                            +30s
                        </button>
                    )}
                    <button
                        onClick={cycleDuration}
                        aria-label={`Rest duration: ${DURATIONS[durationIdx]}s. Click to change.`}
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.625rem',
                            letterSpacing: '0.06em',
                            color: DIM,
                            background: 'none',
                            border: '1px solid #2a2a2a',
                            borderRadius: '3px',
                            padding: '0.2rem 0.4rem',
                            cursor: 'pointer',
                        }}>
                        {DURATIONS[durationIdx]}s
                    </button>
                    <button
                        onClick={skip}
                        aria-label="Skip rest timer"
                        style={{
                            fontFamily: MONO,
                            fontSize: '0.625rem',
                            letterSpacing: '0.06em',
                            color: '#444',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.2rem 0',
                        }}>
                        Skip
                    </button>
                </div>
            </div>
            {/* Progress bar depletes left to right */}
            <div style={{ height: '2px', background: '#1a1a1a' }}>
                <div
                    style={{
                        height: '100%',
                        width: `${pct * 100}%`,
                        background: done ? ACCENT : `${ACCENT}99`,
                        transition: 'width 1s linear, background 0.3s',
                    }}
                />
            </div>
        </div>
    );
}
