import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupersetCard from '../SupersetCard';
import type { RoutineExercise } from '@/lib/pulse/types';

function makeRE(id: string, name: string, order: number): RoutineExercise {
    return {
        id,
        routine_id: 'r1',
        exercise_id: id,
        workout_type: 'chest',
        order,
        sets: '3',
        reps: '8-12',
        starting_weight_kg: null,
        rest_seconds: null,
        variant: null,
        superset_group_id: 'group-1',
        exercise: { id, name, category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null },
    };
}

const reA = makeRE('a', 'Bench Press', 1);
const reB = makeRE('b', 'Cable Fly', 2);

const defaultProps = {
    pair: [reA, reB] as [RoutineExercise, RoutineExercise],
    pairIdx: 0,
    week: 1,
    logs: {},
    prMap: {},
    unit: 'kg' as const,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    notes: {},
    onSaveNote: vi.fn().mockResolvedValue(undefined),
    onDeleteNote: vi.fn().mockResolvedValue(undefined),
};

describe('SupersetCard', () => {
    it('renders both exercise names', () => {
        render(<SupersetCard {...defaultProps} />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Cable Fly')).toBeInTheDocument();
    });

    it('renders the superset header label', () => {
        render(<SupersetCard {...defaultProps} />);
        expect(screen.getByText(/superset/i)).toBeInTheDocument();
    });
});
