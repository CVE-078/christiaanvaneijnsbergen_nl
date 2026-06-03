import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgramView from '../views/ProgramView';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';
import type { RoutineWithExercises, RoutineExercise } from '@/lib/pulse/types';

const makeRE = (id: string, name: string, type: 'push' | 'pull' | 'legs' | 'full_body'): RoutineExercise => ({
    id,
    routine_id: 'r1',
    exercise_id: id,
    workout_type: type,
    variant: null,
    order: 0,
    sets: '3',
    reps: '8',
    starting_weight_kg: null,
    superset_group_id: null,
    exercise: { id, name, category: 'chest', default_sets: '3', default_reps: '8', user_id: null },
});

const pushRE = makeRE('re1', 'Bench Press', 'push');
const pullRE = makeRE('re2', 'Row', 'pull');
const legsRE = makeRE('re3', 'Squat', 'legs');

const baseContext = {
    activeWeek: 1,
    setActiveWeek: vi.fn(),
    logs: {},
    activeSchedule: [],
    activeRoutine: null,
    routineExercisesByType: {},
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(baseContext as unknown as ReturnType<typeof usePulse>);
});

describe('ProgramView', () => {
    it('shows all type sections when no schedule is set', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...baseContext,
            routineExercisesByType: { push: [pushRE], pull: [pullRE] },
        } as unknown as ReturnType<typeof usePulse>);
        render(<ProgramView />);
        expect(screen.getByText('Push')).toBeInTheDocument();
        expect(screen.getByText('Pull')).toBeInTheDocument();
    });

    it('shows only one section when schedule has a single workout type', () => {
        const routine: RoutineWithExercises = {
            id: 'r1',
            user_id: 'u1',
            name: 'Full Body',
            created_at: '',
            schedule: [],
            exercises: [pushRE, pullRE, legsRE],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...baseContext,
            activeRoutine: routine,
            activeSchedule: [
                { day_of_week: 1, workout_type: 'full_body' },
                { day_of_week: 3, workout_type: 'full_body' },
                { day_of_week: 5, workout_type: 'full_body' },
            ],
            routineExercisesByType: { push: [pushRE], pull: [pullRE], legs: [legsRE] },
        } as unknown as ReturnType<typeof usePulse>);
        render(<ProgramView />);
        expect(screen.getByText('Full Body')).toBeInTheDocument();
        expect(screen.queryByText('Push')).not.toBeInTheDocument();
        expect(screen.queryByText('Pull')).not.toBeInTheDocument();
        expect(screen.queryByText('Legs')).not.toBeInTheDocument();
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Row')).toBeInTheDocument();
        expect(screen.getByText('Squat')).toBeInTheDocument();
    });

    it('falls back to all exercises when schedule has single type but activeRoutine is null', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...baseContext,
            activeRoutine: null,
            activeSchedule: [{ day_of_week: 1, workout_type: 'full_body' }],
            routineExercisesByType: { push: [pushRE], pull: [pullRE] },
        } as unknown as ReturnType<typeof usePulse>);
        render(<ProgramView />);
        expect(screen.getByText('Full Body')).toBeInTheDocument();
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Row')).toBeInTheDocument();
    });

    it('shows only scheduled types when schedule has multiple distinct types', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...baseContext,
            activeSchedule: [
                { day_of_week: 1, workout_type: 'push' },
                { day_of_week: 3, workout_type: 'pull' },
            ],
            routineExercisesByType: { push: [pushRE], pull: [pullRE], legs: [legsRE] },
        } as unknown as ReturnType<typeof usePulse>);
        render(<ProgramView />);
        expect(screen.getByText('Push')).toBeInTheDocument();
        expect(screen.getByText('Pull')).toBeInTheDocument();
        expect(screen.queryByText('Legs')).not.toBeInTheDocument();
    });
});
