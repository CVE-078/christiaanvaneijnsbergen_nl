'use client';
import type { ExerciseCategory } from '@/lib/pulse/types';

interface MuscleVolumeBarsProps {
    volume: Partial<Record<ExerciseCategory, number>>;
}

// Presentational per-muscle weekly volume. Coral horizontal bars sized
// proportional to the busiest category, sorted by set count descending.
// Surfaces are separated by tone and whitespace, not borders.
export default function MuscleVolumeBars({ volume }: MuscleVolumeBarsProps) {
    const rows = (Object.entries(volume) as Array<[ExerciseCategory, number]>)
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a);

    if (rows.length === 0) {
        return <p className="font-pulse text-[0.75rem] text-pulse-dim py-2">No sets logged this week.</p>;
    }

    const max = rows[0][1];

    return (
        <ul className="flex flex-col gap-3">
            {rows.map(([category, count]) => (
                <li key={category} className="flex items-center gap-3">
                    <span
                        data-testid="muscle-label"
                        className="font-pulse text-[0.8125rem] text-pulse-dim capitalize w-20 shrink-0">
                        {category}
                    </span>
                    <span className="flex-1 h-2 rounded-full bg-pulse-surface-2 overflow-hidden">
                        <span
                            data-testid="muscle-bar"
                            className="block h-full rounded-full bg-pulse-accent"
                            style={{ width: `${(count / max) * 100}%` }}
                        />
                    </span>
                    <span className="font-pulse text-[0.8125rem] font-medium text-pulse-text w-5 text-right shrink-0">
                        {count}
                    </span>
                </li>
            ))}
        </ul>
    );
}
