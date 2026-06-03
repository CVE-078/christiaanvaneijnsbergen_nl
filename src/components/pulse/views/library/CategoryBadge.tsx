import type { ExerciseCategory } from '@/lib/pulse/types';

// Slate keeps a single accent, so category badges read as a calm neutral chip
// (tone shift, no border) rather than a rainbow of per-category hues.
export default function CategoryBadge({ category }: { category: ExerciseCategory }) {
    return (
        <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-dim bg-pulse-surface-2 rounded-full px-2 py-0.5">
            {category}
        </span>
    );
}
