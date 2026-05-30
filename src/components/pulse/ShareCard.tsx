'use client';
import { computeShareStats } from '@/lib/pulse/utils';
import type { WorkoutSession, RoutineExercise, Logs, PRMap, Unit } from '@/lib/pulse/types';

interface Props {
    session: WorkoutSession;
    completedAt: string;
    exercises: RoutineExercise[];
    logs: Logs;
    prMap: PRMap;
    week: number;
    unit: Unit;
    onDismiss: () => void;
}

export default function ShareCard({ session, completedAt, exercises, logs, prMap, week, unit, onDismiss }: Props) {
    const stats = computeShareStats(session, completedAt, exercises, logs, prMap, week, unit);

    return (
        <div className="fixed inset-0 z-50 bg-pulse-bg flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                {/* Branding */}
                <div className="mb-6 text-center">
                    <span className="font-pulse font-bold text-[1.125rem] tracking-[0.08em] text-white uppercase">
                        Pulse<span className="text-pulse-accent">.</span>
                    </span>
                    <p className="font-pulse text-[0.6875rem] text-pulse-muted tracking-[0.06em] mt-0.5">
                        Your workout, logged.
                    </p>
                </div>

                {/* Card */}
                <div className="w-full max-w-[340px] bg-pulse-surface border border-pulse-border rounded-2xl p-5">
                    {/* Workout header */}
                    <div className="mb-4">
                        <h2 className="font-pulse text-xl font-bold text-white">{stats.workoutLabel}</h2>
                        <p className="font-pulse text-[0.75rem] text-pulse-dim mt-0.5">{stats.date}</p>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {[`${stats.durationMin} min`, `${stats.totalSets} sets`, `Week ${week}`].map((label) => (
                            <span
                                key={label}
                                className="font-pulse text-[0.6875rem] font-semibold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/20 rounded-full px-2.5 py-1 tracking-[0.04em]"
                            >
                                {label}
                            </span>
                        ))}
                    </div>

                    {/* Top lifts */}
                    {stats.topLifts.length > 0 && (
                        <div className="flex flex-col gap-1.5 mb-3">
                            {stats.topLifts.map((lift) => (
                                <div key={lift.name} className="flex items-center gap-2">
                                    <span className="font-pulse text-[0.8125rem] text-pulse-text flex-1 truncate">
                                        {lift.name}
                                    </span>
                                    <span className="font-pulse text-[0.8125rem] font-semibold text-white shrink-0">
                                        {lift.displayWeight} {unit} × {lift.reps}
                                    </span>
                                    {lift.isPR && (
                                        <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-[2px] py-[0.1rem] px-[0.3rem] shrink-0">
                                            PR
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* PR summary */}
                    {stats.prCount > 0 && (
                        <p className="font-pulse text-[0.75rem] font-semibold text-pulse-accent">
                            {stats.prCount} {stats.prCount === 1 ? 'PR' : 'PRs'} this session 🏆
                        </p>
                    )}
                </div>

                {/* Screenshot hint */}
                <p className="font-pulse text-[0.6875rem] text-pulse-muted mt-4 tracking-[0.04em]">
                    📸 Screenshot to share
                </p>
            </div>

            {/* Done button */}
            <div className="px-6 pb-8">
                <button
                    onClick={onDismiss}
                    className="font-pulse w-full py-3 rounded-xl bg-pulse-accent text-black font-semibold text-sm cursor-pointer border-none">
                    Done
                </button>
            </div>
        </div>
    );
}
