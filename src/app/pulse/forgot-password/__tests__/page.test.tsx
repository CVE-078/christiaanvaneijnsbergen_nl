import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../actions', () => ({
    requestReset: vi.fn(),
}));

import ForgotPasswordPage from '../page';

describe('ForgotPasswordPage', () => {
    it('renders the email form by default', async () => {
        render(await ForgotPasswordPage({ searchParams: Promise.resolve({}) }));
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    });

    it('renders a neutral confirmation once sent, with no email field', async () => {
        render(await ForgotPasswordPage({ searchParams: Promise.resolve({ sent: '1' }) }));
        expect(screen.getByText(/if an account exists for that address/i)).toBeInTheDocument();
        expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    });
});
