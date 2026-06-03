import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabButton from '../TabButton';

describe('TabButton', () => {
    it('renders with role="tab"', () => {
        render(
            <TabButton id="t" active={false} controls="p" onClick={vi.fn()}>
                Push
            </TabButton>,
        );
        expect(screen.getByRole('tab')).toBeInTheDocument();
    });

    it('sets id and aria-controls', () => {
        render(
            <TabButton id="tab-push" active={false} controls="panel-push" onClick={vi.fn()}>
                Push
            </TabButton>,
        );
        const btn = screen.getByRole('tab');
        expect(btn).toHaveAttribute('id', 'tab-push');
        expect(btn).toHaveAttribute('aria-controls', 'panel-push');
    });

    it('aria-selected="true" when active', () => {
        render(
            <TabButton id="t" active={true} controls="p" onClick={vi.fn()}>
                Push
            </TabButton>,
        );
        expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'true');
    });

    it('aria-selected="false" when inactive', () => {
        render(
            <TabButton id="t" active={false} controls="p" onClick={vi.fn()}>
                Push
            </TabButton>,
        );
        expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onClick when clicked', async () => {
        const handleClick = vi.fn();
        render(
            <TabButton id="t" active={false} controls="p" onClick={handleClick}>
                Push
            </TabButton>,
        );
        await userEvent.click(screen.getByRole('tab'));
        expect(handleClick).toHaveBeenCalledOnce();
    });

    it('renders badge text when badge prop is provided', () => {
        render(
            <TabButton id="t" active={true} controls="p" onClick={vi.fn()} badge="2/3">
                Push
            </TabButton>,
        );
        expect(screen.getByRole('tab')).toHaveTextContent('2/3');
    });

    it('does not render badge when badge prop is absent', () => {
        render(
            <TabButton id="t" active={false} controls="p" onClick={vi.fn()}>
                Push
            </TabButton>,
        );
        expect(screen.getByRole('tab').textContent).toBe('Push');
    });

    it('forwards onKeyDown to the button element', async () => {
        const handleKeyDown = vi.fn();
        render(
            <TabButton id="t" active={true} controls="p" onClick={vi.fn()} onKeyDown={handleKeyDown}>
                Push
            </TabButton>,
        );
        screen.getByRole('tab').focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(handleKeyDown).toHaveBeenCalled();
    });

    it('merges extra className onto the button', () => {
        render(
            <TabButton id="t" active={false} controls="p" onClick={vi.fn()} className="rounded-full">
                Push
            </TabButton>,
        );
        expect(screen.getByRole('tab').className).toContain('rounded-full');
    });
});
