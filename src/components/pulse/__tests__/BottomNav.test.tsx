import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomNav from '../BottomNav';

describe('BottomNav', () => {
    it('renders all five nav labels', () => {
        render(<BottomNav view="train" onNavigate={vi.fn()} />);
        expect(screen.getByText('Train')).toBeInTheDocument();
        expect(screen.getByText('Plan')).toBeInTheDocument();
        expect(screen.getByText('Progress')).toBeInTheDocument();
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Explore')).toBeInTheDocument();
    });

    it('calls onNavigate with the correct view when a tab is clicked', async () => {
        const onNavigate = vi.fn();
        render(<BottomNav view="train" onNavigate={onNavigate} />);
        await userEvent.click(screen.getByRole('button', { name: /progress/i }));
        expect(onNavigate).toHaveBeenCalledWith('progress');
    });

    it('marks the active tab with aria-current="page"', () => {
        render(<BottomNav view="profile" onNavigate={vi.fn()} />);
        expect(screen.getByRole('button', { name: /profile/i })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('button', { name: /^train$/i })).not.toHaveAttribute('aria-current', 'page');
    });
});
