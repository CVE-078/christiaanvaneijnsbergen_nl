import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModalGroupHeader, ModalIconBadge } from '../ModalList';

describe('ModalGroupHeader', () => {
    it('renders the label uppercase with an optional count', () => {
        render(<ModalGroupHeader label="June 2026" count="47 milestones" />);
        expect(screen.getByText('June 2026')).toHaveClass('uppercase');
        expect(screen.getByText('47 milestones')).toBeInTheDocument();
    });

    it('omits the count when not provided', () => {
        render(<ModalGroupHeader label="Week 11 · Phase 4" />);
        expect(screen.getByText('Week 11 · Phase 4')).toBeInTheDocument();
        expect(screen.queryByText(/decision/i)).not.toBeInTheDocument();
    });
});

describe('ModalIconBadge', () => {
    it('renders children inside the shared 33px rounded-square badge with the tint class', () => {
        render(
            <ModalIconBadge className="bg-pulse-success/15 text-pulse-success">
                <span data-testid="glyph">↑</span>
            </ModalIconBadge>,
        );
        const glyph = screen.getByTestId('glyph');
        const badge = glyph.parentElement as HTMLElement;
        expect(badge).toHaveClass('h-[33px]', 'w-[33px]', 'rounded-[10px]', 'text-pulse-success');
    });
});
