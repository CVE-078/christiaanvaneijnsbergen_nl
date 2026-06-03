import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareCard from '../ShareCard';
import { calcE1RM } from '@/lib/pulse/utils';
import type { WorkoutSession, RoutineExercise, Logs } from '@/lib/pulse/types';

const RE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

const session: WorkoutSession = {
    id: 'sess-1',
    user_id: 'u1',
    routine_id: 'r1',
    workout_type: 'push',
    variant: null,
    started_at: '2026-05-30T10:00:00.000Z',
    completed_at: null,
};
const completedAt = '2026-05-30T10:47:00.000Z';

const exercises: RoutineExercise[] = [
    {
        id: RE_ID,
        routine_id: 'r1',
        exercise_id: 'ex-1',
        workout_type: 'push',
        variant: null,
        order: 0,
        sets: '3',
        reps: '8',
        starting_weight_kg: null,
        superset_group_id: null,
        exercise: {
            id: 'ex-1',
            name: 'Bench Press',
            category: 'chest',
            default_sets: '3',
            default_reps: '8',
            user_id: null,
        },
    },
];

const logs: Logs = {
    [`3-${RE_ID}-0`]: { kg: 100, reps: 8, rir: 2, saved: true },
    [`3-${RE_ID}-1`]: { kg: 100, reps: 7, rir: 2, saved: true },
    [`3-${RE_ID}-2`]: { kg: 97.5, reps: 8, rir: 2, saved: true },
};

const defaultProps = {
    session,
    completedAt,
    exercises,
    logs,
    prMap: {},
    week: 3,
    unit: 'kg' as const,
    onDismiss: vi.fn(),
};

describe('ShareCard', () => {
    it('renders the workout label', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText('Push Day')).toBeInTheDocument();
    });

    it('renders duration', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText('47 min')).toBeInTheDocument();
    });

    it('renders total sets', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText('3 sets')).toBeInTheDocument();
    });

    it('renders the week chip', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText('Week 3')).toBeInTheDocument();
    });

    it('renders top lift with exercise name and weight', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText(/100 kg × 8/)).toBeInTheDocument();
    });

    it('shows PR badge when lift is a PR', () => {
        const prMap = { [RE_ID]: calcE1RM(100, 8) };
        render(<ShareCard {...defaultProps} prMap={prMap} />);
        expect(screen.getByText('PR')).toBeInTheDocument();
    });

    it('shows PR count line when prCount > 0', () => {
        const prMap = { [RE_ID]: calcE1RM(100, 8) };
        render(<ShareCard {...defaultProps} prMap={prMap} />);
        expect(screen.getByText(/1 PR this session/)).toBeInTheDocument();
    });

    it('hides PR count line when no PRs', () => {
        render(<ShareCard {...defaultProps} prMap={{}} />);
        expect(screen.queryByText(/PR this session/)).not.toBeInTheDocument();
    });

    it('shows screenshot hint text', () => {
        render(<ShareCard {...defaultProps} />);
        expect(screen.getByText(/screenshot to share/i)).toBeInTheDocument();
    });

    it('calls onDismiss when Done button is clicked', async () => {
        const onDismiss = vi.fn();
        render(<ShareCard {...defaultProps} onDismiss={onDismiss} />);
        await userEvent.click(screen.getByRole('button', { name: /done/i }));
        expect(onDismiss).toHaveBeenCalledOnce();
    });
});
