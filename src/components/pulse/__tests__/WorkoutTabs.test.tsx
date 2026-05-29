import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkoutTabs from '../WorkoutTabs';
import type { RoutineExercise, TabKey, WorkoutType } from '@/lib/pulse/types';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';

const mockRE = (id: string, workoutType: WorkoutType = 'push'): RoutineExercise => ({
    id,
    routine_id: 'r1',
    exercise_id: id,
    workout_type: workoutType,
    variant: null,
    order: 0,
    sets: '3',
    reps: '8-12',
    starting_weight_kg: null,
    exercise: { id, name: `Exercise ${id}`, category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null },
});

// Sparse context — only push and pull are present (not legs/chest/back/shoulders/arms)
const defaultContext = {
    activeTab: 'push' as TabKey,
    setActiveTab: vi.fn(),
    activeWeek: 1,
    logs: {},
    routineExercisesByTabKey: {
        push: [mockRE('ex-1'), mockRE('ex-2'), mockRE('ex-3')],
        pull: [mockRE('ex-4', 'pull')],
    } as Partial<Record<TabKey, RoutineExercise[]>>,
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    defaultContext.setActiveTab.mockClear();
});

describe('WorkoutTabs', () => {
    it('renders Push and Pull tabs but not Legs (legs not in routineExercisesByTabKey)', () => {
        render(<WorkoutTabs />);
        expect(screen.getByRole('tab', { name: /push/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /pull/i })).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /legs/i })).not.toBeInTheDocument();
    });

    it('renders only tabs for present workout types', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeTab: 'chest' as TabKey,
            routineExercisesByTabKey: {
                chest: [mockRE('ex-c1', 'chest')],
                back: [mockRE('ex-b1', 'back')],
            } as Partial<Record<TabKey, RoutineExercise[]>>,
        } as unknown as ReturnType<typeof usePulse>);
        render(<WorkoutTabs />);
        expect(screen.getByRole('tab', { name: /chest/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /back/i })).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /push/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /pull/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /legs/i })).not.toBeInTheDocument();
    });

    it('marks the active tab with aria-selected="true" and the other with false', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeTab: 'pull' as TabKey,
        } as unknown as ReturnType<typeof usePulse>);
        render(<WorkoutTabs />);
        expect(screen.getByRole('tab', { name: /pull/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: /push/i })).toHaveAttribute('aria-selected', 'false');
    });

    it('calls setActiveTab when an inactive tab is clicked', async () => {
        render(<WorkoutTabs />);
        await userEvent.click(screen.getByRole('tab', { name: /pull/i }));
        expect(defaultContext.setActiveTab).toHaveBeenCalledWith('pull');
    });

    it('calls setActiveTab with active tab type when active tab is clicked', async () => {
        render(<WorkoutTabs />);
        await userEvent.click(screen.getByRole('tab', { name: /push/i }));
        expect(defaultContext.setActiveTab).toHaveBeenCalledWith('push');
    });

    it('navigates to the next tab on ArrowRight (push → pull)', async () => {
        render(<WorkoutTabs />);
        screen.getByRole('tab', { name: /push/i }).focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(defaultContext.setActiveTab).toHaveBeenCalledWith('pull');
    });

    it('wraps around to the last tab on ArrowLeft from the first (push → pull with 2 tabs)', async () => {
        render(<WorkoutTabs />);
        screen.getByRole('tab', { name: /push/i }).focus();
        await userEvent.keyboard('{ArrowLeft}');
        expect(defaultContext.setActiveTab).toHaveBeenCalledWith('pull');
    });

    it('shows "0/3" completion badge on the active push tab', () => {
        render(<WorkoutTabs />);
        expect(screen.getByText('0/3')).toBeInTheDocument();
    });

    it('does not show a badge when the tab has no exercises', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            routineExercisesByTabKey: {
                push: [],
                pull: [mockRE('ex-4', 'pull')],
            } as Partial<Record<TabKey, RoutineExercise[]>>,
        } as unknown as ReturnType<typeof usePulse>);
        render(<WorkoutTabs />);
        const pushTab = screen.getByRole('tab', { name: /push/i });
        // The badge span is only rendered when total > 0, so no x/y pattern inside the push tab
        expect(pushTab.textContent).not.toMatch(/\d+\/\d+/);
    });
});
