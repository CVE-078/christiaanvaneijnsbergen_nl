'use client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExerciseFormSheet from '../ExerciseFormSheet';
import type { DbExercise } from '@/lib/pulse/types';

const baseExercise: DbExercise = {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    name: 'Hack Squat',
    category: 'legs',
    default_sets: '3',
    default_reps: '8-12',
    user_id: 'user-1',
    equipment: ['machines'],
    movement_pattern: 'squat',
    is_compound: true,
};

describe('ExerciseFormSheet – add mode', () => {
    it('generation toggle defaults OFF and metadata fields are hidden', () => {
        render(
            <ExerciseFormSheet
                mode="add"
                open={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );
        const toggle = screen.getByRole('switch', { name: /use in auto-generated routines/i });
        expect(toggle).toHaveAttribute('aria-checked', 'false');
        expect(screen.queryByRole('combobox', { name: /movement pattern/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/compound/i)).not.toBeInTheDocument();
    });

    it('turning the toggle ON reveals movement pattern, equipment, and compound/isolation', () => {
        render(
            <ExerciseFormSheet
                mode="add"
                open={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );
        const toggle = screen.getByRole('switch', { name: /use in auto-generated routines/i });
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('combobox', { name: /movement pattern/i })).toBeInTheDocument();
        // Equipment chips should appear
        expect(screen.getByText('Barbell')).toBeInTheDocument();
        // Compound / Isolation buttons
        expect(screen.getByRole('radio', { name: 'Compound' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Isolation' })).toBeInTheDocument();
    });

    it('reps are shown as two from/to fields in add mode', () => {
        render(
            <ExerciseFormSheet
                mode="add"
                open={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );
        expect(screen.getByLabelText('Reps from')).toBeInTheDocument();
        expect(screen.getByLabelText('Reps to')).toBeInTheDocument();
        // No single freeform reps field
        expect(screen.queryByLabelText('Reps')).not.toBeInTheDocument();
    });

    it('does NOT show Delete in add mode', () => {
        render(
            <ExerciseFormSheet
                mode="add"
                open={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );
        expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('submitting with toggle OFF calls onSubmit with meta: null', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(
            <ExerciseFormSheet
                mode="add"
                open={true}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Lift' } });
        fireEvent.change(screen.getByLabelText('Reps from'), { target: { value: '8' } });
        fireEvent.change(screen.getByLabelText('Reps to'), { target: { value: '12' } });
        fireEvent.click(screen.getByRole('button', { name: /save|add exercise/i }));
        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledOnce();
            const arg = onSubmit.mock.calls[0][0];
            expect(arg.meta).toBeNull();
            expect(arg.defaultReps).toBe('8-12');
        });
    });

    it('submitting with toggle ON passes meta with movement_pattern, equipment, is_compound', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(
            <ExerciseFormSheet
                mode="add"
                open={true}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Lift' } });
        fireEvent.change(screen.getByLabelText('Reps from'), { target: { value: '5' } });

        // Turn on the generation toggle
        fireEvent.click(screen.getByRole('switch', { name: /use in auto-generated routines/i }));

        // Select a movement pattern
        fireEvent.change(screen.getByRole('combobox', { name: /movement pattern/i }), {
            target: { value: 'squat' },
        });

        // Select Compound
        fireEvent.click(screen.getByRole('radio', { name: 'Compound' }));

        fireEvent.click(screen.getByRole('button', { name: /save|add exercise/i }));
        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledOnce();
            const arg = onSubmit.mock.calls[0][0];
            expect(arg.meta).not.toBeNull();
            expect(arg.meta.movement_pattern).toBe('squat');
            expect(arg.meta.is_compound).toBe(true);
            expect(arg.defaultReps).toBe('5');
        });
    });
});

describe('ExerciseFormSheet – edit mode', () => {
    it('pre-fills all fields from initial including category', () => {
        render(
            <ExerciseFormSheet
                mode="edit"
                initial={baseExercise}
                open={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );
        expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Hack Squat');
        expect((screen.getByLabelText('Default sets') as HTMLInputElement).value).toBe('3');
        expect((screen.getByLabelText('Reps from') as HTMLInputElement).value).toBe('8');
        expect((screen.getByLabelText('Reps to') as HTMLInputElement).value).toBe('12');
        // Category select
        const catSelect = screen.getByLabelText('Category') as HTMLSelectElement;
        expect(catSelect.value).toBe('legs');
    });

    it('shows generation toggle ON and metadata when initial has movement_pattern', () => {
        render(
            <ExerciseFormSheet
                mode="edit"
                initial={baseExercise}
                open={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );
        const toggle = screen.getByRole('switch', { name: /use in auto-generated routines/i });
        expect(toggle).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('combobox', { name: /movement pattern/i })).toBeInTheDocument();
    });

    it('shows Delete button in edit mode when onDelete is provided', () => {
        render(
            <ExerciseFormSheet
                mode="edit"
                initial={baseExercise}
                open={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('clicking Delete calls onDelete with the exercise', () => {
        const onDelete = vi.fn();
        render(
            <ExerciseFormSheet
                mode="edit"
                initial={baseExercise}
                open={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
                onDelete={onDelete}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /delete/i }));
        expect(onDelete).toHaveBeenCalledWith(baseExercise);
    });

    it('freeform reps fallback: shows one free-text reps field for "AMRAP"', () => {
        const amrapEx: DbExercise = { ...baseExercise, default_reps: 'AMRAP' };
        render(
            <ExerciseFormSheet
                mode="edit"
                initial={amrapEx}
                open={true}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );
        // Should show single reps field, not from/to
        expect(screen.getByLabelText('Reps')).toBeInTheDocument();
        expect(screen.queryByLabelText('Reps from')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Reps to')).not.toBeInTheDocument();
        // Pre-filled with "AMRAP"
        expect((screen.getByLabelText('Reps') as HTMLInputElement).value).toBe('AMRAP');
    });

    it('submit in edit mode composes reps and passes meta when toggle is ON', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(
            <ExerciseFormSheet
                mode="edit"
                initial={baseExercise}
                open={true}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );
        // Toggle is already ON (initial has movement_pattern)
        fireEvent.click(screen.getByRole('button', { name: /save/i }));
        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledOnce();
            const arg = onSubmit.mock.calls[0][0];
            expect(arg.defaultReps).toBe('8-12');
            expect(arg.meta).not.toBeNull();
            expect(arg.meta.movement_pattern).toBe('squat');
            expect(arg.meta.is_compound).toBe(true);
        });
    });

    it('category change confirm: calls window.confirm when category changes from initial', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(
            <ExerciseFormSheet
                mode="edit"
                initial={baseExercise}
                open={true}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );
        // Change category
        fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'chest' } });
        fireEvent.click(screen.getByRole('button', { name: /save/i }));
        await waitFor(() => {
            expect(confirmSpy).toHaveBeenCalled();
            expect(onSubmit).toHaveBeenCalledOnce();
        });
        confirmSpy.mockRestore();
    });

    it('category change confirm: does not call onSubmit when confirm is declined', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(
            <ExerciseFormSheet
                mode="edit"
                initial={baseExercise}
                open={true}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );
        fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'chest' } });
        fireEvent.click(screen.getByRole('button', { name: /save/i }));
        await waitFor(() => {
            expect(confirmSpy).toHaveBeenCalled();
            expect(onSubmit).not.toHaveBeenCalled();
        });
        confirmSpy.mockRestore();
    });
});
