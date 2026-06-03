import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PageSkeleton, { ErrorState } from '../PageSkeleton';

describe('PageSkeleton', () => {
    it('renders an aria-busy container', () => {
        const { container } = render(<PageSkeleton rows={3} />);
        expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    });

    it('ErrorState calls onRetry', async () => {
        const onRetry = vi.fn();
        render(<ErrorState onRetry={onRetry} />);
        await userEvent.click(screen.getByRole('button', { name: /retry/i }));
        expect(onRetry).toHaveBeenCalledOnce();
    });
});
