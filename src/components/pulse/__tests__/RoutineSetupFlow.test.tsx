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
        // Each value is prefilled, so Next is enabled on every step.
        for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        const arg = onComplete.mock.calls[0][0];
        expect(arg.trainingDays).toEqual([1, 3, 5]);
        expect(arg.sessionTime).toBe('~30 min');
        expect(arg.answers.experience).toBe('beginner');
        expect(arg.answers.goal).toBe('build_muscle');
        expect(arg.answers.days).toBe('2-3');
        expect([...arg.answers.equipment]).toEqual(['dumbbells']);
    });
});
