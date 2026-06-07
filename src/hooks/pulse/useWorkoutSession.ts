'use client';
import { useState, useCallback } from 'react';
import type { WorkoutSession, WorkoutVariant } from '@/lib/pulse/types';

export function useWorkoutSession() {
    const [session, setSession] = useState<WorkoutSession | null>(null);

    const startSession = useCallback(
        async (routineId: string, workoutType: string, variant?: WorkoutVariant | null): Promise<WorkoutSession> => {
            const res = await fetch('/api/pulse/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ routineId, workoutType, variant: variant ?? null }),
            });
            if (!res.ok) throw new Error('Failed to start session');
            const data = (await res.json()) as WorkoutSession;
            setSession(data);
            return data;
        },
        [],
    );

    const completeSession = useCallback(async (sessionId: string): Promise<void> => {
        const res = await fetch(`/api/pulse/sessions/${sessionId}`, { method: 'PATCH' });
        if (!res.ok) throw new Error('Failed to complete session');
        setSession(null);
    }, []);

    const saveSessionDebrief = useCallback(
        async (sessionId: string, debrief: { rpe: number | null; note: string | null }): Promise<void> => {
            const res = await fetch(`/api/pulse/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rpe: debrief.rpe, note: debrief.note }),
            });
            if (!res.ok) throw new Error('Failed to save session debrief');
        },
        [],
    );

    const clearSession = useCallback(() => setSession(null), []);

    return { session, startSession, completeSession, saveSessionDebrief, clearSession };
}
