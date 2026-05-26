const shimmer: React.CSSProperties = {
    background: `linear-gradient(90deg, #141414 25%, #1c1c1c 50%, #141414 75%)`,
    backgroundSize: '200% 100%',
    animation: 'pulse-shimmer 1.4s ease infinite',
};

export default function Loading() {
    return (
        <div className="min-h-screen bg-pulse-bg text-pulse-text">
            {/* Header */}
            <div className="border-b border-pulse-border px-4 h-14 flex items-center gap-3">
                <span className="font-pulse font-bold text-[0.9375rem] tracking-[0.08em] text-white uppercase">
                    Pulse<span className="text-pulse-accent">.</span>
                </span>
                <div style={{ width: 60, height: 12, borderRadius: 2, ...shimmer }} />
                <div style={{ marginLeft: 'auto', width: 160, height: 12, borderRadius: 2, ...shimmer }} />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-pulse-border">
                {['Push', 'Pull', 'Legs'].map((label) => (
                    <div
                        key={label}
                        className="flex-1 py-[0.875rem] text-center font-pulse text-[0.8125rem] tracking-[0.12em] uppercase text-[#333]">
                        {label}
                    </div>
                ))}
            </div>

            {/* Week row */}
            <div className="flex px-4 border-b border-pulse-border gap-1">
                {Array.from({ length: 12 }, (_, i) => (
                    <div key={i} className="min-w-[2.25rem] h-9 flex items-center justify-center">
                        <div style={{ width: 16, height: 10, borderRadius: 2, ...shimmer }} />
                    </div>
                ))}
            </div>

            {/* Exercise card skeletons */}
            <div className="py-3 px-4 max-w-[600px] mx-auto flex flex-col gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                    <div
                        key={i}
                        className="bg-pulse-surface border border-pulse-border rounded py-[0.875rem] px-4 flex items-center gap-4">
                        <div style={{ width: 36, height: 28, borderRadius: 2, ...shimmer }} />
                        <div className="flex-1">
                            <div
                                style={{
                                    width: `${55 + i * 7}%`,
                                    height: 12,
                                    borderRadius: 2,
                                    marginBottom: 8,
                                    ...shimmer,
                                }}
                            />
                            <div style={{ width: '40%', height: 8, borderRadius: 2, ...shimmer }} />
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
