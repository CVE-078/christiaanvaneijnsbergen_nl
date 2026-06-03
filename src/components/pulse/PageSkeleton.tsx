// Slate shimmer skeleton reused by every view while its data slice loads.
// `rows` controls how many card placeholders render.
const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, #161a1d 25%, #1c2125 50%, #161a1d 75%)',
    backgroundSize: '200% 100%',
    animation: 'pulse-shimmer 1.4s ease infinite',
};

export function SkeletonBar({ w = '100%', h = 12 }: { w?: number | string; h?: number }) {
    return <div aria-hidden style={{ width: w, height: h, borderRadius: 6, ...shimmer }} />;
}

export default function PageSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="px-4 pt-6 pb-8 max-w-[600px] lg:max-w-[820px] mx-auto flex flex-col gap-3" aria-busy="true">
            <SkeletonBar w={140} h={14} />
            <div className="mt-2 flex flex-col gap-2">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="bg-pulse-surface rounded-xl py-3.5 px-4 flex items-center gap-4">
                        <div style={{ width: 36, height: 28, borderRadius: 6, ...shimmer }} />
                        <div className="flex-1 flex flex-col gap-2">
                            <SkeletonBar w={`${55 + i * 7}%`} />
                            <SkeletonBar w="40%" h={8} />
                        </div>
                    </div>
                ))}
            </div>
            <style>{`@keyframes pulse-shimmer {0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>
    );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="px-4 py-16 flex flex-col items-center gap-3 text-center" role="alert">
            <div className="font-pulse text-sm text-pulse-dim">Couldn’t load your data.</div>
            <button
                onClick={onRetry}
                className="font-pulse text-sm font-semibold bg-pulse-accent text-pulse-bg rounded-lg px-4 py-2 cursor-pointer border-none">
                Retry
            </button>
        </div>
    );
}
