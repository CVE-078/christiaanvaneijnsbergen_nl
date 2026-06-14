import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExercisesTab from '../ExercisesTab';
import type { DbExercise } from '@/lib/pulse/types';

// Mock portal target for ModalSheet / ExerciseFilterControl popover.
if (typeof document !== 'undefined' && !document.getElementById('portal-root')) {
    const div = document.createElement('div');
    div.id = 'portal-root';
    document.body.appendChild(div);
}

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

vi.mock('@/hooks/pulse/useMediaQuery', () => ({
    useMediaQuery: vi.fn(() => false),
}));

import { usePulse } from '@/context/PulseContext';
import { useMediaQuery } from '@/hooks/pulse/useMediaQuery';

const bench: DbExercise = {
    id: 'ex-bench-00000000-0000-0000-0000-000000000001',
    name: 'Bench Press',
    category: 'chest',
    default_sets: '3',
    default_reps: '8-12',
    user_id: null,
    equipment: ['barbell', 'bench'],
    is_compound: true,
    movement_pattern: 'horizontal_push',
    substitution_class: 'horizontal_push',
    contraindications: [],
};

const squat: DbExercise = {
    id: 'ex-squat-00000000-0000-0000-0000-000000000002',
    name: 'Back Squat',
    category: 'legs',
    default_sets: '4',
    default_reps: '5',
    user_id: null,
    equipment: ['barbell'],
    is_compound: true,
    movement_pattern: 'squat',
    substitution_class: 'squat',
    contraindications: ['knee'],
};

const lateralRaise: DbExercise = {
    id: 'ex-lat-000000000-0000-0000-0000-000000000003',
    name: 'Lateral Raise',
    category: 'shoulders',
    default_sets: '3',
    default_reps: '12-15',
    user_id: null,
    equipment: ['dumbbells'],
    is_compound: false,
    movement_pattern: 'shoulder_iso',
    substitution_class: 'lateral_raise',
    contraindications: [],
};

const customEx: DbExercise = {
    id: 'ex-custom-0000000-0000-0000-0000-000000000004',
    name: 'Cable Fly',
    category: 'chest',
    default_sets: '3',
    default_reps: '15',
    user_id: 'user-123',
    equipment: ['cables'],
    is_compound: false,
    movement_pattern: null,
    substitution_class: null,
    contraindications: [],
};

const mocks = {
    createExercise: vi.fn().mockResolvedValue(customEx),
    updateExercise: vi.fn().mockResolvedValue(undefined),
    deleteExercise: vi.fn().mockResolvedValue(undefined),
    toggleHideExercise: vi.fn().mockResolvedValue(undefined),
    toggleFavorite: vi.fn().mockResolvedValue(undefined),
};

const defaultContext = {
    exercises: [bench, squat, lateralRaise, customEx],
    hiddenExerciseIds: new Set<string>(),
    favoriteExerciseIds: new Set<string>(),
    equipmentProfiles: [],
    profile: {
        display_name: null,
        unit: 'kg' as const,
        active_routine_id: null,
        active_equipment_profile_id: null,
        timezone: 'Europe/Amsterdam',
        movement_restrictions: [],
    },
    ...mocks,
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    vi.mocked(useMediaQuery).mockReturnValue(false);
    Object.values(mocks).forEach((m) => m.mockClear());
});

