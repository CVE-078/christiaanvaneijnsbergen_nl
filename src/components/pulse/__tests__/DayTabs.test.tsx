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
    currentWeek: 1,
    logs: {},
    routineExercisesByTabKey: {
        upper: [
            {
                id: 'ex1',
                sets: '3',
                reps: '8-12',
                routine_id: 'r1',
                exercise_id: 'e1',
                workout_type: 'upper',
                variant: null,
                order: 1,
                starting_weight_kg: null,
                superset_group_id: null,
                exercise: {
                    id: 'e1',
                    name: 'Bench',
                    category: 'chest',
                    default_sets: '3',
                    default_reps: '8-12',
                    user_id: null,
                },
            },
        ],
        lower: [],
    },
    resolveTabForEntry: (entry: ScheduleEntry) =>
        entry.variant ? `${entry.workout_type}:${entry.variant}` : entry.workout_type,
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultCtx as any);
    defaultCtx.setActiveDay = vi.fn();
});

describe('DayTabs', () => {
    it('renders all 7 days, with non-training days disabled', () => {
        render(<DayTabs />);
        expect(screen.getByRole('tab', { name: /mon/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /tue/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /thu/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /fri/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /wed/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /wed/i })).toBeDisabled();
    });

    it('labels non-training days as rest', () => {
        render(<DayTabs />);
        // The "Rest" detail now lives in the accessible name, not visible tile text.
        expect(screen.getByRole('tab', { name: /wed, rest day/i })).toBeInTheDocument();
    });

    it('marks the active day tab as aria-selected', () => {
        render(<DayTabs />);
        expect(screen.getByRole('tab', { name: /mon/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: /tue/i })).toHaveAttribute('aria-selected', 'false');
    });

    it('shows the selected day focus in the summary line', () => {
        render(<DayTabs />);
        // Mon is active and trains Upper, so the summary surfaces its focus once.
        expect(screen.getByText('Upper')).toBeInTheDocument();
    });

    it('exposes done/total for each training day via the accessible name', () => {
        render(<DayTabs />);
        expect(screen.getByRole('tab', { name: /mon, upper, 0 of 1 done/i })).toBeInTheDocument();
    });

    it('calls setActiveDay when a tab is clicked', async () => {
        render(<DayTabs />);
        await userEvent.click(screen.getByRole('tab', { name: /tue/i }));
        expect(defaultCtx.setActiveDay).toHaveBeenCalledWith(2);
    });

    it('only marks today in the week the program is currently on', () => {
        // Mon 8 Jun 2026 -> getDay() === 1 (Monday). Select Tue so Mon (today) is
        // unselected and free to show the marker.
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 5, 8));
        try {
            const { unmount } = render(<DayTabs />);
            vi.mocked(usePulse).mockReturnValue({ ...defaultCtx, activeDay: 2, activeWeek: 3, currentWeek: 3 } as any);
            unmount();
            const { container, unmount: unmount2 } = render(<DayTabs />);
            expect(container.querySelector('[aria-label="today"]')).toBeTruthy();
            unmount2();

            // Viewing a different week than the program is on: no today marker.
            vi.mocked(usePulse).mockReturnValue({ ...defaultCtx, activeDay: 2, activeWeek: 2, currentWeek: 3 } as any);
            const { container: c2 } = render(<DayTabs />);
            expect(c2.querySelector('[aria-label="today"]')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});
