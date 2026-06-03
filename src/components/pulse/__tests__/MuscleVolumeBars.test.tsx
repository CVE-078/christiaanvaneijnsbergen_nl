import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import MuscleVolumeBars from '../MuscleVolumeBars';

describe('MuscleVolumeBars', () => {
    it('renders one row per category with its set count', () => {
        render(<MuscleVolumeBars volume={{ chest: 2, back: 1 }} />);
        const rows = screen.getAllByRole('listitem');
        expect(rows).toHaveLength(2);
        expect(screen.getByText('chest')).toBeInTheDocument();
        expect(screen.getByText('back')).toBeInTheDocument();
        const chestRow = screen.getByText('chest').closest('li')!;
        expect(within(chestRow).getByText('2')).toBeInTheDocument();
        const backRow = screen.getByText('back').closest('li')!;
        expect(within(backRow).getByText('1')).toBeInTheDocument();
    });

    it('sorts rows by volume descending', () => {
        render(<MuscleVolumeBars volume={{ back: 1, chest: 3, legs: 2 }} />);
        const labels = screen.getAllByRole('listitem').map((li) => within(li).getByTestId('muscle-label').textContent);
        expect(labels).toEqual(['chest', 'legs', 'back']);
    });

    it('sizes each bar proportional to the max volume', () => {
        render(<MuscleVolumeBars volume={{ chest: 4, back: 1 }} />);
        const chestRow = screen.getByText('chest').closest('li')!;
        const backRow = screen.getByText('back').closest('li')!;
        const chestBar = within(chestRow).getByTestId('muscle-bar') as HTMLElement;
        const backBar = within(backRow).getByTestId('muscle-bar') as HTMLElement;
        expect(chestBar.style.width).toBe('100%');
        expect(backBar.style.width).toBe('25%');
    });

    it('renders an empty state when there is no volume', () => {
        render(<MuscleVolumeBars volume={{}} />);
        expect(screen.queryAllByRole('listitem')).toHaveLength(0);
        expect(screen.getByText(/no sets/i)).toBeInTheDocument();
    });
});
