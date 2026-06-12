import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MilestonesCard from '../MilestonesCard';
import type { Milestone } from '@/lib/pulse/milestones';

function mk(i: number, month = '05'): Milestone {
    return { id: `count:${month}-${i}`, kind: 'session_count', title: `${i} sessions logged`, detail: 'since you started', dateIso: `2026-${month}-${String(i).padStart(2, '0')}T10:00:00Z` };
}

describe('MilestonesCard', () => {
    it('renders nothing when there are no milestones', () => {
        const { container } = render(<MilestonesCard milestones={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
    it('shows up to four rows and a "Show all" button past the cap', () => {
        render(<MilestonesCard milestones={[5, 4, 3, 2, 1].map((i) => mk(i))} />);
        expect(screen.getByText('5 sessions logged')).toBeInTheDocument(); // newest first
        expect(screen.getByRole('button', { name: /show all 5 milestones/i })).toBeInTheDocument();
    });
    it('groups the "Show all" modal by month, newest month first', () => {
        // Two June entries + three May entries, newest-first as computeMilestones provides.
        const milestones = [mk(10, '06'), mk(9, '06'), mk(3, '05'), mk(2, '05'), mk(1, '05')];
        render(<MilestonesCard milestones={milestones} />);
        fireEvent.click(screen.getByRole('button', { name: /show all 5 milestones/i }));
        expect(screen.getByText('June 2026')).toBeInTheDocument();
        expect(screen.getByText('May 2026')).toBeInTheDocument();
        // Per-month counts in the group headers.
        expect(screen.getByText('2 milestones')).toBeInTheDocument();
        expect(screen.getByText('3 milestones')).toBeInTheDocument();
    });
});
