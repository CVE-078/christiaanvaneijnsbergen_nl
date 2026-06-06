const shimmer: React.CSSProperties = {
    background: `linear-gradient(90deg, #161a1d 25%, #1c2125 50%, #161a1d 75%)`,
    backgroundSize: '200% 100%',
    animation: 'pulse-shimmer 1.4s ease infinite',
};

export default function Loading() {
    return (
        <div className="min-h-screen bg-pulse-bg text-pulse-text">
            {/* Header */}
            <div className="border-b border-pulse-border px-4 h-14 flex items-center gap-3">
                <span className="font-pulse font-bold text-[0.9375rem] tracking-[0.08em] text-pulse-text uppercase">
                    Pulse<span className="text-pulse-accent">.</span>
                </span>
                <div style={{ width: 60, height: 12, borderRadius: 4, ...shimmer }} />
                <div style={{ marginLeft: 'auto', width: 160, height: 12, borderRadius: 4, ...shimmer }} />
            </div>

            {/* Workout-type tabs, dynamic per routine, shown as neutral pill placeholders */}
            <div className="flex gap-2 px-4 py-3">
                {[64, 56, 72].map((w, i) => (
                    <div key={i} style={{ width: w, height: 30, borderRadius: 999, ...shimmer }} />
                ))}
            </div>

            {/* Week strip */}
            <div className="flex px-4 gap-1 pb-3">
                {Array.from({ length: 12 }, (_, i) => (
                    <div key={i} className="min-w-[2.25rem] h-8 flex items-center justify-center">
                        <div style={{ width: 18, height: 10, borderRadius: 4, ...shimmer }} />
                    </div>
                ))}
            </div>

            {/* Exercise card skeletons */}
            <div className="px-4 pb-8 max-w-[600px] lg:max-w-[820px] mx-auto flex flex-col gap-2">
                {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="bg-pulse-surface rounded-xl py-3.5 px-4 flex items-center gap-4">
                        <div style={{ width: 36, height: 28, borderRadius: 6, ...shimmer }} />
                        <div className="flex-1">
                            <div
                                style={{
                                    width: `${55 + i * 7}%`,
                                    height: 12,
                                    borderRadius: 4,
                                    marginBottom: 8,
                                    ...shimmer,
                                }}
                            />
                            <div style={{ width: '40%', height: 8, borderRadius: 4, ...shimmer }} />
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
        @keyframes pulse-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
        </div>
    );
}
