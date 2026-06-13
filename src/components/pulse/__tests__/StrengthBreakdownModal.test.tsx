import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StrengthBreakdownModal from '@/components/pulse/StrengthBreakdownModal';
import type { StrengthScore } from '@/lib/pulse/types';

const strength: StrengthScore = {
    score: 62,
    level: 'Intermediate',
    reason: null,
    lifts: [
        { lift: 'bench', label: 'Bench Press', subScore: 55, ratio: 1.3 },
        { lift: 'squat', label: 'Squat', subScore: 70, ratio: 1.8 },
    ],
};

describe('StrengthBreakdownModal', () => {
    it('renders nothing when closed', () => {
        const { container } = render(<StrengthBreakdownModal open={false} strength={strength} onClose={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the level and per-lift rows when open', () => {
        render(<StrengthBreakdownModal open strength={strength} onClose={() => {}} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Intermediate')).toBeInTheDocument();
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Squat')).toBeInTheDocument();
        expect(screen.getByText('55')).toBeInTheDocument();
        expect(screen.getByText('70')).toBeInTheDocument();
    });

    it('calls onClose when the close button is clicked', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');
        const onClose = vi.fn();
        render(<StrengthBreakdownModal open strength={strength} onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(onClose).toHaveBeenCalled();
    });

    it('renders nothing when strength has no lifts but is open', () => {
        const noLifts: StrengthScore = { score: null, level: null, reason: 'No data', lifts: [] };
        render(<StrengthBreakdownModal open strength={noLifts} onClose={() => {}} />);
        // The dialog still appears (shows no-data state).
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('makes the score a tappable why explaining the methodology', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');
        render(<StrengthBreakdownModal open strength={strength} onClose={() => {}} />);
        const why = screen.getByRole('button', { name: /strength score/i });
        expect(why).toHaveTextContent('62');
        await userEvent.click(why);
        expect(screen.getByText(/relative to typical standards for your bodyweight/i)).toBeInTheDocument();
    });

    it('renders a score trend header when a multi-point series is passed', () => {
        render(
            <StrengthBreakdownModal
                open
                strength={strength}
                series={[
                    { week: 1, score: 40 },
                    { week: 4, score: 46 },
                ]}
                onClose={() => {}}
            />,
        );
        expect(screen.getByText(/score trend/i)).toBeInTheDocument();
    });
});
