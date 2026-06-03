import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseInstructionModal from '../ExerciseInstructionModal';

const defaultProps = {
    exerciseId: '11111111-1111-1111-1111-111111111111',
    exerciseName: 'Bench Press',
    onClose: vi.fn(),
};

describe('ExerciseInstructionModal', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('shows loading state while fetching', () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        render(<ExerciseInstructionModal {...defaultProps} />);
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('renders muscle chips and cues after successful fetch', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                exercise_id: defaultProps.exerciseId,
                primary_muscles: ['Chest', 'Triceps'],
                secondary_muscles: ['Front Delts'],
                cues: ['Retract shoulder blades', 'Elbows at 45–75°'],
            }),
        }) as unknown as typeof fetch;
        render(<ExerciseInstructionModal {...defaultProps} />);
        await waitFor(() => expect(screen.getByText('Chest')).toBeInTheDocument());
        expect(screen.getByText('Triceps')).toBeInTheDocument();
        expect(screen.getByText('Front Delts')).toBeInTheDocument();
        expect(screen.getByText('Retract shoulder blades')).toBeInTheDocument();
        expect(screen.getByText('Elbows at 45–75°')).toBeInTheDocument();
    });

    it('shows error message when fetch returns 404', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
        render(<ExerciseInstructionModal {...defaultProps} />);
        await waitFor(() => expect(screen.getByText(/no instructions available/i)).toBeInTheDocument());
    });

    it('calls onClose when the close button is clicked', async () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        const onClose = vi.fn();
        render(<ExerciseInstructionModal {...defaultProps} onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('renders the exercise name in the modal title', () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        render(<ExerciseInstructionModal {...defaultProps} />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
    });
});
