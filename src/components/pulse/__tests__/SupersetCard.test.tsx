import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// SupersetCard renders ExerciseCard (+ SetLogger), which read the toast and the
// active routine from context; stub both so the card renders without a provider.
vi.mock('@/lib/pulse/toast', () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock('@/context/PulseContext', () => ({ usePulse: () => ({ activeRoutine: { program_weeks: 12 } }) }));
import SupersetCard from '../SupersetCard';
import { swapKey } from '@/lib/pulse/utils';
import type { RoutineExercise, DbExercise } from '@/lib/pulse/types';

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

    it('exposes a Swap control on each paired exercise when swap wiring is provided', () => {
        const onSwap = vi.fn();
        render(
            <SupersetCard
                {...defaultProps}
                swaps={{}}
                exercisesById={new Map()}
                onSwap={onSwap}
                onRevert={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByLabelText('Expand superset'));
        fireEvent.click(screen.getByLabelText(/Expand Bench Press/));
        fireEvent.click(screen.getByRole('button', { name: '⇄ Swap' }));
        expect(onSwap).toHaveBeenCalledWith(reA);
    });

    it('shows the swapped-in exercise name on the paired card when a swap is active', () => {
        const sub: DbExercise = { id: 'sub', name: 'Incline Press', category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null };
        render(
            <SupersetCard
                {...defaultProps}
                swaps={{ [swapKey(1, 'a')]: 'sub' }}
                exercisesById={new Map([['sub', sub]])}
                onSwap={vi.fn()}
                onRevert={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByLabelText('Expand superset'));
        expect(screen.getByLabelText(/Expand Incline Press/)).toBeInTheDocument();
    });

    it('hides the Swap control when no swap wiring is passed', () => {
        render(<SupersetCard {...defaultProps} />);
        fireEvent.click(screen.getByLabelText('Expand superset'));
        fireEvent.click(screen.getByLabelText(/Expand Bench Press/));
        expect(screen.queryByRole('button', { name: '⇄ Swap' })).not.toBeInTheDocument();
    });
});
