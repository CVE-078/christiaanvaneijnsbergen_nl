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

    describe('target mode', () => {
        it('renders a targeted muscle with 0 sets and shows its "to go"', () => {
            render(<MuscleVolumeBars volume={{}} targets={{ shoulders: [8, 12] }} />);
            const row = screen.getByText('shoulders').closest('li')!;
            expect(within(row).getByText('0')).toBeInTheDocument();
            expect(within(row).getByText('8 to go')).toBeInTheDocument();
            expect(within(row).getByTestId('muscle-bar').style.width).toBe('0%');
        });

        it('shows no "to go" for a muscle meeting its floor', () => {
            render(<MuscleVolumeBars volume={{ chest: 10 }} targets={{ chest: [8, 12] }} />);
            const row = screen.getByText('chest').closest('li')!;
            expect(within(row).queryByText(/to go/)).not.toBeInTheDocument();
        });

        it('names a lagging muscle in the summary line', () => {
            render(
                <MuscleVolumeBars
                    volume={{ shoulders: 0, back: 8 }}
                    targets={{ shoulders: [8, 12], back: [12, 16] }}
                />,
            );
            expect(screen.getByText(/8 to go on shoulders/)).toBeInTheDocument();
            expect(screen.getByText(/4 on back/)).toBeInTheDocument();
        });

        it('shows the on-target summary when nothing is lagging', () => {
            render(<MuscleVolumeBars volume={{ chest: 10 }} targets={{ chest: [8, 12] }} />);
            expect(screen.getByText(/on target across the board/i)).toBeInTheDocument();
        });

        it('renders a recovery chip per row when recovery is provided', () => {
            render(
                <MuscleVolumeBars
                    volume={{ chest: 10, back: 4 }}
                    targets={{ chest: [8, 12], back: [12, 16] }}
                    recovery={{ chest: 'high_fatigue', back: 'under' }}
                />,
            );
            const chestRow = screen.getByText('chest').closest('li')!;
            expect(within(chestRow).getByTestId('recovery-chip')).toHaveTextContent('high fatigue');
            const backRow = screen.getByText('back').closest('li')!;
            expect(within(backRow).getByTestId('recovery-chip')).toHaveTextContent('add volume');
        });

        it('renders no recovery chip when recovery is absent', () => {
            render(<MuscleVolumeBars volume={{ chest: 10 }} targets={{ chest: [8, 12] }} />);
            expect(screen.queryByTestId('recovery-chip')).not.toBeInTheDocument();
        });
    });
});
