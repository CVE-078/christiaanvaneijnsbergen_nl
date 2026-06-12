import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../actions', () => ({
    signup: vi.fn(),
    resendConfirmation: vi.fn(),
}));

import SignupForm from '../SignupForm';

describe('SignupForm', () => {
    it('renders email, password, confirm, the create-account button, and a sign-in link', () => {
        render(<SignupForm />);
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /already have an account/i })).toHaveAttribute('href', '/pulse/login');
    });
});
