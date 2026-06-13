import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileView from '../views/ProfileView';
import { ToastProvider } from '@/lib/pulse/toast';
import ToastContainer from '../ToastContainer';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

vi.mock('@/app/pulse/actions', () => ({
    updateGoalWeight: vi.fn().mockResolvedValue(undefined),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
    usePathname: () => '/pulse/profile',
    useRouter: () => ({ push: mockPush }),
}));

import { usePulse } from '@/context/PulseContext';

const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
const mockUpdateGender = vi.fn().mockResolvedValue(undefined);
const mockUpdateLengthUnit = vi.fn().mockResolvedValue(undefined);
const mockUpdatePriorityMuscle = vi.fn().mockResolvedValue(undefined);
const mockUpdateAccentColor = vi.fn().mockResolvedValue(undefined);
const mockUpdateTrainingStyle = vi.fn().mockResolvedValue(undefined);
const mockUpdateVarietyPreference = vi.fn().mockResolvedValue(undefined);
const mockUpdateLoadingLean = vi.fn().mockResolvedValue(undefined);
const mockUpdateMovementRestrictions = vi.fn().mockResolvedValue(undefined);
const mockCreateEquipmentProfile = vi.fn().mockResolvedValue(undefined);
const mockUpdateEquipmentProfile = vi.fn().mockResolvedValue(undefined);
const mockDeleteEquipmentProfile = vi.fn().mockResolvedValue(undefined);
const mockSetActiveEquipmentProfile = vi.fn().mockResolvedValue(undefined);

const defaultContext = {
    email: 'test@example.com',
    profile: {
        display_name: 'Test User',
        unit: 'kg' as const,
        active_routine_id: null,
        onboarding_completed: false,
        goal_weight_kg: null,
        gender: null,
        length_unit: 'cm' as const,
        priority_muscle: null,
        training_style: null,
        variety_preference: null,
        loading_lean: null,
        movement_restrictions: null,
        active_equipment_profile_id: null,
    },
    equipmentProfiles: [],
    createEquipmentProfile: mockCreateEquipmentProfile,
    updateEquipmentProfile: mockUpdateEquipmentProfile,
    deleteEquipmentProfile: mockDeleteEquipmentProfile,
    setActiveEquipmentProfile: mockSetActiveEquipmentProfile,
    bodyweightLogs: [],
    bodyMeasurements: [],
    refreshMeasurements: vi.fn(),
    updateProfile: mockUpdateProfile,
    updateGender: mockUpdateGender,
    updateLengthUnit: mockUpdateLengthUnit,
    updatePriorityMuscle: mockUpdatePriorityMuscle,
    updateAccentColor: mockUpdateAccentColor,
    updateTrainingStyle: mockUpdateTrainingStyle,
    updateVarietyPreference: mockUpdateVarietyPreference,
    updateLoadingLean: mockUpdateLoadingLean,
    updateMovementRestrictions: mockUpdateMovementRestrictions,
    autoAdvance: false,
    setAutoAdvance: vi.fn(),
    streak: 0,
    prMap: {},
    exercises: [],
    routines: [],
    triggerOnboarding: vi.fn(),
    handleExport: vi.fn(),
    loading: {},
    errors: {},
    retry: vi.fn(),
};

const renderWithToast = (component: React.ReactElement) => {
    return render(
        <ToastProvider>
            {component}
            <ToastContainer />
        </ToastProvider>,
    );
};

function renderWithProfile(profileOverrides: Record<string, unknown> = {}) {
    vi.mocked(usePulse).mockReturnValue({
        ...defaultContext,
        profile: { ...defaultContext.profile, ...profileOverrides },
    } as unknown as ReturnType<typeof usePulse>);
    return renderWithToast(<ProfileView />);
}

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    mockUpdateProfile.mockClear();
    mockUpdateGender.mockClear();
    mockUpdateLengthUnit.mockClear();
    mockUpdatePriorityMuscle.mockClear();
    mockUpdateAccentColor.mockClear();
    mockUpdateTrainingStyle.mockClear();
    mockUpdateVarietyPreference.mockClear();
    mockUpdateLoadingLean.mockClear();
    mockUpdateMovementRestrictions.mockClear();
    mockCreateEquipmentProfile.mockClear();
    mockUpdateEquipmentProfile.mockClear();
    mockDeleteEquipmentProfile.mockClear();
    mockSetActiveEquipmentProfile.mockClear();
});

