import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingModal from '../OnboardingModal';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));
import { usePulse } from '@/context/PulseContext';

const generateRoutine = vi.fn().mockResolvedValue({});
const completeOnboarding = vi.fn().mockResolvedValue(undefined);
const dismissOnboarding = vi.fn();
const navigate = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    (usePulse as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        generateRoutine,
        completeOnboarding,
        dismissOnboarding,
        navigate,
    });
});

describe('OnboardingModal', () => {
    it('renders the shared setup flow starting at the equipment step', () => {
        render(<OnboardingModal />);
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
    });

    it('Cancel dismisses onboarding without generating', () => {
        render(<OnboardingModal />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(dismissOnboarding).toHaveBeenCalledTimes(1);
        expect(generateRoutine).not.toHaveBeenCalled();
    });
});
