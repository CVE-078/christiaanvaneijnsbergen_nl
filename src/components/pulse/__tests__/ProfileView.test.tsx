import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileView from '../views/ProfileView';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';

const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
const mockLogBodyWeight = vi.fn();
const mockDeleteBodyWeight = vi.fn().mockResolvedValue(undefined);

const defaultContext = {
    email: 'test@example.com',
    profile: { display_name: 'Test User', unit: 'kg' as const },
    bodyweightLogs: [],
    updateProfile: mockUpdateProfile,
    logBodyWeight: mockLogBodyWeight,
    deleteBodyWeight: mockDeleteBodyWeight,
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as ReturnType<typeof usePulse>);
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

    it('displays today in UTC format (YYYY-MM-DD)', () => {
        const utcDate = new Date().toISOString().slice(0, 10);
        render(<ProfileView />);
        expect(screen.getByText(utcDate)).toBeInTheDocument();
    });

    it('renders initials from displayName', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { display_name: 'John Doe', unit: 'kg' },
        } as ReturnType<typeof usePulse>);
        render(<ProfileView />);
        expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders first email letter as initials when displayName is null', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { display_name: null, unit: 'kg' },
        } as ReturnType<typeof usePulse>);
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
        } as ReturnType<typeof usePulse>);
        render(<ProfileView />);
        expect(screen.getByText(/80 kg/i)).toBeInTheDocument();
    });

    it('shows error when non-numeric weight is submitted', async () => {
        render(<ProfileView />);
        await userEvent.click(screen.getByRole('button', { name: /^log$/i }));
        expect(screen.getByText(/enter a valid weight/i)).toBeInTheDocument();
    });
});
