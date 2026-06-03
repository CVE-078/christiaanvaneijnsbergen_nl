import type { ExerciseCategory } from '@/lib/pulse/types';

const CATEGORY_COLOR: Record<ExerciseCategory, string> = {
    chest: 'text-rose-400',
    shoulders: 'text-orange-400',
    triceps: 'text-amber-400',
    back: 'text-sky-400',
    biceps: 'text-indigo-400',
    legs: 'text-violet-400',
    glutes: 'text-pink-400',
    calves: 'text-teal-400',
    abs: 'text-lime-400',
    other: 'text-pulse-dim',
};

export default function CategoryBadge({ category }: { category: ExerciseCategory }) {
    return (
        <span
            className={`font-pulse text-[0.625rem] tracking-[0.08em] uppercase ${CATEGORY_COLOR[category]} bg-pulse-bg border border-pulse-border rounded-full px-2 py-0.5`}>
            {category}
        </span>
    );
}
