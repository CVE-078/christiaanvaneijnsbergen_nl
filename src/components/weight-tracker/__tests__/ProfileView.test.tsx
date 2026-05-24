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
});
