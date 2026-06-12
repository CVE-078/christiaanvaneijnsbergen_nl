import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionDetailModal from '../SessionDetailModal';
import type { Workout } from '@/lib/pulse/workouts';

const mockWorkout: Workout = {
    id: 's1',
    date: '2026-06-09T18:45:00Z',
    workoutType: 'legs',
    variant: null,
    durationMin: 46,
    setCount: 6,
    exercises: [
        {
            routineExerciseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            name: 'Back Squat',
            sets: [
                { kg: 110, reps: 5, rir: 2 },
                { kg: 110, reps: 5, rir: 2 },
                { kg: 110, reps: 5, rir: 1 },
            ],
            setCount: 3,
            maxKg: 110,
            avgKg: 110,
        },
    ],
};

describe('SessionDetailModal', () => {
    it('renders workout header and summary (title, duration, exercises, volume)', () => {
        render(
            <SessionDetailModal
                open
                workout={mockWorkout}
                unit="kg"
                onClose={() => {}}
            />,
        );
        // Title is derived from workout type ("Legs")
        expect(screen.getByText('Legs')).toBeInTheDocument();
        // Summary strip: duration, exercises label, and total volume (110 x 5 x 3 = 1,650 kg)
        expect(screen.getByText(/46 min/)).toBeInTheDocument();
        expect(screen.getByText('Exercises')).toBeInTheDocument();
        expect(screen.getByText(/1,650 kg/)).toBeInTheDocument();
    });

    it('shows exercise collapsed rows with max weight summary', () => {
        render(
            <SessionDetailModal
                open
                workout={mockWorkout}
                unit="kg"
                onClose={() => {}}
            />,
        );
        // Exercise name is visible in the collapsed header
        expect(screen.getByText('Back Squat')).toBeInTheDocument();
        // Collapsed row shows max kg
        expect(screen.getByText(/110 kg/)).toBeInTheDocument();
    });

    it('expands exercise row to show per-set detail on click', () => {
        render(
            <SessionDetailModal
                open
                workout={mockWorkout}
                unit="kg"
                onClose={() => {}}
            />,
        );
        // Click the exercise row to expand it
        fireEvent.click(screen.getByRole('button', { name: /back squat/i }));
        // Per-set rows should now be visible: one collapsed summary + 3 per-set rows
        // (all show 110 kg × 5). At minimum 2 occurrences means expanded rows are present.
        expect(screen.getAllByText(/110 kg × 5/).length).toBeGreaterThanOrEqual(2);
        // RIR shown
        expect(screen.getAllByText(/\d+ RIR/).length).toBeGreaterThan(0);
    });

    it('renders null when closed', () => {
        const { container } = render(
            <SessionDetailModal
                open={false}
                workout={mockWorkout}
                unit="kg"
                onClose={() => {}}
            />,
        );
        expect(container.firstChild).toBeNull();
    });

    it('calls onClose when backdrop is clicked', () => {
        const onClose = vi.fn();
        render(
            <SessionDetailModal
                open
                workout={mockWorkout}
                unit="kg"
                onClose={onClose}
            />,
        );
        // Click the backdrop (the outermost dialog div)
        fireEvent.click(screen.getByRole('dialog'));
        expect(onClose).toHaveBeenCalled();
    });

    it('shows a back button only when onBack is given, and calls it', () => {
        const onBack = vi.fn();
        const { rerender } = render(
            <SessionDetailModal open workout={mockWorkout} unit="kg" onClose={() => {}} />,
        );
        // Exact 'Back' so it doesn't match the "Back Squat" exercise row button.
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();

        rerender(
            <SessionDetailModal open workout={mockWorkout} unit="kg" onClose={() => {}} onBack={onBack} />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(onBack).toHaveBeenCalledTimes(1);
    });
});
