import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoutineExercise } from '@/lib/pulse/types';

const showToast = vi.fn();
vi.mock('@/lib/pulse/toast', () => ({
    useToast: () => ({ show: showToast }),
}));
// ExerciseCard renders SetLogger, which reads the active routine's program length
// from context; stub usePulse so the card can be rendered without a full provider.
vi.mock('@/context/PulseContext', () => ({
    usePulse: () => ({ activeRoutine: { program_weeks: 12 } }),
}));

import ExerciseCard from '../ExerciseCard';

const routineExercise: RoutineExercise = {
    id: 're-uuid-001',
    routine_id: 'r-1',
    exercise_id: 'ex-1',
    workout_type: 'chest',
    variant: null,
    order: 0,
    sets: '3-4',
    reps: '8-12',
    starting_weight_kg: null,
    superset_group_id: null,
    exercise: {
        id: 'ex-1',
        name: 'Dumbbell Bench Press',
        category: 'chest',
        default_sets: '3-4',
        default_reps: '8-12',
        user_id: null,
    },
};

const defaultProps = {
    routineExercise,
    exIdx: 0,
    week: 1,
    logs: {},
    prMap: {},
    unit: 'kg' as const,
    onSave: () => {},
    onDelete: () => {},
    onSaveNote: vi.fn().mockResolvedValue(undefined),
    onDeleteNote: vi.fn().mockResolvedValue(undefined),
};

// '3-4' → parseMaxSets returns 4 (takes upper bound)
const MAX_SETS = 4;
const RE_ID = 're-uuid-001';

