const shimmer: React.CSSProperties = {
    background: `linear-gradient(90deg, #161a1d 25%, #1c2125 50%, #161a1d 75%)`,
    backgroundSize: '200% 100%',
    animation: 'pulse-shimmer 1.4s ease infinite',
};

// Suspense fallback for the bare /pulse segment: the auth + utility routes
// (login, signup, forgot/reset password, auth/confirm, account-deleted), which
// all render a centered card. The protected app has its own loading.tsx
// ((protected)/loading.tsx -> PageSkeleton), so this never shows the Train shell.
// It mirrors the auth card layout so the skeleton matches the page that follows.
export default function Loading() {
    return (
        <div className="min-h-screen bg-pulse-bg flex items-center justify-center p-4" aria-busy="true">
            <div className="w-full max-w-[360px] bg-pulse-surface rounded-2xl p-7 flex flex-col">
                {/* Brand + tagline */}
                <div className="mb-7 flex flex-col gap-2">
                    <span className="font-pulse font-bold text-lg tracking-[0.06em] uppercase text-pulse-text">
                        Pulse<span className="text-pulse-accent">.</span>
                    </span>
                    <div style={{ width: 200, height: 11, borderRadius: 4, ...shimmer }} />
                </div>

                {/* Two labelled field placeholders */}
                {[0, 1].map((i) => (
                    <div key={i} className="mb-5 flex flex-col gap-1.5">
                        <div style={{ width: 52, height: 9, borderRadius: 4, ...shimmer }} />
                        <div style={{ width: '100%', height: 44, borderRadius: 8, ...shimmer }} />
                    </div>
                ))}

                {/* Submit button */}
                <div style={{ width: '100%', height: 46, borderRadius: 8, marginTop: 4, ...shimmer }} />

                {/* Footer link line */}
                <div className="mt-6 mx-auto" style={{ width: 150, height: 10, borderRadius: 4, ...shimmer }} />
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
