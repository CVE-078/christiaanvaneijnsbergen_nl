import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DayTabs from '../DayTabs';
import type { ScheduleEntry } from '@/lib/pulse/types';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));
import { usePulse } from '@/context/PulseContext';

const schedule: ScheduleEntry[] = [
    { day_of_week: 1, workout_type: 'upper' },
    { day_of_week: 2, workout_type: 'lower' },
    { day_of_week: 4, workout_type: 'upper' },
    { day_of_week: 5, workout_type: 'lower' },
];

const defaultCtx = {
    activeDay: 1,
    setActiveDay: vi.fn(),
    activeSchedule: schedule,
    activeWeek: 1,
    logs: {},
    routineExercisesByType: {
        upper: [{ id: 'ex1', sets: '3', reps: '8-12', routine_id: 'r1', exercise_id: 'e1', workout_type: 'upper', order: 1, starting_weight_kg: null, exercise: { id: 'e1', name: 'Bench', category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null } }],
        lower: [],
    },
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultCtx as any);
    defaultCtx.setActiveDay = vi.fn();
});

describe('DayTabs', () => {
    it('renders a tab for each scheduled day', () => {
        render(<DayTabs />);
        expect(screen.getByRole('tab', { name: /mon/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /tue/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /thu/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /fri/i })).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /wed/i })).not.toBeInTheDocument();
    });

    it('marks the active day tab as aria-selected', () => {
        render(<DayTabs />);
        expect(screen.getByRole('tab', { name: /mon/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: /tue/i })).toHaveAttribute('aria-selected', 'false');
    });

    it('shows workout type label on each tab', () => {
        render(<DayTabs />);
        const monTab = screen.getByRole('tab', { name: /mon/i });
        expect(monTab).toHaveTextContent('Upper');
    });

    it('calls setActiveDay when a tab is clicked', async () => {
        render(<DayTabs />);
        await userEvent.click(screen.getByRole('tab', { name: /tue/i }));
        expect(defaultCtx.setActiveDay).toHaveBeenCalledWith(2);
    });

    it('shows done/total badge when tab has exercises', () => {
        render(<DayTabs />);
        const monTab = screen.getByRole('tab', { name: /mon/i });
        expect(monTab).toHaveTextContent('0/1');
    });
});
