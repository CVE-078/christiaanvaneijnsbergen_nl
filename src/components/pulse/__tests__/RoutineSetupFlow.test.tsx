import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RoutineSetupFlow from '../RoutineSetupFlow';
import type { EquipmentKey } from '@/lib/pulse/types';

const initial = {
    equipment: ['dumbbells'] as EquipmentKey[],
    experience: 'beginner' as const,
    goal: 'build_muscle' as const,
    days: '2-3' as const,
    trainingDays: [1, 3, 5],
    sessionTime: '~30 min' as const,
};

beforeEach(() => vi.clearAllMocks());

describe('RoutineSetupFlow', () => {
    it('starts at the equipment step', () => {
        render(<RoutineSetupFlow onComplete={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
    });

    it('Cancel calls onClose', () => {
        const onClose = vi.fn();
        render(<RoutineSetupFlow onComplete={vi.fn()} onClose={onClose} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('prefilled values let each step advance and completing returns the collected answers', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        render(<RoutineSetupFlow initial={initial} onComplete={onComplete} onClose={onClose} />);
        // Each value is prefilled, so Next is enabled on every step. With 3 training
        // days there are multiple styles, so a style step appears (6 Next clicks:
        // equipment, experience, goal, days/week, which days, style → session time).
        for (let i = 0; i < 6; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        const arg = onComplete.mock.calls[0][0];
        expect(arg.trainingDays).toEqual([1, 3, 5]);
        expect(arg.sessionTime).toBe('~30 min');
        expect(arg.answers.experience).toBe('beginner');
        expect(arg.answers.goal).toBe('build_muscle');
        expect(arg.answers.days).toBe('2-3');
        expect([...arg.answers.equipment]).toEqual(['dumbbells']);
        // The style step pre-selects the recommendation for the count (3 → fb-3).
        expect(arg.styleKey).toBe('fb-3');
    });

    it('shows the program-style step and lets you pick a non-default style', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        render(<RoutineSetupFlow initial={initial} onComplete={onComplete} onClose={vi.fn()} />);
        for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText(/which program style/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Push / Pull / Legs'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].styleKey).toBe('ppl-3');
    });

    it('caps the day picker at the chosen days-per-week count', () => {
        render(
            <RoutineSetupFlow
                initial={{ ...initial, days: '4', trainingDays: [] }}
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />,
        );
        // equipment → experience → goal → days/week (seeds the 4 recommended days) → which days
        for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText(/which days will you train/i)).toBeInTheDocument();
        expect(screen.getByText(/up to 4 days/i)).toBeInTheDocument();
        // Mon, Tue, Thu, Fri are seeded (4 = the cap), so a 5th day (Wed) is disabled.
        expect(screen.getByRole('button', { name: 'Wed' })).toBeDisabled();
    });

    it('hides the style step when only one style exists for the count', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] }; // 2 days → one style (fb-2)
        render(<RoutineSetupFlow initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next'));
        // No style step: 5 Next clicks land straight on the session-time step.
        expect(screen.queryByText(/which program style/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].styleKey).toBe('fb-2');
    });
});
