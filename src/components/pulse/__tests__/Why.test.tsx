import { describe, it, expect, vi, beforeEach } from 'vitest';

// Drive the responsive branch through the useMediaQuery seam (jsdom has no
// matchMedia, so the hook would otherwise always return mobile). The holder is
// `mock`-prefixed so vitest allows it inside the hoisted vi.mock factory.
const mockMedia = { isDesktop: false };
vi.mock('@/hooks/pulse/useMediaQuery', () => ({
    useMediaQuery: () => mockMedia.isDesktop,
}));

import { render, screen, fireEvent, within } from '@testing-library/react';
import Why from '../Why';

beforeEach(() => {
    mockMedia.isDesktop = false; // default: mobile
});

describe('Why affordance', () => {
    it('renders its children and labels the trigger with the concept title', () => {
        render(
            <Why concept="e1rm" variant="glossary">
                e1RM
            </Why>,
        );
        const trigger = screen.getByRole('button', { name: 'What is e1RM' });
        expect(within(trigger).getByText('e1RM')).toBeInTheDocument();
    });

    it('gives the glossary variant a dotted underline and no info glyph', () => {
        render(
            <Why concept="e1rm" variant="glossary">
                e1RM
            </Why>,
        );
        const trigger = screen.getByRole('button', { name: 'What is e1RM' });
        expect(trigger.className).toMatch(/decoration-dotted/);
        expect(trigger.querySelector('svg')).toBeNull();
    });

    it('gives the why variant a trailing info glyph (no underline)', () => {
        render(
            <Why concept="deload" variant="why">
                <span>50 kg</span>
            </Why>,
        );
        const trigger = screen.getByRole('button', { name: 'Why this deload' });
        expect(trigger.querySelector('svg')).not.toBeNull();
        expect(trigger.className).not.toMatch(/decoration-dotted/);
    });

    it('opens the why (and next) on tap; mobile renders a modal sheet', () => {
        render(
            <Why concept="deload" variant="why">
                <span>50 kg</span>
            </Why>,
        );
        // Closed: no dialog yet.
        expect(screen.queryByRole('dialog')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Why this deload' }));

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true'); // ModalSheet, the mobile branch
        expect(screen.getByText('No e1RM gain in 3 weeks, so the lift stalled.')).toBeInTheDocument();
        expect(
            screen.getByText('Lighter targets this week to break the plateau, then build back up.'),
        ).toBeInTheDocument();
    });

    it('desktop renders a non-modal popover dialog labelled by the title', () => {
        mockMedia.isDesktop = true; // desktop
        render(
            <Why concept="e1rm" variant="glossary">
                e1RM
            </Why>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'What is e1RM' }));

        const dialog = screen.getByRole('dialog', { name: 'What is e1RM' });
        expect(dialog).not.toHaveAttribute('aria-modal', 'true'); // popover, not a modal
        expect(
            screen.getByText('Estimated one-rep max: the most you could lift once, calculated from your sets.'),
        ).toBeInTheDocument();
    });

    it('closes on a second tap of the trigger', () => {
        render(
            <Why concept="e1rm" variant="glossary">
                e1RM
            </Why>,
        );
        const trigger = screen.getByRole('button', { name: 'What is e1RM' });
        fireEvent.click(trigger);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        fireEvent.click(trigger);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes on Escape', () => {
        render(
            <Why concept="e1rm" variant="glossary">
                e1RM
            </Why>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'What is e1RM' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes on a backdrop click in the desktop popover', () => {
        mockMedia.isDesktop = true; // desktop
        render(
            <Why concept="e1rm" variant="glossary">
                e1RM
            </Why>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'What is e1RM' }));
        const dialog = screen.getByRole('dialog', { name: 'What is e1RM' });
        const backdrop = dialog.parentElement as HTMLElement;
        fireEvent.click(backdrop);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('moves focus into the popover on open and returns it to the trigger on close (desktop)', () => {
        mockMedia.isDesktop = true; // desktop
        render(
            <Why concept="e1rm" variant="glossary">
                e1RM
            </Why>,
        );
        const trigger = screen.getByRole('button', { name: 'What is e1RM' });
        fireEvent.click(trigger);
        const dialog = screen.getByRole('dialog', { name: 'What is e1RM' });
        // Focus is inside the popover (on the dialog or a descendant).
        expect(dialog === document.activeElement || dialog.contains(document.activeElement)).toBe(true);

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(document.activeElement).toBe(trigger);
    });

    it('contains focus to the popover while open (Tab does not escape, desktop)', () => {
        mockMedia.isDesktop = true; // desktop
        render(
            <Why concept="e1rm" variant="glossary">
                e1RM
            </Why>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'What is e1RM' }));
        const dialog = screen.getByRole('dialog', { name: 'What is e1RM' });
        // Tab and Shift+Tab are intercepted and keep focus on the popover, so it
        // never leaks to the page behind a non-modal dialog.
        fireEvent.keyDown(dialog, { key: 'Tab' });
        expect(dialog.contains(document.activeElement)).toBe(true);
        fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('closes from the "Got it" button in the desktop popover and returns focus', () => {
        mockMedia.isDesktop = true; // desktop
        render(
            <Why concept="progression" params={{ isRepAdvance: false }} variant="why">
                <span>47.5 kg</span>
            </Why>,
        );
        const trigger = screen.getByRole('button', { name: 'Why this target' });
        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole('button', { name: /got it/i }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });

    it('defaults to the why variant (info glyph) when variant is omitted', () => {
        render(<Why concept="recovery">Ready</Why>);
        const trigger = screen.getByRole('button', { name: 'Recovery' });
        expect(trigger.querySelector('svg')).not.toBeNull();
        expect(trigger.className).not.toMatch(/decoration-dotted/);
    });
});
