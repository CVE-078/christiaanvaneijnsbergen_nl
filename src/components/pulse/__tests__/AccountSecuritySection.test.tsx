import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/app/pulse/actions/account', () => ({
    updatePassword: vi.fn(),
    deleteAccount: vi.fn(),
}));

import AccountSecuritySection from '../AccountSecuritySection';

describe('AccountSecuritySection', () => {
    it('renders the change-password and delete rows collapsed by default', () => {
        render(<AccountSecuritySection />);
        expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
        // Forms not visible until expanded
        expect(screen.queryByRole('button', { name: /update password/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /delete my account/i })).toBeNull();
    });

    it('expands the change-password form when the row is clicked', async () => {
        const user = userEvent.setup();
        render(<AccountSecuritySection />);
        await user.click(screen.getByRole('button', { name: /change password/i }));
        expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
        // Delete form stays hidden
        expect(screen.queryByRole('button', { name: /delete my account/i })).toBeNull();
    });

    it('collapses the change-password form when the row is clicked again', async () => {
        const user = userEvent.setup();
        render(<AccountSecuritySection />);
        await user.click(screen.getByRole('button', { name: /change password/i }));
        await user.click(screen.getByRole('button', { name: /change password/i }));
        expect(screen.queryByRole('button', { name: /update password/i })).toBeNull();
    });

    it('expands the delete form when the delete row is clicked', async () => {
        const user = userEvent.setup();
        render(<AccountSecuritySection />);
        await user.click(screen.getByRole('button', { name: /delete account/i }));
        expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument();
        // Password form stays hidden
        expect(screen.queryByRole('button', { name: /update password/i })).toBeNull();
    });

    it('gates the delete button behind typing the confirm word', async () => {
        const user = userEvent.setup();
        render(<AccountSecuritySection />);
        await user.click(screen.getByRole('button', { name: /delete account/i }));

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
