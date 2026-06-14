import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GenerateRoutineButton from '../GenerateRoutineButton';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));
import { usePulse } from '@/context/PulseContext';

const generateRoutine = vi.fn();
const setProgramAnchor = vi.fn().mockResolvedValue(undefined);
const updateRoutineProgramWeeks = vi.fn().mockResolvedValue(undefined);
const deleteRoutine = vi.fn().mockResolvedValue(undefined);
const navigate = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    generateRoutine.mockResolvedValue({
        id: 'routine-1',
        user_id: 'u1',
        name: 'Push Pull Legs',
        created_at: '2026-06-01T00:00:00.000Z',
        rationale: 'Built for your goals.',
    });
    (usePulse as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        generateRoutine,
        setProgramAnchor,
        updateRoutineProgramWeeks,
        deleteRoutine,
        navigate,
        profile: {
            training_style: null,
            variety_preference: null,
            loading_lean: null,
            movement_restrictions: null,
        },
    });
});

async function completeQuickFlow() {
    fireEvent.click(screen.getByText('Generate routine'));
    fireEvent.click(screen.getByText('Dumbbells'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Beginner'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Build muscle'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('4 days'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('~30 min'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Create routine'));
    await waitFor(() => expect(generateRoutine).toHaveBeenCalledTimes(1));
}

describe('GenerateRoutineButton', () => {
    it('opens the quick setup flow on click', () => {
        render(<GenerateRoutineButton />);
        fireEvent.click(screen.getByText('Generate routine'));
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
    });

    it('hands off to the Tune your plan panel after generating, instead of navigating immediately', async () => {
        render(<GenerateRoutineButton />);
        await completeQuickFlow();

        expect(navigate).not.toHaveBeenCalled();
        expect(await screen.findByText(/Push Pull Legs/)).toBeInTheDocument();
        expect(screen.getByText(/Looks good/)).toBeInTheDocument();
    });

    it('"Looks good" closes the panel and navigates to train', async () => {
        render(<GenerateRoutineButton />);
        await completeQuickFlow();

        fireEvent.click(await screen.findByText(/Looks good/));
        expect(navigate).toHaveBeenCalledWith('train');
        expect(screen.queryByText(/Push Pull Legs/)).not.toBeInTheDocument();
    });

    it('seeds the equipment step from the saved profiles when present', () => {
        (usePulse as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            generateRoutine,
            setProgramAnchor,
            updateRoutineProgramWeeks,
            deleteRoutine,
            navigate,
            profile: {
                training_style: null,
                variety_preference: null,
                loading_lean: null,
                movement_restrictions: null,
                active_equipment_profile_id: 'home',
            },
            equipmentProfiles: [
                { id: 'home', name: 'Home', equipment: ['dumbbells', 'bench'], created_at: '2026-06-09T02:00:00Z' },
            ],
            createEquipmentProfile: vi.fn(),
        });
        render(<GenerateRoutineButton />);
        fireEvent.click(screen.getByText('Generate routine'));
        // The saved profile shows as a quick-pick chip and pre-fills the checkboxes.
        expect(screen.getByRole('button', { name: /Home/ })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Dumbbells/ })).toBeChecked();
        expect(screen.getByText(/Filled from your Home profile/i)).toBeInTheDocument();
    });
});
