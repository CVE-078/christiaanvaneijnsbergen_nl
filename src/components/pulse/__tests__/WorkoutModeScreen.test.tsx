import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoutineExercise, Logs, PRMap } from '@/lib/pulse/types';

let prMap: PRMap = {};
const showToast = vi.fn();

vi.mock('@/context/PulseContext', () => ({
    usePulse: () => ({ prMap }),
}));

vi.mock('@/lib/pulse/toast', () => ({
    useToast: () => ({ show: showToast }),
}));

// Import after the mocks so the component picks them up.
import WorkoutModeScreen from '../WorkoutModeScreen';

const mockExercise = (id: string, name: string): RoutineExercise => ({
    id,
    routine_id: 'r1',
    exercise_id: 'e1',
    workout_type: 'push',
    variant: 'A',
    order: 1,
    sets: '3',
    reps: '8-12',
    starting_weight_kg: null,
    rest_seconds: null,
    superset_group_id: null,
    exercise: { id: 'e1', name, category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null },
});

const defaultProps = {
    exercises: [mockExercise('re1', 'Bench Press'), mockExercise('re2', 'OHP')],
    sessionId: 'sess1',
    variant: 'A' as const,
    week: 1,
    logs: {} as Logs,
    unit: 'kg' as const,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onComplete: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
};

