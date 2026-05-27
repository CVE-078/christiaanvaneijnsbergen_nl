import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkoutTabs from '../WorkoutTabs';
import type { RoutineExercise } from '@/lib/pulse/types';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';

const mockRE = (id: string): RoutineExercise => ({
    id,
    routine_id: 'r1',
    exercise_id: id,
    workout_type: 'push',
    order: 0,
    sets: '3',
    reps: '8-12',
    starting_weight_kg: null,
    exercise: { id, name: `Exercise ${id}`, category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null },
});

const defaultContext = {
    activeTab: 'push' as const,
    setActiveTab: vi.fn(),
    activeWeek: 1,
    logs: {},
    routineExercisesByType: {
        push: [mockRE('ex-1'), mockRE('ex-2'), mockRE('ex-3')],
        pull: [mockRE('ex-4')],
        legs: [],
        chest: [],
        back: [],
        shoulders: [],
        arms: [],
    },
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    defaultContext.setActiveTab.mockClear();
});

describe('WorkoutTabs', () => {
    it('renders Push, Pull and Legs tabs', () => {
        render(<WorkoutTabs />);
        expect(screen.getByRole('tab', { name: /push/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /pull/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /legs/i })).toBeInTheDocument();
    });

    it('marks the active tab with aria-selected="true" and others with false', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeTab: 'pull' as const,
        } as unknown as ReturnType<typeof usePulse>);
        render(<WorkoutTabs />);
        expect(screen.getByRole('tab', { name: /pull/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: /push/i })).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByRole('tab', { name: /legs/i })).toHaveAttribute('aria-selected', 'false');
    });

    it('calls setActiveTab when an inactive tab is clicked', async () => {
        render(<WorkoutTabs />);
        await userEvent.click(screen.getByRole('tab', { name: /legs/i }));
        expect(defaultContext.setActiveTab).toHaveBeenCalledWith('legs');
    });

    it('calls setActiveTab with active tab type when active tab is clicked', async () => {
        render(<WorkoutTabs />);
        await userEvent.click(screen.getByRole('tab', { name: /push/i }));
        expect(defaultContext.setActiveTab).toHaveBeenCalledWith('push');
    });

    it('navigates to the next tab on ArrowRight', async () => {
        render(<WorkoutTabs />);
        screen.getByRole('tab', { name: /push/i }).focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(defaultContext.setActiveTab).toHaveBeenCalledWith('pull');
    });

    it('wraps around to the last tab on ArrowLeft from the first', async () => {
        render(<WorkoutTabs />);
        screen.getByRole('tab', { name: /push/i }).focus();
        await userEvent.keyboard('{ArrowLeft}');
        expect(defaultContext.setActiveTab).toHaveBeenCalledWith('legs');
    });

    it('shows "0/3" completion badge on the active push tab', () => {
        render(<WorkoutTabs />);
        expect(screen.getByText('0/3')).toBeInTheDocument();
    });

    it('does not show a badge when the tab has no exercises', () => {
        render(<WorkoutTabs />);
        // legs has 0 exercises — no badge rendered for it
        const legsTab = screen.getByRole('tab', { name: /legs/i });
        expect(legsTab.querySelector('span:last-child')?.textContent).not.toMatch(/\d+\/\d+/);
    });
});
