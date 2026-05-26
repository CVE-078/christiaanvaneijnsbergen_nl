'use client';
import { useEffect, useRef, useState } from 'react';

const DURATIONS = [60, 90, 120, 180];
const DEFAULT_IDX = 1;

interface Props {
    trigger: number;
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
        const raw = localStorage.getItem('pulse_timer_idx') ?? localStorage.getItem('wt_timer_idx');
        const stored = raw !== null ? Number(raw) : -1;
        return stored >= 0 && stored < DURATIONS.length ? stored : DEFAULT_IDX;
    });
    const [remaining, setRemaining] = useState<number | null>(null);
    const totalRef = useRef(DURATIONS[durationIdx]);

    useEffect(() => {
        if (trigger === 0) return;
        totalRef.current = DURATIONS[durationIdx];
        setRemaining(DURATIONS[durationIdx]);
    }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        localStorage.setItem('pulse_timer_idx', String(durationIdx));
    }, [durationIdx]);

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
        <div className="border-b border-pulse-border bg-pulse-surface overflow-hidden">
            <div className="flex items-center gap-3 py-2 px-4">
                <span
                    className={`font-pulse text-[0.75rem] tracking-[0.12em] uppercase ${done ? 'text-pulse-accent' : 'text-pulse-dim'}`}>
                    {done ? 'Go!' : 'Rest'}
                </span>
                <span
                    className={`font-pulse text-base font-bold tracking-[0.04em] min-w-[2.75rem] ${done ? 'text-pulse-accent' : 'text-white'}`}>
                    {fmt(remaining)}
                </span>
                <div className="ml-auto flex gap-2 items-center">
                    {!done && (
                        <button
                            onClick={addTime}
                            aria-label="Add 30 seconds"
                            className="font-pulse text-[0.75rem] tracking-[0.06em] text-pulse-dim bg-transparent border border-[#2a2a2a] rounded-sm py-[0.2rem] px-[0.4rem] cursor-pointer">
                            +30s
                        </button>
                    )}
                    <button
                        onClick={cycleDuration}
                        aria-label={`Rest duration: ${DURATIONS[durationIdx]}s. Click to change.`}
                        className="font-pulse text-[0.75rem] tracking-[0.06em] text-pulse-dim bg-transparent border border-[#2a2a2a] rounded-sm py-[0.2rem] px-[0.4rem] cursor-pointer">
                        {DURATIONS[durationIdx]}s
                    </button>
                    <button
                        onClick={skip}
                        aria-label="Skip rest timer"
                        className="font-pulse text-[0.75rem] tracking-[0.06em] text-[#444] bg-transparent border-none cursor-pointer py-[0.2rem] px-0">
                        Skip
                    </button>
                </div>
            </div>
            <div className="h-[2px] bg-[#1a1a1a]">
                {/* width is a runtime ratio — must stay inline */}
                <div
                    className={`h-full transition-[width] duration-1000 ease-linear ${done ? 'bg-pulse-accent' : 'bg-pulse-accent/60'}`}
                    style={{ width: `${pct * 100}%` }}
                />
            </div>
        </div>
    );
}
