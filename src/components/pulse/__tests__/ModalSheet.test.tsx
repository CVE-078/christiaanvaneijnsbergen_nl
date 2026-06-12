import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalSheet from '../ModalSheet';

describe('ModalSheet', () => {
    it('renders nothing when closed', () => {
        const { container } = render(
            <ModalSheet open={false} title="Hidden" onClose={() => {}}>
                <p>body</p>
            </ModalSheet>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders title, subtitle, and body when open', () => {
        render(
            <ModalSheet open title="Body weight" subtitle="24 entries" onClose={() => {}}>
                <p>body content</p>
            </ModalSheet>,
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Body weight')).toBeInTheDocument();
        expect(screen.getByText('24 entries')).toBeInTheDocument();
        expect(screen.getByText('body content')).toBeInTheDocument();
    });

    it('calls onClose when the close button is clicked', async () => {
        const onClose = vi.fn();
        render(
            <ModalSheet open title="x" onClose={onClose}>
                <p>body</p>
            </ModalSheet>,
        );
        await userEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('hides the back button by default and shows it when onBack is given', async () => {
        const onBack = vi.fn();
        const { rerender } = render(
            <ModalSheet open title="x" onClose={() => {}}>
                <p>body</p>
            </ModalSheet>,
        );
        expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();

        rerender(
            <ModalSheet open title="x" onClose={() => {}} onBack={onBack}>
                <p>body</p>
            </ModalSheet>,
        );
        await userEvent.click(screen.getByRole('button', { name: /back/i }));
        expect(onBack).toHaveBeenCalledTimes(1);
    });
});
