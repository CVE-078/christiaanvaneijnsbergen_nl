import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SegmentedTabs from '@/components/pulse/SegmentedTabs';

const TABS = [
    { id: 'you', label: 'You' },
    { id: 'training', label: 'Training' },
];

describe('SegmentedTabs', () => {
    it('renders one tab button per entry', () => {
        render(
            <SegmentedTabs
                tabs={TABS}
                active="you"
                onChange={vi.fn()}
                ariaLabel="Profile sections"
            />,
        );
        expect(screen.getAllByRole('tab')).toHaveLength(2);
        expect(screen.getByRole('tab', { name: 'You' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Training' })).toBeTruthy();
    });

    it('marks the active tab aria-selected=true and others false', () => {
        render(
            <SegmentedTabs
                tabs={TABS}
                active="training"
                onChange={vi.fn()}
                ariaLabel="Profile sections"
            />,
        );
        expect(screen.getByRole('tab', { name: 'Training' })).toHaveAttribute(
            'aria-selected',
            'true',
        );
        expect(screen.getByRole('tab', { name: 'You' })).toHaveAttribute(
            'aria-selected',
            'false',
        );
    });

    it('calls onChange with the tab id when an inactive tab is clicked', async () => {
        const onChange = vi.fn();
        render(
            <SegmentedTabs
                tabs={TABS}
                active="you"
                onChange={onChange}
                ariaLabel="Profile sections"
            />,
        );
        await userEvent.click(screen.getByRole('tab', { name: 'Training' }));
        expect(onChange).toHaveBeenCalledOnce();
        expect(onChange).toHaveBeenCalledWith('training');
    });

    it('renders a tablist with the supplied aria-label', () => {
        render(
            <SegmentedTabs
                tabs={TABS}
                active="you"
                onChange={vi.fn()}
                ariaLabel="Profile sections"
            />,
        );
        expect(screen.getByRole('tablist', { name: 'Profile sections' })).toBeTruthy();
    });

    it('wires id and aria-controls per tab', () => {
        render(
            <SegmentedTabs
                tabs={TABS}
                active="you"
                onChange={vi.fn()}
                ariaLabel="Profile sections"
            />,
        );
        const youTab = screen.getByRole('tab', { name: 'You' });
        expect(youTab).toHaveAttribute('id', 'tab-you');
        expect(youTab).toHaveAttribute('aria-controls', 'panel-you');
    });
});