describe('ProfileView', () => {
    describe('Tab navigation', () => {
        it('renders You and Training tabs', () => {
            renderWithToast(<ProfileView />);
            expect(screen.getByRole('tab', { name: 'You' })).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: 'Training' })).toBeInTheDocument();
        });

        it('shows You panel content by default', () => {
            renderWithToast(<ProfileView />);
            // Identity and gender are on You tab
            expect(screen.getByText('Test User')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /^male$/i })).toBeInTheDocument();
        });

        it('hides Training panel content on initial render', () => {
            renderWithToast(<ProfileView />);
            // Training priority select is on the Training tab; the panel carries
            // the HTML hidden attribute, so ARIA queries don't find it.
            expect(screen.queryByRole('combobox', { name: /training priority/i })).toBeNull();
        });

        it('switches to Training tab and reveals training controls', async () => {
            renderWithToast(<ProfileView />);
            await userEvent.click(screen.getByRole('tab', { name: 'Training' }));
            expect(screen.getByRole('combobox', { name: /training priority/i })).toBeVisible();
            expect(screen.getByTestId('training-preferences-section')).toBeVisible();
            // ...and the tab is deep-linked into the URL.
            expect(mockPush).toHaveBeenCalledWith('/pulse/profile/training');
        });

        it('switches back to You tab after clicking Training', async () => {
            renderWithToast(<ProfileView />);
            await userEvent.click(screen.getByRole('tab', { name: 'Training' }));
            await userEvent.click(screen.getByRole('tab', { name: 'You' }));
            expect(screen.getByText('Test User')).toBeVisible();
        });
    });

    it('shows a saved confirmation after display name is updated', async () => {
        renderWithToast(<ProfileView />);
        await userEvent.click(screen.getByText('Test User'));
        const input = screen.getByPlaceholderText('Display name');
        await userEvent.clear(input);
        await userEvent.type(input, 'New Name');
        await userEvent.keyboard('{Enter}');
        await waitFor(() => {
            expect(screen.getByText(/saved/i)).toBeInTheDocument();
        });
    });

    it('sets the accent colour when a swatch is clicked', async () => {
        renderWithToast(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: 'Emerald' }));
        expect(mockUpdateAccentColor).toHaveBeenCalledWith('emerald');
    });

    it('shows the display name and email in the Identity row', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: {
                display_name: 'John Doe',
                unit: 'kg',
                active_routine_id: null,
                onboarding_completed: false,
                goal_weight_kg: null,
            },
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        expect(screen.getByText('Display name')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('prompts to add a display name when none is set', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: {
                display_name: null,
                unit: 'kg',
                active_routine_id: null,
                onboarding_completed: false,
                goal_weight_kg: null,
            },
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        expect(screen.getByText('Add display name')).toBeInTheDocument();
    });

    it('calls updateProfile when unit is toggled to lbs', async () => {
        renderWithToast(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^lbs$/i }));
        expect(mockUpdateProfile).toHaveBeenCalledWith('Test User', 'lbs');
    });

    describe('Gender control', () => {
        it('renders Male, Female, and Prefer not to say options', () => {
            renderWithToast(<ProfileView />);
            expect(screen.getByRole('button', { name: /^male$/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /^female$/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /prefer not to say/i })).toBeInTheDocument();
        });

        it('shows "Prefer not to say" as active when gender is null', () => {
            renderWithToast(<ProfileView />);
            const notSay = screen.getByRole('button', { name: /prefer not to say/i });
            expect(notSay.className).toContain('bg-pulse-accent');
            expect(screen.getByRole('button', { name: /^male$/i }).className).not.toContain('bg-pulse-accent');
            expect(screen.getByRole('button', { name: /^female$/i }).className).not.toContain('bg-pulse-accent');
        });

        it('marks the stored gender as active', () => {
            vi.mocked(usePulse).mockReturnValue({
                ...defaultContext,
                profile: { ...defaultContext.profile, gender: 'female' as const },
            } as unknown as ReturnType<typeof usePulse>);
            renderWithToast(<ProfileView />);
            expect(screen.getByRole('button', { name: /^female$/i }).className).toContain('bg-pulse-accent');
            expect(screen.getByRole('button', { name: /^male$/i }).className).not.toContain('bg-pulse-accent');
            expect(screen.getByRole('button', { name: /prefer not to say/i }).className).not.toContain(
                'bg-pulse-accent',
            );
        });

        it('calls updateGender with the chosen value and shows a toast', async () => {
            renderWithToast(<ProfileView />);
            await userEvent.click(screen.getByRole('button', { name: /^female$/i }));
            expect(mockUpdateGender).toHaveBeenCalledWith('female');
            await waitFor(() => expect(screen.getByText(/gender updated/i)).toBeInTheDocument());
        });

        it('clicking "Prefer not to say" calls updateGender(null)', async () => {
            vi.mocked(usePulse).mockReturnValue({
                ...defaultContext,
                profile: { ...defaultContext.profile, gender: 'male' as const },
            } as unknown as ReturnType<typeof usePulse>);
            renderWithToast(<ProfileView />);
            await userEvent.click(screen.getByRole('button', { name: /prefer not to say/i }));
            expect(mockUpdateGender).toHaveBeenCalledWith(null);
        });

        it('does not call updateGender when "Prefer not to say" is already active (gender null)', async () => {
            renderWithToast(<ProfileView />);
            await userEvent.click(screen.getByRole('button', { name: /prefer not to say/i }));
            expect(mockUpdateGender).not.toHaveBeenCalled();
        });
    });

    it('changing the training priority calls updatePriorityMuscle', async () => {
        renderWithToast(<ProfileView />);
        // Training priority is on the Training tab
        await userEvent.click(screen.getByRole('tab', { name: 'Training' }));
        await userEvent.selectOptions(screen.getByRole('combobox', { name: /training priority/i }), 'glutes');
        expect(mockUpdatePriorityMuscle).toHaveBeenCalledWith('glutes');
    });

    it('renders the auto-advance toggle reflecting the stored value', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            autoAdvance: true,
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        const toggle = screen.getByRole('switch', { name: /auto-advance rest timer/i });
        expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('calls setAutoAdvance when the toggle is clicked', async () => {
        const setAutoAdvance = vi.fn();
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            autoAdvance: false,
            setAutoAdvance,
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        await userEvent.click(screen.getByRole('switch', { name: /auto-advance rest timer/i }));
        expect(setAutoAdvance).toHaveBeenCalledWith(true);
    });

    describe('Training preferences editors', () => {
        async function switchToTraining() {
            await userEvent.click(screen.getByRole('tab', { name: 'Training' }));
        }

        it('renders training preference editors and reflects current values', async () => {
            renderWithProfile({
                training_style: 'strength',
                variety_preference: 'consistent',
                loading_lean: 'barbell',
            });
            await switchToTraining();
            const prefsSection = screen.getByTestId('training-preferences-section');
            expect(within(prefsSection).getByRole('button', { name: /Strength/ })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
            expect(within(prefsSection).getByRole('button', { name: /Consistent/ })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
            expect(within(prefsSection).getByRole('button', { name: /^Barbell/ })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
        });

        it('renders null loading_lean as "No preference" active with no equipment row highlighted', async () => {
            renderWithProfile({ loading_lean: null });
            await switchToTraining();
            const prefsSection = screen.getByTestId('training-preferences-section');
            expect(within(prefsSection).getByRole('button', { name: /No preference/ })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
            expect(within(prefsSection).getByRole('button', { name: /^Barbell/ })).toHaveAttribute(
                'aria-pressed',
                'false',
            );
        });

        it('clicking the already-active loading row is a no-op (setter not called)', async () => {
            const user = userEvent.setup();
            renderWithProfile({ loading_lean: 'barbell' });
            await user.click(screen.getByRole('tab', { name: 'Training' }));
            const prefsSection = screen.getByTestId('training-preferences-section');
            await user.click(within(prefsSection).getByRole('button', { name: /^Barbell/ }));
            expect(mockUpdateLoadingLean).not.toHaveBeenCalled();
        });

        it('clicking "No preference" calls updateLoadingLean(null)', async () => {
            const user = userEvent.setup();
            renderWithProfile({ loading_lean: 'barbell' });
            await user.click(screen.getByRole('tab', { name: 'Training' }));
            const prefsSection = screen.getByTestId('training-preferences-section');
            await user.click(within(prefsSection).getByRole('button', { name: /No preference/ }));
            expect(mockUpdateLoadingLean).toHaveBeenCalledWith(null);
        });

        it('clicking an inactive training style calls updateTrainingStyle', async () => {
            const user = userEvent.setup();
            renderWithProfile({ training_style: 'balanced' });
            await user.click(screen.getByRole('tab', { name: 'Training' }));
            const prefsSection = screen.getByTestId('training-preferences-section');
            await user.click(within(prefsSection).getByRole('button', { name: /Strength/ }));
            expect(mockUpdateTrainingStyle).toHaveBeenCalledWith('strength');
        });

        it('clicking the already-active training style is a no-op', async () => {
            const user = userEvent.setup();
            renderWithProfile({ training_style: 'strength' });
            await user.click(screen.getByRole('tab', { name: 'Training' }));
            const prefsSection = screen.getByTestId('training-preferences-section');
            await user.click(within(prefsSection).getByRole('button', { name: /Strength/ }));
            expect(mockUpdateTrainingStyle).not.toHaveBeenCalled();
        });

        it('null training_style defaults to balanced active', async () => {
            renderWithProfile({ training_style: null });
            await switchToTraining();
            const prefsSection = screen.getByTestId('training-preferences-section');
            expect(within(prefsSection).getByRole('button', { name: /Balanced/ })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
        });

        it('null variety_preference defaults to varied active', async () => {
            renderWithProfile({ variety_preference: null });
            await switchToTraining();
            const prefsSection = screen.getByTestId('training-preferences-section');
            expect(within(prefsSection).getByRole('button', { name: /Varied/ })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
        });
    });
});
