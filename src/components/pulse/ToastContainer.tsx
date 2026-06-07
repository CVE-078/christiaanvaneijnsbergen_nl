'use client';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/pulse/toast';
import { usePulse } from '@/context/PulseContext';
import type { Toast } from '@/lib/pulse/toast';

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
    const [hovering, setHovering] = useState(false);

    useEffect(() => {
        if (hovering) return;
        const timer = setTimeout(() => onDismiss(toast.id), 4000);
        return () => clearTimeout(timer);
        // onDismiss is stable, so keying on toast.id and hovering keeps the
        // 4s timer from being torn down and recreated on every parent render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast.id, hovering]);

    const leftBorderColor =
        toast.variant === 'error'
            ? '#ef4444'
            : toast.variant === 'success'
              ? 'var(--color-pulse-accent)'
              : 'var(--color-pulse-dim)';

    return (
        <div
            role={toast.variant === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            className="bg-pulse-surface rounded shadow-lg min-w-[200px] max-w-[320px] px-3 py-2.5 flex items-center gap-3"
            style={{
                border: '1px solid var(--color-pulse-border)',
                borderLeft: `4px solid ${leftBorderColor}`,
            }}>
            <span className="font-pulse text-[0.8125rem] text-pulse-text flex-1">{toast.message}</span>
            <button
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="text-pulse-dim bg-transparent border-none cursor-pointer p-0 shrink-0 font-pulse text-sm leading-none">
                ✕
            </button>
        </div>
    );
}

export default function ToastContainer() {
    const { toasts, dismiss } = useToast();
    const { workoutModeOpen } = usePulse();
    const handleDismiss = useCallback((id: string) => dismiss(id), [dismiss]);

    if (toasts.length === 0) return null;

    // Guided mode puts its primary actions (Save / Next / Finish) along the bottom,
    // so anchor toasts to the top there, just below the guided topbar, instead of
    // letting them sit over those buttons. Elsewhere they stay bottom-right, above
    // the mobile BottomNav.
    const position = workoutModeOpen
        ? 'right-4 top-[calc(env(safe-area-inset-top)+4.5rem)]'
        : 'bottom-20 right-4 lg:bottom-4';

    return (
        <div className={`fixed z-50 flex flex-col gap-2 ${position}`} aria-live="polite" aria-atomic="false">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
            ))}
        </div>
    );
}
