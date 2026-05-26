import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import type { Exercise, Logs, WorkoutType } from '@/lib/pulse/types';

const GREEN = '#22c55e';

interface Props {
    exercise: Exercise;
    exIdx: number;
    week: number;
    type: WorkoutType;
    logs: Logs;
    isActive: boolean;
    onClick: () => void;
}

export default function ExerciseListItem({ exercise, exIdx, week, type, logs, isActive, onClick }: Props) {
    const maxSets = parseMaxSets(exercise.sets);
    const savedCount = Array.from({ length: maxSets }, (_, i) => logKey(week, type, exIdx, i)).filter(
        (k) => logs[k]?.saved,
    ).length;
    const complete = savedCount >= maxSets;

    return (
        <button
            onClick={onClick}
            className={`w-full py-3 px-4 flex items-center gap-3 text-left border-none border-l-2 cursor-pointer border-b border-[#222] ${isActive ? 'bg-[#161616] border-pulse-accent' : 'bg-transparent border-transparent'}`}>
            <span className="font-pulse text-[1.125rem] font-bold leading-none w-7 shrink-0 tracking-[-0.04em] select-none text-[#333]">
                {String(exIdx + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 min-w-0">
                <div
                    className={`font-semibold text-[0.875rem] truncate transition-colors duration-100 ${isActive ? 'text-white' : 'text-[#888]'}`}>
                    {exercise.name}
                </div>
                <div className="flex gap-[3px] mt-1">
                    {Array.from({ length: maxSets }, (_, i) => (
                        <span
                            key={i}
                            className="block w-1 h-1 rounded-full"
                            style={{
                                background:
                                    i < savedCount
                                        ? complete
                                            ? GREEN
                                            : 'var(--color-pulse-accent)'
                                        : 'var(--color-pulse-muted)',
                            }}
                        />
                    ))}
                </div>
            </div>
            {complete && <span className="font-pulse text-[0.75rem] text-[#22c55e] shrink-0">✓</span>}
        </button>
    );
}
