import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomNav from '../BottomNav';

describe('BottomNav', () => {
    it('renders all five nav labels', () => {
        render(<BottomNav view="log" onNavigate={vi.fn()} />);
        expect(screen.getByText('Log')).toBeInTheDocument();
        expect(screen.getByText('Program')).toBeInTheDocument();
        expect(screen.getByText('History')).toBeInTheDocument();
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Library')).toBeInTheDocument();
    });

    it('calls onNavigate with the correct view when a tab is clicked', async () => {
        const onNavigate = vi.fn();
        render(<BottomNav view="log" onNavigate={onNavigate} />);
        await userEvent.click(screen.getByRole('button', { name: /history/i }));
        expect(onNavigate).toHaveBeenCalledWith('history');
    });

    it('marks the active tab with aria-current="page"', () => {
        render(<BottomNav view="profile" onNavigate={vi.fn()} />);
        expect(screen.getByRole('button', { name: /profile/i })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('button', { name: /^log$/i })).not.toHaveAttribute('aria-current', 'page');
    });
});
