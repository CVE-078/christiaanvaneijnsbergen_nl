import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/app/pulse/actions/account', () => ({
    updatePassword: vi.fn(),
    deleteAccount: vi.fn(),
}));

import AccountSecuritySection from '../AccountSecuritySection';

describe('AccountSecuritySection', () => {
    it('renders the change-password and delete sections', () => {
        render(<AccountSecuritySection />);
        expect(screen.getByText('Change password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
        expect(screen.getByText('Delete account')).toBeInTheDocument();
    });

    it('gates the delete button behind typing the confirm word', async () => {
        const user = userEvent.setup();
        render(<AccountSecuritySection />);

        const deleteButton = screen.getByRole('button', { name: /delete my account/i });
        expect(deleteButton).toBeDisabled();

        const confirmInput = screen.getByLabelText(/type delete to confirm/i);
        await user.type(confirmInput, 'delete'); // wrong case
        expect(deleteButton).toBeDisabled();

        await user.clear(confirmInput);
        await user.type(confirmInput, 'DELETE');
        expect(deleteButton).toBeEnabled();
    });
});
