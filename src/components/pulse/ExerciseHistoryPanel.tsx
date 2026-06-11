'use client';
import { toDisplay } from '@/lib/pulse/utils';
import type { ExerciseHistory } from '@/lib/pulse/utils';
import type { Unit } from '@/lib/pulse/types';

// "What did I do here last time" at the point of logging (#13): best set +
// estimated 1RM, a short retrospective e1RM trend, and the previous note. Fed by
// computeExerciseHistory; renders nothing for a brand-new lift (no prior data), so
// it is safe to drop into any logging surface unconditionally.
const TREND: Record<'up' | 'down' | 'flat', { glyph: string; cls: string; label: string }> = {
    up: { glyph: '↑', cls: 'text-pulse-success', label: 'trending up' },
    down: { glyph: '↓', cls: 'text-pulse-accent', label: 'trending down' },
    flat: { glyph: '→', cls: 'text-pulse-dim', label: 'flat' },
};

export default function ExerciseHistoryPanel({ history, unit }: { history: ExerciseHistory; unit: Unit }) {
    const { best, trend, e1rmDeltaPct, previousNote } = history;
    if (!best && !previousNote) return null;
    const t = trend !== 'none' ? TREND[trend] : null;
    return (
        <div className="flex flex-col gap-1 rounded-lg bg-pulse-surface-2 px-3 py-2.5" data-testid="exercise-history">
            {best && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-pulse text-[0.78125rem] font-semibold text-pulse-text">
                        Best {toDisplay(best.kg, unit)} {unit} × {best.reps}
                    </span>
                    <span className="font-pulse text-[0.75rem] text-pulse-dim">
                        ~{Math.round(toDisplay(best.e1rm, unit))} {unit} 1RM
                    </span>
                    {t && (
                        <span className={`font-pulse text-[0.75rem] font-semibold ${t.cls}`} aria-label={t.label}>
                            {t.glyph}
                            {e1rmDeltaPct !== null && ` ${e1rmDeltaPct > 0 ? '+' : ''}${Math.round(e1rmDeltaPct)}%`}
                        </span>
                    )}
                </div>
            )}
            {previousNote && <p className="font-pulse text-[0.75rem] text-pulse-dim">Last note: {previousNote}</p>}
        </div>
    );
}
