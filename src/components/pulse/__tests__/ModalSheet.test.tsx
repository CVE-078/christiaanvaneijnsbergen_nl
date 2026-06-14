import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    it('locks body scroll while open and restores it on close', () => {
        document.body.style.overflow = 'scroll';
        const { rerender } = render(
            <ModalSheet open title="x" onClose={() => {}}>
                <p>body</p>
            </ModalSheet>,
        );
        expect(document.body.style.overflow).toBe('hidden');
        rerender(
            <ModalSheet open={false} title="x" onClose={() => {}}>
                <p>body</p>
            </ModalSheet>,
        );
        expect(document.body.style.overflow).toBe('scroll');
    });

    it('dismisses on a downward swipe of the grip past the threshold', () => {
        const onClose = vi.fn();
        render(
            <ModalSheet open title="x" onClose={onClose}>
                <p>body</p>
            </ModalSheet>,
        );
        const grip = screen.getByTestId('modal-grip');
        fireEvent.touchStart(grip, { touches: [{ clientY: 0 }] });
        fireEvent.touchMove(grip, { touches: [{ clientY: 160 }] });
        fireEvent.touchEnd(grip, {});
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not dismiss on a small grip drag', () => {
        const onClose = vi.fn();
        render(
            <ModalSheet open title="x" onClose={onClose}>
                <p>body</p>
            </ModalSheet>,
        );
        const grip = screen.getByTestId('modal-grip');
        fireEvent.touchStart(grip, { touches: [{ clientY: 0 }] });
        fireEvent.touchMove(grip, { touches: [{ clientY: 25 }] });
        fireEvent.touchEnd(grip, {});
        expect(onClose).not.toHaveBeenCalled();
    });

    it('dismisses on a downward mouse drag of the grip past the threshold', () => {
        const onClose = vi.fn();
        render(
            <ModalSheet open title="x" onClose={onClose}>
                <p>body</p>
            </ModalSheet>,
        );
        const grip = screen.getByTestId('modal-grip');
        // Move/up dispatch on window (the handlers attach there during the drag).
        fireEvent.mouseDown(grip, { clientY: 0 });
        fireEvent.mouseMove(window, { clientY: 160 });
        fireEvent.mouseUp(window);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not dismiss on a small mouse drag of the grip', () => {
        const onClose = vi.fn();
        render(
            <ModalSheet open title="x" onClose={onClose}>
                <p>body</p>
            </ModalSheet>,
        );
        const grip = screen.getByTestId('modal-grip');
        fireEvent.mouseDown(grip, { clientY: 0 });
        fireEvent.mouseMove(window, { clientY: 25 });
        fireEvent.mouseUp(window);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('labels the dialog by its title and hides the grip from assistive tech', () => {
        render(
            <ModalSheet open title="Body weight" onClose={() => {}}>
                <p>body</p>
            </ModalSheet>,
        );
        const dialog = screen.getByRole('dialog');
        const labelledby = dialog.getAttribute('aria-labelledby');
        expect(labelledby).toBeTruthy();
        expect(document.getElementById(labelledby as string)?.textContent).toBe('Body weight');
        expect(dialog).not.toHaveAttribute('aria-label');
        expect(screen.getByTestId('modal-grip')).toHaveAttribute('aria-hidden');
    });

    it('prefers an explicit ariaLabel over the title label', () => {
        render(
            <ModalSheet open title="x" ariaLabel="Custom label" onClose={() => {}}>
                <p>body</p>
            </ModalSheet>,
        );
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-label', 'Custom label');
        expect(dialog).not.toHaveAttribute('aria-labelledby');
    });

    it('renders a footer region when provided', () => {
        render(
            <ModalSheet open title="x" onClose={() => {}} footer={<button>Apply</button>}>
                <p>body</p>
            </ModalSheet>,
        );
        expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    });

    it('does not render a footer region when none is given', () => {
        render(
            <ModalSheet open title="x" onClose={() => {}}>
                <p>body</p>
            </ModalSheet>,
        );
        // Only the close button exists; no extra footer actions.
        expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('applies a custom max width to the panel', () => {
        render(
            <ModalSheet open title="x" onClose={() => {}} maxWidth={720}>
                <p>body</p>
            </ModalSheet>,
        );
        const panel = screen.getByText('body').closest('[style]') as HTMLElement;
        expect(panel.style.maxWidth).toBe('720px');
    });

    it('moves focus into the dialog on open and restores it on close', () => {
        const trigger = document.createElement('button');
        trigger.textContent = 'open';
        document.body.appendChild(trigger);
        trigger.focus();
        expect(document.activeElement).toBe(trigger);

        const { rerender } = render(
            <ModalSheet open title="x" onClose={() => {}}>
                <p>body</p>
            </ModalSheet>,
        );
        // Focus left the trigger and landed inside the dialog.
        expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

        rerender(
            <ModalSheet open={false} title="x" onClose={() => {}}>
                <p>body</p>
            </ModalSheet>,
        );
        expect(document.activeElement).toBe(trigger);
        trigger.remove();
    });
});