describe('WorkoutModeScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prMap = {};
    });

    it('shows first exercise and progress', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText(/exercise 1 of 2/i)).toBeInTheDocument();
    });

    it('advances to next exercise on Next click', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /next exercise/i }));
        expect(screen.getByText('OHP')).toBeInTheDocument();
        expect(screen.getByText(/exercise 2 of 2/i)).toBeInTheDocument();
    });

    it('shows Finish button on last exercise', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /next exercise/i }));
        expect(screen.getByRole('button', { name: /finish workout/i })).toBeInTheDocument();
    });

    it('calls onComplete when Finish is clicked', async () => {
        render(<WorkoutModeScreen {...defaultProps} exercises={[mockExercise('re1', 'Bench Press')]} />);
        fireEvent.click(screen.getByRole('button', { name: /finish workout/i }));
        expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    });

    it('navigates back to previous exercise', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /next exercise/i }));
        fireEvent.click(screen.getByRole('button', { name: /previous exercise/i }));
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('disables finish and early-finish buttons when sessionId is null', () => {
        render(
            <WorkoutModeScreen {...defaultProps} exercises={[mockExercise('re1', 'Bench Press')]} sessionId={null} />,
        );
        expect(screen.getByRole('button', { name: /finish workout/i })).toBeDisabled();
    });

    it('renders a PR tag on a saved set that beats the exercise best', () => {
        prMap = { re1: 100 }; // calcE1RM(80,10) ~= 106.7 > 100
        const logs: Logs = { '1-re1-0': { kg: 80, reps: 10, rir: 2, saved: true } };
        render(<WorkoutModeScreen {...defaultProps} logs={logs} />);
        expect(screen.getByText('PR')).toBeInTheDocument();
    });

    it('does not render a PR tag when the set is below the best', () => {
        prMap = { re1: 200 };
        const logs: Logs = { '1-re1-0': { kg: 50, reps: 5, rir: 2, saved: true } };
        render(<WorkoutModeScreen {...defaultProps} logs={logs} />);
        expect(screen.queryByText('PR')).not.toBeInTheDocument();
    });

    it('fires a success toast when a save newly qualifies as a PR', async () => {
        prMap = { re1: 100 };
        const onSave = vi.fn();
        render(<WorkoutModeScreen {...defaultProps} onSave={onSave} />);
        const kgInputs = screen.getAllByRole('spinbutton', { name: /weight in kg/i });
        const repsInputs = screen.getAllByRole('spinbutton', { name: /repetitions/i });
        await userEvent.type(kgInputs[0], '80');
        await userEvent.type(repsInputs[0], '10');
        await userEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
        expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/new pr on bench press/i), 'success');
        expect(onSave).toHaveBeenCalled();
    });

    it('does not fire a PR toast for a non-PR save', async () => {
        prMap = { re1: 500 };
        render(<WorkoutModeScreen {...defaultProps} />);
        const kgInputs = screen.getAllByRole('spinbutton', { name: /weight in kg/i });
        const repsInputs = screen.getAllByRole('spinbutton', { name: /repetitions/i });
        await userEvent.type(kgInputs[0], '40');
        await userEvent.type(repsInputs[0], '5');
        await userEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
        expect(showToast).not.toHaveBeenCalled();
    });

    it('shows "Superset" in the header when the current step is a pair', () => {
        const mockRE = mockExercise('re1', 'Bench Press');
        const reA = { ...mockRE, id: 'a', order: 1, superset_group_id: 'g1', exercise: { ...mockRE.exercise, name: 'Bench Press' } };
        const reB = { ...mockRE, id: 'b', order: 2, superset_group_id: 'g1', exercise: { ...mockRE.exercise, name: 'Cable Fly' } };
        render(
            <WorkoutModeScreen
                exercises={[reA, reB]}
                sessionId="s1"
                variant={null}
                week={1}
                logs={{}}
                unit="kg"
                onSave={vi.fn()}
                onDelete={vi.fn()}
                onComplete={vi.fn().mockResolvedValue(undefined)}
                onClose={vi.fn()}
            />,
        );
        expect(screen.getByText(/superset/i)).toBeInTheDocument();
        expect(screen.getByText(/bench press/i)).toBeInTheDocument();
        expect(screen.getByText(/cable fly/i)).toBeInTheDocument();
    });

    it('treats a superset pair as a single step in the count and labels', () => {
        const base = mockExercise('x', 'X');
        const s = { ...base, id: 's', order: 1, superset_group_id: null, exercise: { ...base.exercise, name: 'Single Lift' } };
        const a = { ...base, id: 'a', order: 2, superset_group_id: 'g1', exercise: { ...base.exercise, name: 'A Lift' } };
        const b = { ...base, id: 'b', order: 3, superset_group_id: 'g1', exercise: { ...base.exercise, name: 'B Lift' } };
        render(<WorkoutModeScreen {...defaultProps} variant={null} exercises={[s, a, b]} />);
        // [single, pair] => 2 steps; single is first
        expect(screen.getByText(/exercise 1 of 2/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /next exercise/i }));
        // step 2 is the pair (also last): superset label + Finish
        expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
        expect(screen.getByText('A Lift')).toBeInTheDocument();
        expect(screen.getByText('B Lift')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /finish workout/i })).toBeInTheDocument();
    });

    it('shows the resolved display name from resolveDisplay instead of the underlying exercise name', () => {
        const re = mockExercise('re1', 'Bench Press');
        const altExercise = { ...re.exercise, id: 'alt1', name: 'Incline Dumbbell Press' };
        render(
            <WorkoutModeScreen
                {...defaultProps}
                exercises={[re]}
                resolveDisplay={() => altExercise}
            />,
        );
        expect(screen.getByText('Incline Dumbbell Press')).toBeInTheDocument();
        expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
    });

    it('calls onSwapExercise with the current routine exercise when the Swap button is clicked', () => {
        const onSwapExercise = vi.fn();
        const re = mockExercise('re1', 'Bench Press');
        render(
            <WorkoutModeScreen
                {...defaultProps}
                exercises={[re]}
                onSwapExercise={onSwapExercise}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /swap/i }));
        expect(onSwapExercise).toHaveBeenCalledTimes(1);
        expect(onSwapExercise).toHaveBeenCalledWith(re);
    });

    it('gates Next on a superset step until both exercises have a logged set', () => {
        const base = mockExercise('x', 'X');
        const a = { ...base, id: 'a', order: 1, superset_group_id: 'g1', exercise: { ...base.exercise, name: 'A Lift' } };
        const b = { ...base, id: 'b', order: 2, superset_group_id: 'g1', exercise: { ...base.exercise, name: 'B Lift' } };
        const c = { ...base, id: 'c', order: 3, superset_group_id: null, exercise: { ...base.exercise, name: 'C Lift' } };
        // [pair, single] => the pair is the first (non-last) step
        const both = { '1-a-0': { kg: 50, reps: 8, rir: 2, saved: true }, '1-b-0': { kg: 40, reps: 8, rir: 2, saved: true } };
        const { rerender } = render(<WorkoutModeScreen {...defaultProps} variant={null} exercises={[a, b, c]} logs={{}} />);
        expect(screen.getByRole('button', { name: /next exercise/i })).toBeDisabled();
        rerender(<WorkoutModeScreen {...defaultProps} variant={null} exercises={[a, b, c]} logs={{ '1-a-0': { kg: 50, reps: 8, rir: 2, saved: true } } as Logs} />);
        expect(screen.getByRole('button', { name: /next exercise/i })).toBeDisabled();
        rerender(<WorkoutModeScreen {...defaultProps} variant={null} exercises={[a, b, c]} logs={both as Logs} />);
        expect(screen.getByRole('button', { name: /next exercise/i })).not.toBeDisabled();
    });
});