describe('ExerciseCard', () => {
    beforeEach(() => vi.clearAllMocks());

    it('does not show completed indicator when no sets are logged', () => {
        render(<ExerciseCard {...defaultProps} />);
        expect(screen.queryAllByLabelText(/all sets done/i)).toHaveLength(0);
    });

    it('shows completed indicator when all sets are logged', () => {
        const logs: Record<string, { kg: number; reps: number; rir: number; saved: boolean }> = {
            [`1-${RE_ID}-0`]: { kg: 60, reps: 10, rir: 3, saved: true },
            [`1-${RE_ID}-1`]: { kg: 60, reps: 10, rir: 3, saved: true },
            [`1-${RE_ID}-2`]: { kg: 60, reps: 10, rir: 3, saved: true },
            [`1-${RE_ID}-3`]: { kg: 60, reps: 10, rir: 3, saved: true },
        };
        render(<ExerciseCard {...defaultProps} logs={logs} />);
        expect(screen.getAllByLabelText(/all sets done/i).length).toBeGreaterThan(0);
    });

    it('renders the exercise name', () => {
        render(<ExerciseCard {...defaultProps} />);
        expect(screen.getByText('Dumbbell Bench Press')).toBeInTheDocument();
    });

    it('expands to show SetLogger rows when clicked', async () => {
        render(<ExerciseCard {...defaultProps} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        const saveButtons = screen.getAllByRole('button', { name: /save/i });
        expect(saveButtons.length).toBe(MAX_SETS);
    });

    it('calls onSave with the correct log key when a set is saved', async () => {
        const onSave = vi.fn();
        render(<ExerciseCard {...defaultProps} onSave={onSave} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        const kgInputs = screen.getAllByRole('spinbutton', { name: /weight in kg/i });
        const repsInputs = screen.getAllByRole('spinbutton', { name: /repetitions/i });
        await userEvent.type(kgInputs[0], '60');
        await userEvent.type(repsInputs[0], '10');
        await userEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
        expect(onSave).toHaveBeenCalledWith(`1-${RE_ID}-0`, expect.objectContaining({ kg: 60, reps: 10, saved: true }));
    });

    it('shows "+ Note" button when card is expanded and no note exists', async () => {
        render(<ExerciseCard {...defaultProps} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        expect(screen.getByRole('button', { name: /\+ note/i })).toBeInTheDocument();
    });

    it('shows the note text when a note is provided and card is expanded', async () => {
        render(<ExerciseCard {...defaultProps} note="Left shoulder tight" />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        expect(screen.getByText('Left shoulder tight')).toBeInTheDocument();
    });

    it('shows warmup suggestions when previous week set is above 40 kg and card is expanded', async () => {
        const logs = {
            [`1-${RE_ID}-0`]: { kg: 100, reps: 8, rir: 2, saved: true },
        };
        render(<ExerciseCard {...defaultProps} week={2} logs={logs} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        expect(screen.getByText(/warm-up/i)).toBeInTheDocument();
        expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    it('does not show warmup suggestions when there is no previous week data', async () => {
        render(<ExerciseCard {...defaultProps} week={1} logs={{}} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        expect(screen.queryByText(/warm-up/i)).not.toBeInTheDocument();
    });

    it('does not show warmup suggestions when previous week weight is below 40 kg', async () => {
        const logs = {
            [`1-${RE_ID}-0`]: { kg: 30, reps: 15, rir: 2, saved: true },
        };
        render(<ExerciseCard {...defaultProps} week={2} logs={logs} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        expect(screen.queryByText(/warm-up/i)).not.toBeInTheDocument();
    });

    it('renders a coral PR tag on a saved set that beats the exercise best', async () => {
        // calcE1RM(80,10) ~= 106.7 >= 100
        const logs = { [`1-${RE_ID}-0`]: { kg: 80, reps: 10, rir: 2, saved: true } };
        render(<ExerciseCard {...defaultProps} logs={logs} prMap={{ [RE_ID]: 100 }} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        expect(screen.getByText('PR')).toBeInTheDocument();
    });

    it('does not render a PR tag when the set is below the best', async () => {
        const logs = { [`1-${RE_ID}-0`]: { kg: 50, reps: 5, rir: 2, saved: true } };
        render(<ExerciseCard {...defaultProps} logs={logs} prMap={{ [RE_ID]: 200 }} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        expect(screen.queryByText('PR')).not.toBeInTheDocument();
    });

    it('fires a success toast when a save newly qualifies as a PR', async () => {
        render(<ExerciseCard {...defaultProps} prMap={{ [RE_ID]: 100 }} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        const kgInputs = screen.getAllByRole('spinbutton', { name: /weight in kg/i });
        const repsInputs = screen.getAllByRole('spinbutton', { name: /repetitions/i });
        await userEvent.type(kgInputs[0], '80');
        await userEvent.type(repsInputs[0], '10');
        await userEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
        expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/new pr on dumbbell bench press/i), 'success');
    });

    it('does not fire a PR toast when re-saving an already-saved PR', async () => {
        const logs = { [`1-${RE_ID}-0`]: { kg: 80, reps: 10, rir: 2, saved: true } };
        render(<ExerciseCard {...defaultProps} logs={logs} prMap={{ [RE_ID]: 100 }} />);
        await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
        // Edit the first (already-PR) set and save again without lowering it.
        await userEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
        await userEvent.click(screen.getAllByRole('button', { name: /update/i })[0]);
        expect(showToast).not.toHaveBeenCalled();
    });

    it('renders the displayExercise name and a swapped-from line when swapped', async () => {
        const displayExercise = {
            id: 'sub',
            name: 'Hack Squat',
            category: 'legs' as const,
            default_sets: '3',
            default_reps: '10',
            user_id: null,
        };
        render(
            <ExerciseCard
                {...defaultProps}
                displayExercise={displayExercise}
                isSwapped={true}
                originalName="Leg Press"
                onSwap={vi.fn()}
                onRevert={vi.fn()}
            />,
        );
        expect(screen.getByText('Hack Squat')).toBeInTheDocument();
        // Expand the card to reveal swap controls
        await userEvent.click(screen.getByRole('button', { name: /expand hack squat/i }));
        expect(screen.getByText(/swapped from leg press/i)).toBeInTheDocument();
    });
});
