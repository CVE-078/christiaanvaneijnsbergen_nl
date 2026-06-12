import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MilestonesCard from '../MilestonesCard';
import type { Milestone } from '@/lib/pulse/milestones';

function mk(i: number): Milestone {
    return { id: `count:${i}`, kind: 'session_count', title: `${i} sessions logged`, detail: 'since you started', dateIso: `2026-05-${String(i).padStart(2, '0')}T10:00:00Z` };
}

describe('MilestonesCard', () => {
    it('renders nothing when there are no milestones', () => {
        const { container } = render(<MilestonesCard milestones={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
    it('shows up to four rows and a "Show all" button past the cap', () => {
        render(<MilestonesCard milestones={[5, 4, 3, 2, 1].map(mk)} />);
        expect(screen.getByText('5 sessions logged')).toBeInTheDocument(); // newest first
        expect(screen.getByRole('button', { name: /show all 5 milestones/i })).toBeInTheDocument();
    });
});
