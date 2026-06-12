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

    it('renders initials from displayName', () => {
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
        expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders first email letter as initials when displayName is null', () => {
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
        expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('calls updateProfile when unit is toggled to lbs', async () => {
        renderWithToast(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^lbs$/i }));
        expect(mockUpdateProfile).toHaveBeenCalledWith('Test User', 'lbs');
    });

    it('renders both gender options with neither active when gender is null', () => {
        renderWithToast(<ProfileView />);
        const male = screen.getByRole('button', { name: /^male$/i });
        const female = screen.getByRole('button', { name: /^female$/i });
        expect(male).toBeInTheDocument();
        expect(female).toBeInTheDocument();
        expect(male.className).not.toContain('bg-pulse-accent');
        expect(female.className).not.toContain('bg-pulse-accent');
    });

    it('marks the stored gender as active', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { ...defaultContext.profile, gender: 'female' as const },
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        expect(screen.getByRole('button', { name: /^female$/i }).className).toContain('bg-pulse-accent');
        expect(screen.getByRole('button', { name: /^male$/i }).className).not.toContain('bg-pulse-accent');
    });

    it('calls updateGender with the chosen value and shows a toast', async () => {
        renderWithToast(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^female$/i }));
        expect(mockUpdateGender).toHaveBeenCalledWith('female');
        await waitFor(() => expect(screen.getByText(/gender updated/i)).toBeInTheDocument());
    });

    it('changing the training priority calls updatePriorityMuscle', async () => {
        renderWithToast(<ProfileView />);
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
        it('renders training preference editors and reflects current values', () => {
            renderWithProfile({
                training_style: 'strength',
                variety_preference: 'consistent',
                loading_lean: 'barbell',
            });
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

        it('renders null loading_lean as "No preference" active with no equipment row highlighted', () => {
            renderWithProfile({ loading_lean: null });
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
            const prefsSection = screen.getByTestId('training-preferences-section');
            await user.click(within(prefsSection).getByRole('button', { name: /^Barbell/ }));
            expect(mockUpdateLoadingLean).not.toHaveBeenCalled();
        });

        it('clicking "No preference" calls updateLoadingLean(null)', async () => {
            const user = userEvent.setup();
            renderWithProfile({ loading_lean: 'barbell' });
            const prefsSection = screen.getByTestId('training-preferences-section');
            await user.click(within(prefsSection).getByRole('button', { name: /No preference/ }));
            expect(mockUpdateLoadingLean).toHaveBeenCalledWith(null);
        });

        it('clicking an inactive training style calls updateTrainingStyle', async () => {
            const user = userEvent.setup();
            renderWithProfile({ training_style: 'balanced' });
            const prefsSection = screen.getByTestId('training-preferences-section');
            await user.click(within(prefsSection).getByRole('button', { name: /Strength/ }));
            expect(mockUpdateTrainingStyle).toHaveBeenCalledWith('strength');
        });

        it('clicking the already-active training style is a no-op', async () => {
            const user = userEvent.setup();
            renderWithProfile({ training_style: 'strength' });
            const prefsSection = screen.getByTestId('training-preferences-section');
            await user.click(within(prefsSection).getByRole('button', { name: /Strength/ }));
            expect(mockUpdateTrainingStyle).not.toHaveBeenCalled();
        });

        it('null training_style defaults to balanced active', () => {
            renderWithProfile({ training_style: null });
            const prefsSection = screen.getByTestId('training-preferences-section');
            expect(within(prefsSection).getByRole('button', { name: /Balanced/ })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
        });

        it('null variety_preference defaults to varied active', () => {
            renderWithProfile({ variety_preference: null });
            const prefsSection = screen.getByTestId('training-preferences-section');
            expect(within(prefsSection).getByRole('button', { name: /Varied/ })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
        });
    });
});
