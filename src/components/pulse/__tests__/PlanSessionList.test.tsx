import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlanSessionList, { type PlanSession } from '../PlanSessionList';
import type { RoutineExercise } from '@/lib/pulse/types';

// jsdom has no matchMedia match, so useMediaQuery resolves false -> the mobile
// selector path. Good: that exercises the chip selector + the shared row.

function re(id: string, name: string, equipment: string[] = []): RoutineExercise {
    return {
        id,
        routine_id: 'rt',
        exercise_id: `ex-${id}`,
        workout_type: 'upper',
        variant: 'A',
        order: 0,
        sets: 4,
        reps: 8,
        starting_weight_kg: null,
        rest_seconds: null,
        superset_group_id: null,
        // minimal exercise; exerciseReason returns null without a movement pattern.
        exercise: {
            id: `ex-${id}`,
            name,
            category: 'chest',
            default_sets: 4,
            default_reps: 8,
            user_id: null,
            equipment,
        },
    } as unknown as RoutineExercise;
}

const sessions: PlanSession[] = [
    {
        key: 'upper-A',
        label: 'Upper A',
        durationMin: 55,
        setCount: 18,
        focus: 'Chest · Back',
        exercises: [re('1', 'Bench Press', ['barbell'])],
    },
    {
        key: 'lower-A',
        label: 'Lower A',
        durationMin: 50,
        setCount: 17,
        focus: 'Quads · Glutes',
        exercises: [re('2', 'Back Squat', ['barbell'])],
    },
];

describe('PlanSessionList (mobile selector)', () => {
    it('shows a chip per session and the first session by default', () => {
        render(<PlanSessionList sessions={sessions} onSwap={() => {}} onInfo={() => {}} />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();
        expect(screen.getByText('~55 min · 18 sets · 1 exercises')).toBeInTheDocument();
    });

    it('switches the visible session when another chip is tapped', () => {
        render(<PlanSessionList sessions={sessions} onSwap={() => {}} onInfo={() => {}} />);
        fireEvent.click(screen.getByText('Lower A'));
        expect(screen.getByText('Back Squat')).toBeInTheDocument();
    });

    it('fires onSwap with the routine exercise', () => {
        const onSwap = vi.fn();
        render(<PlanSessionList sessions={sessions} onSwap={onSwap} onInfo={() => {}} />);
        fireEvent.click(screen.getByLabelText('Swap Bench Press'));
        expect(onSwap).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    });
});
