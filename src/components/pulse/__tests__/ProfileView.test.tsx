import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileView from '../views/ProfileView';
import { ToastProvider } from '@/lib/pulse/toast';
import ToastContainer from '../ToastContainer';
import type { RoutineWithExercises } from '@/lib/pulse/types';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

vi.mock('@/app/pulse/actions', () => ({
    updateGoalWeight: vi.fn().mockResolvedValue(undefined),
    logBodyMeasurement: vi.fn().mockResolvedValue(undefined),
    logBodyWeight: vi.fn().mockResolvedValue({ id: 'x', logged_at: '2026-05-25', weight_kg: 80 }),
}));

import { usePulse } from '@/context/PulseContext';

const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
const mockLogBodyWeight = vi.fn().mockResolvedValue({ id: 'x', logged_at: '2026-05-25', weight_kg: 80 });
const mockDeleteBodyWeight = vi.fn().mockResolvedValue(undefined);

const defaultContext = {
    email: 'test@example.com',
    profile: { display_name: 'Test User', unit: 'kg' as const, active_routine_id: null, onboarding_completed: false, goal_weight_kg: null },
    bodyweightLogs: [],
    updateProfile: mockUpdateProfile,
    logBodyWeight: mockLogBodyWeight,
    deleteBodyWeight: mockDeleteBodyWeight,
    streak: 0,
    prMap: {},
    exercises: [],
    routines: [] as RoutineWithExercises[],
    triggerOnboarding: vi.fn(),
};

const renderWithToast = (component: React.ReactElement) => {
    return render(
        <ToastProvider>
            {component}
            <ToastContainer />
        </ToastProvider>
    );
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    mockUpdateProfile.mockClear();
    mockLogBodyWeight.mockClear();
    mockDeleteBodyWeight.mockClear();
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

    it('renders a date picker for body weight with today as the default', () => {
        renderWithToast(<ProfileView />);
        const today = new Date().toISOString().split('T')[0];
        const datePicker = screen.getAllByDisplayValue(today);
        expect(datePicker.length).toBeGreaterThan(0);
    });

    it('renders initials from displayName', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { display_name: 'John Doe', unit: 'kg', active_routine_id: null, onboarding_completed: false, goal_weight_kg: null },
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders first email letter as initials when displayName is null', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { display_name: null, unit: 'kg', active_routine_id: null, onboarding_completed: false, goal_weight_kg: null },
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('calls updateProfile when unit is toggled to lbs', async () => {
        renderWithToast(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^lbs$/i }));
        expect(mockUpdateProfile).toHaveBeenCalledWith('Test User', 'lbs');
    });

    it('shows body weight entries in user unit', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyweightLogs: [{ id: 'abc', logged_at: '2026-05-01', weight_kg: 80 }],
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        expect(screen.getByText(/80 kg/i)).toBeInTheDocument();
    });

    it('shows error when non-numeric weight is submitted', async () => {
        renderWithToast(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^log$/i }));
        expect(screen.getByText(/enter a valid weight/i)).toBeInTheDocument();
    });

    it('shows exercise name instead of UUID in Personal Records', () => {
        const RE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
        const routine: RoutineWithExercises = {
            id: 'r1', user_id: 'u1', name: 'PPL', created_at: '',
            schedule: [],
            exercises: [{
                id: RE_ID, routine_id: 'r1', exercise_id: 'ex-1',
                workout_type: 'push', variant: null, order: 0, sets: '3', reps: '8',
                starting_weight_kg: null,
                exercise: { id: 'ex-1', name: 'Bench Press', category: 'chest', default_sets: '3', default_reps: '8', user_id: null },
            }],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            prMap: { [RE_ID]: 126.67 },
            routines: [routine],
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<ProfileView />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.queryByText(RE_ID)).not.toBeInTheDocument();
    });
});