describe('ExercisesTab', () => {
    it('renders all exercises by default', () => {
        render(<ExercisesTab />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Back Squat')).toBeInTheDocument();
        expect(screen.getByText('Lateral Raise')).toBeInTheDocument();
        expect(screen.getByText('Cable Fly')).toBeInTheDocument();
    });

    it('search input filters the list', async () => {
        render(<ExercisesTab />);
        await userEvent.type(screen.getByRole('searchbox', { name: /search exercises/i }), 'bench');
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();
        expect(screen.queryByText('Lateral Raise')).not.toBeInTheDocument();
    });

    it('category chip narrows to that category (flat list, no groups)', async () => {
        render(<ExercisesTab />);
        await userEvent.click(screen.getByRole('button', { name: /^legs$/i }));
        expect(screen.getByText('Back Squat')).toBeInTheDocument();
        expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
        // Flat list: no Favorites group heading.
        expect(screen.queryByRole('heading', { name: /favorites/i })).not.toBeInTheDocument();
    });

    it('filter toggles update results (Favorites)', async () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            favoriteExerciseIds: new Set([squat.id]),
        } as unknown as ReturnType<typeof usePulse>);
        render(<ExercisesTab />);
        // Open the filter panel.
        await userEvent.click(screen.getByTestId('filter-trigger'));
        // Toggle Favorites on.
        const favToggle = screen.getAllByRole('switch').find((el) =>
            el.getAttribute('aria-label') === 'Favorites',
        )!;
        await userEvent.click(favToggle);
        // Bench Press (not a favorite) should no longer be visible.
        await waitFor(() => {
            expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
        });
        // Back Squat is the favorite and should remain (may appear in both groups in grouped view).
        expect(screen.getAllByText('Back Squat').length).toBeGreaterThan(0);
    });

    it('renders grouped list with a pinned Favorites header when favorites exist', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            favoriteExerciseIds: new Set([bench.id]),
        } as unknown as ReturnType<typeof usePulse>);
        render(<ExercisesTab />);
        // Favorites heading should be present.
        expect(screen.getByRole('heading', { name: /favorites/i })).toBeInTheDocument();
        // Category headings should also be present.
        expect(screen.getByRole('heading', { name: /chest/i })).toBeInTheDocument();
    });

    it('omits Favorites heading when no exercises are favorited', () => {
        render(<ExercisesTab />);
        expect(screen.queryByRole('heading', { name: /favorites/i })).not.toBeInTheDocument();
    });

    it('category chip flattens to a plain list (no group headers) for that category', async () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            favoriteExerciseIds: new Set([bench.id]),
        } as unknown as ReturnType<typeof usePulse>);
        render(<ExercisesTab />);
        // Grouped view shows Favorites heading initially.
        expect(screen.getByRole('heading', { name: /favorites/i })).toBeInTheDocument();
        // Click a specific category.
        await userEvent.click(screen.getByRole('button', { name: /^chest$/i }));
        // Heading should be gone; exercises still shown.
        expect(screen.queryByRole('heading', { name: /favorites/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: /chest/i })).not.toBeInTheDocument();
    });

    it('row tap opens ExerciseDetailSheet', async () => {
        render(<ExercisesTab />);
        // Click the row card (data-testid="exercise-row-body", now role="button").
        const rowBodies = screen.getAllByTestId('exercise-row-body');
        await userEvent.click(rowBodies[0]);
        // Detail sheet should open (ModalSheet has role="dialog").
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    it('+ New opens ExerciseFormSheet in add mode', async () => {
        render(<ExercisesTab />);
        await userEvent.click(screen.getByRole('button', { name: /\+ new/i }));
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
        // Should show the "New exercise" title.
        expect(screen.getByText('New exercise')).toBeInTheDocument();
    });

    it('empty-results state appears with Clear filters when filters exclude everything', async () => {
        render(<ExercisesTab />);
        // Search for something that does not exist.
        await userEvent.type(screen.getByRole('searchbox', { name: /search exercises/i }), 'zzznomatch');
        await waitFor(() => {
            expect(screen.getByText(/no exercises match/i)).toBeInTheDocument();
        });
        // Clear filters button should be present.
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
    });

    it('Clear filters button resets query and shows all exercises again', async () => {
        render(<ExercisesTab />);
        await userEvent.type(screen.getByRole('searchbox', { name: /search exercises/i }), 'zzznomatch');
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
        });
        await userEvent.click(screen.getByRole('button', { name: /clear filters/i }));
        await waitFor(() => {
            expect(screen.getByText('Bench Press')).toBeInTheDocument();
        });
    });

    it('does NOT show empty-results state when the catalog itself is empty', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            exercises: [],
        } as unknown as ReturnType<typeof usePulse>);
        render(<ExercisesTab />);
        // No "clear filters" button; shows a different empty message.
        expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
        expect(screen.getByText(/no exercises in the catalog/i)).toBeInTheDocument();
    });

    it('renders rows in a 2-column grid on desktop (mocked useMediaQuery true)', () => {
        vi.mocked(useMediaQuery).mockReturnValue(true);
        render(<ExercisesTab />);
        // The first group grid container should have grid-cols-2.
        const firstGrid = screen.getAllByTestId(/^group-grid-/)[0];
        expect(firstGrid).toBeDefined();
        expect(firstGrid.className).toContain('grid-cols-2');
    });

    it('renders rows in a single column on mobile (mocked useMediaQuery false)', () => {
        vi.mocked(useMediaQuery).mockReturnValue(false);
        render(<ExercisesTab />);
        const firstGrid = screen.getAllByTestId(/^group-grid-/)[0];
        expect(firstGrid).toBeDefined();
        expect(firstGrid.className).not.toContain('grid-cols-2');
    });

    it('keeps the 2-column desktop grid in the flat (category-filtered) view', async () => {
        vi.mocked(useMediaQuery).mockReturnValue(true);
        render(<ExercisesTab />);
        await userEvent.click(screen.getByRole('button', { name: 'chest' }));
        const flatGrid = screen.getByTestId('flat-grid');
        expect(flatGrid.className).toContain('grid-cols-2');
    });

    it('favorite toggle calls toggleFavorite', async () => {
        render(<ExercisesTab />);
        // Each row has a favorite button. Click the first one (Bench Press).
        const starButtons = screen.getAllByLabelText(/add to favorites/i);
        await userEvent.click(starButtons[0]);
        expect(mocks.toggleFavorite).toHaveBeenCalledWith(bench.id, true);
    });

    it('Group by defaults to Muscle (muscle group headers visible by default)', () => {
        render(<ExercisesTab />);
        // Default group-by is muscle, so muscle-category headings appear.
        expect(screen.getByRole('heading', { name: /^chest$/i })).toBeInTheDocument();
    });

    it('switching Group by to Type (via filter panel) renders Compound and Isolation section headers', async () => {
        render(<ExercisesTab />);
        // Open the filter panel.
        await userEvent.click(screen.getByTestId('filter-trigger'));
        // Pick "Type" in the group-by radio group.
        await userEvent.click(screen.getByRole('radio', { name: /^type$/i }));
        // Close panel.
        await userEvent.keyboard('{Escape}');
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /^compound$/i })).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: /^isolation$/i })).toBeInTheDocument();
        });
        // Muscle category headers should not appear.
        expect(screen.queryByRole('heading', { name: /^chest$/i })).not.toBeInTheDocument();
    });

    it('switching Group by to Equipment (via filter panel) renders equipment bucket headers', async () => {
        render(<ExercisesTab />);
        // Open the filter panel.
        await userEvent.click(screen.getByTestId('filter-trigger'));
        // Pick "Equipment" in the group-by radio group.
        await userEvent.click(screen.getByRole('radio', { name: /^equipment$/i }));
        // Close panel.
        await userEvent.keyboard('{Escape}');
        await waitFor(() => {
            // bench and squat both have barbell equipment so Barbell header should appear.
            expect(screen.getByRole('heading', { name: /^barbell$/i })).toBeInTheDocument();
            // Lateral Raise has dumbbells.
            expect(screen.getByRole('heading', { name: /^dumbbells$/i })).toBeInTheDocument();
        });
        // Muscle category headers should not appear.
        expect(screen.queryByRole('heading', { name: /^chest$/i })).not.toBeInTheDocument();
    });

    it('Group by options are accessible inside the filter panel (not in the count row)', async () => {
        render(<ExercisesTab />);
        // The group-by radios should not be in the DOM before opening the filter.
        expect(screen.queryByRole('radio', { name: /^muscle$/i })).not.toBeInTheDocument();
        // Open the filter panel.
        await userEvent.click(screen.getByTestId('filter-trigger'));
        // Now they should be visible.
        expect(screen.getByRole('radio', { name: /^muscle$/i })).toBeInTheDocument();
    });
});
