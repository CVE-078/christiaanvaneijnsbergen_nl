import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));

import { usePulse } from '@/context/PulseContext';
import CoachActivityTimeline from '@/components/pulse/CoachActivityTimeline';
import type { DecisionEventRow } from '@/lib/pulse/types';

const RE = '22222222-2222-4222-8222-222222222222';

const routines = [
    {
        id: 'r1',
        program_weeks: 12,
        exercises: [{ id: RE, exercise: { name: 'Bench Press' } }],
    },
];

function makeCtx(decisions: DecisionEventRow[]) {
    vi.mocked(usePulse).mockReturnValue({
        decisions,
        routines,
        profile: { unit: 'kg' as const },
        activeRoutine: routines[0],
    } as unknown as ReturnType<typeof usePulse>);
}

function progression(over: Partial<DecisionEventRow> = {}): DecisionEventRow {
    return {
        id: 'p1',
        routine_id: 'r1',
        type: 'progression',
        trigger: 'targets_hit',
        affectedArea: RE,
        week: 3,
        magnitude: { fromKg: 80, toKg: 82.5, fromReps: 8, toReps: 9 },
        confidence: null,
        created_at: '2026-06-01T10:00:00.000Z',
        ...over,
    };
}

beforeEach(() => vi.clearAllMocks());

describe('CoachActivityTimeline', () => {
    it('renders nothing when there are no decisions', () => {
        makeCtx([]);
        const { container } = render(<CoachActivityTimeline />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the most recent decision headlines using decisionCopy', () => {
        makeCtx([progression()]);
        render(<CoachActivityTimeline />);
        expect(screen.getByText('Bench Press progressed')).toBeInTheDocument();
    });

    it('renders at most 4 recent decisions inline', () => {
        const many: DecisionEventRow[] = [1, 2, 3, 4, 5].map((i) => progression({ id: `p${i}`, week: i }));
        makeCtx(many);
        render(<CoachActivityTimeline />);
        // Each item renders the same headline; 4 are visible inline.
        expect(screen.getAllByText('Bench Press progressed')).toHaveLength(4);
    });

    it('shows a "Show all" button only when there are more than 4 decisions', () => {
        const many: DecisionEventRow[] = [1, 2, 3, 4, 5].map((i) => progression({ id: `p${i}`, week: i }));
        makeCtx(many);
        render(<CoachActivityTimeline />);
        expect(screen.getByText(/show all 5 decisions/i)).toBeInTheDocument();
    });
});
