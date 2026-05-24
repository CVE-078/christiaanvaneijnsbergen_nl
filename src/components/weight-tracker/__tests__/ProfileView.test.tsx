import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileView from '../views/ProfileView';

vi.mock('@/app/pulse/actions', () => ({
    updateProfile: vi.fn().mockResolvedValue(undefined),
    logBodyWeight: vi.fn(),
    deleteBodyWeight: vi.fn(),
}));

const defaultProps = {
    email: 'test@example.com',
    displayName: 'Test User',
    unit: 'kg' as const,
    bodyweightLogs: [],
    onUnitChange: vi.fn(),
    onDisplayNameChange: vi.fn(),
    onBodyweightLogsChange: vi.fn(),
};

describe('ProfileView', () => {
    it('shows a saved confirmation after display name is updated', async () => {
        render(<ProfileView {...defaultProps} />);
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
        render(<ProfileView {...defaultProps} />);
        expect(screen.getByText(utcDate)).toBeInTheDocument();
    });

    it('renders initials from displayName', () => {
        render(<ProfileView {...defaultProps} displayName="John Doe" />);
        expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders first email letter as initials when displayName is null', () => {
        render(<ProfileView {...defaultProps} displayName={null} />);
        expect(screen.getByText('T')).toBeInTheDocument(); // 'test@example.com' → 'T'
    });

    it('calls onUnitChange and updateProfile when unit is toggled to lbs', async () => {
        const onUnitChange = vi.fn();
        render(<ProfileView {...defaultProps} onUnitChange={onUnitChange} />);
        await userEvent.click(screen.getByRole('button', { name: /^lbs$/i }));
        expect(onUnitChange).toHaveBeenCalledWith('lbs');
    });

    it('shows body weight entries in user unit', () => {
        const logs = [{ id: 'abc', logged_at: '2026-05-01', weight_kg: 80 }];
        render(<ProfileView {...defaultProps} bodyweightLogs={logs} />);
        expect(screen.getByText(/80 kg/i)).toBeInTheDocument();
    });

    it('shows error when non-numeric weight is submitted', async () => {
        render(<ProfileView {...defaultProps} />);
        await userEvent.click(screen.getByRole('button', { name: /^log$/i }));
        expect(screen.getByText(/enter a valid weight/i)).toBeInTheDocument();
    });
});
