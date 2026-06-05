import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingModal from '../OnboardingModal';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));
import { usePulse } from '@/context/PulseContext';

const generateRoutine = vi.fn().mockResolvedValue({});
const completeOnboarding = vi.fn().mockResolvedValue(undefined);
const dismissOnboarding = vi.fn();
const navigate = vi.fn();
const updateGender = vi.fn().mockResolvedValue(undefined);

function mockPulse(profile: { gender?: string | null } = { gender: null }) {
    (usePulse as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        profile,
        generateRoutine,
        completeOnboarding,
        dismissOnboarding,
        navigate,
        updateGender,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockPulse();
});

describe('OnboardingModal', () => {
    it('starts at the optional gender step, then advances to equipment', () => {
        render(<OnboardingModal />);
        expect(screen.getByText(/what's your gender/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Male'));
        fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
    });

    it('lets you skip the gender step', () => {
        render(<OnboardingModal />);
        fireEvent.click(screen.getByText('Skip'));
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
    });

    it('hides the gender step when the profile already has one', () => {
        mockPulse({ gender: 'female' });
        render(<OnboardingModal />);
        expect(screen.queryByText(/what's your gender/i)).not.toBeInTheDocument();
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
    });

    it('Cancel dismisses onboarding without generating', () => {
        render(<OnboardingModal />);
        // Skip past the optional gender step to reach the equipment step's Cancel.
        fireEvent.click(screen.getByText('Skip'));
        fireEvent.click(screen.getByText('Cancel'));
        expect(dismissOnboarding).toHaveBeenCalledTimes(1);
        expect(generateRoutine).not.toHaveBeenCalled();
    });
});
