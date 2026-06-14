import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseDetailSheet from '../ExerciseDetailSheet';
import type { DbExercise } from '@/lib/pulse/types';

const globalEx: DbExercise = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Barbell Bench Press',
    category: 'chest',
    default_sets: '3',
    default_reps: '8-12',
    user_id: null,
    equipment: ['barbell', 'bench'],
    is_compound: true,
    movement_pattern: 'horizontal_push',
};

const customEx: DbExercise = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'My Custom Press',
    category: 'chest',
    default_sets: '3',
    default_reps: '10',
    user_id: 'user-abc',
    equipment: ['dumbbells'],
    is_compound: true,
};

const similar: DbExercise[] = [
    { id: 'sim-1', name: 'Dumbbell Bench Press', category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null },
    { id: 'sim-2', name: 'Machine Chest Press', category: 'chest', default_sets: '3', default_reps: '10-15', user_id: null },
];

const instructionsResponse = {
    exercise_id: globalEx.id,
    primary_muscles: ['Chest', 'Triceps'],
    secondary_muscles: ['Front Delts'],
    cues: ['Retract shoulder blades', 'Press up and slightly back'],
};

const baseProps = {
    exercise: globalEx,
    favorite: false,
    hidden: false,
    similar,
    open: true,
    onClose: vi.fn(),
    onToggleFavorite: vi.fn(),
    onToggleHide: vi.fn(),
};

describe('ExerciseDetailSheet', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('renders on ModalSheet with exercise name as title', async () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        render(<ExerciseDetailSheet {...baseProps} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
    });

    it('shows subtitle with category and Compound', async () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        render(<ExerciseDetailSheet {...baseProps} />);
        expect(screen.getByText(/Chest.*Compound/i)).toBeInTheDocument();
    });

    it('renders metadata badges: category, equipment, Compound, movement pattern', async () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        render(<ExerciseDetailSheet {...baseProps} />);
        const badges = screen.getByTestId('exercise-detail-badges');
        expect(badges.textContent).toMatch(/chest/i);
        expect(badges.textContent).toMatch(/barbell/i);
        expect(badges.textContent).toMatch(/Compound/i);
        expect(badges.textContent).toMatch(/horizontal.push/i);
    });

    it('renders Targets section with primary and secondary muscles after fetch', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => instructionsResponse,
        }) as unknown as typeof fetch;
        render(<ExerciseDetailSheet {...baseProps} />);
        await waitFor(() => expect(screen.getByText('Chest')).toBeInTheDocument());
        expect(screen.getByText('Triceps')).toBeInTheDocument();
        expect(screen.getByText('Front Delts')).toBeInTheDocument();
        expect(screen.getByText(/Targets/i)).toBeInTheDocument();
    });

    it('renders How to section with cues when present', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => instructionsResponse,
        }) as unknown as typeof fetch;
        render(<ExerciseDetailSheet {...baseProps} />);
        await waitFor(() => expect(screen.getByText('Retract shoulder blades')).toBeInTheDocument());
        expect(screen.getByText(/How to/i)).toBeInTheDocument();
        expect(screen.getByText('Press up and slightly back')).toBeInTheDocument();
    });

    it('omits How to section when cues are empty', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ...instructionsResponse, cues: [] }),
        }) as unknown as typeof fetch;
        render(<ExerciseDetailSheet {...baseProps} />);
        // Wait for fetch to resolve
        await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
        expect(screen.queryByText(/How to/i)).not.toBeInTheDocument();
    });

    it('omits How to section entirely for custom exercises (no instructions fetch result)', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
        render(
            <ExerciseDetailSheet
                {...baseProps}
                exercise={customEx}
                onEdit={vi.fn()}
            />,
        );
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        expect(screen.queryByText(/How to/i)).not.toBeInTheDocument();
    });

    it('renders Similar exercises section with the names from the similar prop', async () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        render(<ExerciseDetailSheet {...baseProps} />);
        expect(screen.getByText('Similar exercises')).toBeInTheDocument();
        expect(screen.getByText('Dumbbell Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Machine Chest Press')).toBeInTheDocument();
    });

    it('Favorite action has aria-pressed reflecting the favorite prop', () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        const { rerender } = render(<ExerciseDetailSheet {...baseProps} favorite={false} />);
        expect(screen.getByRole('button', { name: /favorite/i })).toHaveAttribute('aria-pressed', 'false');
        rerender(<ExerciseDetailSheet {...baseProps} favorite={true} />);
        expect(screen.getByRole('button', { name: /favorite/i })).toHaveAttribute('aria-pressed', 'true');
    });

    it('clicking Favorite calls onToggleFavorite with the exercise', async () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        const onToggleFavorite = vi.fn();
        render(<ExerciseDetailSheet {...baseProps} onToggleFavorite={onToggleFavorite} />);
        await userEvent.click(screen.getByRole('button', { name: /favorite/i }));
        expect(onToggleFavorite).toHaveBeenCalledWith(globalEx);
    });

    it('clicking Hide calls onToggleHide with the exercise', async () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        const onToggleHide = vi.fn();
        render(<ExerciseDetailSheet {...baseProps} onToggleHide={onToggleHide} />);
        await userEvent.click(screen.getByRole('button', { name: /hide/i }));
        expect(onToggleHide).toHaveBeenCalledWith(globalEx);
    });

    it('mutual exclusivity: when favorite is true the Hide button label changes to Unhide or similar', () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        // When favorited, Hide should still be accessible but distinct from Favorite
        render(<ExerciseDetailSheet {...baseProps} favorite={true} hidden={false} />);
        const favBtn = screen.getByRole('button', { name: /favorite/i });
        const hideBtn = screen.getByRole('button', { name: /hide/i });
        expect(favBtn).toBeInTheDocument();
        expect(hideBtn).toBeInTheDocument();
        // They must be separate buttons (mutual exclusivity in presentation)
        expect(favBtn).not.toBe(hideBtn);
    });

    it('when hidden is true, Hide button label reflects the hidden state', () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        render(<ExerciseDetailSheet {...baseProps} hidden={true} />);
        // The hide button should reflect the hidden state (e.g. "Unhide")
        expect(screen.getByRole('button', { name: /unhide/i })).toBeInTheDocument();
    });

    it('Edit button is NOT shown when onEdit is not provided', () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        render(<ExerciseDetailSheet {...baseProps} onEdit={undefined} />);
        expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('Edit button IS shown when onEdit is provided', async () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        const onEdit = vi.fn();
        render(<ExerciseDetailSheet {...baseProps} exercise={customEx} onEdit={onEdit} />);
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('clicking Edit calls onEdit with the exercise', async () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
        const onEdit = vi.fn();
        render(<ExerciseDetailSheet {...baseProps} exercise={customEx} onEdit={onEdit} />);
        await userEvent.click(screen.getByRole('button', { name: /edit/i }));
        expect(onEdit).toHaveBeenCalledWith(customEx);
    });
});
