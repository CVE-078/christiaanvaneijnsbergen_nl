import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseSwapPicker from '../ExerciseSwapPicker';
import type { DbExercise } from '@/lib/pulse/types';

const mk = (id: string, name: string, over: Partial<DbExercise> = {}): DbExercise =>
    ({
        id,
        name,
        category: 'chest',
        default_sets: '3',
        default_reps: '8',
        user_id: null,
        movement_pattern: 'horizontal_push',
        equipment: [],
        is_compound: true,
        substitution_class: null,
        contraindications: [],
        ...over,
    }) as DbExercise;

const original = mk('orig', 'Barbell Bench', { substitution_class: 'horizontal_press', equipment: ['barbell', 'bench'] });
const candidates = [mk('a', 'Dumbbell Bench'), mk('b', 'Machine Press')];

function setup(overrides: Record<string, unknown> = {}) {
    const props = {
        original,
        week: 4,
        candidates,
        isSwapped: false,
        onSelect: vi.fn(),
        onRevert: vi.fn(),
        onClose: vi.fn(),
        ...overrides,
    };
    render(<ExerciseSwapPicker {...(props as unknown as ComponentProps<typeof ExerciseSwapPicker>)} />);
    return props;
}

describe('ExerciseSwapPicker', () => {
    it('lists candidates and calls onSelect with the chosen id + null reason by default', async () => {
        const props = setup();
        await userEvent.click(screen.getByText('Dumbbell Bench'));
        expect(props.onSelect).toHaveBeenCalledWith('a', null);
    });

    it('shows a revert option only when a swap is active', () => {
        const { rerender } = render(
            <ExerciseSwapPicker original={original} week={4} candidates={candidates}
                isSwapped={false} onSelect={vi.fn()} onRevert={vi.fn()} onClose={vi.fn()} />,
        );
        expect(screen.queryByRole('button', { name: /revert/i })).not.toBeInTheDocument();
        rerender(
            <ExerciseSwapPicker original={original} week={4} candidates={candidates}
                isSwapped={true} onSelect={vi.fn()} onRevert={vi.fn()} onClose={vi.fn()} />,
        );
        expect(screen.getByRole('button', { name: /revert/i })).toBeInTheDocument();
    });

    it('shows an empty state when there are no candidates', () => {
        setup({ candidates: [] });
        expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
    });

    it('does not show reason chips unless captureReason is set', () => {
        setup();
        expect(screen.queryByRole('button', { name: /no equipment/i })).not.toBeInTheDocument();
    });

    it('shows reason chips and re-ranks when a constraint reason is chosen', async () => {
        // Both same class; Alpha shares the original gear (overlap 2), Beta shares none.
        const alpha = mk('al', 'Alpha', { substitution_class: 'horizontal_press', equipment: ['barbell', 'bench'] });
        const beta = mk('be', 'Beta', { substitution_class: 'horizontal_press', equipment: [] });
        setup({ candidates: [alpha, beta], captureReason: true });
        const order = () => screen.getAllByText(/^(Alpha|Beta)$/).map((n) => n.textContent);
        expect(order()[0]).toBe('Alpha'); // preference: most overlap first
        await userEvent.click(screen.getByRole('button', { name: /no equipment/i }));
        expect(order()[0]).toBe('Beta'); // no_equipment: fewest shared gear first
    });

    it('passes the chosen reason to onSelect', async () => {
        const props = setup({ captureReason: true });
        await userEvent.click(screen.getByRole('button', { name: /^crowded$/i }));
        await userEvent.click(screen.getByText('Dumbbell Bench'));
        expect(props.onSelect).toHaveBeenCalledWith('a', 'crowded');
    });
});
