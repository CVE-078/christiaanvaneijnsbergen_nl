import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingModal from '../OnboardingModal';

vi.mock('swr', () => ({ default: vi.fn() }));
vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));

import useSWR from 'swr';
import { usePulse } from '@/context/PulseContext';
import type { RoutineTemplate } from '@/lib/pulse/types';

const mockCloneTemplate = vi.fn().mockResolvedValue({});
const mockCompleteOnboarding = vi.fn().mockResolvedValue(undefined);
const mockDismissOnboarding = vi.fn();
const mockNavigate = vi.fn();

const mockTemplates: RoutineTemplate[] = [
    {
        id: '1', name: 'Full Body — Dumbbells', slug: 'full-body-db',
        required_equipment: ['dumbbells'], days_per_week: '2-3',
        experience_level: 'beginner', session_time: '30-45 min',
        description: 'One session works everything.',
        schedule_pattern: ['full_body'],
        default_days: [1, 3, 5],
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    (useSWR as any).mockReturnValue({ data: mockTemplates });
    (usePulse as any).mockReturnValue({
        cloneTemplate: mockCloneTemplate,
        completeOnboarding: mockCompleteOnboarding,
        dismissOnboarding: mockDismissOnboarding,
        navigate: mockNavigate,
        routines: [],
    });
});

function selectEquipment() {
    fireEvent.click(screen.getByText('Dumbbells'));
}

function advanceToStep2() {
    selectEquipment();
    fireEvent.click(screen.getByText('Next'));
}

describe('OnboardingModal', () => {
    it('renders step 1 with equipment options', () => {
        render(<OnboardingModal />);
        expect(screen.getByText('What equipment do you have access to?')).toBeInTheDocument();
        expect(screen.getByText('Dumbbells')).toBeInTheDocument();
    });

    it('Next is disabled on step 1 until equipment is selected', () => {
        render(<OnboardingModal />);
        expect(screen.getByText('Next')).toBeDisabled();
        selectEquipment();
        expect(screen.getByText('Next')).not.toBeDisabled();
    });

    it('Skip calls dismissOnboarding without cloning', () => {
        render(<OnboardingModal />);
        fireEvent.click(screen.getByText('Skip for now'));
        expect(mockDismissOnboarding).toHaveBeenCalledOnce();
        expect(mockCloneTemplate).not.toHaveBeenCalled();
    });

    it('navigates to step 2 and can go back', () => {
        render(<OnboardingModal />);
        advanceToStep2();
        expect(screen.getByText("What's your training experience?")).toBeInTheDocument();
        fireEvent.click(screen.getByText('←'));
        expect(screen.getByText('What equipment do you have access to?')).toBeInTheDocument();
    });

    it('completes all steps and shows beginner recommendation', async () => {
        render(<OnboardingModal />);
        // Step 1
        selectEquipment();
        fireEvent.click(screen.getByText('Next'));
        // Step 2
        fireEvent.click(screen.getByText('Beginner'));
        fireEvent.click(screen.getByText('Next'));
        // Step 3
        fireEvent.click(screen.getByText('Build muscle'));
        fireEvent.click(screen.getByText('Next'));
        // Step 4
        fireEvent.click(screen.getByText('5–6 days'));
        fireEvent.click(screen.getByText('Next'));
        // Step 5
        fireEvent.click(screen.getByText('45–60 min'));
        fireEvent.click(screen.getByText('See my recommendation'));
        // Result: beginner → full-body-db
        await waitFor(() =>
            expect(screen.getByText(/Recommended for you/i)).toBeInTheDocument()
        );
    });

    it('"Browse all templates" navigates to library and dismisses modal', async () => {
        render(<OnboardingModal />);
        advanceToStep2();
        fireEvent.click(screen.getByText('Beginner'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Build muscle'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('5–6 days'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('45–60 min'));
        fireEvent.click(screen.getByText('See my recommendation'));
        await screen.findByText(/Recommended for you/i);
        fireEvent.click(screen.getByText('Not quite right? Browse all templates'));
        expect(mockNavigate).toHaveBeenCalledWith('library');
        expect(mockDismissOnboarding).toHaveBeenCalled();
    });

    it('"Start with this routine" clones and completes onboarding', async () => {
        render(<OnboardingModal />);
        advanceToStep2();
        fireEvent.click(screen.getByText('Beginner'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Build muscle'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('5–6 days'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('45–60 min'));
        fireEvent.click(screen.getByText('See my recommendation'));
        await screen.findByText(/Recommended for you/i);
        fireEvent.click(screen.getByText('Start with this routine'));
        await waitFor(() => expect(mockCloneTemplate).toHaveBeenCalledWith('full-body-db'));
        await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalled());
    });
});
