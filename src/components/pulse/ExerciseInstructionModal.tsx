'use client';
import { useEffect, useState } from 'react';
import ModalSheet from '@/components/pulse/ModalSheet';
import type { ExerciseInstruction } from '@/lib/pulse/types';

interface Props {
    exerciseId: string;
    exerciseName: string;
    onClose: () => void;
}

export default function ExerciseInstructionModal({ exerciseId, exerciseName, onClose }: Props) {
    const [data, setData] = useState<ExerciseInstruction | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);
        fetch(`/api/pulse/exercises/${exerciseId}/instructions`)
            .then((res) => {
                if (!res.ok) throw new Error('not found');
                return res.json() as Promise<ExerciseInstruction>;
            })
            .then((d) => {
                if (!cancelled) {
                    setData(d);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setError(true);
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [exerciseId]);

    return (
        <ModalSheet open onClose={onClose} title={exerciseName}>
            <div className="px-6">
                {loading && <p className="font-pulse text-sm text-pulse-muted">Loading…</p>}

                {!loading && error && <p className="font-pulse text-sm text-pulse-muted">No instructions available.</p>}

                {!loading && !error && data && (
                    <>
                        {data.primary_muscles.length > 0 && (
                            <div className="mb-4">
                                <div className="mb-2 font-pulse text-[0.625rem] uppercase tracking-[0.08em] text-pulse-muted">
                                    Primary
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {data.primary_muscles.map((m) => (
                                        <span
                                            key={m}
                                            className="rounded-full border border-pulse-accent/25 bg-pulse-accent/10 px-2.5 py-0.5 font-pulse text-xs font-semibold text-pulse-accent">
                                            {m}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.secondary_muscles.length > 0 && (
                            <div className="mb-4">
                                <div className="mb-2 font-pulse text-[0.625rem] uppercase tracking-[0.08em] text-pulse-muted">
                                    Secondary
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {data.secondary_muscles.map((m) => (
                                        <span
                                            key={m}
                                            className="rounded-full bg-pulse-surface-2 px-2.5 py-0.5 font-pulse text-xs font-semibold text-pulse-dim">
                                            {m}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.cues.length > 0 && (
                            <div>
                                <div className="mb-2 font-pulse text-[0.625rem] uppercase tracking-[0.08em] text-pulse-muted">
                                    Cues
                                </div>
                                <div className="flex flex-col gap-2.5">
                                    {data.cues.map((cue, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pulse-accent/10 font-pulse text-[0.6875rem] font-bold text-pulse-accent">
                                                {i + 1}
                                            </span>
                                            <span className="font-pulse text-sm leading-snug text-pulse-text">
                                                {cue}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </ModalSheet>
    );
}
