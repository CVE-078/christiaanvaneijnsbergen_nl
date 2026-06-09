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
    logBodyMeasurement: vi.fn().mockResolvedValue(undefined),
    logBodyWeight: vi.fn().mockResolvedValue({ id: 'x', logged_at: '2026-05-25', weight_kg: 80 }),
}));

import { usePulse } from '@/context/PulseContext';
import { updateGoalWeight } from '@/app/pulse/actions';

const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
const mockUpdateGender = vi.fn().mockResolvedValue(undefined);
const mockLogBodyWeight = vi.fn().mockResolvedValue({ id: 'x', logged_at: '2026-05-25', weight_kg: 80 });
const mockDeleteBodyWeight = vi.fn().mockResolvedValue(undefined);
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
    logBodyWeight: mockLogBodyWeight,
    deleteBodyWeight: mockDeleteBodyWeight,
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
    mockLogBodyWeight.mockClear();
    mockDeleteBodyWeight.mockClear();
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
    vi.mocked(updateGoalWeight).mockClear();
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

    it('renders a date picker for body weight with today as the default', () => {
        renderWithToast(<ProfileView />);
        const today = new Date().toISOString().split('T')[0];
        const datePicker = screen.getAllByDisplayValue(today);
        expect(datePicker.length).toBeGreaterThan(0);
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

    it('shows body weight entries in user unit', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyweightLogs: [{ id: 'abc', logged_at: '2026-05-01', weight_kg: 80 }],
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        expect(screen.getByText(/80 kg/i)).toBeInTheDocument();
    });

    it('shows a downward bodyweight trend chip when the two latest entries decrease', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyweightLogs: [
                { id: 'b2', logged_at: '2026-05-15', weight_kg: 79 },
                { id: 'b1', logged_at: '2026-05-01', weight_kg: 81 },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        const chip = screen.getByText(/↓\s*2\s*kg/);
        expect(chip).toBeInTheDocument();
        expect(chip.className).toContain('text-pulse-success');
    });

    it('shows error when non-numeric weight is submitted', async () => {
        renderWithToast(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^log$/i }));
        expect(screen.getByText(/enter a valid weight/i)).toBeInTheDocument();
    });

    it('stores goal weight in rounded kg when unit is lbs', async () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: {
                display_name: 'Test User',
                unit: 'lbs',
                active_routine_id: null,
                onboarding_completed: false,
                goal_weight_kg: null,
            },
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        const input = screen.getByPlaceholderText('Goal (lbs)');
        await userEvent.type(input, '180');
        await userEvent.click(screen.getByRole('button', { name: /^set$/i }));
        // 180 / 2.20462 = 81.6466..., rounded to 2 decimals by toKg
        expect(vi.mocked(updateGoalWeight)).toHaveBeenCalledWith(81.65);
    });

    it('calls updateLengthUnit when the in measurement-unit toggle is clicked', async () => {
        renderWithToast(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^in$/i }));
        expect(mockUpdateLengthUnit).toHaveBeenCalledWith('in');
    });

    it('renders the latest measurement readout and converts it when unit is in', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { ...defaultContext.profile, length_unit: 'in' as const },
            bodyMeasurements: [
                {
                    id: 'm1',
                    measured_at: '2026-06-01',
                    waist_cm: 81,
                    hips_cm: 99,
                    chest_cm: 106,
                    arms_cm: 39,
                },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        // 81 cm -> 31.9 in
        expect(screen.getByText(/31\.9 in/)).toBeInTheDocument();
        // 99 cm -> 39 in (39.0 rounds to 39)
        expect(screen.getByText(/^39 in$/)).toBeInTheDocument();
    });

    it('renders measurement readout in cm with em-dash for missing values', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyMeasurements: [
                {
                    id: 'm1',
                    measured_at: '2026-06-01',
                    waist_cm: 81,
                    hips_cm: null,
                    chest_cm: null,
                    arms_cm: null,
                },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        expect(screen.getByText(/81 cm/)).toBeInTheDocument();
        expect(screen.getAllByText('—').length).toBe(3);
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
