import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/app/pulse/actions/account', () => ({
    updatePassword: vi.fn(),
}));

import ResetPasswordForm from '../ResetPasswordForm';

describe('ResetPasswordForm', () => {
    it('renders the new-password fields and the update button', () => {
        render(<ResetPasswordForm />);
        expect(screen.getByRole('heading', { name: /set a new password/i })).toBeInTheDocument();
        expect(screen.getByLabelText('New password')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
    });
});
