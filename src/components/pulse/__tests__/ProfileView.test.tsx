import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileView from '../views/ProfileView';

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
    triggerOnboarding: vi.fn(),
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    mockUpdateProfile.mockClear();
    mockLogBodyWeight.mockClear();
    mockDeleteBodyWeight.mockClear();
});

describe('ProfileView', () => {
    it('shows a saved confirmation after display name is updated', async () => {
        render(<ProfileView />);
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
        render(<ProfileView />);
        const today = new Date().toISOString().split('T')[0];
        const datePicker = screen.getAllByDisplayValue(today);
        expect(datePicker.length).toBeGreaterThan(0);
    });

    it('renders initials from displayName', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { display_name: 'John Doe', unit: 'kg', active_routine_id: null, onboarding_completed: false, goal_weight_kg: null },
        } as unknown as ReturnType<typeof usePulse>);
        render(<ProfileView />);
        expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders first email letter as initials when displayName is null', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { display_name: null, unit: 'kg', active_routine_id: null, onboarding_completed: false, goal_weight_kg: null },
        } as unknown as ReturnType<typeof usePulse>);
        render(<ProfileView />);
        expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('calls updateProfile when unit is toggled to lbs', async () => {
        render(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^lbs$/i }));
        expect(mockUpdateProfile).toHaveBeenCalledWith('Test User', 'lbs');
    });

    it('shows body weight entries in user unit', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyweightLogs: [{ id: 'abc', logged_at: '2026-05-01', weight_kg: 80 }],
        } as unknown as ReturnType<typeof usePulse>);
        render(<ProfileView />);
        expect(screen.getByText(/80 kg/i)).toBeInTheDocument();
    });

    it('shows error when non-numeric weight is submitted', async () => {
        render(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^log$/i }));
        expect(screen.getByText(/enter a valid weight/i)).toBeInTheDocument();
    });
});
