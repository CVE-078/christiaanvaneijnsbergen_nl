import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinishDebrief from '../FinishDebrief';
import type { WorkoutSession } from '@/lib/pulse/types';

const session = {
    id: 's1',
    user_id: 'u',
    routine_id: 'r',
    workout_type: 'push',
    variant: 'A',
    started_at: '2026-05-30T10:00:00Z',
    completed_at: '2026-05-30T11:00:00Z',
    session_rpe: null,
    session_note: null,
} as WorkoutSession;

const baseProps = {
    session,
    completedAt: '2026-05-30T11:00:00Z',
    exercises: [{ id: 'a', sets: '3', reps: '8-12', exercise: { name: 'Bench', category: 'chest' } }] as any,
    logs: { '1-a-0': { kg: 100, reps: 10, rir: 2, saved: true } } as any,
    prMap: {} as any,
    week: 1,
    unit: 'kg' as const,
    decisions: [] as any,
};

describe('FinishDebrief', () => {
    it('renders the coach read and a steady panel for a quiet session', () => {
        render(<FinishDebrief {...baseProps} saveSessionDebrief={vi.fn()} onDismiss={vi.fn()} />);
        expect(screen.getByText(/steady session/i)).toBeInTheDocument();
    });

    it('saves the picked RPE then dismisses on Done', async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const onDismiss = vi.fn();
        render(<FinishDebrief {...baseProps} saveSessionDebrief={save} onDismiss={onDismiss} />);
        await userEvent.click(screen.getByRole('button', { name: 'Rate effort 7' }));
        await userEvent.click(screen.getByRole('button', { name: /^done$/i }));
        expect(save).toHaveBeenCalledWith('s1', { rpe: 7, note: null });
        expect(onDismiss).toHaveBeenCalled();
    });

    it('dismisses without saving when nothing was entered', async () => {
        const save = vi.fn();
        const onDismiss = vi.fn();
        render(<FinishDebrief {...baseProps} saveSessionDebrief={save} onDismiss={onDismiss} />);
        await userEvent.click(screen.getByRole('button', { name: /^done$/i }));
        expect(save).not.toHaveBeenCalled();
        expect(onDismiss).toHaveBeenCalled();
    });

    it('makes the auto-deload chip a tappable why, sourced from explainCopy', async () => {
        const deload = {
            id: 'd1',
            routine_id: 'r',
            type: 'deload',
            trigger: 'plateau',
            affectedArea: 'a',
            week: 1,
            magnitude: { fromKg: 100, toKg: 90 },
            confidence: null,
            created_at: '2026-05-30T11:00:00Z',
        } as any;
        render(<FinishDebrief {...baseProps} decisions={[deload]} saveSessionDebrief={vi.fn()} onDismiss={vi.fn()} />);
        const chip = screen.getByRole('button', { name: /why this deload/i });
        expect(chip).toHaveTextContent(/Auto-deload on 1 lift/);
        await userEvent.click(chip);
        expect(screen.getByText('No e1RM gain in 3 weeks, so the lift stalled.')).toBeInTheDocument();
    });
});
