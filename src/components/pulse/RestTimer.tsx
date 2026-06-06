'use client';
import { useEffect, useRef, useState } from 'react';

const DURATIONS = [60, 90, 120, 180];
const DEFAULT_IDX = 1;

interface Props {
    trigger: number;
    duration?: number;
    onComplete?: () => void;
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

export default function RestTimer({ trigger, duration, onComplete }: Props) {
    const [durationIdx, setDurationIdx] = useState(() => {
        if (typeof window === 'undefined') return DEFAULT_IDX;
        const raw = localStorage.getItem('pulse_timer_idx') ?? localStorage.getItem('wt_timer_idx');
        const stored = raw !== null ? Number(raw) : -1;
        return stored >= 0 && stored < DURATIONS.length ? stored : DEFAULT_IDX;
    });
    // The countdown is anchored to a wall-clock end time, not a per-second
    // decrement, so it stays accurate when the phone locks or the tab is
    // suspended (mobile pauses background timers). `remaining` is derived from
    // `endAt` on every tick and recomputed on resume (visibilitychange / focus).
    const [endAt, setEndAt] = useState<number | null>(null);
    const [remaining, setRemaining] = useState<number | null>(null);
    const totalRef = useRef(DURATIONS[durationIdx]);
    const firedRef = useRef(false);
    const clearAtRef = useRef<number | null>(null);

    useEffect(() => {
        if (trigger === 0) return;
        const start = duration ?? DURATIONS[durationIdx];
        totalRef.current = start;
        firedRef.current = false;
        clearAtRef.current = null;
        setEndAt(Date.now() + start * 1000);
        setRemaining(start);
    }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        localStorage.setItem('pulse_timer_idx', String(durationIdx));
    }, [durationIdx]);

    useEffect(() => {
        if (endAt === null) return;
        const recompute = () => {
            const rem = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
            if (rem <= 0 && !firedRef.current) {
                firedRef.current = true;
                beep();
                onComplete?.();
                clearAtRef.current = Date.now() + 2000;
            }
            // Hold the "Go!" state briefly after completion, then clear.
            if (firedRef.current && clearAtRef.current !== null && Date.now() >= clearAtRef.current) {
                setEndAt(null);
                setRemaining(null);
                return;
            }
            setRemaining(rem);
        };
        recompute(); // sync immediately so a resume jump lands at once
        const id = setInterval(recompute, 250);
        const onResume = () => {
            if (document.visibilityState === 'visible') recompute();
        };
        document.addEventListener('visibilitychange', onResume);
        window.addEventListener('focus', onResume);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onResume);
            window.removeEventListener('focus', onResume);
        };
        // onComplete is read when the countdown hits 0; firedRef guards a single
        // fire, so it stays out of deps to avoid resubscribing every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endAt]);

    function skip() {
        setEndAt(null);
        setRemaining(null);
    }

    function addTime() {
        totalRef.current += 30;
        setEndAt((e) => (e ?? Date.now()) + 30000);
    }

    function cycleDuration() {
        const nextIdx = (durationIdx + 1) % DURATIONS.length;
        const delta = DURATIONS[nextIdx] - DURATIONS[durationIdx];
        setDurationIdx(nextIdx);
        if (endAt !== null) {
            totalRef.current = DURATIONS[nextIdx];
            setEndAt((e) => (e === null ? null : Math.max(Date.now(), e + delta * 1000)));
        }
    }

    if (remaining === null) return null;

    const done = remaining === 0;
    const pct = Math.max(0, remaining / totalRef.current);

    const circumference = 2 * Math.PI * 18;
    const dashOffset = circumference * (1 - pct);

    return (
        <div className="bg-pulse-surface rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 py-4 px-[1.125rem]">
                <div className="relative w-[42px] h-[42px] shrink-0">
                    <svg width="42" height="42" viewBox="0 0 42 42" className="-rotate-90">
                        <circle cx="21" cy="21" r="18" fill="none" stroke="var(--color-pulse-border)" strokeWidth="3" />
                        {/* dashoffset is a runtime ratio — must stay inline */}
                        <circle
                            cx="21"
                            cy="21"
                            r="18"
                            fill="none"
                            stroke="var(--color-pulse-accent)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            style={{ strokeDashoffset: dashOffset }}
                        />
                    </svg>
                </div>
                <div>
                    <div
                        className={`font-pulse text-xl font-medium tracking-[-0.01em] [font-variant-numeric:tabular-nums] ${done ? 'text-pulse-accent' : 'text-pulse-text'}`}>
                        {fmt(remaining)}
                    </div>
                    <div className="font-pulse text-[0.78125rem] tracking-[0.04em] text-pulse-muted">
                        {done ? 'Go!' : 'Rest before next set'}
                    </div>
                </div>
                <div className="ml-auto flex gap-2.5 items-center">
                    {!done && (
                        <button
                            onClick={addTime}
                            aria-label="Add 30 seconds"
                            className="font-pulse text-[0.8125rem] text-pulse-dim bg-transparent border-none cursor-pointer p-0">
                            +30s
                        </button>
                    )}
                    <button
                        onClick={cycleDuration}
                        aria-label={`Rest duration: ${DURATIONS[durationIdx]}s. Click to change.`}
                        className="font-pulse text-[0.8125rem] text-pulse-dim bg-transparent border-none cursor-pointer p-0">
                        {DURATIONS[durationIdx]}s
                    </button>
                    <button
                        onClick={skip}
                        aria-label="Skip rest timer"
                        className="font-pulse text-[0.8125rem] text-pulse-dim bg-transparent border-none cursor-pointer p-0">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}
