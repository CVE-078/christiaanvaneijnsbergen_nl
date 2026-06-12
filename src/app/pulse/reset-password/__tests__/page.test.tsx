import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Mock } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('@/app/pulse/actions/account', () => ({ updatePassword: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import ResetPasswordPage from '../page';

function mockUser(user: { id: string } | null) {
    (createClient as Mock).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    });
}

describe('ResetPasswordPage', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows the form when a recovery session exists', async () => {
        mockUser({ id: 'u1' });
        render(await ResetPasswordPage());
        expect(screen.getByLabelText('New password')).toBeInTheDocument();
        expect(screen.queryByText(/link expired/i)).not.toBeInTheDocument();
    });

    it('shows the expired message and no form when there is no session', async () => {
        mockUser(null);
        render(await ResetPasswordPage());
        expect(screen.getByRole('heading', { name: /link expired/i })).toBeInTheDocument();
        expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    });
});
