'use client';
import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { computeSessionSummary } from '@/lib/pulse/utils';
import { BTN_PRIMARY_BLOCK } from './ui';
import RpeScale from './RpeScale';
import ShareImageCard from './ShareImageCard';
import type { WorkoutSession, RoutineExercise, Logs, PRMap, Unit, DecisionEventRow } from '@/lib/pulse/types';

interface Props {
    session: WorkoutSession;
    completedAt: string;
    exercises: RoutineExercise[];
    logs: Logs;
    prMap: PRMap;
    week: number;
    unit: Unit;
    decisions: DecisionEventRow[];
    saveSessionDebrief: (sessionId: string, debrief: { rpe: number | null; note: string | null }) => Promise<void>;
    onDismiss: () => void;
}

export default function FinishDebrief({
    session,
    completedAt,
    exercises,
    logs,
    prMap,
    week,
    unit,
    decisions,
    saveSessionDebrief,
    onDismiss,
}: Props) {
    const summary = computeSessionSummary(session, completedAt, exercises, logs, prMap, week, unit, decisions);
    const [rpe, setRpe] = useState<number | null>(null);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const shareRef = useRef<HTMLDivElement>(null);

    async function handleDone() {
        const trimmed = note.trim();
        if (rpe !== null || trimmed.length > 0) {
            setSaving(true);
            try {
                await saveSessionDebrief(session.id, { rpe, note: trimmed.length > 0 ? trimmed : null });
            } catch {
                // Best-effort: the session is already complete; don't block dismissal.
            }
            setSaving(false);
        }
        onDismiss();
    }

    async function handleShare() {
        if (!shareRef.current) return;
        try {
            const dataUrl = await toPng(shareRef.current, { pixelRatio: 2, backgroundColor: '#0e1113' });
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], 'pulse-session.png', { type: 'image/png' });
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file] });
            } else {
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = 'pulse-session.png';
                a.click();
            }
        } catch {
            // User-cancelled share or unsupported; no-op.
        }
    }

    const hasDecisions =
        summary.decisions.progressions.length > 0 ||
        summary.decisions.deloads.length > 0 ||
        summary.decisions.rampBack.length > 0;
    const showAdaptList = summary.prCount > 0 || hasDecisions;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-pulse-bg">
            {/* Off-screen export target */}
            <div className="pointer-events-none fixed left-[-9999px] top-0" aria-hidden>
                <ShareImageCard ref={shareRef} summary={summary} week={week} unit={unit} />
            </div>

            <div className="mx-auto w-full max-w-[440px] px-5 pb-10 pt-7">
                <div className="font-pulse-display text-base font-extrabold tracking-[-0.02em] text-pulse-text">
                    Pulse<span className="text-pulse-accent">.</span>
                </div>
                <div className="mt-3.5 font-pulse-body text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-pulse-success">
                    Session complete
                </div>
                <h2 className="mt-1 font-pulse-display text-[2rem] font-extrabold uppercase leading-[0.95] tracking-[-0.01em] text-pulse-text">
                    {summary.workoutLabel}
                </h2>
                <p className="mt-1.5 font-pulse-body text-[0.6875rem] text-pulse-muted">
                    {summary.date} · {summary.durationMin} min
                </p>

                {/* RPE */}
                <div className="mt-4">
                    <RpeScale value={rpe} onChange={setRpe} />
                </div>

                {/* Notes */}
                <div className="mt-4">
                    <div className="mb-2 font-pulse-body text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-pulse-muted">
                        Notes
                    </div>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={1000}
                        rows={2}
                        placeholder="Anything worth remembering? (optional)"
                        aria-label="Session notes"
                        className="w-full resize-none rounded-2xl border border-pulse-border bg-pulse-surface px-3.5 py-3 font-pulse-body text-[0.8125rem] text-pulse-dim outline-none transition-colors placeholder:text-pulse-muted focus:border-pulse-accent/50"
                    />
                </div>

                {/* Coach summary */}
                <div className="mt-4">
                    <div className="mb-2 font-pulse-body text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-pulse-muted">
                        Coach summary
                    </div>
                    <p className="font-pulse text-[0.9375rem] font-semibold leading-[1.45] text-pulse-text">
                        {summary.coachRead}
                    </p>

                    <div className="mt-3.5 grid grid-cols-3 gap-2">
                        {[
                            { v: `${summary.durationMin}`, suffix: ' min', k: 'Duration' },
                            { v: `${summary.totalSets}`, suffix: '', k: 'Sets' },
                            { v: `${summary.tonnage}`, suffix: ` ${unit}`, k: 'Volume' },
                        ].map((s) => (
                            <div key={s.k} className="rounded-xl border border-pulse-border bg-pulse-surface px-3 py-3">
                                <div className="font-pulse-display text-2xl font-extrabold leading-none text-pulse-text">
                                    {s.v}
                                    <span className="font-pulse text-[0.6875rem] font-semibold text-pulse-dim">
                                        {s.suffix}
                                    </span>
                                </div>
                                <div className="mt-1.5 font-pulse-body text-[0.5625rem] uppercase tracking-[0.14em] text-pulse-muted">
                                    {s.k}
                                </div>
                            </div>
                        ))}
                    </div>

                    {showAdaptList ? (
                        <div className="mt-3.5 flex flex-col gap-1.5">
                            {summary.prCount > 0 && (
                                <div className="rounded-xl border border-pulse-border bg-pulse-surface px-3.5 py-2.5 font-pulse text-[0.8125rem] font-semibold text-pulse-text">
                                    {summary.prCount} {summary.prCount === 1 ? 'new PR' : 'new PRs'} this session
                                </div>
                            )}
                            {summary.decisions.progressions.length > 0 && (
                                <div className="rounded-xl border border-pulse-border bg-pulse-surface px-3.5 py-2.5 font-pulse text-[0.8125rem] font-semibold text-pulse-text">
                                    ↑ Progressed {summary.decisions.progressions.length}{' '}
                                    {summary.decisions.progressions.length === 1 ? 'lift' : 'lifts'}
                                </div>
                            )}
                            {summary.decisions.deloads.length > 0 && (
                                <div className="rounded-xl border border-pulse-border bg-pulse-surface px-3.5 py-2.5 font-pulse text-[0.8125rem] font-semibold text-pulse-dim">
                                    ↓ Auto-deload on {summary.decisions.deloads.length}{' '}
                                    {summary.decisions.deloads.length === 1 ? 'lift' : 'lifts'}
                                </div>
                            )}
                            {summary.decisions.rampBack.length > 0 && (
                                <div className="rounded-xl border border-pulse-border bg-pulse-surface px-3.5 py-2.5 font-pulse text-[0.8125rem] font-semibold text-pulse-accent">
                                    Ramp-back week, eased on purpose
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="mt-3.5 rounded-xl border border-pulse-border bg-pulse-surface px-3.5 py-3 font-pulse-body text-[0.75rem] text-pulse-muted">
                            No PRs and nothing flagged this session, weights held and every set hit its target. That is
                            exactly what an on-plan week looks like.
                        </div>
                    )}

                    {summary.muscles.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {summary.muscles.map((m) => (
                                <span
                                    key={m.category}
                                    className="rounded-lg bg-pulse-surface-2 px-2.5 py-1 font-pulse text-[0.6875rem] font-semibold text-pulse-dim">
                                    {m.category.charAt(0).toUpperCase() + m.category.slice(1)}{' '}
                                    <b className="font-bold text-pulse-accent">{m.sets}</b>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="mt-5 flex flex-col gap-2.5">
                    <button onClick={handleDone} disabled={saving} className={BTN_PRIMARY_BLOCK}>
                        {saving ? 'Saving…' : 'Done'}
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-pulse-border bg-transparent py-3 font-pulse text-[0.875rem] font-semibold text-pulse-dim transition-colors hover:text-pulse-text">
                        Save image to share
                    </button>
                </div>
            </div>
        </div>
    );
}
