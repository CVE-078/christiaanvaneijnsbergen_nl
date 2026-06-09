import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingModal from '../OnboardingModal';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));
import { usePulse } from '@/context/PulseContext';

const generateRoutine = vi.fn().mockResolvedValue({ id: 'routine-1' });
const completeOnboarding = vi.fn().mockResolvedValue(undefined);
const dismissOnboarding = vi.fn();
const triggerOnboarding = vi.fn();
const navigate = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    generateRoutine.mockResolvedValue({ id: 'routine-1' });
    (usePulse as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        generateRoutine,
        setProgramAnchor: vi.fn().mockResolvedValue(undefined),
        updateRoutineProgramWeeks: vi.fn().mockResolvedValue(undefined),
        completeOnboarding,
        dismissOnboarding,
        triggerOnboarding,
        navigate,
        profile: {
            training_style: null,
            variety_preference: null,
            loading_lean: null,
            movement_restrictions: null,
        },
        deleteRoutine: vi.fn().mockResolvedValue(undefined),
    });
});

describe('OnboardingModal', () => {
    it('opens straight at the equipment step (quick mode skips gender)', () => {
        render(<OnboardingModal />);
        expect(screen.queryByText(/what's your gender/i)).not.toBeInTheDocument();
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
    });

    it('the close button dismisses onboarding without generating', () => {
        render(<OnboardingModal />);
        // First step closes immediately (no progress), so onClose → dismissOnboarding.
        fireEvent.click(screen.getByRole('button', { name: /close setup/i }));
        expect(dismissOnboarding).toHaveBeenCalledTimes(1);
        expect(generateRoutine).not.toHaveBeenCalled();
    });

    it('hands off to the Tune your plan panel after generating, without dismissing onboarding', async () => {
        render(<OnboardingModal />);

        // 1: equipment
        fireEvent.click(screen.getByText('Dumbbells'));
        fireEvent.click(screen.getByText('Next'));
        // 2: experience
        fireEvent.click(screen.getByText('Beginner'));
        fireEvent.click(screen.getByText('Next'));
        // 3: goal
        fireEvent.click(screen.getByText('Build muscle'));
        fireEvent.click(screen.getByText('Next'));
        // 4: days/week → jumps straight past "which days" and "program style"
        fireEvent.click(screen.getByText('4 days'));
        fireEvent.click(screen.getByText('Next'));
        // 5: session length
        fireEvent.click(screen.getByText('~30 min'));
        fireEvent.click(screen.getByText('Next'));
        // 6: start → complete
        fireEvent.click(screen.getByText('Create my routine'));

        await waitFor(() => expect(generateRoutine).toHaveBeenCalledTimes(1));
        // Pinned open through generation so the routines.length flip can't unmount us.
        expect(triggerOnboarding).toHaveBeenCalledTimes(1);
        // Quick mode passes undefined so generateRoutine defers to the stored profile.
        // Args 5-9 (name..restrictions) stay undefined; arg 10 is the start anchor
        // (defaults to the chosen start date, a string) threaded in for day ordering.
        const genArgs = generateRoutine.mock.calls[0].slice(4);
        expect(genArgs.slice(0, 5)).toEqual([undefined, undefined, undefined, undefined, undefined]);
        expect(typeof genArgs[5]).toBe('string');

        // Handed off to the Tune panel rather than finishing onboarding outright.
        expect(await screen.findByText(/Looks good/)).toBeInTheDocument();
        expect(dismissOnboarding).not.toHaveBeenCalled();
        expect(completeOnboarding).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText(/Looks good/));
        await waitFor(() => expect(completeOnboarding).toHaveBeenCalledTimes(1));
        expect(dismissOnboarding).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith('train');
    });
});
